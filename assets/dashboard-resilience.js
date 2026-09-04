const MAX_AGE=864e5,FUTURE=6e4,$=id=>document.getElementById(id);

export function snapshotIsSafe(d,trialId,requiredDays=90){
  if(!d||typeof d!=='object')return false;
  const r=d.runtime||{},t=d.trial||{},n=Number(t.completedDays);
  return d.mode==='SHADOW'&&d.spotOnly===true&&d.automaticExecution===false&&r.shadowMode===true&&r.operationMode==='SPOT_ONLY'&&r.allowShort===false&&t.trialId===trialId&&t.status==='VERIFIED'&&Number.isFinite(n)&&n>=0&&n<=requiredDays;
}

function project(d){
  const p=d.paper&&typeof d.paper==='object'?d.paper:null,q=p?.paper;
  return{apiVersion:d.apiVersion,generatedAt:d.generatedAt,mode:d.mode,spotOnly:d.spotOnly,automaticExecution:d.automaticExecution,runtime:d.runtime,trial:d.trial,decisions:Array.isArray(d.decisions)?d.decisions.slice(0,15):[],paper:p?{status:p.status,funnel:p.funnel,paper:q?{activeOpen:q.activeOpen,verified:q.verified,metrics:q.metrics,trades:Array.isArray(q.trades)?q.trades.slice(0,20):[]}:undefined,simulatedTrades:p.simulatedTrades,winRatePct:p.winRatePct,netPnlPct:p.netPnlPct,drawdownPct:p.drawdownPct,trades:Array.isArray(p.trades)?p.trades.slice(0,20):undefined,note:p.note}:null};
}

export function saveVerifiedSnapshot(s,k,d,trialId,requiredDays=90,now=Date.now()){
  if(!snapshotIsSafe(d,trialId,requiredDays))return false;
  try{s.setItem(k,JSON.stringify({savedAt:now,data:project(d)}));return true}catch{return false}
}

export function readVerifiedSnapshot(s,k,trialId,requiredDays=90,now=Date.now()){
  try{const c=JSON.parse(s.getItem(k)||'null'),a=Number(c?.savedAt),fresh=Number.isFinite(a)&&a<=now+FUTURE&&now-a<=MAX_AGE;if(c&&fresh&&snapshotIsSafe(c.data,trialId,requiredDays))return c.data;s.removeItem(k)}catch{try{s.removeItem(k)}catch{}}return null;
}

export function normalizedPaperPayload(payload){
  const r=payload&&typeof payload==='object'?payload:{},b=r.paper&&typeof r.paper==='object'?r.paper:r,m=b.metrics&&typeof b.metrics==='object'?b.metrics:{},tr=Array.isArray(b.trades)?b.trades:Array.isArray(r.trades)?r.trades:[];
  return{simulatedTrades:r.simulatedTrades??b.verified??m.verifiedTrades??0,winRatePct:r.winRatePct??m.winRatePct??null,netPnlPct:r.netPnlPct??m.netReturnPct??null,drawdownPct:r.drawdownPct??m.maxDrawdownPct??null,trades:tr,note:r.note||(r.status?`Estado Paper: ${r.status}. Sólo se publican operaciones con entrada, salida y evidencia verificadas.`:''),funnel:r.funnel||null};
}

function ensureFunnelUi(){
  if($('paperFunnelPanel'))return;const t=document.querySelector('#paper .tableWrap');if(!t)return;
  t.insertAdjacentHTML('beforebegin','<article class="panel content" id="paperFunnelPanel" style="margin-top:10px"><div class="head"><div><div class="ey">Embudo de elegibilidad</div><h3>De observación a señal Paper elegible</h3></div><span class="chip" id="funnelStatus">sin datos</span></div><p class="tiny">Cada etapa muestra cuántas observaciones siguen vivas después de aplicar los filtros del motor. Cero elegibles no significa cero datos.</p><div class="analyticsGrid"><div class="analyticsCard"><span>Observadas</span><strong id="funnelObserved">--</strong></div><div class="analyticsCard"><span>Horizonte oficial</span><strong id="funnelOfficial">--</strong></div><div class="analyticsCard"><span>Sesgo bullish</span><strong id="funnelBullish">--</strong></div><div class="analyticsCard"><span>Alta confianza</span><strong id="funnelConfidence">--</strong></div><div class="analyticsCard"><span>Elegibles</span><strong id="funnelEligible">--</strong></div></div><div class="bannerNote" id="funnelReasons">Esperando evidencia del funnel.</div></article>');
}

export function renderFunnel(funnel){
  ensureFunnelUi();if(!$('paperFunnelPanel'))return;const f=funnel&&typeof funnel==='object'?funnel:null;
  if(!f){for(const id of['funnelObserved','funnelOfficial','funnelBullish','funnelConfidence','funnelEligible']){const e=$(id);if(e)e.textContent='--'}const s=$('funnelStatus'),r=$('funnelReasons');if(s)s.textContent='sin datos';if(r)r.textContent='Esperando evidencia del funnel.';return}
  const c=f.counts||{},v=k=>Number.isFinite(Number(c[k]))?String(Number(c[k])):'--';
  $('funnelObserved').textContent=v('observed');$('funnelOfficial').textContent=v('officialHorizon');$('funnelBullish').textContent=v('bullishBias');$('funnelConfidence').textContent=v('highConfidence');$('funnelEligible').textContent=v('eligible');$('funnelStatus').textContent=`protocolo ${f.protocol||'read-only'}`;
  const x=f.rejectedByReason&&typeof f.rejectedByReason==='object'?Object.entries(f.rejectedByReason):[],l=f.lifecycle||{},r=x.length?x.map(([k,n])=>`${k}: ${n}`).join(' · '):'Sin rechazos publicados.';$('funnelReasons').textContent=`${r} · abiertas: ${Number(l.opened||0)} · verificadas: ${Number(l.verified||0)}`;
}
