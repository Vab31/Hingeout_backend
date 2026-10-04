const https = require('https');

/**
 * Clean & normalize raw job text into structured job object(s).
 * Supports both single job posts and multi-job post digests.
 */
async function normalizeJobWithAI(rawText, sourceContext = {}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const aiResult = await callGeminiAPI(rawText, apiKey, sourceContext);
      if (aiResult) return aiResult;
    } catch (err) {
      console.warn('⚠️ Gemini API call failed, falling back to heuristic normalization:', err.message);
    }
  }

  // Check if raw text contains multiple job blocks (e.g. separated by header lines or multiple "Position:" occurrences)
  const jobBlocks = splitMultiJobText(rawText);

  if (jobBlocks.length > 1) {
    return jobBlocks.map((block) => fallbackSingleJobNormalization(block, sourceContext));
  }

  return fallbackSingleJobNormalization(rawText, sourceContext);
}

/**
 * Split multi-job digest text into individual job post strings
 */
function splitMultiJobText(rawText) {
  const positionMatches = (rawText.match(/Position:\s*/gi) || []).length;
  if (positionMatches > 1) {
    // Split on header separator or company/position blocks
    const chunks = rawText.split(/(?=Jobs \| Internships|Position:)/i);
    const validBlocks = [];
    let currentBlock = '';

    for (const chunk of chunks) {
      if (/Position:/i.test(chunk) || /Apply Now:/i.test(chunk)) {
        if (currentBlock.trim()) validBlocks.push(currentBlock.trim());
        currentBlock = chunk;
      } else {
        currentBlock += '\n' + chunk;
      }
    }
    if (currentBlock.trim()) validBlocks.push(currentBlock.trim());

    return validBlocks.filter((b) => /Position:|Apply Now:|careers|jobs/i.test(b));
  }

  return [rawText];
}

/**
 * Single job heuristic normalization
 */
function fallbackSingleJobNormalization(rawText, sourceContext) {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. Extract Company Name
  let companyName = sourceContext.companyName || '';
  const companyMatch = rawText.match(/(?:Company|Organization):\s*(.+)/i);
  if (companyMatch) {
    companyName = companyMatch[1].trim();
  } else {
    // Look for lines containing company name or preceding Position:
    for (let i = 0; i < lines.length; i++) {
      if (/Position:|Role:/i.test(lines[i])) {
        if (i > 0 && !/Jobs \| Internships|Placement|Interviews/i.test(lines[i - 1])) {
          companyName = lines[i - 1].trim();
          break;
        }
      }
    }
  }

  // Clean company name if it grabbed header text
  companyName = companyName.replace(/^(Position|Role|Designation):\s*/i, '').trim();
  if (!companyName || /Jobs \| Internships|Placement|Interviews/i.test(companyName)) {
    const knownCompanies = ['Caterpillar', 'NatWest Group', 'Siemens', 'Google', 'Amazon', 'Microsoft', 'TCS', 'Infosys'];
    const matchedComp = knownCompanies.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(rawText));
    companyName = matchedComp || 'Hiring Employer';
  }

  // 2. Extract Position Title
  let title = '';
  const posMatch = rawText.match(/(?:Position|Role|Title|Designation):\s*(.+)/i);
  if (posMatch) {
    title = posMatch[1].trim();
  } else {
    title = lines.find((l) => !/Jobs \||Company:|Apply|http/i.test(l)) || 'Opportunity';
  }

  // 3. Extract Real Application URL (Exclude WhatsApp/Telegram community links)
  const allUrls = rawText.match(/https?:\/\/[^\s>)]+/gi) || [];
  const validApplyUrl =
    allUrls.find(
      (u) =>
        !u.includes('whatsapp.com') &&
        !u.includes('t.me') &&
        !u.includes('bit.ly') &&
        !u.includes('instagram.com')
    ) || allUrls[0] || sourceContext.url || '';

  // Clean URL trailing punctuation if any
  const cleanUrl = validApplyUrl.replace(/[\.,\)]+$/, '');

  // 4. Experience heuristic
  let expMin = null;
  let expMax = null;
  let isFresher = false;

  if (/fresher|intern|entry level|graduate/i.test(rawText)) {
    isFresher = true;
    expMin = 0;
    expMax = 1;
  } else {
    const expMatch = rawText.match(/(\d+)\s*[-to]+\s*(\d+)\s*years?/i);
    if (expMatch) {
      expMin = parseInt(expMatch[1]);
      expMax = parseInt(expMatch[2]);
    }
  }

  // 5. Work Mode & Location
  let workMode = 'On-site';
  if (/remote|work from home|wfh/i.test(rawText)) workMode = 'Remote';
  else if (/hybrid/i.test(rawText)) workMode = 'Hybrid';

  let location = 'Remote';
  const locMatch = rawText.match(/(?:Location|City):\s*(.+)/i);
  if (locMatch) {
    location = locMatch[1].trim();
  } else if (/bangalore|bengaluru/i.test(rawText)) location = 'Bengaluru';
  else if (/pune/i.test(rawText)) location = 'Pune';
  else if (/delhi|noida|gurugram/i.test(rawText)) location = 'NCR';

  // 6. Extract Skills
  const knownSkills = ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'C++', 'SQL', 'MongoDB', 'AWS', 'Docker', 'Automation', 'Selenium'];
  const matchedSkills = knownSkills.filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, 'i').test(rawText);
  });

  return cleanNormalizedObject(
    {
      title,
      company: companyName,
      location,
      country: 'India',
      experienceMin: expMin,
      experienceMax: expMax,
      employmentType: /internship/i.test(rawText) ? 'Internship' : 'Full-Time',
      workMode,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: 'INR',
      category: sourceContext.category || 'Tech',
      skills: matchedSkills,
      description: rawText,
      shortDescription: rawText.substring(0, 150) + '...',
      originalUrl: cleanUrl,
      isFresherFriendly: isFresher,
    },
    sourceContext
  );
}

function callGeminiAPI(rawText, apiKey, sourceContext) {
  return new Promise((resolve, reject) => {
    const prompt = `
You are an expert AI job data extractor for HingOut platform.
Extract structured job details from the following raw job posting text.

CRITICAL RULES:
1. NEVER invent or hallucinate information.
2. If salary is not explicitly stated, set salaryMin and salaryMax to null.
3. Extract original employer application URL, ignoring social links (WhatsApp/Telegram).
4. Determine isFresherFriendly: true if required experience <= 1 year or freshers eligible.

RAW TEXT:
"""
${rawText}
"""

SOURCE CONTEXT:
Category Preference: ${sourceContext.category || 'Tech'}

Respond strictly with a valid JSON object or Array of JSON objects if multiple job postings exist.
`;

    const requestBody = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const textResponse = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textResponse) {
            const structured = JSON.parse(textResponse);
            if (Array.isArray(structured)) {
              resolve(structured.map((s) => cleanNormalizedObject(s, sourceContext)));
            } else {
              resolve(cleanNormalizedObject(structured, sourceContext));
            }
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(requestBody);
    req.end();
  });
}

function cleanNormalizedObject(obj, sourceContext) {
  return {
    title: obj.title || 'Software Opportunity',
    company: obj.company || sourceContext.companyName || 'Hiring Company',
    location: obj.location || 'Remote',
    country: obj.country || 'India',
    experienceMin: typeof obj.experienceMin === 'number' ? obj.experienceMin : null,
    experienceMax: typeof obj.experienceMax === 'number' ? obj.experienceMax : null,
    employmentType: ['Full-Time', 'Part-Time', 'Internship', 'Contract', 'Freelance'].includes(obj.employmentType)
      ? obj.employmentType
      : 'Full-Time',
    workMode: ['On-site', 'Hybrid', 'Remote'].includes(obj.workMode) ? obj.workMode : 'On-site',
    salaryMin: typeof obj.salaryMin === 'number' ? obj.salaryMin : null,
    salaryMax: typeof obj.salaryMax === 'number' ? obj.salaryMax : null,
    salaryCurrency: obj.salaryCurrency || 'INR',
    category: obj.category || sourceContext.category || 'Tech',
    skills: Array.isArray(obj.skills) ? obj.skills : [],
    description: obj.description || 'Job details available on original site.',
    shortDescription: obj.shortDescription || (obj.description ? obj.description.substring(0, 140) + '...' : ''),
    originalUrl: obj.originalUrl || sourceContext.url || '',
    canonicalUrl: obj.canonicalUrl || obj.originalUrl || sourceContext.url || '',
    isFresherFriendly: Boolean(obj.isFresherFriendly),
  };
}

module.exports = { normalizeJobWithAI };
