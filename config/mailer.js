const Mailjet = require('node-mailjet');

// ✅ Mailjet — free 200 emails/day, works on Render, no domain needed
const mailjet = Mailjet.apiConnect(
  process.env.MAILJET_API_KEY,
  process.env.MAILJET_SECRET_KEY
);

module.exports = mailjet;