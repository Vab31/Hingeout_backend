const https = require('https');

/**
 * Deterministic Lever Public JSON API Adapter
 * Fetches all active job postings for a Lever company board in 1 request!
 */
async function fetchLeverJobs(companyId) {
  const url = `https://api.lever.co/v0/postings/${companyId}?mode=json`;

  return new Promise((resolve) => {
    https
      .get(url, { headers: { 'User-Agent': 'HingOut-Crawler/1.0' } }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const postings = JSON.parse(data);
            if (Array.isArray(postings)) {
              const normalized = postings.map((p) => ({
                title: p.text,
                company: companyId.charAt(0).toUpperCase() + companyId.slice(1),
                location: p.categories?.location || 'Remote',
                country: 'India',
                experienceMin: /fresher|intern|entry/i.test(p.text + p.description) ? 0 : null,
                experienceMax: /fresher|intern|entry/i.test(p.text + p.description) ? 1 : null,
                employmentType: p.categories?.commitment || 'Full-Time',
                workMode: p.workplaceType === 'remote' ? 'Remote' : p.workplaceType === 'hybrid' ? 'Hybrid' : 'On-site',
                salaryMin: null,
                salaryMax: null,
                salaryCurrency: 'INR',
                category: p.categories?.team || 'Tech',
                skills: [],
                description: p.descriptionPlain ? p.descriptionPlain.substring(0, 2000) : p.text,
                shortDescription: p.descriptionPlain ? p.descriptionPlain.substring(0, 150) + '...' : p.text,
                originalUrl: p.hostedUrl,
                canonicalUrl: p.hostedUrl,
                isFresherFriendly: /fresher|intern|entry/i.test(p.text),
                sourceJobId: String(p.id),
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

module.exports = { fetchLeverJobs };
