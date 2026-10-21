const crypto = require('crypto');

const BASE_URL = process.env.CASHFREE_BASE_URL || 'https://sandbox.cashfree.com/pg';
const API_VERSION = process.env.CASHFREE_API_VERSION || '2025-01-01';

const configured = () => Boolean(process.env.CASHFREE_CLIENT_ID && process.env.CASHFREE_CLIENT_SECRET);

const request = async (path, { method='GET', body, idempotencyKey }={}) => {
  if (!configured()) {
    const error = new Error('Cashfree Sandbox is not configured');
    error.statusCode = 503;
    throw error;
  }
  const headers = {
    Accept:'application/json',
    'Content-Type':'application/json',
    'x-api-version':API_VERSION,
    'x-client-id':process.env.CASHFREE_CLIENT_ID,
    'x-client-secret':process.env.CASHFREE_CLIENT_SECRET,
  };
  if (idempotencyKey) headers['x-idempotency-key'] = idempotencyKey;
  const response = await fetch(`${BASE_URL}${path}`, { method, headers, body:body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let data={};
  try { data=text ? JSON.parse(text) : {}; } catch { data={ message:text }; }
  if (!response.ok) {
    const error=new Error(data.message || data.type || `Cashfree request failed (${response.status})`);
    error.statusCode=response.status>=500?502:400;
    error.cashfree=data;
    throw error;
  }
  return data;
};

const createDepositOrder = ({ orderId, amount, customer, returnUrl, notifyUrl }) => request('/orders', {
  method:'POST',
  idempotencyKey:`create-${orderId}`,
  body:{
    order_id:orderId,
    order_amount:Number(amount),
    order_currency:'INR',
    customer_details:{
      customer_id:`user_${customer.id}`,
      customer_name:customer.name,
      customer_email:customer.email,
      customer_phone:String(customer.phone).replace(/\D/g,'').slice(-10),
    },
    order_meta:{
      return_url:returnUrl,
      ...(notifyUrl?{notify_url:notifyUrl}:{}),
    },
    order_note:'Refundable Shades & Strokes auction security deposit',
  },
});

const createPaymentOrder = ({ orderId, amount, customer, returnUrl, notifyUrl, note }) => request('/orders', {
  method:'POST',
  idempotencyKey:`create-${orderId}`,
  body:{
    order_id:orderId,
    order_amount:Number(amount),
    order_currency:'INR',
    customer_details:{
      customer_id:`user_${customer.id}`,
      customer_name:customer.name,
      customer_email:customer.email,
      customer_phone:String(customer.phone).replace(/\D/g,'').slice(-10),
    },
    order_meta:{ return_url:returnUrl, ...(notifyUrl?{notify_url:notifyUrl}:{}) },
    order_note:note || 'Shades & Strokes artwork purchase',
  },
});

const getOrderPayments = orderId => request(`/orders/${encodeURIComponent(orderId)}/payments`);

const createRefund = async ({ orderId, refundId, amount }) => {
  const result=await request(`/orders/${encodeURIComponent(orderId)}/refunds`, {
  method:'POST',
  idempotencyKey:`refund-${refundId}`,
  body:{ refund_id:refundId, refund_amount:Number(amount), refund_note:'Auction security deposit refund', refund_speed:'STANDARD' },
  });
  return Array.isArray(result)?result[0]:result;
};

const getRefund = ({ orderId, refundId }) => request(`/orders/${encodeURIComponent(orderId)}/refunds/${encodeURIComponent(refundId)}`);

const verifyWebhookSignature = ({ signature, timestamp, rawBody }) => {
  if (!signature || !timestamp || !rawBody || !process.env.CASHFREE_CLIENT_SECRET) return false;
  const expected=crypto.createHmac('sha256',process.env.CASHFREE_CLIENT_SECRET).update(`${timestamp}${rawBody}`).digest('base64');
  const actualBuffer=Buffer.from(String(signature));
  const expectedBuffer=Buffer.from(expected);
  return actualBuffer.length===expectedBuffer.length && crypto.timingSafeEqual(actualBuffer,expectedBuffer);
};

module.exports={configured,createDepositOrder,createPaymentOrder,createRefund,getOrderPayments,getRefund,verifyWebhookSignature};
