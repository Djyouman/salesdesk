const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:1400,height:900}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#home'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000); await p.waitForTimeout(900);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const low=()=>document.querySelector('#main').innerText.toLowerCase();
    const id='snap-'+isoWeek(); const snap=S.live.product[id]; out.snapWritten=!!snap; out.snapKeys=snap?Object.keys(snap).filter(k=>['open','weighted','wonFY','byBrand','byRep','byStage','stuck','stages'].includes(k)).length:0; out.stagesCount=snap?Object.keys(snap.stages).length:0; out.isoWeek=id;
    // simulate prior week snapshot and movement fallback
    const prev={...snap,id:'snap-2026-W40',week:'2026-W40',stages:{...snap.stages}}; const d=S.deals.find(x=>x.status==='open'&&x.id.startsWith('pd_')&&dealStage(x)==='lead'&&!x.stageAt); prev.stages[d.id]='lead'; await dbWrite('product','snap-2026-W40',prev,false);
    // advance without stamp (simulate imported stage change by editing history-level stage via live doc without stageAt)
    await dbWrite('deals',d.id,{...d,stage:'quoted',prob:null},false); const w=weekMovement(S.deals); out.fallbackAdvanced=w.advanced.some(x=>x.id===d.id); out.snapWeek=w.snapWeek;
    S.ui.anaTab='trend'; go('analytics'); await t(150); out.trend=low().includes('pipeline trend')&&low().includes('2026-w40'); out.ovTrend=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    S.ui.anaTab='week'; render(); await t(100); out.weekBanner=low().includes('weekly snapshot');
    // importer maps last stage change + bid due + proposal date
    S.ui.setupTab='data'; go('setup'); await t(80); const d2=S.deals.find(x=>x.status==='open'&&x.id.startsWith('pd_')&&x.id!==d.id); document.querySelector('#pdTa').value=`Deal - ID,Deal - Title,Deal - Stage,Deal - Status,Deal - Last stage change,Deal - Bid due date,Deal - Proposal Date\n${d2.pd},${d2.title.replace(/,/g,' ')},Proposal Submitted,open,2026-10-20 09:00:00,2026-11-12,2026-10-21\n`; await ACTIONS.pdPreview(); await t(40); await ACTIONS.pdImport(); await t(40); const dd=S.dealById.get(d2.id); out.importStamps=dd.stageChangedAt==='2026-10-20'&&dd.bidDue==='2026-11-12'&&dd.proposalDate==='2026-10-21';
    // perf
    const times={}; for(const [v,prep] of [['home',()=>{}],['pipeline',()=>{S.ui.pipeTab='list'}],['accounts',()=>{S.ui.acctTab='list'}],['analytics',()=>{S.ui.anaTab='overview'}]]){ prep(); const t0=performance.now(); location.hash='#'+v; route(); times[v]=Math.round(performance.now()-t0) } out.renderMs=times;
    out.idx=Object.keys(S.dealsByOrg).length>2000;
    return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
