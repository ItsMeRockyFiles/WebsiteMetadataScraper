# 🚀 Website Metadata Scraper API

High-performance, production-ready Node.js API for extracting rich website metadata, Open Graph tags, Twitter Cards, favicons, JSON-LD structured data, and meta tags. Supports Express server hosting (Render) and Vercel Serverless Functions with Upstash Redis Caching.

---

## ✨ Key Features & Differentiators

- **Rich Metadata Extraction**: Title, Description, Open Graph (`og:*`), Twitter Cards (`twitter:*`), Favicon, Canonical URL, Language, Keywords, Author, Theme Color, and JSON-LD structured data.
- **Vercel Serverless & Upstash Redis Caching**: Includes native Vercel serverless function (`api/v1/scrape.js`) with 10-minute Upstash Redis caching (`cached: true / false`).
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
- **Framework**: Express.js & Vercel Serverless Functions
- **Cache**: `@upstash/redis` (Upstash KV / Redis)
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
| `nocache` | boolean | No | `false` | Bypass Redis cache and force fresh scrape (`true` / `1`) |
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

## ⚡ Deploying on Vercel with Upstash Redis Caching

### 1. Deploy Repository to Vercel
1. Import repository on [Vercel Dashboard](https://vercel.com/new).
2. Vercel automatically detects `api/v1/scrape.js` and `vercel.json`.

### 2. Add Upstash Redis Integration
1. On your Vercel project, go to **Storage** ➔ **Create Database** ➔ **Upstash KV / Redis**.
2. Vercel automatically injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` environment variables into your deployment.
3. Every response will return `"cached": true` on cache hits (TTL 600s)!

---

## 🌐 Deploying to Render & Publishing on RapidAPI

### Step 1: Deploy on Render
1. Push repository to GitHub.
2. Click **New +** ➔ **Web Service** on Render Dashboard.
3. Connect repository (`render.yaml` will auto-configure build and start commands).

### Step 2: Publish on RapidAPI Hub
1. Open [RapidAPI Provider Studio](https://rapidapi.com/provider).
2. Click **Add New API** (Name: `Website Metadata Scraper`).
3. Set **Target Base URL**: `https://your-app.vercel.app/api/v1` or `https://your-app.onrender.com/api/v1`.
4. Configure `/scrape` endpoint parameter `url` (String, Required).
5. Set `RAPIDAPI_PROXY_SECRET` in env variables to secure the endpoint.

---

## 📄 License

MIT License. Free for commercial and personal use.
