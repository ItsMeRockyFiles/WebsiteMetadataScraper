const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const config = require('./config');
const apiRateLimiter = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const apiRoutes = require('./routes/apiRoutes');

const app = express();

// Enable Trust Proxy for Render / Vercel deployment
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts/styles for demo UI
}));

// CORS Configuration
app.use(cors());

// Body Parsing Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Frontend (Demo UI & Docs)
app.use(express.static(path.join(__dirname, '../public')));

// Mount API Routes with Rate Limiter
app.use('/api/v1', apiRateLimiter, apiRoutes);

// Root Fallback to Serve Frontend
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'API endpoint not found.' }
    });
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Centralized Error Handling
app.use(errorHandler);

// Start Server if launched directly
if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`===================================================`);
    console.log(` 🚀 Website Metadata Scraper API Running`);
    console.log(` 🌐 Server URL: http://localhost:${config.port}`);
    console.log(` 📡 Scrape API: http://localhost:${config.port}/api/v1/scrape?url=https://github.com`);
    console.log(` 💚 Health Check: http://localhost:${config.port}/api/v1/health`);
    console.log(`===================================================`);
  });
}

module.exports = app;
