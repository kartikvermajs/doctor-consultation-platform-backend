const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

/* =========================================================
   ALLOWED FILE TYPES
   ========================================================= */

const IMAGE_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const PDF_MIME_TYPES = ["application/pdf"];

const ALLOWED_MIME_TYPES = [...IMAGE_MIME_TYPES, ...PDF_MIME_TYPES];

/* =========================================================
   CLOUDINARY STORAGE CONFIG
   ========================================================= */

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    // Determine resource type
    const isPdf = PDF_MIME_TYPES.includes(file.mimetype);

    // Sanitize original filename
    const safeName = file.originalname
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .toLowerCase();

    return {
      folder: "appointments/documents",
      resource_type: isPdf ? "raw" : "image",
      public_id: `${Date.now()}-${safeName}`,
      overwrite: false,
    };
  },
});

/* =========================================================
   MULTER FILE FILTER (HARD FAIL)
   ========================================================= */

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        "Only JPG, JPEG, PNG, WEBP images and PDF files are allowed",
      ),
      false,
    );
  }

  cb(null, true);
};

/* =========================================================
   MULTER INSTANCE (HARDENED)
   ========================================================= */

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per file
    files: 5, // max 5 files per request
  },
});

module.exports = upload;
