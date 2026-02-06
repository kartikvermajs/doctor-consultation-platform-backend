const express = require("express");
const Appointment = require("../modal/Appointment");
const upload = require("../middleware/cloudinaryUpload");
const cloudinary = require("../config/cloudinary");
const auth = require("../middleware/auth");

const router = express.Router();

router.post(
  "/:appointmentId/documents",
  auth.authenticate,
  upload.array("documents"),
  async (req, res) => {
    const appointment = await Appointment.findById(req.params.appointmentId);
    if (!appointment) return res.status(404).json({ message: "Not found" });

    if (req.user.type !== "doctor")
      return res.status(403).json({ message: "Forbidden" });

    const docs = req.files.map((f) => ({
      url: f.path,
      key: f.filename, // cloudinary public_id
      type: "other",
      uploadedBy: "doctor",
    }));

    appointment.documents.push(...docs);
    await appointment.save();

    res.json(docs);
  },
);

/**
 * Delete document
 */
router.delete("/:appointmentId/documents/:key", auth.authenticate, async (req, res) => {
  if (req.user.type !== "doctor")
    return res.status(403).json({ message: "Forbidden" });

  await cloudinary.uploader.destroy(req.params.key, {
    resource_type: "raw",
  });

  await Appointment.updateOne(
    { _id: req.params.appointmentId },
    { $pull: { documents: { key: req.params.key } } },
  );

  res.json({ success: true });
});

module.exports = router;
