// Central error handler — always returns JSON
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Internal Server Error';

  // MySQL duplicate entry
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message    = 'A record with that value already exists';
  }

  // MySQL foreign key fail
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    statusCode = 400;
    message    = 'Referenced record does not exist';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message    = 'Invalid token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message    = 'Token expired';
  }

  if (process.env.NODE_ENV === 'development') {
    console.error(`[ERROR] ${statusCode} — ${message}`, err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// Async wrapper — eliminates try/catch boilerplate in controllers
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { errorHandler, asyncHandler };
