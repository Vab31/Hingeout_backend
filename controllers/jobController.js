const Job = require('../models/Job');
const Company = require('../models/Company');
const JobSource = require('../models/JobSource');
const slugify = require('../utils/slugify');

/**
 * Helper to slugify title
 */
const generateSlug = (title, companyName) => {
  const base = `${title} ${companyName || ''} ${Math.floor(1000 + Math.random() * 9000)}`;
  return slugify(base, { lower: true, strict: true });
};

// ── Admin: List all jobs with filters & pagination ────────
exports.getAdminJobs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const { status, category, search, fresher, sourceType } = req.query;
    const query = {};

    if (status) query.status = status;
    if (category) query.category = category;
    if (sourceType) query.sourceType = sourceType;
    if (fresher === 'true') query.isFresherFriendly = true;

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { skills: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .populate('companyId', 'name logo website')
      .populate('sourceId', 'name type url')
      .sort({ createdAt: -1 })
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

// ── Admin: Get Review Queue (DRAFT / NEEDS_REVIEW jobs) ───
exports.getReviewQueue = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {
      $or: [
        { status: 'DRAFT' },
        { verificationStatus: 'NEEDS_REVIEW' },
      ],
    };

    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .populate('companyId', 'name logo website')
      .populate('sourceId', 'name type url')
      .sort({ createdAt: -1 })
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

// ── Admin / Public: Get single job details ────────────────
exports.getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('companyId')
      .populate('sourceId');

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    res.json({ success: true, data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: Create single job manually ─────────────────────
exports.createJob = async (req, res) => {
  try {
    const {
      companyId,
      title,
      description,
      shortDescription,
      location,
      country,
      experienceMin,
      experienceMax,
      employmentType,
      workMode,
      salaryMin,
      salaryMax,
      salaryCurrency,
      category,
      skills,
      sourceId,
      sourceJobId,
      sourceType,
      originalUrl,
      canonicalUrl,
      isFresherFriendly,
      status,
    } = req.body;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(400).json({ success: false, message: 'Invalid Company ID' });
    }

    const slug = generateSlug(title, company.name);

    const job = await Job.create({
      companyId,
      title,
      slug,
      description,
      shortDescription: shortDescription || '',
      location: location || 'Remote',
      country: country || 'India',
      experienceMin: experienceMin ?? null,
      experienceMax: experienceMax ?? null,
      employmentType: employmentType || 'Full-Time',
      workMode: workMode || 'Remote',
      salaryMin: salaryMin ?? null,
      salaryMax: salaryMax ?? null,
      salaryCurrency: salaryCurrency || 'INR',
      category,
      skills: Array.isArray(skills) ? skills : [],
      sourceId,
      sourceJobId: sourceJobId || null,
      sourceType: sourceType || 'MANUAL_URL',
      originalUrl,
      canonicalUrl: canonicalUrl || originalUrl,
      isFresherFriendly: isFresherFriendly || (experienceMin !== null && experienceMin <= 1),
      status: status || 'DRAFT',
    });

    res.status(201).json({ success: true, data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: Update job details ─────────────────────────────
exports.updateJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    Object.assign(job, req.body);
    await job.save();

    res.json({ success: true, data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: Publish job ────────────────────────────────────
exports.publishJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    job.status = 'ACTIVE';
    job.isVerified = true;
    job.verificationStatus = 'VERIFIED';
    job.lastVerifiedAt = new Date();
    await job.save();

    res.json({ success: true, message: 'Job published successfully', data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: Reject job ─────────────────────────────────────
exports.rejectJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    job.status = 'REJECTED';
    await job.save();

    res.json({ success: true, message: 'Job rejected', data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: Expire job ─────────────────────────────────────
exports.expireJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    job.status = 'EXPIRED';
    job.verificationStatus = 'EXPIRED';
    await job.save();

    res.json({ success: true, message: 'Job marked as expired', data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: Delete job ─────────────────────────────────────
exports.deleteJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndDelete(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    res.json({ success: true, message: 'Job deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: Bulk action on jobs ────────────────────────────
exports.bulkJobAction = async (req, res) => {
  try {
    const { action, jobIds } = req.body;

    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return res.status(400).json({ success: false, message: 'jobIds array is required' });
    }

    let result;
    if (action === 'publish') {
      result = await Job.updateMany(
        { _id: { $in: jobIds } },
        {
          status: 'ACTIVE',
          isVerified: true,
          verificationStatus: 'VERIFIED',
          lastVerifiedAt: new Date(),
        }
      );
    } else if (action === 'reject') {
      result = await Job.updateMany(
        { _id: { $in: jobIds } },
        { status: 'REJECTED' }
      );
    } else if (action === 'expire') {
      result = await Job.updateMany(
        { _id: { $in: jobIds } },
        { status: 'EXPIRED', verificationStatus: 'EXPIRED' }
      );
    } else if (action === 'delete') {
      result = await Job.deleteMany({ _id: { $in: jobIds } });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action parameter' });
    }

    res.json({ success: true, message: `Bulk action '${action}' completed`, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
