/**
 * Calculate job relevance score (0 - 100) based on configured weights.
 */
function calculateRelevanceScore(jobData, sourceQualityScore = 15, isUrlValid = true) {
  let score = 0;

  // 1. Freshness (25%)
  const postedDate = jobData.postedDate ? new Date(jobData.postedDate) : new Date();
  const diffHours = (new Date() - postedDate) / (1000 * 60 * 60);

  if (diffHours <= 24) score += 25;
  else if (diffHours <= 72) score += 20;
  else if (diffHours <= 168) score += 15;
  else if (diffHours <= 360) score += 10;
  else score += 5;

  // 2. Relevance & Completeness (25%)
  let completeness = 0;
  if (jobData.title && jobData.title.length >= 5) completeness += 5;
  if (jobData.description && jobData.description.length >= 100) completeness += 10;
  if (Array.isArray(jobData.skills) && jobData.skills.length > 0) completeness += 5;
  if (jobData.location) completeness += 5;
  score += completeness;

  // 3. Fresher Suitability (20%)
  if (jobData.isFresherFriendly || (jobData.experienceMin !== null && jobData.experienceMin <= 1)) {
    score += 20;
  } else if (jobData.experienceMin !== null && jobData.experienceMin <= 3) {
    score += 10;
  }

  // 4. Company / Source Quality (15%)
  score += Math.min(15, Math.max(0, sourceQualityScore));

  // 5. Valid Application URL (10%)
  if (isUrlValid) score += 10;

  // 6. Location Suitability (5%)
  const hubLocations = ['bengaluru', 'bangalore', 'pune', 'gurugram', 'noida', 'delhi', 'hyderabad', 'mumbai', 'remote'];
  const locLower = (jobData.location || '').toLowerCase();
  if (hubLocations.some((hub) => locLower.includes(hub))) {
    score += 5;
  }

  return Math.min(100, Math.round(score));
}

module.exports = { calculateRelevanceScore };
