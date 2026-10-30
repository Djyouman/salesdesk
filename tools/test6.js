const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:1400,height:900}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#home'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const today=todayISO();
    // a) quote-driven stage stamp
    const d=S.deals.find(x=>x.status==='open'&&x.value<5e7&&x.id.startsWith('pd_')&&dealStage(x)==='lead'); await ACTIONS.newQuote({deal:d.id}); await t(40); const q=Object.values(S.live.quotes).find(x=>x.dealId===d.id);
    out.installNull=S.live.quotes[q.id].installStart===null;
    document.querySelector('#qform [name="opt.0.l.0.cost"]').value='120000'; await ACTIONS.saveQuote({id:q.id}); const dd=S.dealById.get(d.id); out.a=dd.stage==='quoted'&&dd.stageAt.quoted===today&&weekMovement(S.deals).advanced.some(x=>x.id===d.id);
    // b) editDeal + createDeal stamps
    const d2=S.deals.find(x=>x.status==='open'&&x.id.startsWith('pd_')&&x.id!==d.id&&dealStage(x)==='lead'); ACTIONS.editDeal({id:d2.id}); document.querySelector('#dealf [name=stage]').value='qualified'; await ACTIONS.saveDeal({id:d2.id}); out.b1=S.dealById.get(d2.id).stageChangedAt===today;
    ACTIONS.newDeal({}); document.querySelector('#dealf [name=title]').value='Stamp test'; document.querySelector('#dealf [name=stage]').value='qualified'; await ACTIONS.createDeal(); const nd=S.deals.find(x=>x.title==='Stamp test'); out.b2=nd.stageAt.qualified===today;
    // c) tax basis
    const d3=S.deals.find(x=>x.status==='open'&&x.line==='project'&&x.id.startsWith('pd_')&&x.value<5e7&&![d.id,d2.id].includes(x.id)); await ACTIONS.newQuote({deal:d3.id}); await t(40); const q3=Object.values(S.live.quotes).find(x=>x.dealId===d3.id);
    document.querySelector('#qform [name=template]').value='rtu'; await ACTIONS.applyTemplate({id:q3.id}); document.querySelector('#qform [name=taxRate]').value='7'; await ACTIONS.saveQuote({id:q3.id}); let c=quoteCalc(S.live.quotes[q3.id]);
    out.c1=Math.abs(c.tax-Math.round((c.byType.equipment+c.byType.material)*c.price/c.cost*0.07))<=1; const gmTax=c.tax;
    document.querySelector('#qform [name=pricing]').value='markup'; await ACTIONS.saveQuote({id:q3.id}); c=quoteCalc(S.live.quotes[q3.id]); out.c2=c.tax===Math.round((c.byType.equipment*1.15+c.byType.material*1.2)*0.07); const mkTax=c.tax;
    document.querySelector('#qform [name="opt.0.price"]').value='52000'; await ACTIONS.saveQuote({id:q3.id}); c=quoteCalc(S.live.quotes[q3.id]); out.c3=c.tax!==mkTax&&c.price===52000;
    // d) template clears override
    document.querySelector('#qform [name=template]').value='chiller'; await ACTIONS.applyTemplate({id:q3.id}); const q3b=S.live.quotes[q3.id]; c=quoteCalc(q3b); out.d=q3b.options[0].price===null&&c.price===Math.round(c.suggested/100)*100&&c.price>200000;
    // e) week movement rep-only
    const before=weekMovement(S.deals); const d4=S.deals.filter(x=>x.status==='open'&&x.id.startsWith('pd_')&&x.value<1e6&&![d.id,d2.id,d3.id].includes(x.id)).slice(0,3); await setStage(d4[0],'verbal'); await setStage(d4[1],'verbal'); ACTIONS.closeDeal({id:d4[2].id,result:'won'}); await ACTIONS.doClose({id:d4[2].id,result:'won'});
    let w=weekMovement(S.deals); out.e1=w.acts.length===before.acts.length&&w.system>=before.system+3;
    ACTIONS.quickLog({id:d4[0].id}); document.querySelector('#qlf [name=text]').value='call'; await ACTIONS.saveQuickLog({id:d4[0].id}); w=weekMovement(S.deals); out.e2=w.byRep['local user']===1;
    // P23 capacity: two quotes one deal load once; overdue row
    const bk=d3.brand; S.ui.brand=bk; await ACTIONS.newQuote({deal:d3.id}); await t(40); const quotes3=Object.values(S.live.quotes).filter(x=>x.dealId===d3.id); out.twoQuotes=quotes3.length===2;
    for(const qq of quotes3){ qq.installStart='2026-09-01'; qq.options[0].crew=4; qq.options[0].days=15; await saveQuote(qq,true,false) }
    S.ui.planTab='gpmd'; go('plan'); await t(120); const txt=document.querySelector('#main').innerText; out.overdueRow=txt.includes('Overdue / unscheduled'); const rowTxt=txt.split('\n').find(l=>l.startsWith('Overdue')); out.overdueLine=rowTxt; out.defaultAssumption=txt.includes('default assumption');
    ACTIONS.editGpmd({id:bk}); document.querySelector('#gf [name=fieldTechs]').value='12'; await ACTIONS.saveGpmd({id:bk}); await t(60); out.assumptionGone=!document.querySelector('#main').innerText.includes('default assumption');
    // P24 brandmgr scope
    S.role='brandmgr'; S.meUser={name:'x',brand:'cortez',brands:['cortez']}; S.ui.brand=''; const m=new Date().getMonth()+1; const cortezPlan=S.plans.companyPlans.filter(g=>g.brand==='cortez'&&g.month<=m).reduce((a,g)=>a+g.ordersPlan,0); out.p24=planTotals('').ordersYTD===cortezPlan; const x=ceoBriefData(filteredDeals()); out.coverageFY=Math.abs(x.coverage-(x.wgtFY/x.gap))<1e-9; out.briefText=ceoBriefText(x).includes('closing this FY');
    // P25
    out.numSeq=nextNumber('quotes',bk);
    return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
