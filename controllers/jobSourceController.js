const JobSource = require('../models/JobSource');
const JobRun = require('../models/JobRun');
const Company = require('../models/Company');
const Job = require('../models/Job');
const { normalizeJobWithAI } = require('../services/ai/jobNormalizer');
const { validateApplicationUrl } = require('../services/urlValidator');
const { calculateRelevanceScore } = require('../services/processing/relevanceScorer');
const { checkDuplicateJob } = require('../services/processing/deduplicator');
const { extractLdJsonJobs } = require('../services/adapters/ldJsonExtractor');
const { fetchGreenhouseJobs } = require('../services/adapters/greenhouseAdapter');
const { fetchLeverJobs } = require('../services/adapters/leverAdapter');
const slugify = require('../utils/slugify');
const https = require('https');
const http = require('http');

// ── Admin: List all job sources ───────────────────────────
exports.getJobSources = async (req, res) => {
  try {
    const sources = await JobSource.find()
      .populate('companyId', 'name logo website')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: sources.length, data: sources });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: Add new job source ─────────────────────────────
exports.createJobSource = async (req, res) => {
  try {
    const { name, companyId, type, url, extractionMethod, crawlFrequencyHours, autoPublish } = req.body;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(400).json({ success: false, message: 'Invalid company ID' });
    }

    const source = await JobSource.create({
      name,
      companyId,
      type,
      url,
      extractionMethod: extractionMethod || 'API',
      crawlFrequencyHours: crawlFrequencyHours || 24,
      autoPublish: Boolean(autoPublish),
      active: true,
      status: 'HEALTHY',
    });

    res.status(201).json({ success: true, data: source });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: Update job source ──────────────────────────────
exports.updateJobSource = async (req, res) => {
  try {
    const source = await JobSource.findById(req.params.id);
    if (!source) {
      return res.status(404).json({ success: false, message: 'Job source not found' });
    }

    Object.assign(source, req.body);
    await source.save();

    res.json({ success: true, data: source });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: Delete job source ──────────────────────────────
exports.deleteJobSource = async (req, res) => {
  try {
    const source = await JobSource.findByIdAndDelete(req.params.id);
    if (!source) {
      return res.status(404).json({ success: false, message: 'Job source not found' });
    }

    res.json({ success: true, message: 'Source deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: Trigger REAL live crawler for a source ─────────
exports.triggerSourceCrawl = async (req, res) => {
  try {
    const source = await JobSource.findById(req.params.id).populate('companyId');
    if (!source) {
      return res.status(404).json({ success: false, message: 'Source not found' });
    }

    const startTime = new Date();
    let jobsFoundCount = 0;
    let jobsNewCount = 0;
    let jobsDuplicateCount = 0;
    let jobsFailedCount = 0;

    let extractedList = [];

    // 1. Check Source Type for Dedicated ATS Adapters
    if (source.type === 'GREENHOUSE') {
      const boardToken = extractTokenFromUrl(source.url) || source.companyId.name.toLowerCase();
      extractedList = await fetchGreenhouseJobs(boardToken);
    } else if (source.type === 'LEVER') {
      const companyToken = extractTokenFromUrl(source.url) || source.companyId.name.toLowerCase();
      extractedList = await fetchLeverJobs(companyToken);
    } else {
      // 2. Fetch HTML content for Generic / Company Career Pages
      const { rawHtml, cleanText } = await fetchSourceContentWithHtml(source.url);

      if (rawHtml) {
        // Try LD+JSON structured script extraction first (multi-job detection)
        const ldJobs = extractLdJsonJobs(rawHtml);
        if (ldJobs.length > 0) {
          extractedList = ldJobs;
        } else {
          // Fallback to AI / Heuristic Normalizer
          const normalized = await normalizeJobWithAI(cleanText.substring(0, 5000), {
            companyName: source.companyId?.name || source.name,
            url: source.url,
            category: 'Tech',
          });
          extractedList = Array.isArray(normalized) ? normalized : [normalized];
        }
      }
    }

    jobsFoundCount = extractedList.length;

    // 3. Process each extracted job document
    for (const item of extractedList) {
      try {
        const targetUrl = item.originalUrl || source.url;
        const urlValidation = await validateApplicationUrl(targetUrl);
        const duplicateCheck = await checkDuplicateJob(
          {
            ...item,
            companyId: source.companyId._id,
            canonicalUrl: item.canonicalUrl || targetUrl,
          },
          source._id
        );

        if (duplicateCheck.isDuplicate) {
          jobsDuplicateCount++;
        } else {
          const score = calculateRelevanceScore(item, 15, urlValidation.isValid);
          const jobSlug = slugify(`${item.title} ${source.companyId.name} ${Math.floor(1000 + Math.random() * 9000)}`);

          await Job.create({
            companyId: source.companyId._id,
            title: item.title,
            slug: jobSlug,
            description: item.description,
            shortDescription: item.shortDescription,
            location: item.location,
            country: item.country || 'India',
            experienceMin: item.experienceMin,
            experienceMax: item.experienceMax,
            employmentType: item.employmentType,
            workMode: item.workMode,
            category: item.category || 'Tech',
            skills: item.skills,
            sourceId: source._id,
            sourceType: source.type,
            originalUrl: targetUrl,
            canonicalUrl: item.canonicalUrl || targetUrl,
            relevanceScore: score,
            isFresherFriendly: item.isFresherFriendly,
            isVerified: urlValidation.isValid,
            verificationStatus: urlValidation.status,
            status: source.autoPublish ? 'ACTIVE' : 'DRAFT',
            postedDate: new Date(),
          });

          jobsNewCount++;
        }
      } catch (jobErr) {
        jobsFailedCount++;
      }
    }

    // 4. Record JobRun audit history
    const run = await JobRun.create({
      sourceId: source._id,
      startedAt: startTime,
      completedAt: new Date(),
      status: jobsFailedCount > 0 && jobsNewCount === 0 ? 'FAILED' : 'COMPLETED',
      jobsFound: jobsFoundCount,
      jobsNew: jobsNewCount,
      jobsDuplicate: jobsDuplicateCount,
      jobsFailed: jobsFailedCount,
    });

    source.lastCrawledAt = new Date();
    source.lastSuccessAt = new Date();
    source.status = jobsFailedCount > 0 && jobsNewCount === 0 ? 'WARNING' : 'HEALTHY';
    await source.save();

    res.json({
      success: true,
      message: `Crawl completed! Found ${jobsFoundCount} jobs (${jobsNewCount} new, ${jobsDuplicateCount} duplicates).`,
      data: {
        run,
        jobsFound: jobsFoundCount,
        jobsNew: jobsNewCount,
        jobsDuplicate: jobsDuplicateCount,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: Get crawl history runs ─────────────────────────
exports.getCrawlRuns = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const total = await JobRun.countDocuments();
    const runs = await JobRun.find()
      .populate({
        path: 'sourceId',
        select: 'name type url status',
        populate: { path: 'companyId', select: 'name logo' },
      })
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      count: runs.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: runs,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

function fetchSourceContentWithHtml(targetUrl) {
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
            if (data.length < 50000) data += chunk.toString();
          });
          res.on('end', () => {
            const cleanText = data
              .replace(/<script\b[^<]*>([\s\S]*?)<\/script>/gi, '')
              .replace(/<style\b[^<]*>([\s\S]*?)<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            resolve({ rawHtml: data, cleanText });
          });
        }
      );

      req.on('error', () => resolve({ rawHtml: '', cleanText: '' }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ rawHtml: '', cleanText: '' });
      });
    } catch (e) {
      resolve({ rawHtml: '', cleanText: '' });
    }
  });
}

function extractTokenFromUrl(urlStr) {
  try {
    const parts = new URL(urlStr).pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  } catch (e) {
    return '';
  }
}
