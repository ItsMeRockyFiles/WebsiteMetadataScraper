const axios = require('axios');
const cheerio = require('cheerio');
const { validateUrl } = require('./ssrfValidator');

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; RapidAPIMetadataBot/1.0; +https://rapidapi.com)';
const DEFAULT_TIMEOUT = 10000; // 10 seconds

/**
 * Scrapes metadata from a given URL
 * @param {string} targetUrl 
 * @param {Object} options 
 * @param {boolean} [options.extended=false] Include raw meta tags list
 * @param {string} [options.customUserAgent] Custom user agent string
 * @param {number} [options.timeout] Request timeout in ms
 * @returns {Promise<Object>}
 */
async function scrapeMetadata(targetUrl, options = {}) {
  const { extended = false, customUserAgent, timeout = DEFAULT_TIMEOUT } = options;

  // 1. SSRF and URL validation
  const validation = await validateUrl(targetUrl);
  if (!validation.isValid) {
    throw { statusCode: 400, message: validation.error };
  }

  const cleanUrl = validation.urlObj.href;
  const startTime = Date.now();

  // 2. Fetch page HTML with Axios
  let response;
  try {
    response = await axios.get(cleanUrl, {
      headers: {
        'User-Agent': customUserAgent || DEFAULT_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br'
      },
      timeout: Math.min(timeout, 20000), // Max 20s
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400
    });
  } catch (err) {
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      throw { statusCode: 504, message: `Gateway Timeout: Request to target URL exceeded timeout limit (${timeout}ms).` };
    }
    if (err.response) {
      throw { statusCode: 422, message: `Target server returned HTTP ${err.response.status}: ${err.response.statusText}` };
    }
    throw { statusCode: 502, message: `Failed to fetch target URL: ${err.message}` };
  }

  const responseTimeMs = Date.now() - startTime;
  const finalUrl = response.request?.res?.responseUrl || cleanUrl;
  const contentType = response.headers['content-type'] || '';

  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml') && !contentType.includes('text/xml')) {
    // If it's an image/pdf/json directly, provide lightweight response
    return buildNonHtmlResponse(cleanUrl, finalUrl, response.status, responseTimeMs, contentType);
  }

  const html = response.data;
  const $ = cheerio.load(html);

  // Helper for absolute URL conversion
  const toAbsolute = (relUrl) => {
    if (!relUrl || typeof relUrl !== 'string') return null;
    const trimmed = relUrl.trim();
    if (!trimmed) return null;
    try {
      return new URL(trimmed, finalUrl).href;
    } catch {
      return trimmed;
    }
  };

  // 3. Extract Meta Tags
  const metaTags = {};
  $('meta').each((_, el) => {
    const name = $(el).attr('name') || $(el).attr('property') || $(el).attr('itemprop');
    const content = $(el).attr('content') || $(el).attr('value');
    if (name && content !== undefined) {
      metaTags[name.toLowerCase()] = content.trim();
    }
  });

  // OpenGraph metadata
  const openGraph = {};
  Object.keys(metaTags).forEach((key) => {
    if (key.startsWith('og:')) {
      const prop = key.substring(3);
      openGraph[prop] = metaTags[key];
    }
  });

  // Twitter Card metadata
  const twitterCard = {};
  Object.keys(metaTags).forEach((key) => {
    if (key.startsWith('twitter:')) {
      const prop = key.substring(8);
      twitterCard[prop] = metaTags[key];
    }
  });

  // Primary Metadata Resolution
  const rawTitle = openGraph.title || twitterCard.title || $('title').first().text().trim() || $('h1').first().text().trim() || null;
  const title = rawTitle ? rawTitle.replace(/\s+/g, ' ') : null;

  const rawDesc = openGraph.description || twitterCard.description || metaTags['description'] || null;
  const description = rawDesc ? rawDesc.replace(/\s+/g, ' ') : null;

  const rawImage = openGraph.image || openGraph['image:secure_url'] || twitterCard.image || $('link[rel="image_src"]').attr('href') || null;
  const image = toAbsolute(rawImage);

  // Favicon Resolution
  const faviconRel = $('link[rel~="icon"]').attr('href') || 
                     $('link[rel="shortcut icon"]').attr('href') || 
                     $('link[rel="apple-touch-icon"]').attr('href') || 
                     '/favicon.ico';
  const favicon = toAbsolute(faviconRel);

  // Canonical URL
  const canonicalRel = $('link[rel="canonical"]').attr('href') || openGraph.url || null;
  const canonical = toAbsolute(canonicalRel) || finalUrl;

  // Language & Keywords
  const lang = $('html').attr('lang') || metaTags['language'] || metaTags['og:locale'] || null;
  const keywordsRaw = metaTags['keywords'] || null;
  const keywords = keywordsRaw ? keywordsRaw.split(',').map(k => k.trim()).filter(Boolean) : [];

  // Author & Publisher
  const author = metaTags['author'] || metaTags['article:author'] || twitterCard.creator || metaTags['publisher'] || null;
  const themeColor = metaTags['theme-color'] || metaTags['msapplication-tilecolor'] || null;
  const siteName = openGraph.site_name || new URL(finalUrl).hostname.replace(/^www\./, '');

  // JSON-LD Structured Data
  const jsonLd = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (content) {
        const parsed = JSON.parse(content);
        jsonLd.push(parsed);
      }
    } catch {
      // Ignore invalid JSON-LD scripts
    }
  });

  // Headings
  const headings = {
    h1: [],
    h2: []
  };
  $('h1').slice(0, 5).each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text) headings.h1.push(text);
  });
  $('h2').slice(0, 10).each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text) headings.h2.push(text);
  });

  // Final metadata response structure
  const result = {
    success: true,
    request: {
      url: cleanUrl,
      finalUrl: finalUrl,
      domain: new URL(finalUrl).hostname,
      statusCode: response.status,
      responseTimeMs: responseTimeMs,
      contentType: contentType
    },
    meta: {
      title,
      description,
      image,
      favicon,
      siteName,
      canonical,
      lang,
      keywords,
      author,
      themeColor
    },
    openGraph,
    twitterCard,
    jsonLd: jsonLd.length > 0 ? jsonLd : null,
    headings
  };

  if (extended) {
    result.allTags = metaTags;
  }

  return result;
}

function buildNonHtmlResponse(cleanUrl, finalUrl, statusCode, responseTimeMs, contentType) {
  return {
    success: true,
    request: {
      url: cleanUrl,
      finalUrl: finalUrl,
      domain: new URL(finalUrl).hostname,
      statusCode: statusCode,
      responseTimeMs: responseTimeMs,
      contentType: contentType
    },
    meta: {
      title: cleanUrl.split('/').pop() || 'Resource',
      description: `Direct content of type ${contentType}`,
      image: contentType.startsWith('image/') ? finalUrl : null,
      favicon: new URL(finalUrl).origin + '/favicon.ico',
      siteName: new URL(finalUrl).hostname,
      canonical: finalUrl,
      lang: null,
      keywords: [],
      author: null,
      themeColor: null
    },
    openGraph: {},
    twitterCard: {},
    jsonLd: null,
    headings: { h1: [], h2: [] }
  };
}

module.exports = {
  scrapeMetadata
};
