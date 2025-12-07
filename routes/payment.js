const express = require("express");
const Razorpay = require("razorpay");
const { authenticate, requireRole } = require("../middleware/auth");
const { body } = require("express-validator");
const validate = require("../middleware/validate");
const Appointment = require("../modal/Appointment");
const crypto = require("crypto");

const router = express.Router();

const razorPay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

router.post(
  "/create-order",
  authenticate,
  requireRole("patient"),
  [
    body("appointmentId")
      .isMongoId()
      .withMessage("valid appoitment ID is required"),
  ],
  validate,
  async (req, res) => {
    try {
      const { appointmentId } = req.body;

      //find appointment
      const appointment = await Appointment.findById(appointmentId)
        .populate("doctorId", "name specialization")
        .populate("patientId", "name email phone");

      if (!appointment) {
        return res.notFound("Appointemnt not found");
      }
      if (appointment.patientId._id.toString() !== req.auth.id) {
        return res.forbidden("Access denined");
      }

      if (appointment.paymentStatus === "Paid") {
        return res.badRequest("Payment alredy complted");
      }

      const order = await razorPay.orders.create({
        amount: appointment.totalAmount * 100,
        currency: "INR",
        receipt: `appointement_${appointmentId}`,
        notes: {
          appointmentId: appointmentId,
          doctorName: appointment.doctorId.name,
          patientName: appointment.patientId.name,
          consultationType: appointment.consultationType,
          date: appointment.date,
          slotStart: appointment.slotStartIso,
          slotEnd: appointment.slotEndIso,
        },
      });

      res.ok(
        {
          orderId: order.id,
          amount: appointment.totalAmount,
          currency: "INR",
          key: process.env.RAZORPAY_KEY_ID,
        },
        "Payment order created successfully"
      );
    } catch (error) {
      res.serverError("Failed to create paymnet order ", [error.message]);
    }
  }
);

router.post(
  "/verify-payment",
  authenticate,
  requireRole("patient"),
  [
    body("appointmentId")
      .isMongoId()
      .withMessage("valid appoitment ID is required"),
    body("razorpay_order_id")
      .isString()
      .withMessage("Razorpay order Id required"),
    body("razorpay_payment_id")
      .isString()
      .withMessage("Razorpay payment Id required"),
    body("razorpay_signature")
      .isString()
      .withMessage("Razorpay signature required"),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        appointmentId,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body;

      //find appointment
      const appointment = await Appointment.findById(appointmentId)
        .populate("doctorId", "name specialization")
        .populate("patientId", "name email phone");

      if (!appointment) {
        return res.notFound("Appointemnt not found");
      }
      if (appointment.patientId._id.toString() !== req.auth.id) {
        return res.forbidden("Access denined");
      }

      //verify paymnet signature
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest("hex");

      const isAuthentic = expectedSignature === razorpay_signature;
      if (!isAuthentic) {
        return res.badRequest("paymnet varification failed");
      }

      appointment.paymentStatus = "Paid";
      appointment.paymentMethod = "RazorPay";
      appointment.razorpayPaymentId = razorpay_payment_id;
      appointment.razorpayOrderId = razorpay_order_id;
      appointment.razorpaySignature = razorpay_signature;
      appointment.paymentDate = new Date();

      await appointment.save();

      await appointment.populate(
        "doctorId",
        "name specialization fees hospitalInfo profileImage"
      );
      await appointment.populate("patientId", "name email phone profileImage");

      res.ok(
        appointment,
        "Payment verified and appointment confirmed succesfully"
      );
    } catch (error) {
      res.serverError("Failed to verify paymnet ", [error.message]);
    }
  }
);


 module.exports = router;