const https = require('https');
const { URL } = require('url');

const ARTHA_BASE_URL = process.env.ARTHA_API_BASE_URL || 'https://api-usa.artha.link/api/v1';

/**
 * Helper to make HTTPS requests with rate-limit backoff handling (429 Retry-After)
 */
async function makeArthaRequest(endpointPath, queryParams = {}, retryCount = 0) {
  const apiKey = process.env.ARTHA_API_KEY;
  if (!apiKey) {
    throw new Error('ARTHA_API_KEY is not configured in backend environment variables.');
  }

  const url = new URL(`${ARTHA_BASE_URL}${endpointPath}`);
  Object.keys(queryParams).forEach((key) => {
    if (queryParams[key] !== undefined && queryParams[key] !== null && queryParams[key] !== '') {
      url.searchParams.append(key, queryParams[key]);
    }
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-API-Key': apiKey,
        'Accept': 'application/json',
        'User-Agent': 'HingeOut-Backend/1.0',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      const requestId = res.headers['x-request-id'] || 'N/A';
      const rateLimitRemaining = res.headers['x-ratelimit-remaining'];
      const retryAfterHeader = res.headers['retry-after'];

      res.on('data', (chunk) => (data += chunk));
      res.on('end', async () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = { success: false, message: data };
        }

        // Handle 429 Rate Limit Backoff
        if (res.statusCode === 429 && retryCount < 3) {
          const retrySeconds = parseInt(retryAfterHeader) || 3;
          console.warn(`[ArthaAPI 429 Rate Limit] Request ID: ${requestId}. Backing off for ${retrySeconds}s (Attempt ${retryCount + 1}/3)...`);
          await new Promise((r) => setTimeout(r, retrySeconds * 1000));
          try {
            const retryRes = await makeArthaRequest(endpointPath, queryParams, retryCount + 1);
            return resolve(retryRes);
          } catch (retryErr) {
            return reject(retryErr);
          }
        }

        if (res.statusCode >= 400) {
          console.error(`[ArthaAPI Error ${res.statusCode}] Request ID: ${requestId}`, parsed);
          return reject({
            statusCode: res.statusCode,
            requestId,
            error: parsed.error || { code: 'API_ERROR', message: parsed.message || 'Error fetching from artha.link' },
          });
        }

        resolve({
          statusCode: res.statusCode,
          requestId,
          rateLimitRemaining,
          data: parsed,
        });
      });
    });

    req.on('error', (err) => reject({ statusCode: 500, error: { code: 'NETWORK_ERROR', message: err.message } }));
    req.end();
  });
}

/**
 * Fetch public jobs from artha.link API
 */
async function fetchArthaJobs(queryParams = {}) {
  const res = await makeArthaRequest('/jobs', queryParams);
  return res.data;
}

/**
 * Fetch a single job by ID from artha.link API
 */
async function fetchArthaJobById(jobId) {
  try {
    const res = await makeArthaRequest(`/jobs/${jobId}`);
    return res.data;
  } catch (err) {
    // Fallback: fetch feed list and find matching item by id
    const searchRes = await makeArthaRequest('/jobs', { limit: 100 });
    const items = searchRes.data?.data?.items || [];
    const found = items.find((j) => String(j.id) === String(jobId) || String(j.slug) === String(jobId));
    if (found) return { success: true, data: found };
    throw err;
  }
}
/**
 * Fetch filter option lists from artha.link API
 */
async function fetchArthaFilters() {
  const res = await makeArthaRequest('/jobs/filters');
  return res.data;
}

module.exports = {
  fetchArthaJobs,
  fetchArthaFilters,
  fetchArthaJobById,
  makeArthaRequest,
};
