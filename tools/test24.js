const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#home'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const low=()=>document.querySelector('#main').innerText.toLowerCase(); const mlow=()=>(document.querySelector('#modalhost').innerText||'').toLowerCase();
    // ---- P55 part 2: sales cannot mutate a foreign deal through any path
    const steve=S.users.find(u=>u.name==='Steve Dobbins'); S.forceRole='sales'; S.forceUser=steve; recompute();
    const foreign=S.deals.find(d=>d.status==='open'&&d.owner!=='Steve Dobbins'&&d.value>1000&&d.value<5e7); const before=JSON.stringify(S.live.deals[foreign.id]||null); const nAct=Object.keys(S.live.activities).length;
    ACTIONS.quickLog({id:foreign.id}); await t(30); if(document.querySelector('#qlf')){ document.querySelector('#qlf [name=text]').value='should not save'; } await ACTIONS.saveQuickLog({id:foreign.id}); await t(60);
    out.quickLogBlocked=JSON.stringify(S.live.deals[foreign.id]||null)===before&&Object.keys(S.live.activities).length===nAct;
    const nQ=Object.keys(S.live.quotes).length; await ACTIONS.newQuote({deal:foreign.id}); await t(60); out.quoteBlocked=Object.keys(S.live.quotes).length===nQ;
    const wonForeign=S.deals.find(d=>d.status==='won'&&d.owner!=='Steve Dobbins'&&d.line==='maintenance'); await ACTIONS.startRenewal({id:wonForeign.id}); await t(60); out.renewalBlocked=!Object.values(S.live.deals).some(d=>d.renewalOf===wonForeign.id);
    const wonF2=S.deals.find(d=>d.status==='won'&&d.owner!=='Steve Dobbins'&&!d.stJobNo); await ACTIONS.recordHandoff({id:wonF2.id}); await t(30); if(document.querySelector('#hof')){document.querySelector('#hof [name=stJobNo]').value='X1'} await ACTIONS.saveHandoff({id:wonF2.id}); await t(60); out.handoffBlocked=!(S.live.deals[wonF2.id]&&S.live.deals[wonF2.id].stJobNo);
    // own deal still works
    const own=S.deals.find(d=>d.status==='open'&&d.owner==='Steve Dobbins'&&d.value<5e7); ACTIONS.quickLog({id:own.id}); await t(30); document.querySelector('#qlf [name=text]').value='own call'; await ACTIONS.saveQuickLog({id:own.id}); await t(80); out.ownLogWorks=Object.values(S.live.activities).some(a=>a.dealId===own.id&&a.text.startsWith('own call'));
    // AI tools and rep card scoped
    const tools=aiTools(); const sd=tools.find(x=>x.name==='search_deals').execute({text:''}); out.aiScoped=sd.every(x=>x.rep==='Steve Dobbins'); const ps=tools.find(x=>x.name==='pipeline_summary').execute({}); out.aiSummaryScoped=JSON.stringify(ps).length>10;
    ACTIONS.repModal({name:foreign.owner}); await t(40); out.repModalScoped=!mlow().includes(foreign.title.toLowerCase().slice(0,15)); closeModal();
    S.forceRole='owner'; S.forceUser=null; recompute();
    // ---- P62 forecast basis
    const k1=kpis(filteredDeals()); const nImp=k1.open.filter(onImportedProb).length; out.importedCounted=nImp>500; const mv=S.deals.find(d=>d.status==='open'&&d.prob!=null&&d.value>1000&&d.value<5e7); await setStage(mv,'verbal'); await t(80); out.moveClearsImported=!onImportedProb(S.dealById.get(mv.id))&&kpis(filteredDeals()).open.filter(onImportedProb).length===nImp-1;
    go('home'); await t(100); out.homeBasisLabel=low().includes('imported pipedrive probability')&&low().includes((nImp-1)+' on imported');
    const cur=S.live.settings.main||{}; await dbWrite('settings','main',{...cur,forecastBasis:'stage'},false); await t(50); const k2=kpis(filteredDeals()); out.basisChangesWeighted=Math.abs(k2.wgt-k1.wgt)>1000; out.stageProb=S.deals.filter(d=>d.status==='open'&&d.prob!=null).slice(0,50).every(d=>dealProb(d)===STAGE_BY[dealStage(d)].p);
    S.ui.pipeTab='forecast'; go('pipeline'); await t(120); out.forecastLabel=low().includes('(stage-weighted)');
    S.ui.setupTab='data'; go('setup'); await t(120); out.setupSelect=!!document.querySelector('#main select[name=forecastBasis]')&&document.querySelector('#main select[name=forecastBasis]').value==='stage';
    await dbWrite('settings','main',{...(S.live.settings.main||{}),forecastBasis:'imported'},false); await t(30);
    // ---- P65 GPMD floor banner
    S.ui.brand=''; go('quotes'); await t(120); out.floorBanner=low().includes('gpmd floor not set')&&low().includes('default floor')||low().includes('gpmd floor not set');
    const unset=opBrands().filter(b=>!gpmdExplicit(b.key)).length; out.unsetCount=unset;
    const cur2=S.live.settings.main||{}; await dbWrite('settings','main',{...cur2,gpmd:{...(cur2.gpmd||{}),cortez:{requiredGpmd:900,laborCostPerManDay:580}}},false); await t(30); S.ui.brand='cortez'; render(); await t(60); out.bannerClearsWhenSet=!low().includes('gpmd floor not set'); S.ui.brand='';
    out.pillTitle=verdictPill('chase','weber').includes('default floor')&&!verdictPill('chase','cortez').includes('default floor');
    out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
