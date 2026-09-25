const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../src/server');
const vercelScrapeHandler = require('../api/v1/scrape');
const vercelHealthHandler = require('../api/v1/health');
const { validateUrl, isPrivateIp } = require('../src/services/ssrfValidator');
const { scrapeMetadata, parseHtmlMetadata } = require('../src/services/scraperService');

test('SSRF Validator - detects private and loopback IPs', () => {
  assert.equal(isPrivateIp('127.0.0.1'), true);
  assert.equal(isPrivateIp('10.0.0.5'), true);
  assert.equal(isPrivateIp('192.168.1.1'), true);
  assert.equal(isPrivateIp('169.254.169.254'), true);
  assert.equal(isPrivateIp('8.8.8.8'), false);
  assert.equal(isPrivateIp('1.1.1.1'), false);
});

test('SSRF Validator - rejects unsafe URLs with specific error codes', async () => {
  const localRes = await validateUrl('http://127.0.0.1/admin');
  assert.equal(localRes.isValid, false);
  assert.equal(localRes.code, 'SSRF_RESTRICTED');

  const localhostRes = await validateUrl('http://localhost:8080');
  assert.equal(localhostRes.isValid, false);
  assert.equal(localhostRes.code, 'SSRF_RESTRICTED');

  const ftpRes = await validateUrl('ftp://example.com');
  assert.equal(ftpRes.isValid, false);
  assert.equal(ftpRes.code, 'INVALID_URL');
});

test('Collection Consistency Rule - Empty collections return [] or {} never null', () => {
  const emptyHtml = `<html><head><title>Minimal Page</title></head><body><h1>Hello</h1></body></html>`;
  const parsed = parseHtmlMetadata(emptyHtml, 'https://minimal.com', 'https://minimal.com', 200, 50, 'text/html');

  assert.ok(Array.isArray(parsed.meta.keywords));
  assert.equal(parsed.meta.keywords.length, 0);

  assert.ok(Array.isArray(parsed.jsonLd));
  assert.equal(parsed.jsonLd.length, 0);

  assert.ok(typeof parsed.openGraph === 'object' && parsed.openGraph !== null);
  assert.ok(typeof parsed.twitterCard === 'object' && parsed.twitterCard !== null);
  assert.ok(Array.isArray(parsed.headings.h1));
  assert.ok(Array.isArray(parsed.headings.h2));
});

test('Smart Image Fallback - extracts image from JSON-LD when OG/Twitter missing', () => {
  const jsonLdImgHtml = `
    <html>
    <head>
      <title>Roblox Item</title>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Cool Hat",
          "image": "https://images.roblox.com/hat.jpg"
        }
      </script>
    </head>
    <body><h1>Cool Hat</h1></body>
    </html>
  `;

  const parsed = parseHtmlMetadata(jsonLdImgHtml, 'https://roblox.com/item', 'https://roblox.com/item', 200, 50, 'text/html');

  assert.equal(parsed.meta.image, 'https://images.roblox.com/hat.jpg');
  assert.equal(parsed.meta.siteName, 'roblox.com'); // Domain fallback
});

test('Vercel Serverless Function Handler - api/v1/scrape.js', async () => {
  // Test missing URL
  let statusCodeMissing = 0;
  let jsonMissing = null;
  const mockReqMissing = { query: {} };
  const mockResMissing = {
    status: (code) => { statusCodeMissing = code; return mockResMissing; },
    json: (data) => { jsonMissing = data; return mockResMissing; }
  };

  await vercelScrapeHandler(mockReqMissing, mockResMissing);
  assert.equal(statusCodeMissing, 400);
  assert.equal(jsonMissing.success, false);
  assert.equal(jsonMissing.error.code, 'INVALID_URL');

  // Test valid URL execution
  let statusCodeValid = 0;
  let jsonValid = null;
  const mockReqValid = { query: { url: 'https://example.com' } };
  const mockResValid = {
    status: (code) => { statusCodeValid = code; return mockResValid; },
    json: (data) => { jsonValid = data; return mockResValid; }
  };

  await vercelScrapeHandler(mockReqValid, mockResValid);
  assert.equal(statusCodeValid, 200);
  assert.equal(jsonValid.success, true);
  assert.equal(jsonValid.request.domain, 'example.com');
  assert.equal(jsonValid.cached, false);
});

test('Vercel Serverless Function - api/v1/health.js', () => {
  let statusCode = 0;
  let responseData = null;
  const headers = {};

  const mockReq = {};
  const mockRes = {
    setHeader: (key, val) => { headers[key] = val; },
    status: (code) => { statusCode = code; return mockRes; },
    json: (data) => { responseData = data; return mockRes; }
  };

  vercelHealthHandler(mockReq, mockRes);
  assert.equal(statusCode, 200);
  assert.equal(responseData.status, 'ok');
  assert.equal(responseData.service, 'Website Metadata Scraper API');
  assert.ok(typeof responseData.timestamp === 'string');
});

test('Vercel Serverless Function - RapidAPI Proxy Secret Enforcement', async () => {
  process.env.RAPIDAPI_PROXY_SECRET = 'my_secret_key_123';

  try {
    // 1. Request without secret header -> 403 FORBIDDEN
    let statusUnauthorized = 0;
    let jsonUnauthorized = null;
    const mockReqBad = { query: { url: 'https://example.com' }, headers: {} };
    const mockResBad = {
      status: (code) => { statusUnauthorized = code; return mockResBad; },
      json: (data) => { jsonUnauthorized = data; return mockResBad; }
    };

    await vercelScrapeHandler(mockReqBad, mockResBad);
    assert.equal(statusUnauthorized, 403);
    assert.equal(jsonUnauthorized.success, false);
    assert.equal(jsonUnauthorized.error.code, 'FORBIDDEN');

    // 2. Request with correct secret header -> 200 OK
    let statusOk = 0;
    let jsonOk = null;
    const mockReqGood = {
      query: { url: 'https://example.com' },
      headers: { 'x-rapidapi-proxy-secret': 'my_secret_key_123' }
    };
    const mockResGood = {
      status: (code) => { statusOk = code; return mockResGood; },
      json: (data) => { jsonOk = data; return mockResGood; }
    };

    await vercelScrapeHandler(mockReqGood, mockResGood);
    assert.equal(statusOk, 200);
    assert.equal(jsonOk.success, true);

  } finally {
    delete process.env.RAPIDAPI_PROXY_SECRET;
  }
});

test('Integration Test - Express API Endpoints & Standardized Errors', async () => {
  const server = app.listen(0);

  try {
    // 1. Health Endpoint
    const health = await makeRequest(server, '/api/v1/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'ok');

    // 2. Scrape Endpoint missing URL (400 INVALID_URL)
    const missing = await makeRequest(server, '/api/v1/scrape');
    assert.equal(missing.status, 400);
    assert.equal(missing.body.success, false);
    assert.equal(missing.body.error.code, 'INVALID_URL');

    // 3. Scrape Endpoint valid URL (GET)
    const scrapeGet = await makeRequest(server, '/api/v1/scrape?url=https://example.com');
    assert.equal(scrapeGet.status, 200);
    assert.equal(scrapeGet.body.success, true);
    assert.equal(scrapeGet.body.request.domain, 'example.com');
    assert.ok(Array.isArray(scrapeGet.body.jsonLd)); // jsonLd is [] (never null)
    assert.ok(Array.isArray(scrapeGet.body.meta.keywords)); // keywords is [] (never null)

  } finally {
    server.close();
  }
});

// Helper for HTTP requests against Express app
function makeRequest(server, path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const options = {
      hostname: '127.0.0.1',
      port: address.port,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}
