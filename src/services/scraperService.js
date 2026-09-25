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
    throw {
      statusCode: 400,
      code: validation.code || 'INVALID_URL',
      message: validation.error,
      targetUrl: targetUrl
    };
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
      throw {
        statusCode: 504,
        code: 'FETCH_TIMEOUT',
        message: `Target site did not respond within timeout limit (${timeout}ms).`,
        targetUrl: cleanUrl
      };
    }
    if (err.response) {
      throw {
        statusCode: 422,
        code: 'TARGET_HTTP_ERROR',
        message: `Target server returned HTTP status ${err.response.status}: ${err.response.statusText}`,
        targetUrl: cleanUrl
      };
    }
    throw {
      statusCode: 502,
      code: 'TARGET_FETCH_ERROR',
      message: `Failed to fetch target URL: ${err.message}`,
      targetUrl: cleanUrl
    };
  }

  const responseTimeMs = Date.now() - startTime;
  const finalUrl = response.request?.res?.responseUrl || cleanUrl;
  const contentType = response.headers['content-type'] || '';

  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml') && !contentType.includes('text/xml')) {
    return buildNonHtmlResponse(cleanUrl, finalUrl, response.status, responseTimeMs, contentType);
  }

  const html = response.data;
  return parseHtmlMetadata(html, cleanUrl, finalUrl, response.status, responseTimeMs, contentType, { extended });
}

/**
 * Core HTML Metadata Parsing Function
 */
function parseHtmlMetadata(html, cleanUrl, finalUrl, statusCode, responseTimeMs, contentType, options = {}) {
  const { extended = false } = options;
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

  // 3. Extract All Meta Tags
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

  // 4. JSON-LD Structured Data Parsing
  const jsonLd = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (content) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          jsonLd.push(...parsed);
        } else if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
          jsonLd.push(...parsed['@graph']);
        } else {
          jsonLd.push(parsed);
        }
      }
    } catch {
      // Ignore malformed JSON-LD scripts
    }
  });

  // Extract JSON-LD Image Fallback if available
  let jsonLdImage = null;
  if (jsonLd.length > 0) {
    for (const item of jsonLd) {
      if (item.image) {
        if (typeof item.image === 'string') {
          jsonLdImage = item.image;
          break;
        } else if (typeof item.image === 'object' && item.image.url) {
          jsonLdImage = item.image.url;
          break;
        } else if (Array.isArray(item.image) && item.image.length > 0) {
          const firstImg = item.image[0];
          jsonLdImage = typeof firstImg === 'string' ? firstImg : (firstImg.url || null);
          if (jsonLdImage) break;
        }
      }
    }
  }

  // Primary Metadata Resolution with fallback order
  const rawTitle = openGraph.title || twitterCard.title || $('title').first().text().trim() || $('h1').first().text().trim() || null;
  const title = rawTitle ? rawTitle.replace(/\s+/g, ' ') : null;

  const rawDesc = openGraph.description || twitterCard.description || metaTags['description'] || null;
  const description = rawDesc ? rawDesc.replace(/\s+/g, ' ') : null;

  // Smart Image Fallback Order: og:image -> og:image:secure_url -> twitter:image -> twitter:image:src -> jsonLd.image -> link[rel="image_src"]
  const rawImage = openGraph.image || 
                   openGraph['image:secure_url'] || 
                   twitterCard.image || 
                   twitterCard['image:src'] || 
                   jsonLdImage || 
                   $('link[rel="image_src"]').attr('href') || 
                   null;
  const image = toAbsolute(rawImage);

  // Favicon Fallback Order & Resolution: icon -> shortcut icon -> apple-touch-icon -> apple-touch-icon-precomposed -> mask-icon -> /favicon.ico
  const faviconRel = $('link[rel~="icon"]').attr('href') || 
                     $('link[rel="shortcut icon"]').attr('href') || 
                     $('link[rel="apple-touch-icon"]').attr('href') || 
                     $('link[rel="apple-touch-icon-precomposed"]').attr('href') || 
                     $('link[rel="mask-icon"]').attr('href') || 
                     '/favicon.ico';
  const favicon = toAbsolute(faviconRel);

  // Canonical URL
  const canonicalRel = $('link[rel="canonical"]').attr('href') || openGraph.url || null;
  const canonical = toAbsolute(canonicalRel) || finalUrl;

  // Language & Keywords (Always Array)
  const lang = $('html').attr('lang') || metaTags['language'] || metaTags['og:locale'] || null;
  const keywordsRaw = metaTags['keywords'] || null;
  const keywords = keywordsRaw ? keywordsRaw.split(',').map(k => k.trim()).filter(Boolean) : [];

  // Author & Publisher
  const author = metaTags['author'] || metaTags['article:author'] || twitterCard.creator || metaTags['publisher'] || null;
  const themeColor = metaTags['theme-color'] || metaTags['msapplication-tilecolor'] || null;
  const siteName = openGraph.site_name || twitterCard.site || new URL(finalUrl).hostname.replace(/^www\./, '');

  // 5. Headings Content Extraction (Clean nav, header, footer noise)
  const $content = cheerio.load($.html());
  $content('nav, footer, header, aside, [role="navigation"], [role="contentinfo"], .nav, .navigation, .footer, .header, .sidebar, #footer, #nav, #sidebar, #header').remove();

  const headings = { h1: [], h2: [] };
  const genericNoise = [
    'navigation', 'navigation menu', 'site-wide links', 'footer', 'header', 
    'menu', 'table of contents', 'search', 'skip to main content', 'main menu'
  ];

  $content('h1').slice(0, 5).each((_, el) => {
    const text = $content(el).text().trim().replace(/\s+/g, ' ');
    if (text && !genericNoise.includes(text.toLowerCase())) {
      headings.h1.push(text);
    }
  });

  $content('h2').slice(0, 10).each((_, el) => {
    const text = $content(el).text().trim().replace(/\s+/g, ' ');
    if (text && !genericNoise.includes(text.toLowerCase())) {
      headings.h2.push(text);
    }
  });

  // 6. Final Metadata Response Structure (Collections always return [] or {})
  const result = {
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
    jsonLd,
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
    jsonLd: [],
    headings: { h1: [], h2: [] }
  };
}

module.exports = {
  scrapeMetadata,
  parseHtmlMetadata
};
