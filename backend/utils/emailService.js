// ============================================================
//  Email Service — Placeholder (configure with nodemailer later)
//  Place this file in: backend/utils/emailService.js
// ============================================================

const sendOrderConfirmation = async (order, items, user) => {
  // TODO: configure nodemailer or SendGrid here
  console.log(`📧 Order confirmation would be sent to ${user?.email} for order ${order?.order_number}`);
};

const sendStatusUpdate = async (order, user, status) => {
  // TODO: configure nodemailer or SendGrid here
  console.log(`📧 Status update (${status}) would be sent to ${user?.email} for order ${order?.order_number}`);
};

module.exports = { sendOrderConfirmation, sendStatusUpdate };
