import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: 2,
      maxlength: 150
    },

    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      uppercase: true,
      trim: true
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },

    price: {
      type: Number,
      required: true,
      min: 0
    },
    salePrice: {
      type: Number,
      min: 0,
      default: null,
      validate: {
        validator: function (value) {
          return value === null || value < this.price;
        },
        message: "Sale price must be lower than regular price",
      },
    },

    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Stock must be a whole number"
      }
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Product category is required"]
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Product search and filtering indexes
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ price: 1 });
productSchema.index({ name: "text", description: "text" });
productSchema.index({ createdAt: -1 });

const Product = mongoose.model("Product", productSchema);

export default Product;