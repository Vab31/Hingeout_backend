// config/cloudinary.js
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure the cloud storage rule specifically for PDFs/Resumes
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "student_resumes",
    resource_type: "raw", // CRITICAL: This allows PDFs and DOCX files instead of just images
    public_id: (req, file) => `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`,
  },
});

const upload = multer({ storage: storage });

module.exports = upload;