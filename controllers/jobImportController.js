const Company = require('../models/Company');
const JobSource = require('../models/JobSource');
const Job = require('../models/Job');
const { normalizeJobWithAI } = require('../services/ai/jobNormalizer');
const { validateApplicationUrl } = require('../services/urlValidator');
const { calculateRelevanceScore } = require('../services/processing/relevanceScorer');
const { checkDuplicateJob } = require('../services/processing/deduplicator');
const slugify = require('../utils/slugify');
const https = require('https');
const http = require('http');

/**
 * Phase 4: Import job post from Telegram raw text
 */
exports.importTelegramPost = async (req, res) => {
  try {
    const { text, category } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, message: 'Telegram text content is required' });
    }

    // 1. Normalize raw text using AI
    const normalized = await normalizeJobWithAI(text, { category: category || 'Tech' });

    // 2. Find or create company
    let company = await Company.findOne({ name: { $regex: new RegExp(`^${normalized.company}$`, 'i') } });
    if (!company) {
      company = await Company.create({
        name: normalized.company,
        slug: slugify(normalized.company + '-' + Math.floor(Math.random() * 1000)),
      });
    }

    // 3. Find or create Telegram JobSource
    let source = await JobSource.findOne({ companyId: company._id, type: 'TELEGRAM' });
    if (!source) {
      source = await JobSource.create({
        name: `${company.name} Telegram Ingestion`,
        companyId: company._id,
        type: 'TELEGRAM',
        url: normalized.originalUrl || 'https://t.me',
        extractionMethod: 'AI_HEURISTIC',
      });
    }

    // 4. Validate URL & Deduplicate
    const urlValidation = await validateApplicationUrl(normalized.originalUrl);
    const duplicateCheck = await checkDuplicateJob(
      { ...normalized, companyId: company._id, canonicalUrl: normalized.canonicalUrl },
      source._id
    );
    const score = calculateRelevanceScore(normalized, 15, urlValidation.isValid);

    const result = {
      companyId: company._id,
      companyName: company.name,
      sourceId: source._id,
      title: normalized.title,
      description: normalized.description,
      shortDescription: normalized.shortDescription,
      location: normalized.location,
      country: normalized.country,
      experienceMin: normalized.experienceMin,
      experienceMax: normalized.experienceMax,
      employmentType: normalized.employmentType,
      workMode: normalized.workMode,
      salaryMin: normalized.salaryMin,
      salaryMax: normalized.salaryMax,
      salaryCurrency: normalized.salaryCurrency,
      category: normalized.category,
      skills: normalized.skills,
      originalUrl: normalized.originalUrl,
      canonicalUrl: normalized.canonicalUrl,
      isFresherFriendly: normalized.isFresherFriendly,
      relevanceScore: score,
      urlStatus: urlValidation.status,
      isUrlValid: urlValidation.isValid,
      isDuplicate: duplicateCheck.isDuplicate,
      duplicateReason: duplicateCheck.reason,
    };

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Phase 5: Manual Source URL Import
 */
exports.importSourceUrl = async (req, res) => {
  try {
    const { url, category, companyName } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, message: 'Source URL is required' });
    }

    // 1. Fetch webpage text content
    const htmlContent = await fetchWebpageText(url);
    if (!htmlContent) {
      return res.status(400).json({ success: false, message: 'Unable to fetch content from the provided URL' });
    }

    // 2. Determine company
    const inferredCompany = companyName || extractCompanyNameFromUrl(url);
    let company = await Company.findOne({ name: { $regex: new RegExp(`^${inferredCompany}$`, 'i') } });
    if (!company) {
      company = await Company.create({
        name: inferredCompany,
        slug: slugify(inferredCompany + '-' + Math.floor(Math.random() * 1000)),
        website: new URL(url).origin,
        careerUrl: url,
      });
    }

    // 3. Find or create Source record
    let source = await JobSource.findOne({ url });
    if (!source) {
      source = await JobSource.create({
        name: `${company.name} Career Page`,
        companyId: company._id,
        type: 'MANUAL_URL',
        url,
        extractionMethod: 'AI_HEURISTIC',
      });
    }

    // 4. Extract and normalize
    const normalized = await normalizeJobWithAI(htmlContent.substring(0, 3500), {
      category: category || 'Tech',
      url,
      companyName: company.name,
    });

    const urlValidation = await validateApplicationUrl(normalized.originalUrl || url);
    const duplicateCheck = await checkDuplicateJob(
      { ...normalized, companyId: company._id, canonicalUrl: normalized.canonicalUrl || url },
      source._id
    );
    const score = calculateRelevanceScore(normalized, 15, urlValidation.isValid);

    const jobResult = {
      companyId: company._id,
      companyName: company.name,
      sourceId: source._id,
      title: normalized.title,
      description: normalized.description,
      shortDescription: normalized.shortDescription,
      location: normalized.location,
      country: normalized.country,
      experienceMin: normalized.experienceMin,
      experienceMax: normalized.experienceMax,
      employmentType: normalized.employmentType,
      workMode: normalized.workMode,
      salaryMin: normalized.salaryMin,
      salaryMax: normalized.salaryMax,
      salaryCurrency: normalized.salaryCurrency,
      category: normalized.category,
      skills: normalized.skills,
      originalUrl: normalized.originalUrl || url,
      canonicalUrl: normalized.canonicalUrl || url,
      isFresherFriendly: normalized.isFresherFriendly,
      relevanceScore: score,
      urlStatus: urlValidation.status,
      isUrlValid: urlValidation.isValid,
      isDuplicate: duplicateCheck.isDuplicate,
      duplicateReason: duplicateCheck.reason,
    };

    const discoverySummary = {
      jobsFound: 1,
      relevantCount: score >= 60 ? 1 : 0,
      fresherCount: normalized.isFresherFriendly ? 1 : 0,
      duplicatesCount: duplicateCheck.isDuplicate ? 1 : 0,
      failedValidationCount: urlValidation.isValid ? 0 : 1,
    };

    res.json({
      success: true,
      summary: discoverySummary,
      data: [jobResult],
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

function fetchWebpageText(targetUrl) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(targetUrl);
      const transport = parsed.protocol === 'https:' ? https : http;

      const req = transport.get(
        targetUrl,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          timeout: 8000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            if (data.length < 15000) data += chunk.toString();
          });
          res.on('end', () => {
            // Strip HTML tags for text extraction
            const text = data
              .replace(/<script\b[^<]*>([\s\S]*?)<\/script>/gi, '')
              .replace(/<style\b[^<]*>([\s\S]*?)<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            resolve(text);
          });
        }
      );

      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

function extractCompanyNameFromUrl(targetUrl) {
  try {
    const hostname = new URL(targetUrl).hostname.replace(/^www\./, '');
    const parts = hostname.split('.');
    const mainDomain = parts[0];
    return mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1);
  } catch (e) {
    return 'Target Company';
  }
}
