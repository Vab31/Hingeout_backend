const Job = require('../models/Job');
const JobClick = require('../models/JobClick');
const Category = require('../models/Category');
const Skill = require('../models/Skill');

// ── GET /api/jobs (Public Job Search & Filters) ───────────
exports.getPublicJobs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const { search, location, category, employmentType, workMode, fresher, company } = req.query;

    const query = { status: 'ACTIVE' };

    if (category) query.category = category;
    if (employmentType) query.employmentType = employmentType;
    if (workMode) query.workMode = workMode;
    if (fresher === 'true') query.isFresherFriendly = true;

    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { skills: { $regex: search, $options: 'i' } },
      ];
    }

    if (company) {
      query.companyId = company;
    }

    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .populate('companyId', 'name logo website')
      .select('-sourceJobId -verificationStatus')
      .sort({ postedDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      count: jobs.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: jobs,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/jobs/:slug (Public Single Job Details) ────────
exports.getPublicJobBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const job = await Job.findOne({ slug, status: 'ACTIVE' })
      .populate('companyId', 'name logo website careerUrl description')
      .select('-sourceJobId');

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job posting not found or expired' });
    }

    // Increment views count asynchronously
    Job.findByIdAndUpdate(job._id, { $inc: { viewsCount: 1 } }).exec().catch(() => {});

    // Fetch related jobs (same category or company)
    const relatedJobs = await Job.find({
      _id: { $ne: job._id },
      status: 'ACTIVE',
      $or: [{ category: job.category }, { companyId: job.companyId }],
    })
      .populate('companyId', 'name logo')
      .select('title slug location employmentType workMode postedDate isFresherFriendly')
      .limit(4);

    res.json({
      success: true,
      data: job,
      relatedJobs,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/jobs/:id/apply (CRITICAL: Click Tracking & Redirect) ──
exports.trackApplyAndRedirect = async (req, res) => {
  try {
    const { id } = req.params;
    const refParam = (req.query.ref || req.query.referrer || '').toString().trim();

    // 1. Retrieve job strictly from database
    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (job.status !== 'ACTIVE') {
      return res.status(410).json({ success: false, message: 'This job posting has expired or is no longer active' });
    }

    const destinationUrl = job.canonicalUrl || job.originalUrl;
    if (!destinationUrl) {
      return res.status(500).json({ success: false, message: 'Application URL is missing for this job' });
    }

    // 2. Parse request analytics metadata
    const userAgent = req.headers['user-agent'] || '';
    const referrer = req.headers['referer'] || req.headers['referrer'] || '';
    const clientIp = (req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || '').toString().split(',')[0].trim();
    let deviceType = 'desktop';
    if (/mobile/i.test(userAgent)) deviceType = 'mobile';
    else if (/tablet|ipad/i.test(userAgent)) deviceType = 'tablet';

    // 3. Resolve Creator User by ID or referralCode
    const User = require('../models/User');
    const mongoose = require('mongoose');
    let referrerUserId = null;
    let referralCode = refParam;
    let creatorUser = null;

    if (refParam) {
      if (mongoose.Types.ObjectId.isValid(refParam)) {
        creatorUser = await User.findById(refParam);
      }
      if (!creatorUser) {
        creatorUser = await User.findOne({ referralCode: refParam });
      }
      if (creatorUser) {
        referrerUserId = creatorUser._id;
        referralCode = creatorUser.referralCode || refParam;
      }
    }

    // 4. IP Deduplication / Fraud Check (24h window per IP per job)
    let isUniqueClick = true;
    if (clientIp) {
      const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentClick = await JobClick.findOne({
        jobId: job._id,
        ipAddress: clientIp,
        timestamp: { $gte: past24h },
      });
      if (recentClick) {
        isUniqueClick = false;
      }
    }

    const cpcEarned = (isUniqueClick && job.isCpcEnabled) ? (job.cpcRate || 0) : 0;

    // 5. Asynchronously log click & update creator metrics
    JobClick.create({
      jobId: job._id,
      jobTitle: job.title || '',
      timestamp: new Date(),
      referrer: referrer.substring(0, 300),
      deviceType,
      userAgent: userAgent.substring(0, 300),
      ipAddress: clientIp,
      visitorIp: clientIp,
      referrerUserId,
      creatorId: referrerUserId,
      referralCode: referralCode.substring(0, 100),
      refCode: referralCode.substring(0, 100),
      isUniqueClick,
      isUnique: isUniqueClick,
      cpcEarned,
    }).catch((err) => console.error('Error logging job click:', err.message));

    if (creatorUser) {
      const creatorUpdates = {
        $inc: {
          totalClicksDriven: 1,
          ...(isUniqueClick ? { totalUniqueClicksDriven: 1, cpcBalance: cpcEarned } : {}),
        },
      };
      User.findByIdAndUpdate(creatorUser._id, creatorUpdates).exec().catch(() => {});
    }

    Job.findByIdAndUpdate(job._id, { $inc: { applyClicksCount: 1 } }).exec().catch(() => {});

    // 6. Safe 302 Redirect strictly to database-stored target URL
    return res.redirect(302, destinationUrl);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/jobs/meta/categories ──────────────────────────
exports.getCategories = async (req, res) => {
  try {
    const categories = await Job.aggregate([
      { $match: { status: 'ACTIVE' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
