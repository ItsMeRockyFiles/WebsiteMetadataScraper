const config = require('../config');

/**
 * Middleware to verify RapidAPI proxy header secret if configured in environment
 */
function rapidApiAuth(req, res, next) {
  if (!config.rapidApiProxySecret) {
    // If no secret configured, allow request (for development or public deployment)
    return next();
  }

  const headerSecret = req.headers['x-rapidapi-proxy-secret'];

  if (!headerSecret || headerSecret !== config.rapidApiProxySecret) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Invalid or missing RapidAPI Proxy Secret header (x-rapidapi-proxy-secret).'
      }
    });
  }

  next();
}

module.exports = rapidApiAuth;
