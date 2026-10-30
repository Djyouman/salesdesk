const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#home'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const low=()=>document.querySelector('#main').innerText.toLowerCase();
    out.noPackUnfiltered=!low().includes('month-end pack');
    S.ui.brand='cortez'; render(); await t(100); out.packShown=low().includes('cortez month-end pack')&&low().includes('copy pack');
    const x=gmPackData('cortez'); const ds=S.deals.filter(d=>d.brand==='cortez'); const k=kpis(ds); out.tiesToKpis=x.k.ov===k.ov&&x.k.wv===k.wv; const mm=`${settings().fiscalYear}-${String(new Date().getMonth()+1).padStart(2,'0')}`; out.wonMonth=x.wonMv===ds.filter(d=>d.status==='won'&&d.won===mm&&sane(d)).reduce((a,d)=>a+d.value,0);
    out.commitTies=Math.abs(x.commit-forecastRoll({month:mm,deals:ds,brand:'cortez'}).reduce((a,r)=>a+r.commit,0))<1; out.renTies=x.ren.length===renewalsDue(ds.filter(sane),90).length;
    const txt=gmPackText('cortez'); out.textSections=['Orders:','Pipeline:','Bids this month:','Renewals due in 90 days:','Stuck in proposal/verbal','Slipped in the last 30 days:','Data quality:'].every(h=>txt.includes(h)); out.textWon=txt.includes(fmtK(x.wonMv)); out.cardWon=low().includes(fmtK(x.wonMv).toLowerCase());
    // brand manager sees own brand pack without a filter
    S.ui.brand=''; S.forceRole='brandmgr'; S.forceUser={name:'Test GM',brand:'weber',brands:['weber']}; recompute(); go('home'); await t(120); out.bmPack=low().includes('weber month-end pack'); S.forceRole='owner'; S.forceUser=null; recompute();
    // sales never sees it
    S.forceRole='sales'; S.forceUser=S.users.find(u=>u.name==='Steve Dobbins'); recompute(); S.ui.brand='cortez'; render(); await t(80); out.salesNoPack=!low().includes('month-end pack'); S.forceRole='owner'; S.forceUser=null; recompute(); S.ui.brand='';
    out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth; return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
