const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#home'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const low=()=>document.querySelector('#main').innerText.toLowerCase(); const mlow=()=>(document.querySelector('#modalhost').innerText||'').toLowerCase();
    S.forceRole='sales'; S.forceUser=S.users.find(u=>u.name==='Steve Dobbins'); recompute(); go('home'); await t(120);
    out.tourCard=low().includes('five-minute tour'); const before=kpis(filteredDeals()); const wmBefore=weekMovement(S.deals); const n0=S.deals.length;
    await ACTIONS.toggleTraining(); await t(150); out.trainingOn=trainingOn(); out.banner=low().includes('training mode.'); const tr=S.deals.filter(isTraining); out.seeded=tr.length===3&&tr.every(d=>d.owner==='Steve Dobbins'); out.visible=S.deals.length===n0+3;
    const after=kpis(filteredDeals()); out.kpisExcluded=after.ov===before.ov&&after.open.length===before.open.length; 
    // activity on training deal must not count
    await addActivity('d_training_pm','call','practice call'); await t(50); const wmAfter=weekMovement(S.deals); const cnt=v=>Array.isArray(v)?v.length:v; out.weekExcluded=cnt(wmAfter.acts)===cnt(wmBefore.acts)&&cnt(wmAfter.system)===cnt(wmBefore.system);
    out.ceoExcluded=JSON.stringify(ceoBriefData(S.deals).brandsRows||'').length>0; const snap=buildSnapshot(); out.snapExcluded=!Object.keys(snap.stages||{}).some(id=>id.startsWith('d_training_'));
    out.handoffExcluded=!handoffCsv(S.deals,'2020-01-01','2030-01-01').csv.includes('practice'); out.dqExcluded=!dqSummary(filteredDeals()).some(r=>false)&&dqSummary(filteredDeals()).reduce((a,r)=>a+r.open,0)===before.open.length;
    // training deal usable: quote it
    S.sel.deal='d_training_rtu'; go('deal'); await t(100); out.dealOpens=low().includes('rtu replacement, building 2');
    // tour
    go('home'); await t(80); ACTIONS.startTour(); await t(40); out.step1=mlow().includes('step 1 of 7'); ACTIONS.tourGo({v:'pipeline',i:'2'}); await t(200); out.showMe=S.view==='pipeline'&&mlow().includes('step 3 of 7'); for(let i=3;i<=7;i++){ ACTIONS.tourStep({i:String(i)}); await t(30) } await t(150);
    out.finished=!document.querySelector('#modal'); const u=S.live.users[S.forceUser.id]; out.onboarded=!!(u&&u.onboardedAt); go('home'); await t(100); out.cardGone=!low().includes('five-minute tour');
    S.forceRole='owner'; S.forceUser=null; recompute(); S.ui.teamTab='people'; go('team'); await t(150); out.teamCol=low().includes('onboarded')&&low().includes(todayISO());
    // leave training: deals hidden, not deleted
    await ACTIONS.toggleTraining(); await t(100); out.hidden=!S.deals.some(isTraining)&&Object.keys(S.live.deals).filter(id=>id.startsWith('d_training_')).length===3;
    await ACTIONS.toggleTraining(); await t(60); out.backOn=S.deals.filter(isTraining).length===3; await ACTIONS.resetTraining(); await t(100); out.reset=S.deals.filter(isTraining).length===3&&!Object.values(S.live.activities).some(a=>a.dealId==='d_training_pm'&&!a.deleted);
    setTraining(false); recompute(); out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
