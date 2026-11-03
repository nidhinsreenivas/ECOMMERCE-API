import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getCategoryTree
} from "./category.service.js";

// Create category
export const addCategory = async (req, res, next) => {
  try {
    const category = await createCategory(req.body);

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category
    });
  } catch (error) {
    next(error);
  }
};

// Get all categories
export const listCategories = async (req, res, next) => {
  try {
    const categories = await getAllCategories();

    return res.status(200).json({
      success: true,
      message: "Categories retrieved successfully",
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

// Get category by ID
export const getCategoryDetails = async (req, res, next) => {
  try {
    const category = await getCategoryById(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Category retrieved successfully",
      data: category
    });
  } catch (error) {
    next(error);
  }
};

// Update category
export const editCategory = async (req, res, next) => {
  try {
    const category = await updateCategory(
      req.params.id,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category
    });
  } catch (error) {
    next(error);
  }
};

// Delete category
export const removeCategory = async (req, res, next) => {
  try {
    await deleteCategory(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};

export const listCategoryTree = async (req, res, next) => {
  try {
    const categories = await getCategoryTree();

    return res.status(200).json({
      success: true,
      message: "Category tree retrieved successfully",
      data: categories
    });
  } catch (error) {
    next(error);
  }
};