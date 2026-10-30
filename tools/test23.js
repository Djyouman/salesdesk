const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#pipeline'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const low=()=>document.querySelector('#main').innerText.toLowerCase();
    const fy=settings().fiscalYear; const m=`${fy}-${String(new Date().getMonth()+1).padStart(2,'0')}`; const mi=+m.slice(5,7);
    // P54 brand scope
    S.ui.brand='cortez'; S.ui.owner=''; const rows=forecastRoll({month:m,deals:filteredDeals()}); const cortezPlan=S.plans.goals.filter(g=>g.brand==='cortez'&&g.month===mi&&!/new hire|mgmt|replace|open req|tbd/i.test(g.rep)).reduce((a,g)=>a+g.ordersPlan,0);
    out.planScoped=Math.abs(rows.reduce((a,r)=>a+r.plan,0)-cortezPlan)<1; out.noOtherBrands=rows.every(r=>r.brand==='cortez'); out.noPlaceholders=!rows.some(r=>/new hire|mgmt/i.test(r.rep));
    S.ui.pipeTab='forecast'; go('pipeline'); await t(150); out.headerPlan=low().includes(('plan '+fmtK(cortezPlan)).toLowerCase());
    // brief uses the same scope
    const x=ceoBriefData(filteredDeals()); const txt=ceoBriefText(x); out.briefScoped=txt.includes('vs plan '+fmtK(cortezPlan));
    S.ui.brand='';
    // sales sees own row only
    S.forceRole='sales'; S.forceUser=S.users.find(u=>u.name==='Steve Dobbins'); recompute(); const srows=forecastRoll({month:m,deals:filteredDeals()}); out.salesOwnRow=srows.length<=1&&srows.every(r=>r.rep==='Steve Dobbins'); S.forceRole='owner'; S.forceUser=null; recompute();
    // brand manager scope
    S.forceRole='brandmgr'; S.forceUser={name:'Test GM',brand:'weber',brands:['weber']}; recompute(); const brows=forecastRoll({month:m,deals:filteredDeals()}); out.brandmgrScoped=brows.every(r=>r.brand==='weber'); S.forceRole='owner'; S.forceUser=null; recompute();
    // P56 outlier guard
    const big=S.dealById.get('pd_11169'); const org=S.orgById.get(big.org); out.orgOpenSane=org.openValue<5e7;
    S.view='accounts'; S.ui.acctTab='list'; S.ui.q=''; render(); await t(80); const first=document.querySelector('#main table tr.row'); out.firstNotOutlier=!(first&&first.dataset.go&&first.dataset.go.endsWith(big.org)); out.lastTouchHeader=low().includes('last touch');
    S.sel.org=big.org; go('account'); await t(100); out.acctHeaderSane=low().includes('outlier/paused excluded')&&!low().includes('$6.2b');
    S.ui.teamTab='people'; go('team'); await t(100); out.teamLoads=low().includes('onboarded');
    out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
