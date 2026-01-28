export function notFound(req, res) {
  res.status(404).json({ error: "Not Found", path: req.originalUrl });
}

export function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  if (err.name === "SequelizeValidationError") {
    return res.status(400).json({
      error: "ValidationError",
      message: "Invalid payload",
      details: err.errors.reduce((acc, e) => {
        acc[e.path] = e.message;
        return acc;
      }, {}),
    });
  }

  if (err.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({
      error: "Conflict",
      message: "Unique constraint violation",
      details: err.errors.reduce((acc, e) => {
        acc[e.path] = e.message;
        return acc;
      }, {}),
    });
  }

  res.status(status).json({ error: "Error", message });
}
