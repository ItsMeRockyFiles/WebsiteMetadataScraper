// api/v1/scrape.js
// Vercel serverless function wrapper with Upstash Redis caching support.
// Reuses the same scraper logic as the Express server.

const { scrapeMetadata } = require('../../src/services/scraperService');
const { Redis } = require('@upstash/redis');

// Initialize Redis if Upstash credentials exist in environment
let redis = null;
if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
  try {
    redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  } catch (err) {
    console.warn('Upstash Redis initialization warning:', err.message);
  }
}

const CACHE_TTL_SECONDS = 600; // 10 minutes

module.exports = async (req, res) => {
  const { url, extended, userAgent, timeout, nocache } = req.query || {};

  if (!url) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_URL',
        message: 'Missing required query parameter: url.'
      }
    });
  }

  const cacheKey = `scrape:${url}:${extended || 'false'}`;
  const skipCache = nocache === 'true' || nocache === '1';

  try {
    // 1. Check Redis cache (if configured and caller hasn't bypassed)
    if (redis && !skipCache) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const parsedCache = typeof cached === 'string' ? JSON.parse(cached) : cached;
          return res.status(200).json({
            ...parsedCache,
            cached: true
          });
        }
      } catch (cacheErr) {
        console.warn('Redis cache read error (continuing without cache):', cacheErr.message);
      }
    }

    // 2. Cache miss — run the real scraper
    const data = await scrapeMetadata(url, {
      extended: extended === 'true' || extended === '1',
      customUserAgent: userAgent,
      timeout: timeout ? parseInt(timeout, 10) : undefined
    });

    // 3. Store result in Redis cache for next time
    if (redis && !skipCache) {
      try {
        await redis.set(cacheKey, JSON.stringify(data), { ex: CACHE_TTL_SECONDS });
      } catch (cacheWriteErr) {
        console.warn('Redis cache write error:', cacheWriteErr.message);
      }
    }

    return res.status(200).json({
      ...data,
      cached: false
    });

  } catch (err) {
    console.error('Scrape error:', err);
    const status = err.statusCode || 500;
    const code = err.code || 'INTERNAL_ERROR';
    const message = err.message || 'An unexpected error occurred.';
    return res.status(status).json({
      success: false,
      error: { code, message }
    });
  }
};
