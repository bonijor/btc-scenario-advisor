import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptiveGridDisplay, readVerifiedSnapshot, saveVerifiedSnapshot, snapshotIsSafe } from '../assets/dashboard-resilience.js';

const TRIAL_ID='btc-shadow-90d-20260817T173948Z';
function storage(){const values=new Map();return{getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)}}
function fixture(status='VERIFIED'){
  return {
    apiVersion:'btc-shadow-dashboard-readonly/2.1',generatedAt:'2026-09-08T14:00:00.000Z',mode:'SHADOW',spotOnly:true,automaticExecution:false,
    firebaseToken:'must-not-persist',account:{email:'must-not-persist@example.invalid'},
    runtime:{shadowMode:true,operationMode:'SPOT_ONLY',allowShort:false,ready:true},
    trial:{trialId:TRIAL_ID,status,completedDays:16,requiredDays:90},
    decisions:Array.from({length:30},(_,i)=>({horizon:'5m',reason:`r${i}`})),
    paper:{status:'WAITING_CONDITIONS',recentRuns:[{runId:'must-not-persist'}],funnel:{counts:{observed:5,eligible:0}},paper:{activeOpen:0,verified:0,metrics:{verifiedTrades:0},trades:[]}},
    adaptiveGrid:{protocol:'btc-adaptive-grid-dashboard-evidence/1.0',generatedAt:'2026-09-07T23:00:00.000Z',status:'V1_HISTORICAL_COMPLETE',targetDecisions:100,totalDecisions:100,evidenceBasis:'VERIFIED_APPEND_ONLY_PROSPECTIVE_CHAIN',safety:{shadowMode:true,spotOnly:true,readOnly:true,sendToExchange:false,realOrderCreated:false,formalTrialMutation:false,countsTowardFormal90D:false,productionEligible:false}},
    adaptiveGridV2:{protocol:'btc-adaptive-grid-v2-progress/1.0',evidenceRole:'V2_PROSPECTIVE_ONLY',evidenceBasis:'VERIFIED_APPEND_ONLY_PROSPECTIVE_CHAIN_V2',generatedAt:'2026-09-08T14:00:00.000Z',status:'COLLECTING',targetActivatedSamples:50,targetCompletedTpCycles:50,activatedSamples:7,completedTpCycles:5,maturedActivatedOutcomes:5,pendingOutcomeCount:2,totalNetPnlAfterCosts:0.42,safetyViolations:0,chainValid:true,independentAuditPass:false,gate80ReconsiderationReady:false,source:{authoritative:true,bucket:'linear-poet-426418-k0-adaptive-grid-rehearsal',object:'adaptive-grid-v2/prospective-ledger.jsonl',generation:'123',ledgerSha256:'abc'},legacyV1:{targetDecisions:100,totalDecisions:100,status:'HISTORICAL_COMPLETE_NOT_TRANSFERABLE',countsTowardV2:false},safety:{shadowMode:true,spotOnly:true,readOnly:true,sendToExchange:false,exchangeCredentials:false,realOrdersAllowed:false,productiveShorts:false,formalTrialMutation:false,countsTowardFormal90D:false,automaticPromotion:false}}
  }
}

test('live payload safety is independent from formal trial verification status',()=>{
  assert.equal(snapshotIsSafe(fixture('VERIFIED'),TRIAL_ID),true);
  const initialized=fixture('INITIALIZED');initialized.trial.completedDays=null;
  const blocked=fixture('BLOCKED');blocked.trial.completedDays=null;
  assert.equal(snapshotIsSafe(initialized,TRIAL_ID),true);
  assert.equal(snapshotIsSafe(blocked,TRIAL_ID),true);
});

test('unsafe runtime and wrong trial fail closed',()=>{const unsafe=fixture();unsafe.runtime.allowShort=true;assert.equal(snapshotIsSafe(unsafe,TRIAL_ID),false);assert.equal(snapshotIsSafe(fixture(),'wrong-trial'),false)});

test('V1 is historical 100/100 and cannot imply V2 readiness',()=>{
  const view=adaptiveGridDisplay(fixture().adaptiveGrid,fixture().adaptiveGridV2);
  assert.deepEqual(view.v1,{counter:'100 / 100',state:'HISTÓRICO CERRADO',valid:true});
  assert.equal(view.v2.activated,'7 / 50');assert.equal(view.v2.tp,'5 / 50');assert.equal(view.v2.valid,true);
  assert.notEqual(view.v2.state,'READY_FOR_GATE80_RECONSIDERATION');
});

test('V2 fails closed without authoritative source or verified evidence basis',()=>{
  const f=fixture();f.adaptiveGridV2.source.authoritative=false;
  let view=adaptiveGridDisplay(f.adaptiveGrid,f.adaptiveGridV2);assert.equal(view.v2.valid,false);assert.equal(view.v2.activated,'-- / 50');
  const g=fixture();g.adaptiveGridV2.source.authoritative=true;g.adaptiveGridV2.evidenceBasis='STATIC_READINESS';
  view=adaptiveGridDisplay(g.adaptiveGrid,g.adaptiveGridV2);assert.equal(view.v2.valid,false);
});

test('cache persists bounded projection and both Adaptive Grid evidence blocks',()=>{
  const s=storage();assert.equal(saveVerifiedSnapshot(s,'k',fixture(),TRIAL_ID,90,1000),true);
  const raw=s.getItem('k');assert.ok(raw);assert.equal(raw.includes('must-not-persist'),false);assert.equal(raw.includes('recentRuns'),false);
  const cached=JSON.parse(raw);assert.equal(cached.data.decisions.length,15);assert.equal(cached.data.adaptiveGrid.totalDecisions,100);assert.equal(cached.data.adaptiveGridV2.activatedSamples,7);assert.equal(cached.data.adaptiveGridV2.targetActivatedSamples,50);assert.equal(cached.data.adaptiveGridV2.legacyV1.countsTowardV2,false);assert.equal(cached.data.adaptiveGridV2.safety.countsTowardFormal90D,false);
});

test('non-verified formal trial snapshots are never written to cache',()=>{const s=storage();const f=fixture('INITIALIZED');f.trial.completedDays=null;assert.equal(saveVerifiedSnapshot(s,'k',f,TRIAL_ID,90,1000),false);assert.equal(s.getItem('k'),null)});

test('expired, future-dated, corrupt, or unsafe cache is rejected and removed',()=>{const now=2_000_000_000,cases=[JSON.stringify({savedAt:now-(24*60*60*1000)-1,data:fixture()}),JSON.stringify({savedAt:now+60_001,data:fixture()}),'{bad json',JSON.stringify({savedAt:now-1000,data:fixture('BLOCKED')})];for(const value of cases){const s=storage();s.setItem('k',value);assert.equal(readVerifiedSnapshot(s,'k',TRIAL_ID,90,now),null);assert.equal(s.getItem('k'),null)}});

test('fresh VERIFIED cache remains readable',()=>{const now=2_000_000_000,s=storage();s.setItem('k',JSON.stringify({savedAt:now-1000,data:fixture()}));const cached=readVerifiedSnapshot(s,'k',TRIAL_ID,90,now);assert.equal(cached?.trial.completedDays,16);assert.equal(cached?.adaptiveGrid.totalDecisions,100);assert.equal(cached?.adaptiveGridV2.activatedSamples,7)});
