
// Handle undefined routes
export const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;

  next(error);
};

// Centralized error handler
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || "Internal Server Error";
  let errors = undefined;

  // 1. MongoDB duplicate key error
  if (err.code === 11000) {
    statusCode = 409;

    const duplicateField = Object.keys(err.keyValue || {})[0];

    message = duplicateField
      ? `${duplicateField} already exists`
      : "Duplicate value already exists";
  }

  // 2. Mongoose validation error
  else if (err.name === "ValidationError") {
    statusCode = 400;

    errors = Object.values(err.errors).map((item) => ({
      field: item.path,
      message: item.message,
    }));

    message = "Database validation failed";
  }

  // 3. Invalid MongoDB ObjectId
  else if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid value for ${err.path}`;
  }

  // 4. Zod validation error
  else if (err.name === "ZodError") {
    statusCode = 400;

    errors = err.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    message = "Validation failed";
  }

  // 5. JWT errors
  else if (
    err.name === "JsonWebTokenError" ||
    err.name === "TokenExpiredError"
  ) {
    statusCode = 401;
    message = "Invalid or expired authentication token";
  }

  // 6. Malformed JSON request
  else if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    "body" in err
  ) {
    statusCode = 400;
    message = "Invalid JSON request body";
  }

  // Ensure valid HTTP status code
  if (
    !Number.isInteger(statusCode) ||
    statusCode < 400 ||
    statusCode > 599
  ) {
    statusCode = 500;
  }

  // Avoid exposing internal server errors in production
  if (statusCode === 500 && process.env.NODE_ENV === "production") {
    message = "Internal Server Error";
    errors = undefined;
  }

  // Avoid sending a second response
  if (res.headersSent) {
    return next(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),

    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
    }),
  });
};
