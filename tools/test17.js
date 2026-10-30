const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#analytics'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const low=()=>document.querySelector('#main').innerText.toLowerCase();
    const rows=dqSummary(); out.rows=rows.length; out.keys=rows.length&&['brand','rep','open','issues','counts','score'].every(k=>k in rows[0]); const total=rows.reduce((a,r)=>a+r.issues,0); out.total=total;
    S.ui.anaTab='quality'; go('analytics'); await t(150); out.tab=low().includes('data quality by brand')&&low().includes('past close'); out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    const a=document.querySelector('#main [data-act=dqOpen][data-rep]:not([data-rep=""])'); const rep=a.dataset.rep, issue=a.dataset.issue; const n=+a.textContent; ACTIONS.dqOpen({rep,issue}); await t(120); out.listFiltered=S.view==='pipeline'&&S.ui.pipeTab==='list'&&document.querySelectorAll('#main table tr.row').length===n&&low().includes('showing deals with'); ACTIONS.dqClear(); S.ui.owner='';
    go('home'); await t(100); out.homeDq=low().includes(total+' open issues');
    // sales role sees own rows only
    S.forceRole='sales'; S.forceUser={name:'Steve Dobbins',brand:'cortez'}; recompute(); const srows=dqSummary(); out.salesOwn=srows.every(r=>r.rep==='Steve Dobbins'); S.forceRole='owner'; S.forceUser=null; recompute();
    // P41 quote from hours with split lines and estimator
    const big=S.deals.find(d=>d.status==='open'&&d.value>5000&&d.value<5e7&&(d.estManHours||d.forecastLaborHours)>=16&&d.line==='project'); await ACTIONS.quoteFromHours({id:big.id}); await t(80); const q=Object.values(S.live.quotes).find(x=>x.dealId===big.id); const c=quoteCalc(q); out.lines=q.options[0].lines.length; out.linesSum=Math.abs(q.options[0].lines.reduce((a,l)=>a+l.cost,0)-Math.round(Math.max(0,big.value*(1-((big.pdGm>0&&big.pdGm<=1)?big.pdGm:gpmdFor(big.brand).targetGm))-c.manDays*q.laborCostPerManDay)))<=1; out.estimator=q.estimator===(big.estimator||''); out.gpmdFinite=isFinite(c.gpmd);
    q.scope='x'; q.estimator='Test Estimator'; await saveQuote(q,true,false); await ACTIONS.makeProposal({id:q.id}); await t(60); const pr=Object.values(S.live.proposals).find(x=>x.quoteId===q.id); out.propEstimator=renderProposalDoc(pr,true).includes('Estimated by');
    return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
