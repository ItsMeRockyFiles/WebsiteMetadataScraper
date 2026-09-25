/**
 * Global Error Handler Middleware
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || getErrorCode(statusCode);

  const errorResponse = {
    success: false,
    error: {
      code: code,
      message: message
    }
  };

  if (err.targetUrl) {
    errorResponse.error.targetUrl = err.targetUrl;
  }

  res.status(statusCode).json(errorResponse);
}

function getErrorCode(status) {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 422: return 'UNPROCESSABLE_ENTITY';
    case 429: return 'TOO_MANY_REQUESTS';
    case 502: return 'TARGET_FETCH_ERROR';
    case 504: return 'FETCH_TIMEOUT';
    default: return 'INTERNAL_SERVER_ERROR';
  }
}

module.exports = errorHandler;
