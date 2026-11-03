
import mongoose from "mongoose";
import Category from "./category.model.js";
import Product from "../products/product.model.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Generate URL-friendly slug
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
};

// Generate a unique slug
const createUniqueSlug = async (name, excludeId = null) => {
  const baseSlug = generateSlug(name);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const filter = { slug };

    if (excludeId) {
      filter._id = { $ne: excludeId };
    }

    const existing = await Category.findOne(filter).select("_id");

    if (!existing) return slug;

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

// Validate parent category
const validateParent = async (parentId) => {
  if (parentId === null || parentId === undefined) {
    return null;
  }

  if (!mongoose.isValidObjectId(parentId)) {
    throw createError("Invalid parent category ID", 400);
  }

  const parent = await Category.findById(parentId);

  if (!parent) {
    throw createError("Parent category not found", 404);
  }

  if (!parent.isActive) {
    throw createError("Cannot use an inactive parent category", 400);
  }

  return parent;
};

// Prevent circular category relationships
const validateNoCircularReference = async (categoryId, newParentId) => {
  let currentParentId = newParentId;

  while (currentParentId) {
    if (currentParentId.toString() === categoryId.toString()) {
      throw createError("Circular category relationship detected", 400);
    }

    const parent = await Category.findById(currentParentId)
      .select("parent")
      .lean();

    if (!parent) break;

    currentParentId = parent.parent;
  }
};

// 1. Create category
export const createCategory = async (categoryData) => {
  const { name, description, parent } = categoryData;

  await validateParent(parent);

  const slug = await createUniqueSlug(name);

  const category = await Category.create({
    name,
    slug,
    description,
    parent: parent || null,
  });

  return category;
};

// 2. Get all categories
export const getAllCategories = async () => {
  return Category.find()
    .populate("parent", "name slug")
    .sort({ name: 1 })
    .lean();
};

// 3. Get category by ID
export const getCategoryById = async (categoryId) => {
  if (!mongoose.isValidObjectId(categoryId)) {
    throw createError("Invalid category ID", 400);
  }

  const category = await Category.findById(categoryId)
    .populate("parent", "name slug")
    .lean();

  if (!category) {
    throw createError("Category not found", 404);
  }

  return category;
};

// 4. Update category
export const updateCategory = async (categoryId, updateData) => {
  if (!mongoose.isValidObjectId(categoryId)) {
    throw createError("Invalid category ID", 400);
  }

  const category = await Category.findById(categoryId);

  if (!category) {
    throw createError("Category not found", 404);
  }

  if (updateData.name !== undefined) {
    category.name = updateData.name;
    category.slug = await createUniqueSlug(
      updateData.name,
      category._id
    );
  }

  if (updateData.description !== undefined) {
    category.description = updateData.description;
  }

  if (updateData.parent !== undefined) {
    await validateParent(updateData.parent);

    if (updateData.parent) {
      await validateNoCircularReference(
        category._id,
        updateData.parent
      );
    }

    category.parent = updateData.parent || null;
  }

  if (updateData.isActive !== undefined) {
    category.isActive = updateData.isActive;
  }

  await category.save();

  return category;
};

// 5. Delete category safely
export const deleteCategory = async (categoryId) => {
  if (!mongoose.isValidObjectId(categoryId)) {
    throw createError("Invalid category ID", 400);
  }

  const category = await Category.findById(categoryId);

  if (!category) {
    throw createError("Category not found", 404);
  }

  // Prevent deletion if subcategories exist
  const hasChildren = await Category.exists({
    parent: category._id,
  });

  if (hasChildren) {
    throw createError(
      "Cannot delete category because it has subcategories",
      400
    );
  }

  // Prevent deletion if products are assigned to this category
  const hasProducts = await Product.exists({
    category: category._id,
  });

  if (hasProducts) {
    throw createError(
      "Cannot delete category because products are assigned to it",
      400
    );
  }

  await category.deleteOne();

  return { id: categoryId };
};

// 6. Get category tree
export const getCategoryTree = async () => {
  const categories = await Category.find({ isActive: true })
    .sort({ name: 1 })
    .lean();

  const categoryMap = new Map();

  categories.forEach((category) => {
    category.children = [];
    categoryMap.set(category._id.toString(), category);
  });

  const tree = [];

  categories.forEach((category) => {
    if (category.parent) {
      const parent = categoryMap.get(category.parent.toString());

      if (parent) {
        parent.children.push(category);
      } else {
        tree.push(category);
      }
    } else {
      tree.push(category);
    }
  });

  return tree;
};
