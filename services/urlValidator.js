const https = require('https');
const http = require('http');

/**
 * Validate application URL format, responsiveness, and check if job page is active.
 */
async function validateApplicationUrl(url) {
  if (!url || typeof url !== 'string') {
    return { isValid: false, status: 'BROKEN', message: 'URL string missing' };
  }

  const sanitizedUrl = url.trim();

  // 1. Basic URL format check
  let parsedUrl;
  try {
    parsedUrl = new URL(sanitizedUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { isValid: false, status: 'BROKEN', message: 'URL must use HTTP or HTTPS protocol' };
    }
  } catch (e) {
    return { isValid: false, status: 'BROKEN', message: 'Invalid URL format' };
  }

  // 2. Perform HTTP HEAD / GET check with timeout
  try {
    const httpCheck = await performHttpCheck(sanitizedUrl);
    
    if (httpCheck.statusCode >= 200 && httpCheck.statusCode < 400) {
      // Check for soft-404 keywords in redirected URL or body snippet
      if (isSoft404(httpCheck.finalUrl, httpCheck.bodySnippet)) {
        return {
          isValid: false,
          status: 'EXPIRED',
          message: 'Job listing detected as closed/expired on source page',
          finalUrl: httpCheck.finalUrl,
        };
      }

      return {
        isValid: true,
        status: 'VERIFIED',
        message: 'URL responsive and active',
        finalUrl: httpCheck.finalUrl,
      };
    } else if (httpCheck.statusCode === 404 || httpCheck.statusCode === 410) {
      return { isValid: false, status: 'EXPIRED', message: `HTTP ${httpCheck.statusCode} Job page no longer exists` };
    } else {
      return { isValid: false, status: 'NEEDS_REVIEW', message: `HTTP status ${httpCheck.statusCode} returned` };
    }
  } catch (err) {
    return { isValid: false, status: 'BROKEN', message: `Connection error: ${err.message}` };
  }
}

function performHttpCheck(targetUrl, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    let currentUrl = targetUrl;
    let redirectCount = 0;

    function makeRequest(urlToFetch) {
      const parsed = new URL(urlToFetch);
      const transport = parsed.protocol === 'https:' ? https : http;

      const req = transport.request(
        urlToFetch,
        {
          method: 'GET',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          timeout: 8000,
        },
        (res) => {
          // Handle redirects
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            redirectCount++;
            if (redirectCount > maxRedirects) {
              return reject(new Error('Too many redirects'));
            }
            const nextUrl = new URL(res.headers.location, urlToFetch).href;
            return makeRequest(nextUrl);
          }

          let bodySnippet = '';
          res.on('data', (chunk) => {
            if (bodySnippet.length < 2000) bodySnippet += chunk.toString();
          });

          res.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              finalUrl: urlToFetch,
              bodySnippet: bodySnippet.toLowerCase(),
            });
          });
        }
      );

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request connection timeout'));
      });

      req.end();
    }

    makeRequest(currentUrl);
  });
}

function isSoft404(finalUrl, bodySnippet) {
  const closedKeywords = [
    'job no longer available',
    'position closed',
    'job posting has expired',
    'no longer accepting applications',
    'this job is closed',
    '404 page not found',
    'page does not exist',
  ];

  return closedKeywords.some((kw) => bodySnippet.includes(kw) || finalUrl.toLowerCase().includes('job-closed'));
}

module.exports = { validateApplicationUrl };
