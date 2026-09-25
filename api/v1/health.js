// api/v1/health.js
// Vercel serverless function wrapper for health check endpoint.

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).json({
    status: 'ok',
    service: 'Website Metadata Scraper API',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    memoryUsage: process.memoryUsage()
  });
};
