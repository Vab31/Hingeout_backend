const https = require('https');

/**
 * Deterministic Greenhouse Public API Adapter
 * Fetches all active job postings for a Greenhouse company board in 1 request!
 */
async function fetchGreenhouseJobs(boardToken) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;

  return new Promise((resolve) => {
    https
      .get(url, { headers: { 'User-Agent': 'HingOut-Crawler/1.0' } }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.jobs && Array.isArray(json.jobs)) {
              const normalized = json.jobs.map((j) => ({
                title: j.title,
                company: boardToken.charAt(0).toUpperCase() + boardToken.slice(1),
                location: j.location?.name || 'Remote',
                country: 'India',
                experienceMin: /fresher|intern|entry/i.test(j.title + j.content) ? 0 : null,
                experienceMax: /fresher|intern|entry/i.test(j.title + j.content) ? 1 : null,
                employmentType: 'Full-Time',
                workMode: /remote/i.test(j.location?.name || '') ? 'Remote' : 'On-site',
                salaryMin: null,
                salaryMax: null,
                salaryCurrency: 'INR',
                category: 'Tech',
                skills: [],
                description: j.content ? j.content.replace(/<[^>]+>/g, ' ').substring(0, 2000) : j.title,
                shortDescription: j.content ? j.content.replace(/<[^>]+>/g, ' ').substring(0, 150) + '...' : j.title,
                originalUrl: j.absolute_url,
                canonicalUrl: j.absolute_url,
                isFresherFriendly: /fresher|intern|entry/i.test(j.title),
                sourceJobId: String(j.id),
              }));
              return resolve(normalized);
            }
            resolve([]);
          } catch (e) {
            resolve([]);
          }
        });
      })
      .on('error', () => resolve([]));
  });
}

module.exports = { fetchGreenhouseJobs };
