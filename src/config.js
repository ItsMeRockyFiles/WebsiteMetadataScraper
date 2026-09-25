require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX || '60', 10), // 60 req/min
  rapidApiProxySecret: process.env.RAPIDAPI_PROXY_SECRET || null,
  timeoutMs: parseInt(process.env.DEFAULT_TIMEOUT_MS || '10000', 10)
};
