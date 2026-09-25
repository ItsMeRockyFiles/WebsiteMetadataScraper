# 🚀 Website Metadata Scraper API

High-performance, production-ready Node.js & Express REST API for extracting rich website metadata, Open Graph tags, Twitter Cards, favicons, JSON-LD structured data, and meta tags. Designed specifically for hosting on Render and monetization on **RapidAPI**.

---

## ✨ Key Features

- **Full Metadata Extraction**: Extracts Title, Description, Open Graph (`og:*`), Twitter Cards (`twitter:*`), Favicon, Canonical URL, Language, Keywords, Author, Theme Color, and JSON-LD structured data.
- **Visual & Code Demo UI**: Integrated glassmorphic web dashboard at `/` to test scraping live, preview link cards, view raw JSON, and generate client code snippets.
- **SSRF & Security Protected**: Built-in Server-Side Request Forgery (SSRF) validation blocks private IP ranges (`127.0.0.1`, `10.x.x.x`, `192.168.x.x`, `169.254.169.254`), loopbacks, and local network hostnames.
- **RapidAPI Ready**: Supports optional proxy secret validation (`x-rapidapi-proxy-secret`) header to ensure requests originate strictly from RapidAPI.
- **Rate Limiting & Security Headers**: Uses `express-rate-limit` and `helmet` headers out of the box.
- **Turnkey Hosting**: Prepared with `render.yaml` for 1-click deployment on Render.

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
| `url` | string | Yes | - | Full target URL to scrape (e.g. `https://github.com`) |
| `extended` | boolean | No | `false` | Include raw `allTags` dictionary of every meta tag found |
| `timeout` | integer | No | `10000` | Request timeout in milliseconds (max 20,000ms) |

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/v1/scrape?url=https://github.com"
```

### 2. `POST /api/v1/scrape`

Scrape website metadata using JSON request body.

**Request Body:**
```json
{
  "url": "https://github.com",
  "extended": false
}
```

### 3. `GET /api/v1/health`

Health check endpoint returning server status, uptime, and memory statistics.

---

## 📦 Sample API Response

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
    "h2": ["The AI-powered developer platform"]
  }
}
```

---

## 🧪 Running Tests

Run the test suite with Node's native test runner:

```bash
npm test
```

---

## 🌐 Deploying to Render & Publishing on RapidAPI

### Step 1: Deploy on Render
1. Push this repository to GitHub.
2. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** -> **Web Service**.
3. Connect your repository. Render will automatically detect `render.yaml`.
4. Set your environment variables (e.g. `NODE_ENV=production`).

### Step 2: Publish on RapidAPI Hub
1. Log into [RapidAPI Provider Studio](https://rapidapi.com/provider).
2. Click **Add New API**. Name it `Website Metadata Scraper`.
3. Set the **Target Base URL** to your Render deployment: `https://your-app.onrender.com/api/v1`.
4. Add the `/scrape` endpoint under **Endpoints**.
5. Set up pricing tiers (e.g., Free: 100 req/day, Basic: 10,000 req/mo for $9.99).
6. Enable **RapidAPI Proxy Secret** and copy the secret key into your Render environment as `RAPIDAPI_PROXY_SECRET`.

---

## 📄 License

MIT License. Free for commercial and personal use.
