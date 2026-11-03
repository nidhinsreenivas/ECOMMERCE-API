
import mongoose from "mongoose";
import Order from "./order.model.js";
import Product from "../products/product.model.js";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// 1. Create order
export const createOrder = async (customerId, orderData) => {
  const session = await mongoose.startSession();

  try {
    let createdOrder;

    await session.withTransaction(async () => {
      // Combine duplicate product entries
      const quantityMap = new Map();

      for (const item of orderData.items) {
        const productId = item.product.toString();
        const currentQuantity = quantityMap.get(productId) || 0;

        quantityMap.set(productId, currentQuantity + item.quantity);
      }

      // Load and validate products
      const productIds = [...quantityMap.keys()];

      const products = await Product.find({
        _id: { $in: productIds },
        isActive: true,
      }).session(session);

      if (products.length !== productIds.length) {
        throw createError(
          "One or more products were not found or are inactive",
          404
        );
      }

      const productMap = new Map(
        products.map((product) => [
          product._id.toString(),
          product,
        ])
      );

      // Calculate prices using database values
      const orderItems = [];
      let totalAmount = 0;

      for (const [productId, quantity] of quantityMap.entries()) {
        const product = productMap.get(productId);

        if (product.stock < quantity) {
          throw createError(
            `Insufficient stock for ${product.name}. Available stock: ${product.stock}`,
            409
          );
        }

        const sellingPrice =
          product.salePrice !== null &&
          product.salePrice !== undefined
            ? product.salePrice
            : product.price;

        const subtotal = sellingPrice * quantity;

        orderItems.push({
          product: product._id,
          productName: product.name,
          sku: product.sku,
          unitPrice: sellingPrice,
          quantity,
          subtotal,
        });

        totalAmount += subtotal;
      }

      // Reduce stock atomically
      for (const item of orderItems) {
        const stockUpdate = await Product.updateOne(
          {
            _id: item.product,
            isActive: true,
            stock: { $gte: item.quantity },
          },
          {
            $inc: { stock: -item.quantity },
          },
          { session }
        );

        if (stockUpdate.modifiedCount !== 1) {
          throw createError(
            `Stock changed or is insufficient for ${item.productName}. Please try again.`,
            409
          );
        }
      }

      // Create order
      const [order] = await Order.create(
        [
          {
            customer: customerId,
            items: orderItems,
            totalAmount,
            shippingAddress: orderData.shippingAddress,
          },
        ],
        { session }
      );

      createdOrder = order;
    });

    return createdOrder;
  } finally {
    await session.endSession();
  }
};

// 2. Shared order listing with pagination and filters
const getOrders = async ({
  customerId,
  status,
  search,
  sort = "newest",
  page = 1,
  limit = 10,
}) => {
  const allowedStatuses = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ];

  const sortOptions = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    amount_asc: { totalAmount: 1 },
    amount_desc: { totalAmount: -1 },
  };

  // Validate status
  if (status && !allowedStatuses.includes(status)) {
    throw createError("Invalid order status filter", 400);
  }

  // Validate sorting
  if (!sortOptions[sort]) {
    throw createError("Invalid sort option", 400);
  }

  // Validate pagination
  const currentPage = Number(page);
  const pageSize = Number(limit);

  if (
    !Number.isInteger(currentPage) ||
    currentPage < 1
  ) {
    throw createError("Page must be a positive integer", 400);
  }

  if (
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  ) {
    throw createError("Limit must be between 1 and 100", 400);
  }

  const filter = {};

  // Customer can only access their own orders
  if (customerId) {
    filter.customer = customerId;
  }

  // Filter by status
  if (status) {
    filter.status = status;
  }

  // Search by exact order ID
  if (search) {
    if (!mongoose.isValidObjectId(search)) {
      throw createError(
        "Search must be a valid 24-character order ID",
        400
      );
    }

    filter._id = new mongoose.Types.ObjectId(search);
  }

  const skip = (currentPage - 1) * pageSize;

  const [orders, totalOrders] = await Promise.all([
    Order.find(filter)
      .populate("customer", "name email")
      .populate("items.product", "name sku")
      .sort(sortOptions[sort])
      .skip(skip)
      .limit(pageSize)
      .lean(),

    Order.countDocuments(filter),
  ]);

  return {
    orders,
    pagination: {
      currentPage,
      pageSize,
      totalOrders,
      totalPages: Math.ceil(totalOrders / pageSize),
      hasNextPage: currentPage * pageSize < totalOrders,
      hasPreviousPage: currentPage > 1,
    },
  };
};

// 3. Customer: get own orders
export const getMyOrders = async (customerId, query = {}) => {
  return getOrders({
    customerId,
    ...query,
  });
};

// 4. Admin: get all orders
export const getAllOrders = async (query = {}) => {
  return getOrders(query);
};

// 5. Customer: get one own order
export const getMyOrderById = async (customerId, orderId) => {
  if (!mongoose.isValidObjectId(orderId)) {
    throw createError("Invalid order ID", 400);
  }

  const order = await Order.findOne({
    _id: orderId,
    customer: customerId,
  })
    .populate("items.product", "name sku")
    .lean();

  if (!order) {
    throw createError("Order not found", 404);
  }

  return order;
};

// 6. Update order status and restore stock on cancellation
export const updateOrderStatus = async (orderId, newStatus) => {
  const session = await mongoose.startSession();

  try {
    let updatedOrder;

    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);

      if (!order) {
        throw createError("Order not found", 404);
      }

      const allowedTransitions = {
        pending: ["confirmed", "cancelled"],
        confirmed: ["processing", "cancelled"],
        processing: ["shipped", "cancelled"],
        shipped: ["delivered"],
        delivered: [],
        cancelled: [],
      };

      if (!allowedTransitions[order.status]?.includes(newStatus)) {
        throw createError(
          `Cannot change order status from ${order.status} to ${newStatus}`,
          400
        );
      }

      // Restore stock only when cancelling
      if (newStatus === "cancelled") {
        for (const item of order.items) {
          const stockUpdate = await Product.updateOne(
            { _id: item.product },
            { $inc: { stock: item.quantity } },
            { session }
          );

          if (stockUpdate.matchedCount !== 1) {
            throw createError(
              `Product not found while restoring stock: ${item.productName}`,
              404
            );
          }
        }
      }

      order.status = newStatus;

      await order.save({ session });

      updatedOrder = order;
    });

    return updatedOrder;
  } finally {
    await session.endSession();
  }
};
