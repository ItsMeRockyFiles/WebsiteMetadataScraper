# 🚀 Website Metadata Scraper API

High-performance, production-ready Node.js & Express REST API for extracting rich website metadata, Open Graph tags, Twitter Cards, favicons, JSON-LD structured data, and meta tags. Designed specifically for hosting on Render and monetization on **RapidAPI**.

---

## ✨ Key Features & Differentiators

- **Rich Metadata Extraction**: Title, Description, Open Graph (`og:*`), Twitter Cards (`twitter:*`), Favicon, Canonical URL, Language, Keywords, Author, Theme Color, and JSON-LD structured data.
- **Deep JSON-LD Parsing**: Parses single objects, arrays, and complex `@graph` schemas (e.g. Products with price/currency, NewsArticle, Recipes, Organizations).
- **Strict Empty Container Rules (Zero `null` Traps)**:
  - All collections **always** return empty containers (`[]` or `{}`), never `null`.
  - `jsonLd`: `[]`
  - `keywords`: `[]`
  - `openGraph`: `{}`
  - `twitterCard`: `{}`
  - `headings`: `{ h1: [], h2: [] }`
  - *Benefit*: API clients can iterate (`data.jsonLd.forEach(...)`, `data.keywords.includes(...)`) directly without defensive `if (data.jsonLd)` null checks.
- **Aggressive Multi-Source Image Fallback**:
  - `meta.image` resolves across Open Graph, Twitter Cards, and JSON-LD:
    $$\text{meta.image} = \text{og:image} \longrightarrow \text{twitter:image} \longrightarrow \text{jsonLd.image} \longrightarrow \text{link[rel="image\_src"]} \longrightarrow \text{null}$$
- **Smart Site Name Resolution**:
  - `meta.siteName` resolves: `og:site_name` ➔ `twitter:site` ➔ Target Domain (e.g., `roblox.com`).
- **Robust Favicon Resolution**:
  - `meta.favicon` resolves: `link[rel~="icon"]` ➔ `link[rel="shortcut icon"]` ➔ `link[rel="apple-touch-icon"]` ➔ `link[rel="apple-touch-icon-precomposed"]` ➔ `link[rel="mask-icon"]` ➔ `/favicon.ico` (all converted to absolute URLs or data URIs).
- **Clean Content Headings**: Automatically strips navigation headers, footers, sidebars, and generic menu noise (`nav`, `footer`, `header`, `aside`) so `headings.h1` and `headings.h2` represent actual content hierarchy.
- **SSRF & Security Shield**: Built-in Server-Side Request Forgery protection blocks private IP ranges (`127.0.0.1`, `10.x.x.x`, `192.168.x.x`, `169.254.169.254`), loopbacks, and local hostnames.
- **Standardized Error Payload**: Consistent error shapes with clear error codes (`FETCH_TIMEOUT`, `TARGET_HTTP_ERROR`, `TARGET_FETCH_ERROR`, `SSRF_RESTRICTED`, `INVALID_URL`).

---

## 🛠️ Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **HTTP Client**: Axios
- **HTML Parser**: Cheerio
- **Security & Utilities**: Helmet, Express-Rate-Limit, CORS, Node `dns` & `net`

---

## 🚀 Quick Start (Local Development)

```bash
# 1. Clone the repository
git clone https://github.com/your-username/WebsiteMetadataScraper.git
cd WebsiteMetadataScraper

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Visit `http://localhost:3000` in your browser to view the interactive demo and documentation UI!

---

## 📡 API Endpoints

### 1. `GET /api/v1/scrape`

Scrape website metadata using query parameters.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string | Yes | - | Target URL to scrape (e.g. `https://github.com`) |
| `extended` | boolean | No | `false` | Include raw `allTags` dictionary of every meta tag found |
| `timeout` | integer | No | `10000` | Request timeout in milliseconds (max 20,000ms) |

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/v1/scrape?url=https://github.com"
```

### 2. `POST /api/v1/scrape`

Scrape website metadata using JSON request body.

```json
{
  "url": "https://github.com",
  "extended": false
}
```

### 3. `GET /api/v1/health`

Health check endpoint returning server status, uptime, and memory statistics.

---

## 📦 Sample Success Response

```json
{
  "success": true,
  "request": {
    "url": "https://github.com",
    "finalUrl": "https://github.com/",
    "domain": "github.com",
    "statusCode": 200,
    "responseTimeMs": 184,
    "contentType": "text/html; charset=utf-8"
  },
  "meta": {
    "title": "GitHub: Let's build from here",
    "description": "GitHub is where over 100 million developers shape the future of software, together.",
    "image": "https://github.githubassets.com/assets/campaign-social-042d2ce9733c.png",
    "favicon": "https://github.githubassets.com/favicons/favicon.png",
    "siteName": "GitHub",
    "canonical": "https://github.com/",
    "lang": "en",
    "keywords": [],
    "author": "GitHub",
    "themeColor": "#1e2327"
  },
  "openGraph": {
    "site_name": "GitHub",
    "title": "GitHub: Let's build from here",
    "description": "GitHub is where over 100 million developers shape the future of software...",
    "image": "https://github.githubassets.com/assets/campaign-social-042d2ce9733c.png"
  },
  "twitterCard": {
    "card": "summary_large_image",
    "site": "@github",
    "title": "GitHub: Let's build from here"
  },
  "jsonLd": [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      "name": "GitHub"
    }
  ],
  "headings": {
    "h1": ["Let's build from here"],
    "h2": ["The AI-powered developer platform", "Accelerate high-quality software development"]
  }
}
```

---

## ⚠️ Standardized Error Response Format

All failed requests return a consistent JSON payload:

```json
{
  "success": false,
  "error": {
    "code": "FETCH_TIMEOUT",
    "message": "Target site did not respond within timeout limit (10000ms).",
    "targetUrl": "https://example-slow-site.com"
  }
}
```

### Error Codes Table:
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_URL` | 400 | Missing or malformed URL string |
| `SSRF_RESTRICTED` | 400 | URL targets local IP (`127.0.0.1`), loopback, or internal subnet |
| `TARGET_HTTP_ERROR` | 422 | Target server returned 4xx or 5xx HTTP response |
| `TARGET_FETCH_ERROR` | 502 | Connection refused, DNS failure, or socket failure |
| `FETCH_TIMEOUT` | 504 | Target server took longer than timeout limit |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded |

---

## 🧪 Running Tests

```bash
npm test
```

---

## 🌐 Deploying to Render & Publishing on RapidAPI

### Step 1: Deploy on Render
1. Push repository to GitHub.
2. Click **New +** ➔ **Web Service** on Render Dashboard.
3. Connect repository (`render.yaml` will auto-configure build and start commands).

### Step 2: Publish on RapidAPI Hub
1. Open [RapidAPI Provider Studio](https://rapidapi.com/provider).
2. Click **Add New API** (Name: `Website Metadata Scraper`).
3. Set **Target Base URL**: `https://your-app.onrender.com/api/v1`.
4. Configure `/scrape` endpoint parameter `url` (String, Required).
5. Set `RAPIDAPI_PROXY_SECRET` in Render env variables to secure the endpoint.

---

## 📄 License

MIT License. Free for commercial and personal use.
