const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../src/server');
const { validateUrl, isPrivateIp } = require('../src/services/ssrfValidator');
const { scrapeMetadata } = require('../src/services/scraperService');

test('SSRF Validator - detects private and loopback IPs', () => {
  assert.equal(isPrivateIp('127.0.0.1'), true);
  assert.equal(isPrivateIp('10.0.0.5'), true);
  assert.equal(isPrivateIp('192.168.1.1'), true);
  assert.equal(isPrivateIp('169.254.169.254'), true);
  assert.equal(isPrivateIp('8.8.8.8'), false);
  assert.equal(isPrivateIp('1.1.1.1'), false);
});

test('SSRF Validator - rejects unsafe URLs', async () => {
  const localRes = await validateUrl('http://127.0.0.1/admin');
  assert.equal(localRes.isValid, false);

  const localhostRes = await validateUrl('http://localhost:8080');
  assert.equal(localhostRes.isValid, false);

  const ftpRes = await validateUrl('ftp://example.com');
  assert.equal(ftpRes.isValid, false);
});

test('SSRF Validator - accepts valid public HTTPS URL', async () => {
  const validRes = await validateUrl('https://example.com');
  assert.equal(validRes.isValid, true);
  assert.equal(validRes.urlObj.hostname, 'example.com');
});

test('Scraper Service - extracts metadata from example.com', async () => {
  const data = await scrapeMetadata('https://example.com');
  assert.equal(data.success, true);
  assert.equal(data.request.domain, 'example.com');
  assert.ok(data.meta.title.includes('Example Domain'));
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

test('Integration Test - Express API Endpoints', async () => {
  const server = app.listen(0);

  try {
    // 1. Health Endpoint
    const health = await makeRequest(server, '/api/v1/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'ok');

    // 2. Scrape Endpoint missing URL
    const missing = await makeRequest(server, '/api/v1/scrape');
    assert.equal(missing.status, 400);
    assert.equal(missing.body.success, false);

    // 3. Scrape Endpoint localhost (SSRF blocked)
    const ssrf = await makeRequest(server, '/api/v1/scrape?url=http://127.0.0.1');
    assert.equal(ssrf.status, 400);
    assert.equal(ssrf.body.success, false);

    // 4. Scrape Endpoint valid URL (GET)
    const scrapeGet = await makeRequest(server, '/api/v1/scrape?url=https://example.com');
    assert.equal(scrapeGet.status, 200);
    assert.equal(scrapeGet.body.success, true);
    assert.equal(scrapeGet.body.request.domain, 'example.com');

    // 5. Scrape Endpoint valid URL (POST)
    const scrapePost = await makeRequest(server, '/api/v1/scrape', 'POST', { url: 'https://example.com' });
    assert.equal(scrapePost.status, 200);
    assert.equal(scrapePost.body.success, true);
    assert.equal(scrapePost.body.request.domain, 'example.com');

  } finally {
    server.close();
  }
});
