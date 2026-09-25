/**
 * Global Error Handler Middleware
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: {
      code: getErrorCode(statusCode),
      message: message
    }
  });
}

function getErrorCode(status) {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 422: return 'UNPROCESSABLE_ENTITY';
    case 429: return 'TOO_MANY_REQUESTS';
    case 502: return 'BAD_GATEWAY';
    case 504: return 'GATEWAY_TIMEOUT';
    default: return 'INTERNAL_SERVER_ERROR';
  }
}

module.exports = errorHandler;
