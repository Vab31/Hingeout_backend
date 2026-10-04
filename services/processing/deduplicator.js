const Job = require('../../models/Job');

/**
 * 4-Level Duplicate Detection Engine
 */
async function checkDuplicateJob(jobData, sourceId) {
  // Level 1: Match sourceJobId if available
  if (jobData.sourceJobId && sourceId) {
    const level1Match = await Job.findOne({
      sourceId,
      sourceJobId: jobData.sourceJobId,
    });
    if (level1Match) {
      return { isDuplicate: true, level: 1, matchedJobId: level1Match._id, reason: 'Exact Source Job ID match' };
    }
  }

  // Level 2: Match canonicalUrl
  if (jobData.canonicalUrl) {
    const level2Match = await Job.findOne({ canonicalUrl: jobData.canonicalUrl });
    if (level2Match) {
      return { isDuplicate: true, level: 2, matchedJobId: level2Match._id, reason: 'Exact Canonical URL match' };
    }
  }

  // Level 3: Match CompanyID + Cleaned Title + Location
  if (jobData.companyId && jobData.title) {
    const cleanTitle = normalizeString(jobData.title);
    const cleanLoc = normalizeString(jobData.location || '');

    const candidates = await Job.find({ companyId: jobData.companyId }).select('title location canonicalUrl');
    for (const cand of candidates) {
      if (normalizeString(cand.title) === cleanTitle && normalizeString(cand.location) === cleanLoc) {
        return { isDuplicate: true, level: 3, matchedJobId: cand._id, reason: 'Company + Title + Location exact match' };
      }
    }
  }

  // Level 4: Similarity matching (e.g. Software Engineer - Bangalore vs Software Development Engineer - Bengaluru)
  if (jobData.companyId && jobData.title) {
    const candJobs = await Job.find({ companyId: jobData.companyId }).select('title location');
    for (const cand of candJobs) {
      const similarity = calculateStringSimilarity(jobData.title, cand.title);
      if (similarity >= 0.85) {
        return { isDuplicate: true, level: 4, matchedJobId: cand._id, score: similarity, reason: `Fuzzy title match (${Math.round(similarity * 100)}%)` };
      }
    }
  }

  return { isDuplicate: false, level: null };
}

function normalizeString(str) {
  return (str || '')
    .toLowerCase()
    .replace(/bengaluru/g, 'bangalore')
    .replace(/software development engineer/g, 'software engineer')
    .replace(/sde/g, 'software engineer')
    .replace(/[^a-z0-9]/g, '');
}

function calculateStringSimilarity(str1, str2) {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Dice coefficient on bigrams
  const bigrams1 = getBigrams(s1);
  const bigrams2 = getBigrams(s2);

  let intersection = 0;
  for (const bg of bigrams1) {
    if (bigrams2.includes(bg)) intersection++;
  }

  return (2.0 * intersection) / (bigrams1.length + bigrams2.length);
}

function getBigrams(str) {
  const bigrams = [];
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.push(str.substring(i, i + 2));
  }
  return bigrams;
}

module.exports = { checkDuplicateJob, calculateStringSimilarity };
