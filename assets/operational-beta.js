import { adaptiveGridDisplay } from './dashboard-resilience.js';
import { rawEconomicDisplay } from './raw-economic-resilience.js';

const API=(new URLSearchParams(location.search).get('api')||localStorage.getItem('btcModelApiBase')||'https://btc-shadow-dashboard-api-o7li7xggnq-rj.a.run.app').replace(/\/$/,'');
const TRIAL='btc-shadow-90d-20260817T173948Z';
const $=id=>document.getElementById(id);
const set=(id,value)=>{const el=$(id);if(el)el.textContent=value};
const bool=v=>v===true?'OK':v===false?'NO':'--';
let timer=null;

async function fetchDashboard(){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(`${API}/api/v1/dashboard`,{cache:'no-store',signal:controller.signal,headers:{accept:'application/json'}});
    if(!response.ok)throw new Error(`HTTP_${response.status}`);
    return response.json();
  }finally{clearTimeout(timeout)}
}

function blocked(reason='READ_ONLY_DATA_UNAVAILABLE'){
  for(const id of ['v2Activated','v2Tp','v2Matured','v2Pnl','rawOutcomes','rawBuys','rawTp','rawPnl','rawChain','rawParity','rawProvenance','activationId','baseline','sourceCommit'])set(id,'--');
  set('monitorState',`BLOQUEADO · ${reason}`);
  set('authority','NO AUTORIZA TRADING');
}

function render(data){
  const runtime=data?.runtime||{},trial=data?.trial||{};
  const envelope=data?.apiVersion==='btc-shadow-dashboard-readonly/2.2'&&data?.mode==='SHADOW'&&data?.spotOnly===true&&data?.automaticExecution===false&&runtime.shadowMode===true&&runtime.operationMode==='SPOT_ONLY'&&runtime.allowShort===false&&trial.trialId===TRIAL;
  if(!envelope){blocked('CONTRATO_API_2_2_NO_VERIFICADO');return}

  const v2=adaptiveGridDisplay(null,data.adaptiveGridV2).v2;
  const raw=rawEconomicDisplay(data.rawEconomic);
  if(!v2.valid||!raw.valid){blocked(!v2.valid?'V2_NO_AUTORITATIVO':'RAW_NO_AUTORITATIVO');return}

  const g=data.adaptiveGridV2,r=data.rawEconomic;
  set('v2Activated',v2.activated);set('v2Tp',v2.tp);
  set('v2Matured',Number.isInteger(g.maturedActivatedOutcomes)?String(g.maturedActivatedOutcomes):'--');
  set('v2Pnl',typeof g.totalNetPnlAfterCosts==='number'?`${g.totalNetPnlAfterCosts.toFixed(4)} USDT`:'--');
  set('rawOutcomes',raw.outcomes);set('rawBuys',raw.buys);set('rawTp',raw.tp);set('rawPnl',raw.pnl);
  set('rawChain',bool(r.chainValid));set('rawParity',bool(r.exactSourceOutcomeReconciliation));
  set('rawProvenance',Number.isInteger(r.provenanceViolations)?String(r.provenanceViolations):'--');
  set('activationId',r.activation?.activationId||'--');
  set('baseline',Number.isInteger(r.activation?.baselineDecisionSequence)?String(r.activation.baselineDecisionSequence):'--');
  set('sourceCommit',r.activation?.sourceCommit||'--');
  set('monitorState',`${v2.state} · RAW ${raw.state}`);
  set('authority','NO AUTORIZA TRADING');
  set('updatedAt',data.generatedAt?new Date(data.generatedAt).toLocaleString('es-AR',{hour12:false}):'--');
}

async function refresh(){
  const button=$('refreshBeta');if(button){button.disabled=true;button.setAttribute('aria-busy','true')}
  try{render(await fetchDashboard())}catch(error){blocked(String(error?.message||'READ_ONLY_DATA_UNAVAILABLE').slice(0,80))}
  finally{if(button){button.disabled=false;button.setAttribute('aria-busy','false')}}
}

$('refreshBeta')?.addEventListener('click',refresh);
refresh();
timer=setInterval(refresh,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
window.addEventListener('pagehide',()=>{if(timer)clearInterval(timer)},{once:true});
