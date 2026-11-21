/* Native install prompt on Android; manual fallback when the browser does not expose it. */
(()=>{
 let deferred=null;
 const $=id=>document.getElementById(id);
 const standalone=()=>Boolean(globalThis.BillNestAndroid)||matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const mobile=()=>/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||matchMedia('(max-width:700px)').matches;
 const show=()=>{
  const card=$('installAppCard');
  if(!card)return;
  card.hidden=standalone()||!mobile()||sessionStorage.getItem('billnest-install-dismissed')==='1';
 };
 const guide=()=>{
  const el=$('installAppHelp');
  if(el){
   el.hidden=false;
   el.textContent=/Android/i.test(navigator.userAgent)?
    'In Chrome, tap the ⋮ menu and choose Install app or Add to Home screen.':
    'Use your browser Share menu and choose Add to Home Screen.';
  }
 };
 window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();deferred=event;show();
 });
 window.addEventListener('appinstalled',()=>{
  deferred=null;const card=$('installAppCard');if(card)card.hidden=true;
 });
 document.addEventListener('click',async event=>{
  const install=event.target.closest?.('#installAppButton');
  if(install){
   event.preventDefault();
   if(!deferred){guide();return}
   const prompt=deferred;deferred=null;
   try{
    await prompt.prompt();
    const choice=await prompt.userChoice;
    if(choice?.outcome==='accepted'){const card=$('installAppCard');if(card)card.hidden=true;}
    else guide();
   }catch(error){console.info('PWA install prompt unavailable',error);guide()}
  }
  if(event.target.closest?.('#installAppDismiss')){
   sessionStorage.setItem('billnest-install-dismissed','1');
   const card=$('installAppCard');if(card)card.hidden=true;
  }
 });
 document.addEventListener('DOMContentLoaded',()=>{
  show();
  if('serviceWorker' in navigator&&location.protocol==='https:'){
   navigator.serviceWorker.register('./sw.js',{scope:'./'})
    .catch(error=>console.warn('Offline install unavailable:',error));
  }
 });
})();
