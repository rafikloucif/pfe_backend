const nodemailer = require("nodemailer"); 

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  family: 4  // ✅ force IPv4 — fixes ENETUNREACH on Render
});

module.exports = transporter;