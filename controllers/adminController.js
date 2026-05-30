// const User = require('../models/User');
// const { sendBulkEmail } = require('../utils/email');
// const { generateAccessToken } = require('../utils/jwt'); // use your existing utility

// exports.adminLogin = async (req, res) => {
//   const { email, password } = req.body;

//   if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
//     // Generate token with role: 'admin'
//     const token = generateAccessToken({ userId: 'admin_root', role: 'admin' });

//     return res.json({
//       success: true,
//       token,
//       message: "Welcome back, Admin"
//     });
//   }
//   res.status(401).json({ success: false, message: "Invalid credentials" });
// };

// exports.sendJobToTargetedUsers = async (req, res) => {
//   const { title, url, category } = req.body;

//   try {
//     // Find verified students interested in this category
//     const recipients = await User.find({ 
//       jobTypes: category, 
//       isVerified: true 
//     }).select('email');

//     if (recipients.length === 0) {
//       return res.status(404).json({ message: `No students found for ${category}` });
//     }

//     const emailList = recipients.map(u => u.email);

//     // Using your email utility (passing the object it expects)
//     await sendBulkEmail({
//       recipients: emailList,
//       subject: `New ${category} Opening: ${title}`,
//       message: `A new position matching your profile is live: ${title}\nApply here: ${url}`,
//       adminName: "Counsellor Team"
//     });

//     res.json({ success: true, count: emailList.length });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };


const User = require('../models/User');
const connectDB = require('../config/db'); // 1. Import your fixed connection helper
const { sendBulkEmail } = require('../utils/email');
const { generateAccessToken } = require('../utils/jwt'); 

// ─────────────────────────────────────────────────────────────
// 1. POST /api/admin/login
// ─────────────────────────────────────────────────────────────
exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;

  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    // Generate token with role: 'admin'
    const token = generateAccessToken({ userId: 'admin_root', role: 'admin' });

    return res.json({
      success: true,
      token,
      message: "Welcome back, Admin"
    });
  }
  res.status(401).json({ success: false, message: "Invalid credentials" });
};

// ─────────────────────────────────────────────────────────────
// 2. POST /api/admin/send-job
// ─────────────────────────────────────────────────────────────
exports.sendJobToTargetedUsers = async (req, res) => {
  const { title, url, category } = req.body;

  try {
    // ENSURE DATABASE CONNECTION IS READY BEFORE THE QUERY RUNS
    await connectDB();

    // Find verified students interested in this category
    const recipients = await User.find({ 
      jobTypes: category, 
      isVerified: true 
    }).select('email');

    if (recipients.length === 0) {
      return res.status(404).json({ message: `No students found for ${category}` });
    }

    const emailList = recipients.map(u => u.email);

    // Using your email utility (passing the object it expects)
    await sendBulkEmail({
      recipients: emailList,
      subject: `New ${category} Opening: ${title}`,
      message: `A new position matching your profile is live: ${title}\nApply here: ${url}`,
      adminName: "Counsellor Team"
    });

    res.json({ success: true, count: emailList.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};