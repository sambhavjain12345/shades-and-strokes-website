export const openCashfreeCheckout = async paymentSessionId => {
  const Cashfree=await new Promise((resolve,reject)=>{
    if(window.Cashfree)return resolve(window.Cashfree);
    const existing=document.querySelector('script[data-cashfree-sdk]');
    if(existing){existing.addEventListener('load',()=>resolve(window.Cashfree),{once:true});existing.addEventListener('error',()=>reject(new Error('Unable to load Cashfree checkout')),{once:true});return;}
    const script=document.createElement('script');script.src='https://sdk.cashfree.com/js/v3/cashfree.js';script.async=true;script.dataset.cashfreeSdk='true';script.onload=()=>resolve(window.Cashfree);script.onerror=()=>reject(new Error('Unable to load Cashfree checkout'));document.head.appendChild(script);
  });
  return Cashfree({mode:'sandbox'}).checkout({paymentSessionId,redirectTarget:'_modal'});
};
