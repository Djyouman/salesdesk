const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#home'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const low=()=>document.querySelector('#main').innerText.toLowerCase(); const mlow=()=>(document.querySelector('#modalhost').innerText||'').toLowerCase();
    // win a deal so there is a pending handoff
    const d=S.deals.find(x=>x.status==='open'&&x.value>20000&&x.value<5e7&&x.line==='project'); S.sel.deal=d.id; go('deal'); await t(100);
    ACTIONS.closeDeal({id:d.id,result:'won'}); await t(60); const f=document.querySelector('#closef'); if(f){ const w=f.querySelector('[name=when]'); if(w)w.value=todayISO(); } await ACTIONS.doClose({id:d.id,result:'won'}); await t(150);
    const won=S.dealById.get(d.id); out.won=won.status==='won';
    const pend=handoffPending(); out.pendingHas=pend.some(x=>x.id===d.id);
    out.dealRow=low().includes('not yet in servicetitan')&&low().includes('record job #');
    go('home'); await t(150); const n=pend.length; out.homeCard=low().includes('won, not in servicetitan')&&low().includes(n+' won in 90 days');
    ACTIONS.showHandoff(); await t(60); out.modalList=mlow().includes(d.title.toLowerCase().slice(0,20)); 
    ACTIONS.recordHandoff({id:d.id}); await t(60); document.querySelector('#hof [name=stJobNo]').value='ST-48213'; await ACTIONS.saveHandoff({id:d.id}); await t(150);
    const w2=S.dealById.get(d.id); out.saved=w2.stJobNo==='ST-48213'&&w2.enteredInST===todayISO()&&w2.stSystem==='ServiceTitan'; out.pendingGone=!handoffPending().some(x=>x.id===d.id); out.activity=Object.values(S.live.activities).some(a=>a.dealId===d.id&&a.type==='handoff');
    const wm=weekMovement(S.deals); out.notRepActivity=(wm.system||0)>=1;
    S.sel.deal=d.id; go('deal'); await t(100); out.dealShows=low().includes('servicetitan st-48213');
    // csv
    const r=handoffCsv(S.deals,todayISO(),todayISO()); out.csvRows=r.n>=1; const lines=r.csv.split('\n'); out.csvHeader=lines[0].startsWith('Brand,Entity,Job number,Entered in job system,Deal'); out.csvHasJob=lines.some(l=>l.includes('ST-48213')); out.csvCols=lines.every(l=>{let q=false,c=1;for(const ch of l){if(ch==='"')q=!q;else if(ch===','&&!q)c++}return c===lines[0].split(',').length});
    const all=handoffCsv(S.deals,'2026-01-01','2026-12-31'); out.csvFyRows=all.n>500;
    // setup data tab
    S.ui.setupTab='data'; go('setup'); await t(150); out.setupCard=low().includes('won-deal handoff export'); out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    await ACTIONS.exportHandoff(); await t(50); out.exportLocalMsg=(document.querySelector('#hoOut').textContent||'').includes('rows ready');
    // sales role: card hidden, still can record on own deal
    S.forceRole='sales'; S.forceUser={name:won.owner,brand:won.brand}; recompute(); go('home'); await t(120); out.salesNoCard=!low().includes('won, not in servicetitan'); S.forceRole='owner'; S.forceUser=null; recompute();
    // persistence
    return out;
  });
  await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  r.persist=await p.evaluate(()=>Object.values(S.live.deals).some(d=>d.stJobNo==='ST-48213'));
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
