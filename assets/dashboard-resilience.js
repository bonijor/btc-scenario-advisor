const MAX_AGE=864e5,FUTURE=6e4,D=typeof document==='undefined'?null:document,$=id=>D?.getElementById(id);
const GRID_PROTOCOL='btc-adaptive-grid-dashboard-evidence/1.0';
const GRID_EVIDENCE='VERIFIED_APPEND_ONLY_PROSPECTIVE_CHAIN';

export function adaptiveGridDisplay(grid){
  const safety=grid?.safety||{},total=Number(grid?.totalDecisions);
  const valid=grid?.protocol===GRID_PROTOCOL&&grid?.evidenceBasis===GRID_EVIDENCE&&Number(grid?.targetDecisions)===100&&Number.isInteger(total)&&total>=0&&total<=100&&safety.shadowMode===true&&safety.spotOnly===true&&safety.readOnly===true&&safety.sendToExchange===false&&safety.realOrderCreated===false&&safety.formalTrialMutation===false&&safety.countsTowardFormal90D===false&&safety.productionEligible===false;
  return valid&&total>0?{counter:`${total} / 100`,state:grid.status==='FIRST_REVIEW_READY'?'REVIEW READY':'PROSPECTIVO VERIFICADO',valid:true}:{counter:'-- / 100',state:'BLOQUEADO · sin receipt',valid:false};
}

function renderGrid(grid){
  if(!D)return;
  const panel=D.querySelector('.statusSummaryCard');
  if(!panel)return;
  if(!$('adaptiveGridCounter'))panel.insertAdjacentHTML('beforeend','<div><span>Adaptive Grid</span><strong id="adaptiveGridCounter">-- / 100</strong><small id="adaptiveGridState">BLOQUEADO · sin receipt</small></div>');
  const view=adaptiveGridDisplay(grid);
  $('adaptiveGridCounter').textContent=view.counter;
  $('adaptiveGridState').textContent=view.state;
}

export function snapshotIsSafe(data,trialId,requiredDays=90){
  if(!data||typeof data!=='object'){renderGrid(null);return false}
  const runtime=data.runtime||{},trial=data.trial||{},completed=Number(trial.completedDays);
  const valid=data.mode==='SHADOW'&&data.spotOnly===true&&data.automaticExecution===false&&runtime.shadowMode===true&&runtime.operationMode==='SPOT_ONLY'&&runtime.allowShort===false&&trial.trialId===trialId&&Number.isFinite(completed)&&completed>=0&&completed<=requiredDays;
  renderGrid(valid?data.adaptiveGrid:null);
  return valid;
}

function verifiedForCache(data,trialId,requiredDays=90){return snapshotIsSafe(data,trialId,requiredDays)&&data?.trial?.status==='VERIFIED'}

function project(data){
  const paper=data.paper&&typeof data.paper==='object'?data.paper:null,nested=paper?.paper;
  const grid=data.adaptiveGrid&&typeof data.adaptiveGrid==='object'?data.adaptiveGrid:null;
  return{
    apiVersion:data.apiVersion,generatedAt:data.generatedAt,mode:data.mode,spotOnly:data.spotOnly,automaticExecution:data.automaticExecution,
    runtime:data.runtime,trial:data.trial,decisions:Array.isArray(data.decisions)?data.decisions.slice(0,15):[],
    paper:paper?{status:paper.status,funnel:paper.funnel,paper:nested?{activeOpen:nested.activeOpen,verified:nested.verified,metrics:nested.metrics,trades:Array.isArray(nested.trades)?nested.trades.slice(0,20):[]}:undefined,simulatedTrades:paper.simulatedTrades,winRatePct:paper.winRatePct,netPnlPct:paper.netPnlPct,drawdownPct:paper.drawdownPct,trades:Array.isArray(paper.trades)?paper.trades.slice(0,20):undefined,note:paper.note}:null,
    adaptiveGrid:grid?{protocol:grid.protocol,generatedAt:grid.generatedAt,status:grid.status,targetDecisions:grid.targetDecisions,totalDecisions:grid.totalDecisions,remainingDecisions:grid.remainingDecisions,progressPct:grid.progressPct,modes:grid.modes,maturedOutcomes:grid.maturedOutcomes,completedCycles:grid.completedCycles,netPnl:grid.netPnl,firstReviewReady:grid.firstReviewReady,evidenceBasis:grid.evidenceBasis,safety:grid.safety}:null
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
    renderGrid(null);storage.removeItem(key);
  }catch{renderGrid(null);try{storage.removeItem(key)}catch{}}
  return null;
}

export function normalizedPaperPayload(payload){
  const root=payload&&typeof payload==='object'?payload:{},base=root.paper&&typeof root.paper==='object'?root.paper:root,metrics=base.metrics&&typeof base.metrics==='object'?base.metrics:{},trades=Array.isArray(base.trades)?base.trades:Array.isArray(root.trades)?root.trades:[];
  return{simulatedTrades:root.simulatedTrades??base.verified??metrics.verifiedTrades??0,winRatePct:root.winRatePct??metrics.winRatePct??null,netPnlPct:root.netPnlPct??metrics.netReturnPct??null,drawdownPct:root.drawdownPct??metrics.maxDrawdownPct??null,trades,note:root.note||(root.status?`Estado Paper: ${root.status}. Sólo se publican operaciones con entrada, salida y evidencia verificadas.`:''),funnel:root.funnel||null};
}

function ensureFunnelUi(){
  if($('paperFunnelPanel')||!D)return;
  const table=D.querySelector('#paper .tableWrap');
  if(!table)return;
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
