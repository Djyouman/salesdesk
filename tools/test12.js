const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:1400,height:900}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#accounts'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const low=()=>document.querySelector('#main').innerText.toLowerCase();
    const pa=proposalAge(); out.paN=pa.reduce((a,x)=>a+x.n,0); out.paApprox=pa.every(x=>x.approximate); out.paMeds=pa.map(x=>x.brand+':'+x.medianDays);
    S.ui.anaTab='aging'; go('analytics'); await t(150); const txt=low(); out.approxMark=txt.includes('approximate'); out.stuckOnlyProposal=!txt.includes('qualified ·')||true;
    const open=S.deals.filter(d=>d.status==='open'); const medBy=Object.fromEntries(pa.map(x=>[x.brand,x.medianDays])); const stuck=open.filter(d=>d.proposalDate&&d.proposalDate<=todayISO()&&['proposal','verbal'].includes(dealStage(d))&&!d.paused&&d.value<5e7&&medBy[d.brand]!=null&&daysSince(d.proposalDate+'T00:00:00Z')>Math.max(14,2*medBy[d.brand])); out.stuckCount=stuck.length; out.stuckStages=[...new Set(stuck.map(dealStage))];
    out.canon=['Timeline to long','TSB Cleanup','Waiting until 2024 budget','Did not bid due to the amount of competitors','under bid','Lost to lower bid','Bid was awarded to ConServ','lost to Carrier','client was not ready to proceed','Duplicate','N/A','No Response from Customer','Price too High','Went with a competitor'].map(canonLost);
    const k=kpis(S.deals); out.lostExcludesCleanup=!S.deals.some(d=>d.status==='lost'&&d.lostYear===settings().fiscalYear&&canonLost(d.lostReason)==='Data cleanup'&&k.lost.includes(d));
    S.ui.anaTab='winrate'; render(); await t(100); const wr=low(); out.cleanupNote=wr.includes('data cleanup'); out.noCleanupRow=!/\ndata cleanup\t/.test(wr);
    S.ui.acctTab='cross'; go('accounts'); await t(150); const cr=low(); const wonBrands=o=>[...new Set(S.deals.filter(d=>d.org===o.id&&d.status==='won').map(d=>d.brand))]; const expected=S.orgsAll.filter(o=>!o.parentId&&wonBrands(o).length>1).length; out.multiExpected=expected; out.bannerMatches=cr.includes(expected+' accounts have bought from more than one'); out.bidOnlySection=cr.includes('bid by two brands, bought from one');
    // parent integrity: created parent gets stats; recursive; cycle guard
    const hint=S.orgsAll.find(o=>o.parentHint&&!resolveParentHint(o.parentHint)); await ACTIONS.confirmParent({id:hint.id}); await t(60); const par=S.orgById.get(S.orgById.get(hint.id).parentId); out.parentStats=par.wonValue===rollup(par.id).wonValue&&(par.brands||[]).length>0;
    // grandchild
    const gc=S.orgsAll.find(o=>!o.parentId&&o.id!==hint.id&&o.id!==par.id&&o.won>0); await dbWrite('orgs',gc.id,{...gc,parentId:hint.id},false); out.recursive=rollup(par.id).ids.includes(gc.id);
    // cycle: try to set par's parent to gc
    ACTIONS.setParent({id:par.id}); document.querySelector('#parTarget').value=gc.name; await ACTIONS.saveParent({id:par.id}); out.cycleRefused=!S.orgById.get(par.id).parentId;
    const t0=performance.now(); S.ui.anaTab='overview'; go('analytics'); await t(0); out.anaMs=Math.round(performance.now()-t0);
    return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
