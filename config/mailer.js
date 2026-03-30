const nodemailer = require('nodemailer');

// ✅ Gmail App Password — works on Render, no SMTP blocking
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // ✅ 16-char App Password, NOT your real password
  }
});

module.exports = transporter;