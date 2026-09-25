const rateLimit = require('express-rate-limit');
const config = require('../config');

const apiRateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: `Too many requests from this IP. Please try again after ${Math.ceil(config.rateLimitWindowMs / 1000)} seconds.`
    }
  }
});

module.exports = apiRateLimiter;
