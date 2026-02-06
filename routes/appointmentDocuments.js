const express = require("express");
const Appointment = require("../modal/Appointment");
const upload = require("../middleware/cloudinaryUpload");
const cloudinary = require("../config/cloudinary");
const auth = require("../middleware/auth");

const router = express.Router();

router.post(
  "/:appointmentId/documents",
  auth.authenticate,
  (req, res, next) => {
    upload.array("documents")(req, res, (err) => {
      if (err) {
        console.error("Multer/Cloudinary error:", err);
        return res.status(400).json({
          message: "File upload failed",
          error: err.message,
        });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (req.auth.type !== "doctor") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const appointment = await Appointment.findById(req.params.appointmentId);
      if (!appointment) {
        return res.status(404).json({ message: "Not found" });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const docs = req.files.map((f) => ({
        url: f.path,
        key: f.filename,
        type: "other",
        uploadedBy: "doctor",
      }));

      appointment.documents.push(...docs);
      await appointment.save();

      res.json(docs);
    } catch (error) {
      console.error("Upload handler error:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

/**
 * Delete document
 */
router.delete(
  "/:appointmentId/documents/:key",
  auth.authenticate,
  async (req, res) => {
    if (req.auth.type !== "doctor")
      return res.status(403).json({ message: "Forbidden" });

    await cloudinary.uploader.destroy(req.params.key, {
      resource_type: "raw",
    });

    await Appointment.updateOne(
      { _id: req.params.appointmentId },
      { $pull: { documents: { key: req.params.key } } },
    );

    res.json({ success: true });
  },
);

module.exports = router;
