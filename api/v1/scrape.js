// api/v1/scrape.js
// Vercel serverless function wrapper.
// Uses ioredis to connect to Redis Cloud over TCP.

const { scrapeMetadata } = require('../../src/services/scraperService');
const Redis = require('ioredis');

// Create Redis client lazily so cold starts without REDIS_URL don't crash.
let redis = null;
function getRedis() {
  if (redis) return redis;
  if (!process.env.REDIS_URL) {
    console.warn('REDIS_URL not set — cache disabled.');
    return null;
  }
  try {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      connectTimeout: 3000,
      lazyConnect: false,
      // Required for serverless: don't keep retrying forever
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
    });
    redis.on('error', (err) => console.error('Redis error:', err.message));
    return redis;
  } catch (err) {
    console.error('Failed to initialize Redis client:', err.message);
    return null;
  }
}

const CACHE_TTL_SECONDS = 600; // 10 minutes

module.exports = async (req, res) => {
  // 🔒 SECURITY CHECK: Verify the request is coming from RapidAPI
  const rapidApiSecret = process.env.RAPIDAPI_PROXY_SECRET;
  if (rapidApiSecret) {
    const incomingSecret = req.headers && req.headers['x-rapidapi-proxy-secret'];
    if (incomingSecret !== rapidApiSecret) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied. This API can only be accessed via RapidAPI.' }
      });
    }
  }

  // Support both GET (query) and POST (body) — RapidAPI customers use both.
  const params = { ...(req.query || {}), ...(req.body || {}) };
  const { url, extended, userAgent, timeout, nocache } = params;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_URL',
        message: 'Missing required query parameter: url.'
      }
    });
  }

  const extendedFlag = extended === 'true' || extended === '1';
  const cacheKey = `scrape:${url}:${extendedFlag}`;
  const skipCache = nocache === 'true' || nocache === '1';
  const client = getRedis();

  try {
    // 1. Check Redis cache (unless caller opted out)
    if (client && !skipCache) {
      try {
        const cached = await client.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (res.set) res.set('Cache-Control', 'public, max-age=600');
          return res.status(200).json({ ...parsed, cached: true });
        }
      } catch (cacheErr) {
        // Cache read failures should never break the API
        console.error('Cache read failed:', cacheErr.message);
      }
    }

    // 2. Cache miss — run the real scraper
    const data = await scrapeMetadata(url, {
      extended: extendedFlag,
      customUserAgent: userAgent,
      timeout: timeout ? parseInt(timeout, 10) : undefined
    });

    // 3. Store in Redis for next time (best-effort)
    if (client) {
      try {
        await client.set(cacheKey, JSON.stringify(data), 'EX', CACHE_TTL_SECONDS);
      } catch (cacheErr) {
        console.error('Cache write failed:', cacheErr.message);
      }
    }

    if (res.set) res.set('Cache-Control', 'public, max-age=600');
    return res.status(200).json({ ...data, cached: false });

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
