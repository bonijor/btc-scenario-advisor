(()=>{
let p;
const load=()=>p||(p=new Promise((ok,bad)=>{
 if(!document.querySelector('link[data-autopaper-module]')){const l=document.createElement('link');l.rel='stylesheet';l.href='assets/paper-funnel.css?v=3d2';l.dataset.autopaperModule='1';document.head.append(l)}
 const s=document.createElement('script');s.src='assets/paper-funnel.js?v=3d2';s.dataset.autopaperModule='1';s.async=true;s.onload=()=>ok(window.BTCAutoPaper);s.onerror=bad;document.head.append(s)
}));
document.querySelectorAll('[data-view="paper"]').forEach(b=>b.addEventListener('click',()=>{load().catch(()=>{})},{passive:true}));
const kick=()=>window.dispatchEvent(new Event('resize'));
const settle=()=>{requestAnimationFrame(()=>requestAnimationFrame(kick));setTimeout(kick,120);setTimeout(kick,420)};
window.addEventListener('load',settle,{once:true});
window.addEventListener('pageshow',settle);
if(document.fonts?.ready)document.fonts.ready.then(settle).catch(()=>{});
})();
