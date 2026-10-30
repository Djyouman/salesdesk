const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:1400,height:900}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#home'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s));
    // maintenance deal -> quote defaults to PM template
    const md=S.deals.find(x=>x.status==='open'&&x.line==='maintenance'&&x.id.startsWith('pd_')); await ACTIONS.newQuote({deal:md.id}); await t(50); const q=Object.values(S.live.quotes).find(x=>x.dealId===md.id);
    out.type=q.type; out.template=q.template; out.visits=q.options[0].visits; let c=quoteCalc(q); out.pmHours=c.hours; out.pmManDays=c.manDays; out.pmVerdictBeforePrice=c.verdict;
    document.querySelector('#qform [name="opt.0.price"]').value='9600'; await ACTIONS.saveQuote({id:q.id}); c=quoteCalc(S.live.quotes[q.id]); out.pmPrice=c.price; out.pmGpmd=Math.round(c.gpmd); out.pmVerdict=c.verdict; out.dealSynced=S.dealById.get(md.id).value===9600;
    await ACTIONS.makeProposal({id:q.id}); await t(50); const pr=Object.values(S.live.proposals).find(x=>x.quoteId===q.id); const html=renderProposalDoc(pr,true); out.propHasEquipment=html.includes('Equipment covered'); out.propHasVisits=html.includes('visits per year'); out.propType=pr.type;
    // project deal -> rtu template, markup pricing, tax
    const pd=S.deals.find(x=>x.status==='open'&&x.line==='project'&&x.id.startsWith('pd_')&&x.value<5e7); await ACTIONS.newQuote({deal:pd.id}); await t(50); const q2=Object.values(S.live.quotes).find(x=>x.dealId===pd.id);
    document.querySelector('#qform [name=template]').value='rtu'; await ACTIONS.applyTemplate({id:q2.id}); let q2b=S.live.quotes[q2.id]; out.rtuLines=q2b.options[0].lines.length; out.rtuCrew=q2b.options[0].crew; c=quoteCalc(q2b); out.rtuGmPrice=c.price; out.rtuVerdict=c.verdict;
    document.querySelector('#qform [name=pricing]').value='markup'; document.querySelector('#qform [name=taxRate]').value='7'; document.querySelector('#qform [name=installStart]').value='2027-01-15'; await ACTIONS.saveQuote({id:q2.id}); q2b=S.live.quotes[q2.id]; c=quoteCalc(q2b); out.markupPrice=c.price; out.markupGt=c.price>out.rtuGmPrice; out.tax=c.tax; out.total=c.total; out.installStart=q2b.installStart;
    out.mkInputs=document.querySelectorAll('#qform [name^="mk."]').length;
    // plan capacity uses installStart month
    S.ui.brand=pd.brand; S.ui.planTab='gpmd'; go('plan'); await t(100); out.planText=document.querySelector('#main').innerText.includes('Jan');
    // P16 plan name mapping
    const g0=S.plans.goals.find(g=>g.rep==='MGMT/New Hire'); const owner=S.deals.find(d=>d.status==='open'&&d.brand===g0.brand).owner; const u=S.users.find(u=>u.name===owner); u.planNames=['MGMT/New Hire']; out.mapped=planOwner('MGMT/New Hire')===owner; S.ui.brand=''; S.ui.planTab='reps'; go('plan'); await t(100); out.repsHidesPlaceholder=!document.querySelector('#main').innerText.includes('MGMT/New Hire');
    // setup gpmd markups save
    ACTIONS.editGpmd({id:'cortez'}); document.querySelector('#gf [name="mk.labor"]').value='0.6'; document.querySelector('#gf [name=requiredGpmd]').value='900'; await ACTIONS.saveGpmd({id:'cortez'}); out.cortezMk=gpmdFor('cortez').markups.labor; out.cortezReq=gpmdFor('cortez').requiredGpmd; out.rbrooksReqUnchanged=gpmdFor('rbrooks').requiredGpmd===850;
    return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
