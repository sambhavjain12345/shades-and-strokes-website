process.env.NODE_ENV='test';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('crypto');
const {verifyWebhookSignature}=require('../utils/cashfreeService');

test('Cashfree webhook verification accepts only the timestamped raw-body signature',()=>{
  const previous=process.env.CASHFREE_CLIENT_SECRET;
  process.env.CASHFREE_CLIENT_SECRET='sandbox-secret';
  const timestamp='1700000000';
  const rawBody=JSON.stringify({type:'PAYMENT_SUCCESS_WEBHOOK',data:{order:{order_id:'SSAD_1'}}});
  const signature=crypto.createHmac('sha256','sandbox-secret').update(`${timestamp}${rawBody}`).digest('base64');
  assert.equal(verifyWebhookSignature({signature,timestamp,rawBody}),true);
  assert.equal(verifyWebhookSignature({signature,timestamp,rawBody:`${rawBody} `}),false);
  if(previous===undefined)delete process.env.CASHFREE_CLIENT_SECRET;else process.env.CASHFREE_CLIENT_SECRET=previous;
});
