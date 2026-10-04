const { fetchArthaJobs, fetchArthaFilters } = require('../services/arthaService');
const Job = require('../models/Job');
const Company = require('../models/Company');
const JobSource = require('../models/JobSource');

global.arthaJobCache = global.arthaJobCache || new Map();

// ── GET /api/artha/jobs (Proxy Public Jobs Feed) ────────────────
exports.getArthaJobs = async (req, res) => {
  try {
    const {
      limit = 12,
      offset = 0,
      q,
      location,
      state,
      city,
      job_type,
      work_mode,
      exp_level,
      salary_min,
      salary_max,
      sort_by = 'newest',
    } = req.query;

    const queryParams = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      q,
      location,
      state,
      city,
      job_type,
      work_mode,
      exp_level,
      salary_min,
      salary_max,
      sort_by,
    };

    const arthaResponse = await fetchArthaJobs(queryParams);

    // Cache all fetched items into memory for instantaneous lookup on detail page
    const items = arthaResponse?.data?.items || [];
    items.forEach((item) => {
      if (item.id) global.arthaJobCache.set(String(item.id), item);
      if (item.slug) global.arthaJobCache.set(String(item.slug), item);
    });

    res.json(arthaResponse);
  } catch (err) {
    console.error('Artha Controller Error:', err);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.error || { code: 'SERVER_ERROR', message: err.message },
      requestId: err.requestId || null,
    });
  }
};

// ── GET /api/artha/filters (Proxy Filter Dropdowns) ──────────────
exports.getArthaFilters = async (req, res) => {
  try {
    const arthaFilters = await fetchArthaFilters();
    res.json(arthaFilters);
  } catch (err) {
    console.error('Artha Filters Controller Error:', err);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.error || { code: 'SERVER_ERROR', message: err.message },
    });
  }
};

// ── GET /api/artha/jobs/:id (Get Single Job with Creator Info) ────
exports.getArthaJobById = async (req, res) => {
  try {
    const { id } = req.params;
    const { ref } = req.query;

    let jobData = global.arthaJobCache.get(String(id));

    if (!jobData) {
      try {
        const { fetchArthaJobById } = require('../services/arthaService');
        const arthaRes = await fetchArthaJobById(id);
        jobData = arthaRes?.data || arthaRes;
      } catch (apiErr) {
        const isValidObjectId = id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id);
        const dbJob = await Job.findOne({
          $or: [{ sourceJobId: id }, { slug: id }, { _id: isValidObjectId ? id : null }],
        }).populate('companyId');

        if (dbJob) {
          jobData = {
            id: dbJob.sourceJobId || dbJob._id,
            title: dbJob.title,
            company: dbJob.companyId?.name || 'Company',
            logo: dbJob.companyId?.logo || '',
            location: dbJob.location,
            country: dbJob.country,
            job_type: dbJob.employmentType?.toLowerCase(),
            work_mode: dbJob.workMode?.toLowerCase(),
            description: dbJob.description,
            skills: dbJob.skills,
            url: dbJob.canonicalUrl || dbJob.originalUrl,
            cpc_rate: dbJob.cpcRate || 1.84,
            cpa_rate: dbJob.cpaRate || 0.70,
            posted_date: dbJob.createdAt,
          };
        }
      }
    }

    if (!jobData) {
      return res.status(404).json({ success: false, message: 'Job posting not found.' });
    }

    // Ensure CPC and CPA fields are normalized
    jobData.cpc_rate = jobData.cpc_rate || 1.84;
    jobData.cpa_rate = jobData.cpa_rate || 0.70;

    let creatorInfo = null;
    if (ref) {
      const User = require('../models/User');
      const isValidObjectId = ref.length === 24 && /^[0-9a-fA-F]{24}$/.test(ref);
      const creator = await User.findOne({
        $or: [{ referralCode: ref }, { _id: isValidObjectId ? ref : null }],
      }).select('name email linkedInUrl primaryPlatform role');

      if (creator) {
        creatorInfo = {
          name: creator.name,
          role: creator.role,
          platform: creator.primaryPlatform || 'Creator',
        };
      }
    }

    res.json({
      success: true,
      data: jobData,
      creator: creatorInfo,
    });
  } catch (err) {
    console.error('Error in getArthaJobById:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/artha/jobs/:id/apply (Click Tracking & Target Redirect) ──
exports.trackArthaApplyAndRedirect = async (req, res) => {
  try {
    const { id } = req.params;
    const { ref } = req.query;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Browser';

    let targetUrl = 'https://www.hingeout.com/jobs';
    let jobTitle = 'Job Opportunity';

    const cachedItem = global.arthaJobCache.get(String(id));
    if (cachedItem && cachedItem.url) {
      targetUrl = cachedItem.url;
      jobTitle = cachedItem.title;
    } else {
      try {
        const { fetchArthaJobById } = require('../services/arthaService');
        const arthaRes = await fetchArthaJobById(id);
        const item = arthaRes?.data || arthaRes;
        if (item && item.url) {
          targetUrl = item.url;
          jobTitle = item.title;
        }
      } catch {
        const isValidObjectId = id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id);
        const dbJob = await Job.findOne({ $or: [{ sourceJobId: id }, { slug: id }, { _id: isValidObjectId ? id : null }] });
        if (dbJob && (dbJob.canonicalUrl || dbJob.originalUrl)) {
          targetUrl = dbJob.canonicalUrl || dbJob.originalUrl;
          jobTitle = dbJob.title;
        }
      }
    }

    // Process creator attribution if ref code is present
    if (ref) {
      const User = require('../models/User');
      const JobClick = require('../models/JobClick');
      const isValidObjectId = ref.length === 24 && /^[0-9a-fA-F]{24}$/.test(ref);

      const creator = await User.findOne({
        $or: [{ referralCode: ref }, { _id: isValidObjectId ? ref : null }],
      });

      if (creator) {
        const cpcRate = 1.84; // Standard Artha CPC rate
        const clickDate = new Date();
        clickDate.setHours(0, 0, 0, 0);

        const existingClick = await JobClick.findOne({
          creatorId: creator._id,
          visitorIp: ip,
          createdAt: { $gte: clickDate },
        });

        const isUnique = !existingClick;

        await JobClick.create({
          creatorId: creator._id,
          referrerUserId: creator._id,
          jobId: id,
          jobTitle: jobTitle,
          referralCode: ref,
          refCode: ref,
          ipAddress: ip,
          visitorIp: ip,
          userAgent,
          isUniqueClick: isUnique,
          isUnique: isUnique,
          cpcEarned: cpcRate,
          timestamp: new Date(),
        });

        creator.totalClicksDriven = (creator.totalClicksDriven || 0) + 1;
        if (isUnique) {
          creator.totalUniqueClicksDriven = (creator.totalUniqueClicksDriven || 0) + 1;
          creator.cpcBalance = (creator.cpcBalance || 0) + cpcRate;
        }
        await creator.save();
      }
    }

    return res.redirect(302, targetUrl);
  } catch (err) {
    console.error('Error tracking Artha apply redirect:', err);
    res.redirect(302, 'https://www.hingeout.com/jobs');
  }
};

// ── POST /api/artha/sync (Optional DB Ingestion Engine) ──────────
exports.syncArthaJobsToDatabase = async (req, res) => {
  try {
    const arthaData = await fetchArthaJobs({ limit: 50, sort_by: 'newest' });
    const items = arthaData?.data?.items || [];

    if (items.length === 0) {
      return res.json({ success: true, message: 'No jobs found on Artha to sync.', syncedCount: 0 });
    }

    // Ensure Artha JobSource exists in database
    let source = await JobSource.findOne({ sourceType: 'API', name: 'Artha.link Creator Feed' });
    if (!source) {
      source = await JobSource.create({
        name: 'Artha.link Creator Feed',
        slug: 'artha-link-creator-feed',
        sourceType: 'API',
        targetUrl: 'https://api.artha.link/api/v1/jobs',
        status: 'HEALTHY',
        crawlFrequencyHours: 12,
      });
    }

    let syncedCount = 0;

    for (const item of items) {
      // Find or create Company
      const companyName = item.company || 'Featured Company';
      const companySlug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      let company = await Company.findOne({ slug: companySlug });
      if (!company) {
        company = await Company.create({
          name: companyName,
          slug: companySlug,
          logo: item.logo || '',
          website: '',
        });
      }

      // Format slug
      const jobSlug = item.slug || `artha-${item.id || Date.now()}`;
      const originalUrl = item.url; // Creator-attributed URL!

      const existingJob = await Job.findOne({ $or: [{ slug: jobSlug }, { canonicalUrl: originalUrl }] });

      const jobPayload = {
        companyId: company._id,
        title: item.title,
        slug: jobSlug,
        description: item.description || `<p>${item.title} at ${companyName}</p>`,
        shortDescription: `${item.title} at ${companyName} (${item.location || 'Remote'})`,
        location: item.location || [item.city, item.state, item.country].filter(Boolean).join(', ') || 'Remote',
        country: item.country || 'India',
        employmentType: item.job_type === 'full-time' ? 'Full-Time' : item.job_type === 'internship' ? 'Internship' : 'Full-Time',
        workMode: item.work_mode === 'remote' ? 'Remote' : item.work_mode === 'hybrid' ? 'Hybrid' : 'On-site',
        salaryMin: item.salary_min || null,
        salaryMax: item.salary_max || null,
        salaryCurrency: item.salary_curr || 'INR',
        category: item.industry || 'Tech',
        skills: item.skills || [],
        sourceId: source._id,
        sourceJobId: String(item.id),
        sourceType: 'API',
        originalUrl: originalUrl,
        canonicalUrl: originalUrl,
        status: 'ACTIVE',
        isVerified: true,
        verificationStatus: 'VERIFIED',
        relevanceScore: 90,
      };

      if (!existingJob) {
        await Job.create(jobPayload);
        syncedCount++;
      } else {
        await Job.findByIdAndUpdate(existingJob._id, jobPayload);
      }
    }

    res.json({
      success: true,
      message: `Successfully synced ${syncedCount} Artha creator jobs to database!`,
      syncedCount,
      totalFetched: items.length,
    });
  } catch (err) {
    console.error('Error syncing Artha jobs:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
