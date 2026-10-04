const Job = require('../models/Job');
const JobClick = require('../models/JobClick');
const Company = require('../models/Company');
const JobSource = require('../models/JobSource');

// ── GET /api/admin/jobs/analytics (Admin Dashboard Analytics) ──
exports.getAdminAnalytics = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalJobs,
      activeJobs,
      jobsAddedToday,
      jobsExpiredToday,
      activeCompanies,
      activeSources,
    ] = await Promise.all([
      Job.countDocuments(),
      Job.countDocuments({ status: 'ACTIVE' }),
      Job.countDocuments({ createdAt: { $gte: todayStart } }),
      Job.countDocuments({ status: 'EXPIRED', updatedAt: { $gte: todayStart } }),
      Company.countDocuments(),
      JobSource.countDocuments({ active: true }),
    ]);

    // Aggregate total views and clicks
    const totalsAgg = await Job.aggregate([
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$viewsCount' },
          totalClicks: { $sum: '$applyClicksCount' },
        },
      },
    ]);

    const totalViews = totalsAgg[0]?.totalViews || 0;
    const totalClicks = totalsAgg[0]?.totalClicks || 0;
    const applyCtr = totalViews > 0 ? Number(((totalClicks / totalViews) * 100).toFixed(2)) : 0;

    // Aggregated Company Breakdown
    const companyAnalytics = await Job.aggregate([
      {
        $group: {
          _id: '$companyId',
          jobCount: { $sum: 1 },
          views: { $sum: '$viewsCount' },
          clicks: { $sum: '$applyClicksCount' },
        },
      },
      {
        $lookup: {
          from: 'companies',
          localField: '_id',
          foreignField: '_id',
          as: 'company',
        },
      },
      { $unwind: '$company' },
      {
        $project: {
          companyId: '$_id',
          companyName: '$company.name',
          logo: '$company.logo',
          jobCount: 1,
          views: 1,
          clicks: 1,
          ctr: {
            $cond: [
              { $gt: ['$views', 0] },
              { $multiply: [{ $divide: ['$clicks', '$views'] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { clicks: -1 } },
      { $limit: 10 },
    ]);

    // Aggregated Source Breakdown
    const sourceAnalytics = await JobSource.find().populate('companyId', 'name');
    const sourceStats = await Promise.all(
      sourceAnalytics.map(async (src) => {
        const jobStats = await Job.aggregate([
          { $match: { sourceId: src._id } },
          {
            $group: {
              _id: null,
              jobsFound: { $sum: 1 },
              clicksGenerated: { $sum: '$applyClicksCount' },
            },
          },
        ]);

        return {
          sourceId: src._id,
          sourceName: src.name,
          companyName: src.companyId?.name || 'N/A',
          type: src.type,
          status: src.status,
          jobsFound: jobStats[0]?.jobsFound || 0,
          clicksGenerated: jobStats[0]?.clicksGenerated || 0,
        };
      })
    );

    // Aggregated Top User Referrers
    const topReferrers = await JobClick.aggregate([
      { $match: { referralCode: { $ne: '' } } },
      {
        $group: {
          _id: '$referralCode',
          referralCode: { $first: '$referralCode' },
          totalClicks: { $sum: 1 },
          lastClickAt: { $max: '$timestamp' },
        },
      },
      { $sort: { totalClicks: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      success: true,
      summary: {
        totalJobs,
        activeJobs,
        jobsAddedToday,
        jobsExpiredToday,
        totalJobViews: totalViews,
        totalApplyClicks: totalClicks,
        applyCtr,
        activeCompanies,
        activeSources,
        totalReferralClicks: topReferrers.reduce((acc, r) => acc + r.totalClicks, 0),
      },
      companyAnalytics,
      sourceAnalytics: sourceStats,
      referralAnalytics: topReferrers,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
