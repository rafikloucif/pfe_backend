const emailjs = require('@emailjs/nodejs');

emailjs.init({
  publicKey:  process.env.EMAILJS_PUBLIC_KEY,
  privateKey: process.env.EMAILJS_PRIVATE_KEY,
});

module.exports = emailjs;