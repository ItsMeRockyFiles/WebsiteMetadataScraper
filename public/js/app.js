let currentResult = null;
let currentTargetUrl = '';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('scraperForm');
  form.addEventListener('submit', handleScrape);
  
  // Set default initial snippet
  showSnippet('curl');
});

function setSampleUrl(url) {
  document.getElementById('urlInput').value = url;
  document.getElementById('scraperForm').requestSubmit();
}

async function handleScrape(e) {
  e.preventDefault();
  const urlInput = document.getElementById('urlInput').value.trim();
  const extended = document.getElementById('extendedToggle').checked;

  if (!urlInput) return;

  currentTargetUrl = urlInput;
  setLoading(true);

  try {
    const apiEndpoint = `/api/v1/scrape?url=${encodeURIComponent(urlInput)}&extended=${extended}`;
    const res = await fetch(apiEndpoint);
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error?.message || 'Failed to extract metadata');
    }

    currentResult = data;
    renderResults(data);
    updateSnippets(urlInput, extended);
    document.getElementById('resultsSection').style.display = 'block';

  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  const btn = document.getElementById('submitBtn');
  const text = document.getElementById('btnText');
  const spinner = document.getElementById('btnSpinner');

  btn.disabled = isLoading;
  if (isLoading) {
    text.style.display = 'none';
    spinner.style.display = 'inline-block';
  } else {
    text.style.display = 'inline-block';
    spinner.style.display = 'none';
  }
}

function renderResults(data) {
  const { meta, request, openGraph, twitterCard, headings } = data;

  // 1. Visual Link Preview
  const imgContainer = document.getElementById('previewImgContainer');
  if (meta.image) {
    imgContainer.innerHTML = `<img src="${escapeHtml(meta.image)}" alt="OG Preview" onerror="this.parentElement.innerHTML='<span class=\'preview-image-fallback\'>Failed to load image</span>'"/>`;
  } else {
    imgContainer.innerHTML = `<span class="preview-image-fallback">No Preview Image Available</span>`;
  }

  const faviconEl = document.getElementById('previewFavicon');
  if (meta.favicon) {
    faviconEl.src = meta.favicon;
    faviconEl.style.display = 'inline-block';
  } else {
    faviconEl.style.display = 'none';
  }

  document.getElementById('previewDomainText').textContent = request.domain || 'domain.com';
  document.getElementById('previewTitle').textContent = meta.title || 'No Title Found';
  document.getElementById('previewDesc').textContent = meta.description || 'No Description Found';

  // 2. Metadata Breakdown Grid
  const metaGrid = document.getElementById('metaGrid');
  const items = [
    { key: 'Title', val: meta.title },
    { key: 'Description', val: meta.description },
    { key: 'Domain', val: request.domain },
    { key: 'Canonical URL', val: meta.canonical, isLink: true },
    { key: 'Site Name', val: meta.siteName },
    { key: 'Favicon URL', val: meta.favicon, isLink: true },
    { key: 'Image URL', val: meta.image, isLink: true },
    { key: 'Language', val: meta.lang },
    { key: 'Keywords', val: meta.keywords && meta.keywords.length > 0 ? meta.keywords.join(', ') : null },
    { key: 'Author', val: meta.author },
    { key: 'Theme Color', val: meta.themeColor },
    { key: 'Response Time', val: `${request.responseTimeMs} ms` },
    { key: 'HTTP Status', val: request.statusCode }
  ];

  metaGrid.innerHTML = items
    .filter(i => i.val !== null && i.val !== undefined && i.val !== '')
    .map(i => `
      <div class="meta-item">
        <div class="meta-key">${escapeHtml(i.key)}</div>
        <div class="meta-value">
          ${i.isLink ? `<a href="${escapeHtml(i.val)}" target="_blank" rel="noopener">${escapeHtml(i.val)}</a>` : escapeHtml(String(i.val))}
        </div>
      </div>
    `).join('');

  // 3. Raw JSON Output
  document.getElementById('jsonOutput').textContent = JSON.stringify(data, null, 2);
}

function switchTab(tabName) {
  const tabs = ['preview', 'breakdown', 'json', 'code'];
  tabs.forEach(t => {
    const btn = document.querySelector(`[onclick="switchTab('${t}')"]`);
    const content = document.getElementById(`tab-${t}`);
    if (t === tabName) {
      btn.classList.add('active');
      content.style.display = 'block';
    } else {
      btn.classList.remove('active');
      content.style.display = 'none';
    }
  });
}

// Snippet Generator
let snippets = {};

function updateSnippets(targetUrl, extended) {
  const encoded = encodeURIComponent(targetUrl);
  const baseUrl = window.location.origin;

  snippets = {
    curl: `curl -X GET "${baseUrl}/api/v1/scrape?url=${encoded}${extended ? '&extended=true' : ''}" \\
  -H "x-rapidapi-host: website-metadata-scraper.p.rapidapi.com" \\
  -H "x-rapidapi-key: YOUR_RAPIDAPI_KEY"`,
    
    fetch: `const url = "${baseUrl}/api/v1/scrape?url=${encoded}${extended ? '&extended=true' : ''}";

const response = await fetch(url, {
  method: 'GET',
  headers: {
    'x-rapidapi-host': 'website-metadata-scraper.p.rapidapi.com',
    'x-rapidapi-key': 'YOUR_RAPIDAPI_KEY'
  }
});
const metadata = await response.json();
console.log(metadata);`,

    axios: `const axios = require('axios');

const options = {
  method: 'GET',
  url: '${baseUrl}/api/v1/scrape',
  params: { url: '${targetUrl}'${extended ? ", extended: 'true'" : ''} },
  headers: {
    'x-rapidapi-host': 'website-metadata-scraper.p.rapidapi.com',
    'x-rapidapi-key': 'YOUR_RAPIDAPI_KEY'
  }
};

try {
  const response = await axios.request(options);
  console.log(response.data);
} catch (error) {
  console.error(error);
}`,

    python: `import requests

url = "${baseUrl}/api/v1/scrape"
querystring = {"url": "${targetUrl}"${extended ? ', "extended": "true"' : ''}}

headers = {
    "x-rapidapi-host": "website-metadata-scraper.p.rapidapi.com",
    "x-rapidapi-key": "YOUR_RAPIDAPI_KEY"
}

response = requests.get(url, headers=headers, params=querystring)
print(response.json())`
  };

  const activeLang = document.getElementById('snippetLangLabel').dataset.lang || 'curl';
  showSnippet(activeLang);
}

function showSnippet(lang) {
  const output = document.getElementById('snippetOutput');
  const label = document.getElementById('snippetLangLabel');
  
  label.dataset.lang = lang;
  
  switch(lang) {
    case 'curl': label.textContent = 'cURL Command'; break;
    case 'fetch': label.textContent = 'JavaScript (Fetch API)'; break;
    case 'axios': label.textContent = 'Node.js (Axios)'; break;
    case 'python': label.textContent = 'Python (Requests)'; break;
  }

  output.textContent = snippets[lang] || `// Run a query to generate code for ${lang}`;
}

function copyJson() {
  if (!currentResult) return;
  navigator.clipboard.writeText(JSON.stringify(currentResult, null, 2));
  alert('JSON copied to clipboard!');
}

function copySnippet() {
  const text = document.getElementById('snippetOutput').textContent;
  if (!text) return;
  navigator.clipboard.writeText(text);
  alert('Code snippet copied to clipboard!');
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
