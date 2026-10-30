const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#pipeline'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const low=()=>document.querySelector('#main').innerText.toLowerCase(); const today=todayISO(); const m=today.slice(0,7);
    const rows=forecastRoll({month:m,deals:S.deals}); out.rows=rows.length; out.keys=rows.length?Object.keys(rows[0]).filter(k=>['rep','brand','commit','best','wgt','plan','gap','won'].includes(k)).length:0;
    const d=S.deals.find(x=>x.status==='open'&&x.value<5e7&&ym(x.close)===m&&dealStage(x)==='quoted'&&x.id.startsWith('pd_')); const before=rows.find(r=>r.rep===d.owner)||{commit:0}; out.defaultCat=forecastCat(d);
    ACTIONS.quickLog({id:d.id}); document.querySelector('#qlf [name=forecastCat]').value='commit'; await ACTIONS.saveQuickLog({id:d.id}); await t(40); const after=forecastRoll({month:m,deals:S.deals}).find(r=>r.rep===d.owner); out.commitMoved=Math.abs((after.commit-before.commit)-d.value)<1; out.catStored=S.dealById.get(d.id).forecastCat==='commit';
    S.ui.pipeTab='forecast'; render(); await t(120); const txt=low(); out.forecastTab=txt.includes('commit')&&txt.includes('best case')&&txt.includes('gap after commit'); out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    // bid due
    const d2=S.deals.find(x=>x.status==='open'&&x.id.startsWith('pd_')&&x.id!==d.id&&x.value<1e6); ACTIONS.editDeal({id:d2.id}); const nd=new Date(); nd.setDate(nd.getDate()+3); const due=new Date(nd.getTime()-nd.getTimezoneOffset()*6e4).toISOString().slice(0,10); document.querySelector('#dealf [name=bidDue]').value=due; await ACTIONS.saveDeal({id:d2.id}); await t(40); out.bidStored=S.dealById.get(d2.id).bidDue===due;
    go('home'); await t(120); out.bidsCard=low().includes('bids due this week')&&low().includes('no quote'); out.ovHome=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    S.ui.pipeTab='list'; go('pipeline'); await t(100); ACTIONS.sortBid(); await t(80); const firstRow=document.querySelector('#main table tr.row'); out.sortedFirstHasBid=!!firstRow&&firstRow.innerText.includes(due.slice(0,7));
    out.briefLine=ceoBriefText(ceoBriefData(S.deals)).toLowerCase().includes('commit this month');
    out.persist=JSON.parse(localStorage.getItem('sd_local_v1')).live.deals[d2.id].bidDue===due;
    return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
