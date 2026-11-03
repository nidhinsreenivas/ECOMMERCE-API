import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      minlength: 2,
      maxlength: 80
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ""
    },

    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null
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

// Indexes for efficient category lookups
categorySchema.index({ parent: 1, isActive: 1 });
categorySchema.index({ name: 1 });

const Category = mongoose.model("Category", categorySchema);

export default Category;