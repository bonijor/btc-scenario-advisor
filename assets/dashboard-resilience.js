const MAX_AGE=864e5,FUTURE=6e4,D=typeof document==='undefined'?null:document,$=id=>D?.getElementById(id);
const V1_PROTOCOL='btc-adaptive-grid-dashboard-evidence/1.0';
const V1_EVIDENCE='VERIFIED_APPEND_ONLY_PROSPECTIVE_CHAIN';
const V2_PROTOCOL='btc-adaptive-grid-v2-progress/1.0';
const V2_EVIDENCE='VERIFIED_APPEND_ONLY_PROSPECTIVE_CHAIN_V2';
const SHADOW_PROTOCOL='btc-shadow-validation-progress/1.0';

const safeV1=s=>s?.shadowMode===true&&s?.spotOnly===true&&s?.readOnly===true&&s?.sendToExchange===false&&s?.realOrderCreated===false&&s?.formalTrialMutation===false&&s?.countsTowardFormal90D===false&&s?.productionEligible===false;
const safeV2=s=>s?.shadowMode===true&&s?.spotOnly===true&&s?.readOnly===true&&s?.sendToExchange===false&&s?.exchangeCredentials===false&&s?.realOrdersAllowed===false&&s?.productiveShorts===false&&s?.formalTrialMutation===false&&s?.countsTowardFormal90D===false&&s?.automaticPromotion===false;
const safeShadow=v=>v?.protocol===SHADOW_PROTOCOL&&Number(v?.targetScore)===100&&v?.canAuthorizeTrading===false&&v?.liveTradingEligible===false&&v?.countsTowardFormal90D===false&&v?.formalTrialMutation===false&&v?.sendToExchange===false;

export function adaptiveGridDisplay(v1,v2){
  const total=Number(v1?.totalDecisions);
  const v1Valid=v1?.protocol===V1_PROTOCOL&&v1?.evidenceBasis===V1_EVIDENCE&&Number(v1?.targetDecisions)===100&&Number.isInteger(total)&&total===100&&safeV1(v1?.safety);
  const a=Number(v2?.activatedSamples),tp=Number(v2?.completedTpCycles);
  const v2Valid=v2?.protocol===V2_PROTOCOL&&v2?.evidenceRole==='V2_PROSPECTIVE_ONLY'&&v2?.evidenceBasis===V2_EVIDENCE&&Number(v2?.targetActivatedSamples)===50&&Number(v2?.targetCompletedTpCycles)===50&&Number.isInteger(a)&&a>=0&&Number.isInteger(tp)&&tp>=0&&safeV2(v2?.safety)&&v2?.source?.authoritative===true;
  return {
    v1:v1Valid?{counter:'100 / 100',state:'HISTÓRICO CERRADO',valid:true}:{counter:'-- / 100',state:'HISTÓRICO NO VERIFICADO',valid:false},
    v2:v2Valid?{activated:`${a} / 50`,tp:`${tp} / 50`,state:v2.status||'COLLECTING',valid:true}:{activated:'-- / 50',tp:'-- / 50',state:'BLOQUEADO · sin evidencia V2 autoritativa',valid:false}
  };
}

export function shadowValidationDisplay(value){
  const score=Number(value?.verifiedScore);
  const valid=safeShadow(value)&&Number.isFinite(score)&&score>=0&&score<=100;
  return valid
    ?{counter:`${score} / 100`,state:value.status||'COLLECTING',authority:'NO AUTORIZA TRADING',valid:true}
    :{counter:'-- / 100',state:'BLOQUEADO · sin validación SHADOW autoritativa',authority:'NO AUTORIZA TRADING',valid:false};
}

function renderGrid(v1,v2,shadowValidation){
  if(!D)return;
  const panel=D.querySelector('.statusSummaryCard');
  if(!panel)return;
  if(!$('adaptiveGridV1Counter'))panel.insertAdjacentHTML('beforeend','<div><span>Adaptive Grid V1</span><strong id="adaptiveGridV1Counter">-- / 100</strong><small id="adaptiveGridV1State">HISTÓRICO NO VERIFICADO</small></div><div><span>Adaptive Grid V2</span><strong id="adaptiveGridV2Activated">-- / 50</strong><small id="adaptiveGridV2Tp">TP -- / 50</small><small id="adaptiveGridV2State">BLOQUEADO · sin evidencia V2 autoritativa</small></div><div><span>Validación SHADOW verificada</span><strong id="shadowValidationCounter">-- / 100</strong><small id="shadowValidationState">BLOQUEADO · sin validación SHADOW autoritativa</small><small id="shadowValidationAuthority">NO AUTORIZA TRADING</small></div>');
  const view=adaptiveGridDisplay(v1,v2),shadow=shadowValidationDisplay(shadowValidation);
  $('adaptiveGridV1Counter').textContent=view.v1.counter;$('adaptiveGridV1State').textContent=view.v1.state;
  $('adaptiveGridV2Activated').textContent=view.v2.activated;$('adaptiveGridV2Tp').textContent=`TP ${view.v2.tp}`;$('adaptiveGridV2State').textContent=view.v2.state;
  $('shadowValidationCounter').textContent=shadow.counter;$('shadowValidationState').textContent=shadow.state;$('shadowValidationAuthority').textContent=shadow.authority;
}

export function snapshotIsSafe(data,trialId){
  if(!data||typeof data!=='object'){renderGrid(null,null,null);return false}
  const runtime=data.runtime||{},trial=data.trial||{};
  const valid=data.mode==='SHADOW'&&data.spotOnly===true&&data.automaticExecution===false&&runtime.shadowMode===true&&runtime.operationMode==='SPOT_ONLY'&&runtime.allowShort===false&&trial.trialId===trialId;
  renderGrid(valid?data.adaptiveGrid:null,valid?data.adaptiveGridV2:null,valid?data.shadowValidation:null);
  return valid;
}

function verifiedForCache(data,trialId,requiredDays=90){
  const completed=Number(data?.trial?.completedDays);
  return snapshotIsSafe(data,trialId)&&data?.trial?.status==='VERIFIED'&&Number.isFinite(completed)&&completed>=0&&completed<=requiredDays;
}

function project(data){
  const paper=data.paper&&typeof data.paper==='object'?data.paper:null,nested=paper?.paper;
  const v1=data.adaptiveGrid&&typeof data.adaptiveGrid==='object'?data.adaptiveGrid:null;
  const v2=data.adaptiveGridV2&&typeof data.adaptiveGridV2==='object'?data.adaptiveGridV2:null;
  const shadow=data.shadowValidation&&typeof data.shadowValidation==='object'?data.shadowValidation:null;
  return{
    apiVersion:data.apiVersion,generatedAt:data.generatedAt,mode:data.mode,spotOnly:data.spotOnly,automaticExecution:data.automaticExecution,
    runtime:data.runtime,trial:data.trial,decisions:Array.isArray(data.decisions)?data.decisions.slice(0,15):[],
    paper:paper?{status:paper.status,funnel:paper.funnel,paper:nested?{activeOpen:nested.activeOpen,verified:nested.verified,metrics:nested.metrics,trades:Array.isArray(nested.trades)?nested.trades.slice(0,20):[]}:undefined,simulatedTrades:paper.simulatedTrades,winRatePct:paper.winRatePct,netPnlPct:paper.netPnlPct,drawdownPct:paper.drawdownPct,trades:Array.isArray(paper.trades)?paper.trades.slice(0,20):undefined,note:paper.note}:null,
    adaptiveGrid:v1?{protocol:v1.protocol,generatedAt:v1.generatedAt,status:v1.status,targetDecisions:v1.targetDecisions,totalDecisions:v1.totalDecisions,evidenceBasis:v1.evidenceBasis,safety:v1.safety}:null,
    adaptiveGridV2:v2?{protocol:v2.protocol,evidenceRole:v2.evidenceRole,evidenceBasis:v2.evidenceBasis,generatedAt:v2.generatedAt,status:v2.status,targetActivatedSamples:v2.targetActivatedSamples,targetCompletedTpCycles:v2.targetCompletedTpCycles,activatedSamples:v2.activatedSamples,completedTpCycles:v2.completedTpCycles,maturedActivatedOutcomes:v2.maturedActivatedOutcomes,pendingOutcomeCount:v2.pendingOutcomeCount,totalNetPnlAfterCosts:v2.totalNetPnlAfterCosts,safetyViolations:v2.safetyViolations,chainValid:v2.chainValid,independentAuditPass:v2.independentAuditPass,gate80ReconsiderationReady:v2.gate80ReconsiderationReady,source:v2.source,safety:v2.safety,legacyV1:v2.legacyV1}:null,
    shadowValidation:shadow?{protocol:shadow.protocol,status:shadow.status,verifiedScore:shadow.verifiedScore,targetScore:shadow.targetScore,authorityCoveragePct:shadow.authorityCoveragePct,remainingVerifiedPoints:shadow.remainingVerifiedPoints,scoreMeaning:shadow.scoreMeaning,canAuthorizeTrading:shadow.canAuthorizeTrading,liveTradingEligible:shadow.liveTradingEligible,countsTowardFormal90D:shadow.countsTowardFormal90D,formalTrialMutation:shadow.formalTrialMutation,sendToExchange:shadow.sendToExchange}:null
  };
}

export function saveVerifiedSnapshot(storage,key,data,trialId,requiredDays=90,now=Date.now()){
  if(!verifiedForCache(data,trialId,requiredDays))return false;
  try{storage.setItem(key,JSON.stringify({savedAt:now,data:project(data)}));return true}catch{return false}
}

export function readVerifiedSnapshot(storage,key,trialId,requiredDays=90,now=Date.now()){
  try{
    const cached=JSON.parse(storage.getItem(key)||'null'),savedAt=Number(cached?.savedAt);
    const fresh=Number.isFinite(savedAt)&&savedAt<=now+FUTURE&&now-savedAt<=MAX_AGE;
    if(cached&&fresh&&verifiedForCache(cached.data,trialId,requiredDays))return cached.data;
    renderGrid(null,null,null);storage.removeItem(key);
  }catch{renderGrid(null,null,null);try{storage.removeItem(key)}catch{}}
  return null;
}

export function normalizedPaperPayload(payload){
  const root=payload&&typeof payload==='object'?payload:{},base=root.paper&&typeof root.paper==='object'?root.paper:root,metrics=base.metrics&&typeof base.metrics==='object'?base.metrics:{},trades=Array.isArray(base.trades)?base.trades:Array.isArray(root.trades)?root.trades:[];
  return{simulatedTrades:root.simulatedTrades??base.verified??metrics.verifiedTrades??0,winRatePct:root.winRatePct??metrics.winRatePct??null,netPnlPct:root.netPnlPct??metrics.netReturnPct??null,drawdownPct:root.drawdownPct??metrics.maxDrawdownPct??null,trades,note:root.note||(root.status?`Estado Paper: ${root.status}. Sólo se publican operaciones con entrada, salida y evidencia verificadas.`:''),funnel:root.funnel||null};
}

function ensureFunnelUi(){
  if($('paperFunnelPanel')||!D)return;
  const table=D.querySelector('#paper .tableWrap');if(!table)return;
  table.insertAdjacentHTML('beforebegin','<article class="panel content" id="paperFunnelPanel" style="margin-top:10px"><div class="head"><div><div class="ey">Embudo de elegibilidad</div><h3>De observación a señal Paper elegible</h3></div><span class="chip" id="funnelStatus">sin datos</span></div><p class="tiny">Cada etapa muestra cuántas observaciones siguen vivas después de aplicar los filtros del motor. Cero elegibles no significa cero datos.</p><div class="analyticsGrid"><div class="analyticsCard"><span>Observadas</span><strong id="funnelObserved">--</strong></div><div class="analyticsCard"><span>Horizonte oficial</span><strong id="funnelOfficial">--</strong></div><div class="analyticsCard"><span>Sesgo bullish</span><strong id="funnelBullish">--</strong></div><div class="analyticsCard"><span>Alta confianza</span><strong id="funnelConfidence">--</strong></div><div class="analyticsCard"><span>Elegibles</span><strong id="funnelEligible">--</strong></div></div><div class="bannerNote" id="funnelReasons">Esperando evidencia del funnel.</div></article>');
}

export function renderFunnel(funnel){
  ensureFunnelUi();if(!$('paperFunnelPanel'))return;
  const data=funnel&&typeof funnel==='object'?funnel:null;
  if(!data){for(const id of['funnelObserved','funnelOfficial','funnelBullish','funnelConfidence','funnelEligible']){const el=$(id);if(el)el.textContent='--'}$('funnelStatus').textContent='sin datos';$('funnelReasons').textContent='Esperando evidencia del funnel.';return}
  const counts=data.counts||{},value=key=>Number.isFinite(Number(counts[key]))?String(Number(counts[key])):'--';
  $('funnelObserved').textContent=value('observed');$('funnelOfficial').textContent=value('officialHorizon');$('funnelBullish').textContent=value('bullishBias');$('funnelConfidence').textContent=value('highConfidence');$('funnelEligible').textContent=value('eligible');$('funnelStatus').textContent=`protocolo ${data.protocol||'read-only'}`;
  const rejected=data.rejectedByReason&&typeof data.rejectedByReason==='object'?Object.entries(data.rejectedByReason):[],lifecycle=data.lifecycle||{},reason=rejected.length?rejected.map(([key,n])=>`${key}: ${n}`).join(' · '):'Sin rechazos publicados.';
  $('funnelReasons').textContent=`${reason} · abiertas: ${Number(lifecycle.opened||0)} · verificadas: ${Number(lifecycle.verified||0)}`;
}
