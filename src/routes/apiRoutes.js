const express = require('express');
const router = express.Router();
const { scrapeMetadata } = require('../services/scraperService');
const rapidApiAuth = require('../middleware/rapidApiAuth');

/**
 * @route   GET /api/v1/scrape
 * @desc    Scrape website metadata via query parameters
 * @access  Public (or RapidAPI authenticated)
 */
router.get('/scrape', rapidApiAuth, async (req, res, next) => {
  try {
    const { url, extended, userAgent, timeout } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_URL',
          message: 'Missing required query parameter: url. Example: /api/v1/scrape?url=https://github.com'
        }
      });
    }

    const data = await scrapeMetadata(url, {
      extended: extended === 'true' || extended === '1',
      customUserAgent: userAgent,
      timeout: timeout ? parseInt(timeout, 10) : undefined
    });

    return res.status(200).json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/v1/scrape
 * @desc    Scrape website metadata via JSON body
 * @access  Public (or RapidAPI authenticated)
 */
router.post('/scrape', rapidApiAuth, async (req, res, next) => {
  try {
    const { url, extended, userAgent, timeout } = req.body || {};

    if (!url) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_URL',
          message: 'Missing required body property: url. Example: { "url": "https://github.com" }'
        }
      });
    }

    const data = await scrapeMetadata(url, {
      extended: Boolean(extended),
      customUserAgent: userAgent,
      timeout: timeout ? parseInt(timeout, 10) : undefined
    });

    return res.status(200).json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/v1/health
 * @desc    Health check & status endpoint
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Website Metadata Scraper API',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    memoryUsage: process.memoryUsage()
  });
});

module.exports = router;
