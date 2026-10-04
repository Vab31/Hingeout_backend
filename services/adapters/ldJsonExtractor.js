/**
 * Extract structured JobPosting JSON-LD blocks from HTML content
 */
function extractLdJsonJobs(html) {
  if (!html || typeof html !== 'string') return [];

  const jobs = [];
  const scriptRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const jsonContent = JSON.parse(match[1].trim());

      // Check if it's a single JobPosting object
      if (jsonContent['@type'] === 'JobPosting') {
        jobs.push(mapLdJsonToJob(jsonContent));
      }
      // Check if it's an array of JobPostings
      else if (Array.isArray(jsonContent)) {
        jsonContent.forEach((item) => {
          if (item['@type'] === 'JobPosting') jobs.push(mapLdJsonToJob(item));
        });
      }
      // Check if it's an @graph wrapper
      else if (Array.isArray(jsonContent['@graph'])) {
        jsonContent['@graph'].forEach((item) => {
          if (item['@type'] === 'JobPosting') jobs.push(mapLdJsonToJob(item));
        });
      }
    } catch (e) {
      // Ignore non-job LD+JSON blocks
    }
  }

  return jobs;
}

function mapLdJsonToJob(ld) {
  const companyName = ld.hiringOrganization?.name || 'Hiring Company';
  const location = ld.jobLocation?.address?.addressLocality || ld.jobLocation?.address?.addressRegion || 'Remote';
  const country = ld.jobLocation?.address?.addressCountry || 'India';
  const applyUrl = ld.url || ld.sameAs || '';

  const expMin = /fresher|entry level|graduate/i.test(ld.description || ld.title) ? 0 : null;

  return {
    title: ld.title || 'Job Opening',
    company: companyName,
    location,
    country: typeof country === 'string' ? country : 'India',
    experienceMin: expMin,
    experienceMax: expMin === 0 ? 1 : null,
    employmentType: ld.employmentType ? formatEmploymentType(ld.employmentType) : 'Full-Time',
    workMode: /remote/i.test(location + ld.description) ? 'Remote' : 'On-site',
    salaryMin: ld.baseSalary?.value?.minValue || null,
    salaryMax: ld.baseSalary?.value?.maxValue || null,
    salaryCurrency: ld.baseSalary?.currency || 'INR',
    category: 'Software Engineering',
    skills: [],
    description: ld.description ? ld.description.replace(/<[^>]+>/g, ' ').substring(0, 2000) : ld.title,
    shortDescription: ld.description ? ld.description.replace(/<[^>]+>/g, ' ').substring(0, 150) + '...' : ld.title,
    originalUrl: applyUrl,
    canonicalUrl: applyUrl,
    isFresherFriendly: expMin === 0,
  };
}

function formatEmploymentType(typeStr) {
  if (/full/i.test(typeStr)) return 'Full-Time';
  if (/part/i.test(typeStr)) return 'Part-Time';
  if (/intern/i.test(typeStr)) return 'Internship';
  if (/contract/i.test(typeStr)) return 'Contract';
  return 'Full-Time';
}

module.exports = { extractLdJsonJobs };
