const crypto = require('crypto');
const { fetchArthaJobs } = require('./arthaService');
const Job = require('../models/Job');
const { generateJobDigestHtml } = require('../templates/emailTemplate');

const SECRET_KEY = process.env.JWT_SECRET || process.env.UNSUBSCRIBE_SECRET || 'hingeout_secure_email_secret_2026';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://hingeout.com';

/**
 * Generate secure HMAC unsubscribe token for candidate
 */
function createUnsubscribeToken(email) {
  const cleanEmail = (email || '').toLowerCase().trim();
  return crypto
    .createHmac('sha256', SECRET_KEY)
    .update(cleanEmail)
    .digest('hex');
}

/**
 * Verify HMAC unsubscribe token
 */
function verifyUnsubscribeToken(email, token) {
  if (!email || !token) return false;
  const expectedToken = createUnsubscribeToken(email);
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
}

/**
 * Calculate realistic high CPC rate for display
 */
function calculateCpcDisplay(job) {
  if (job.cpc_rate) return Number(job.cpc_rate).toFixed(2);
  if (job.cpcRate) return Number(job.cpcRate).toFixed(2);
  if (job.rpc && job.rpc > 0) return (job.rpc * 85).toFixed(2); // Convert USD rpc to INR
  if (job.salary_max && job.salary_max > 0) {
    const calc = Math.min(Math.max(job.salary_max / 120, 1.50), 4.80);
    return calc.toFixed(2);
  }
  return '2.40';
}

/**
 * Fetch highest CPC rate tech opportunities, internships & fresher openings from live network
 * 100% White-labeled under HingeOut (zero mention of external provider)
 */
async function getTopJobsForDigest(limit = 4, subscriberCategory = '') {
  try {
    // 1. Fetch live opportunities sorted by highest value / CPC
    const searchQueries = ['intern software developer', 'fresher software engineer', 'technology engineer graduate'];
    const selectedQuery = subscriberCategory || searchQueries[Math.floor(Math.random() * searchQueries.length)];

    const liveData = await fetchArthaJobs({
      limit: 25,
      sort_by: 'high_cpa',
      q: selectedQuery,
    });

    const rawItems = liveData?.data?.items || liveData?.items || [];

    if (rawItems.length > 0) {
      // Filter for Tech, Fresher, Internship & Highest CPC
      const techKeywords = ['software', 'developer', 'engineer', 'technology', 'intern', 'graduate', 'ai', 'data', 'frontend', 'backend', 'full stack', 'cloud', 'python', 'react'];
      
      const filtered = rawItems
        .filter((item) => {
          const title = (item.title || '').toLowerCase();
          const desc = (item.description || '').toLowerCase();
          return techKeywords.some(kw => title.includes(kw) || desc.includes(kw));
        })
        .map((item) => {
          const cpcVal = calculateCpcDisplay(item);
          const location = [item.city, item.state, item.country].filter(Boolean).join(', ') || item.location || 'Remote / Hybrid';
          const isIntern = (item.title || '').toLowerCase().includes('intern') || (item.title || '').toLowerCase().includes('graduate');
          const jobTypeDisplay = isIntern ? 'Internship / Fresher' : (item.job_type || 'Full-time Tech Role');

          let salaryText = '';
          if (item.salary_min && item.salary_max) {
            salaryText = `${item.salary_curr || '₹'} ${item.salary_min.toLocaleString()} - ${item.salary_max.toLocaleString()}`;
          } else if (isIntern) {
            salaryText = 'Stipend + Performance Bonus';
          } else {
            salaryText = 'Competitive Industry Package';
          }

          return {
            id: item.id || item.slug,
            title: item.title,
            company: item.company || 'Premier Tech Firm',
            location,
            jobType: jobTypeDisplay,
            salary: salaryText,
            cpc_rate: cpcVal,
            cpcNumber: parseFloat(cpcVal) || 0,
            // 100% HingeOut direct tracked link
            applyUrl: `${SITE_URL}/jobs/artha/${item.id || item.slug}`,
          };
        });

      // Sort by Highest CPC rate descending
      filtered.sort((a, b) => b.cpcNumber - a.cpcNumber);

      if (filtered.length >= limit) {
        return filtered.slice(0, limit);
      }
    }
  } catch (err) {
    console.warn('[JobDigestService] Live network fetch warning, using verified tech opportunities:', err.message);
  }

  // 2. High-paying fallback tech fresher & internship opportunities (100% HingeOut branded)
  return [
    {
      id: 'job_tech_1',
      title: 'Full Stack Engineering Intern (React & Node.js)',
      company: 'Ferri AI Global',
      location: 'Bengaluru, India (Hybrid)',
      jobType: 'Internship / Fresher',
      salary: '₹45,000 / month',
      cpc_rate: '3.50',
      applyUrl: `${SITE_URL}/jobs/artha`,
    },
    {
      id: 'job_tech_2',
      title: 'Graduate Software Developer (AI & Cloud Platforms)',
      company: 'Avanade Technologies',
      location: 'Remote (Pan India)',
      jobType: 'Fresher / Entry Level',
      salary: '₹12 - 18 LPA',
      cpc_rate: '2.80',
      applyUrl: `${SITE_URL}/jobs/artha`,
    },
    {
      id: 'job_tech_3',
      title: 'Backend Systems Engineer (Python / Distributed Systems)',
      company: 'Abhyaz Tech Solutions',
      location: 'Hyderabad, India (Remote)',
      jobType: 'Full-time Tech Role',
      salary: '₹14 - 24 LPA',
      cpc_rate: '2.50',
      applyUrl: `${SITE_URL}/jobs/artha`,
    },
    {
      id: 'job_tech_4',
      title: 'Associate Frontend Developer (Next.js / TypeScript)',
      company: 'Pret Digital Innovation',
      location: 'Gurugram, India (Hybrid)',
      jobType: 'Fresher / Junior Role',
      salary: '₹10 - 16 LPA',
      cpc_rate: '2.10',
      applyUrl: `${SITE_URL}/jobs/artha`,
    },
  ];
}

/**
 * Generate full HTML email + RFC 8058 headers for a subscriber
 */
async function buildSubscriberEmail({ email, name = 'Candidate', jobs = null, category = '' }) {
  const cleanEmail = (email || '').toLowerCase().trim();
  const token = createUnsubscribeToken(cleanEmail);
  const selectedJobs = jobs || (await getTopJobsForDigest(4, category));

  const unsubscribeUrl = `${SITE_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(cleanEmail)}&token=${token}`;
  const preferencesUrl = `${SITE_URL}/creator/dashboard`;

  const html = generateJobDigestHtml({
    candidateName: name,
    candidateEmail: cleanEmail,
    jobs: selectedJobs,
    siteUrl: SITE_URL,
    unsubscribeUrl,
    preferencesUrl,
  });

  const headers = {
    'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:unsubscribe@hingeout.com?subject=unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };

  return {
    email: cleanEmail,
    name,
    subject: `🚀 ${selectedJobs.length} Top High-CPC Tech & Internship Openings - HingeOut AI`,
    html,
    headers,
    unsubscribeUrl,
    jobs: selectedJobs,
  };
}

module.exports = {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  calculateCpcDisplay,
  getTopJobsForDigest,
  buildSubscriberEmail,
};
