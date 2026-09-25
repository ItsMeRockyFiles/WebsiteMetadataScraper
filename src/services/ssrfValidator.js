const dns = require('dns').promises;
const net = require('net');

/**
 * Validates if a target URL is safe to fetch (prevents SSRF attacks)
 * @param {string} targetUrl 
 * @returns {Promise<{ isValid: boolean, code?: string, error?: string, urlObj?: URL }>}
 */
async function validateUrl(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return { isValid: false, code: 'INVALID_URL', error: 'URL parameter is required and must be a string.' };
  }

  let formattedUrl = targetUrl.trim();
  // Prepend https:// only if no protocol scheme is specified at all
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(formattedUrl)) {
    formattedUrl = 'https://' + formattedUrl;
  }

  let urlObj;
  try {
    urlObj = new URL(formattedUrl);
  } catch (err) {
    return { isValid: false, code: 'INVALID_URL', error: 'Invalid URL format.' };
  }

  // Enforce HTTP / HTTPS protocol
  if (!['http:', 'https:'].includes(urlObj.protocol)) {
    return { isValid: false, code: 'INVALID_URL', error: 'Only HTTP and HTTPS protocols are supported.' };
  }

  const hostname = urlObj.hostname;

  // Direct IP checks (IPv4 / IPv6)
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return { isValid: false, code: 'SSRF_RESTRICTED', error: 'Access to private or local IP addresses is prohibited.' };
    }
  } else {
    // Check hostname string for common local names
    if (['localhost', 'broadcasthost'].includes(hostname.toLowerCase()) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return { isValid: false, code: 'SSRF_RESTRICTED', error: 'Access to internal hostnames is prohibited.' };
    }

    // Resolve DNS to verify destination IP isn't private (SSRF protection)
    try {
      const addresses = await dns.lookup(hostname, { all: true });
      for (const addr of addresses) {
        if (isPrivateIp(addr.address)) {
          return { isValid: false, code: 'SSRF_RESTRICTED', error: 'Target domain resolves to a private or restricted network IP.' };
        }
      }
    } catch (dnsErr) {
      return { isValid: false, code: 'DNS_LOOKUP_FAILED', error: `Unable to resolve hostname '${hostname}': ${dnsErr.message}` };
    }
  }

  return { isValid: true, urlObj };
}

/**
 * Checks if an IP string is private/loopback/link-local/multicast
 * @param {string} ip 
 * @returns {boolean}
 */
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 0) return true; // 0.0.0.0/8
    if (parts[0] === 127) return true; // 127.0.0.0/8 (Loopback)
    if (parts[0] === 10) return true; // 10.0.0.0/8 (Private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12 (Private)
    if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16 (Private)
    if (parts[0] === 169 && parts[1] === 254) return true; // 169.254.0.0/16 (Link-local)
    if (parts[0] >= 224) return true; // Multicast
    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fe80:')) return true; // Link-local
    if (normalized.startsWith('fc00:') || normalized.startsWith('fd00:')) return true; // Unique local
  }

  return false;
}

module.exports = {
  validateUrl,
  isPrivateIp
};
