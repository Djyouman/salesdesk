const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#accounts'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const low=()=>document.querySelector('#main').innerText.toLowerCase();
    const ren=renewalsDue(S.deals.filter(d=>d.value<5e7),120); out.count=ren.length; out.allMaint=ren.every(x=>x.d.line==='maintenance'&&x.d.status==='won'); out.sorted=ren.every((x,i)=>i===0||x.r>=ren[i-1].r); out.withinWindow=ren.every(x=>x.r<=new Date(Date.now()+120*864e5).toISOString().slice(0,10));
    const w=S.deals.find(d=>d.status==='won'&&d.line==='maintenance'&&d.won==='2025-11'); out.anniv=renewalDateFor(w); out.annivFuture=out.anniv>=todayISO();
    S.ui.acctTab='pm'; render(); await t(120); out.section=low().includes('renewals due in 120 days'); out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    const x=ren[0]; const before=S.deals.length; await ACTIONS.startRenewal({id:x.d.id}); await t(80); const nd=S.deals.find(d=>d.renewalOf===x.d.id); out.created=!!nd&&nd.line==='maintenance'&&nd.status==='open'&&nd.close===x.r&&nd.value===x.d.value&&dealStage(nd)==='qualified'; out.linkedBack=S.dealById.get(x.d.id).renewedBy===nd.id; out.droppedFromList=!renewalsDue(S.deals,120).some(y=>y.d.id===x.d.id);
    out.dealPage=low().includes('renewal of'); go('home'); await t(100); out.homeRow=low().includes('pm renewals in 90 days'); return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
