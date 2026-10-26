export const openCashfreeCheckout = async paymentSessionId => {
  if (!paymentSessionId || typeof paymentSessionId !== 'string') {
    throw new Error('Cashfree did not return a valid payment session. Please try again.');
  }
  const Cashfree=await new Promise((resolve,reject)=>{
    if(window.Cashfree)return resolve(window.Cashfree);
    const existing=document.querySelector('script[data-cashfree-sdk]');
    if(existing){existing.addEventListener('load',()=>resolve(window.Cashfree),{once:true});existing.addEventListener('error',()=>reject(new Error('Unable to load Cashfree checkout')),{once:true});return;}
    const script=document.createElement('script');script.src='https://sdk.cashfree.com/js/v3/cashfree.js';script.async=true;script.dataset.cashfreeSdk='true';script.onload=()=>resolve(window.Cashfree);script.onerror=()=>reject(new Error('Unable to load Cashfree checkout'));document.head.appendChild(script);
  });
  const result=await Cashfree({mode:'sandbox'}).checkout({paymentSessionId,redirectTarget:'_modal'});
  // The Cashfree SDK can resolve (rather than reject) when checkout cannot be
  // opened. Never continue to backend verification in that case.
  if(result?.error){
    throw new Error(result.error.message||'Cashfree checkout could not be opened. Please try again.');
  }
  return result;
};
