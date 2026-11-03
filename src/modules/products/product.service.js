
import mongoose from "mongoose";
import Product from "./product.model.js";
import Category from "../categories/category.model.js";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Validate category before assigning a product
const validateCategory = async (categoryId) => {
  if (!mongoose.isValidObjectId(categoryId)) {
    throw createError("Invalid category ID", 400);
  }

  const category = await Category.findById(categoryId);

  if (!category) {
    throw createError("Category not found", 404);
  }

  if (!category.isActive) {
    throw createError(
      "Cannot assign product to an inactive category",
      400
    );
  }

  return category;
};

// Validate sale price
const validateSalePrice = (price, salePrice) => {
  if (
    salePrice !== undefined &&
    salePrice !== null &&
    salePrice >= price
  ) {
    throw createError(
      "Sale price must be lower than regular price",
      400
    );
  }
};

// Get effective selling price
const getEffectivePrice = () => ({
  $cond: [
    {
      $and: [
        { $ne: ["$salePrice", null] },
        { $gt: ["$salePrice", 0] }
      ]
    },
    "$salePrice",
    "$price"
  ]
});

// Find category and all descendants
const getCategoryAndDescendantIds = async (categoryId) => {
  const category = await Category.findById(categoryId);

  if (!category || !category.isActive) {
    throw createError("Category not found or inactive", 404);
  }

  const categoryIds = [category._id];
  let currentLevelIds = [category._id];

  while (currentLevelIds.length > 0) {
    const children = await Category.find({
      parent: { $in: currentLevelIds },
      isActive: true
    }).select("_id");

    currentLevelIds = children.map((child) => child._id);
    categoryIds.push(...currentLevelIds);
  }

  return categoryIds;
};

// 1. Create product
export const createProduct = async (productData) => {
  const {
    name,
    sku,
    description,
    price,
    salePrice,
    stock,
    category
  } = productData;

  await validateCategory(category);

  validateSalePrice(price, salePrice);

  const normalizedSku = sku.trim().toUpperCase();

  const existingProduct = await Product.findOne({
    sku: normalizedSku
  });

  if (existingProduct) {
    throw createError("SKU already exists", 409);
  }

  const product = await Product.create({
    name,
    sku: normalizedSku,
    description,
    price,
    salePrice: salePrice ?? null,
    stock,
    category
  });

  return product;
};

// 2. Get all products
export const getAllProducts = async (query = {}) => {
  const {
    search,
    category,
    minPrice,
    maxPrice,
    sort = "newest",
    page = 1,
    limit = 10
  } = query;

  const filter = {
    isActive: true
  };

  // Search by product name, SKU or description
  if (search && search.trim()) {
    filter.$or = [
      { name: { $regex: search.trim(), $options: "i" } },
      { sku: { $regex: search.trim(), $options: "i" } },
      { description: { $regex: search.trim(), $options: "i" } }
    ];
  }

  // Filter by category and descendants
  if (category) {
    if (!mongoose.isValidObjectId(category)) {
      throw createError("Invalid category ID", 400);
    }

    const categoryIds =
      await getCategoryAndDescendantIds(category);

    filter.category = { $in: categoryIds };
  }

  // Filter by effective selling price
  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceConditions = {};

    if (minPrice !== undefined) {
      priceConditions.$gte = Number(minPrice);
    }

    if (maxPrice !== undefined) {
      priceConditions.$lte = Number(maxPrice);
    }

    filter.$expr = {
      $and: Object.entries(priceConditions).map(
        ([operator, value]) => ({
          [operator]: [getEffectivePrice(), value]
        })
      )
    };
  }

  // Sorting
  const sortOptions = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    price_asc: { effectivePrice: 1 },
    price_desc: { effectivePrice: -1 },
    name_asc: { name: 1 },
    name_desc: { name: -1 }
  };

  if (!sortOptions[sort]) {
    throw createError("Invalid sort option", 400);
  }

  // Pagination
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 10));
  const skip = (currentPage - 1) * pageSize;

  // Fetch products and count
  const [products, totalProducts] = await Promise.all([
    Product.aggregate([
      { $match: filter },
      {
        $addFields: {
          effectivePrice: getEffectivePrice()
        }
      },
      { $sort: sortOptions[sort] },
      { $skip: skip },
      { $limit: pageSize },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category"
        }
      },
      {
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          effectivePrice: 0
        }
      }
    ]),

    Product.countDocuments(filter)
  ]);

  return {
    products,
    pagination: {
      currentPage,
      pageSize,
      totalProducts,
      totalPages: Math.ceil(totalProducts / pageSize),
      hasNextPage: currentPage * pageSize < totalProducts,
      hasPreviousPage: currentPage > 1
    }
  };
};

// 3. Get product by ID
export const getProductById = async (productId) => {
  if (!mongoose.isValidObjectId(productId)) {
    throw createError("Invalid product ID", 400);
  }

  const product = await Product.findOne({
    _id: productId,
    isActive: true
  })
    .populate("category", "name slug")
    .lean();

  if (!product) {
    throw createError("Product not found", 404);
  }

  return product;
};

// 4. Update product
export const updateProduct = async (productId, updateData) => {
  if (!mongoose.isValidObjectId(productId)) {
    throw createError("Invalid product ID", 400);
  }

  const product = await Product.findById(productId);

  if (!product) {
    throw createError("Product not found", 404);
  }

  if (updateData.category !== undefined) {
    await validateCategory(updateData.category);
  }

  // Calculate final prices before updating
  const updatedPrice =
    updateData.price !== undefined
      ? updateData.price
      : product.price;

  const updatedSalePrice =
    updateData.salePrice !== undefined
      ? updateData.salePrice
      : product.salePrice;

  validateSalePrice(updatedPrice, updatedSalePrice);

  // Check duplicate SKU
  if (updateData.sku !== undefined) {
    const normalizedSku = updateData.sku.trim().toUpperCase();

    const existingProduct = await Product.findOne({
      sku: normalizedSku,
      _id: { $ne: product._id }
    });

    if (existingProduct) {
      throw createError("SKU already exists", 409);
    }

    product.sku = normalizedSku;
  }

  const allowedFields = [
    "name",
    "description",
    "price",
    "salePrice",
    "stock",
    "category",
    "isActive"
  ];

  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      product[field] = updateData[field];
    }
  });

  await product.save();

  return product;
};

// 5. Delete product
export const deleteProduct = async (productId) => {
  if (!mongoose.isValidObjectId(productId)) {
    throw createError("Invalid product ID", 400);
  }

  const product = await Product.findById(productId);

  if (!product) {
    throw createError("Product not found", 404);
  }

  await product.deleteOne();

  return { id: productId };
};
