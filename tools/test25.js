const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#pipeline'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const low=()=>document.querySelector('#main').innerText.toLowerCase();
    S.ui.brand='';S.ui.owner='';
    const m=`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    // ---- P63: slip history via quick log and edit
    const d=S.deals.find(x=>x.status==='open'&&x.close&&x.close>todayISO()&&x.value>5000&&x.value<5e7&&ym(x.close)===m);
    const plus=(iso,n)=>{const z=new Date(iso+'T00:00:00');z.setDate(z.getDate()+n);return new Date(z.getTime()-z.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
    S.sel.deal=d.id; go('deal'); await t(80); ACTIONS.quickLog({id:d.id}); await t(30); document.querySelector('#qlf [name=text]').value='pushed'; document.querySelector('#qlf [name=close]').value=plus(d.close,14); await ACTIONS.saveQuickLog({id:d.id}); await t(100);
    let d2=S.dealById.get(d.id); out.hist1=d2.closeHistory&&d2.closeHistory.length===1&&d2.closeHistory[0].from===d.close&&d2.closeHistory[0].to===plus(d.close,14);
    ACTIONS.editDeal({id:d.id}); await t(30); document.querySelector('#dealf [name=close]').value=plus(d.close,30); await ACTIONS.saveDeal({id:d.id}); await t(100); d2=S.dealById.get(d.id); out.hist2=d2.closeHistory.length===2;
    ACTIONS.editDeal({id:d.id}); await t(30); await ACTIONS.saveDeal({id:d.id}); await t(80); out.noDupOnSameDate=S.dealById.get(d.id).closeHistory.length===2;
    const sl=slipsSince(S.deals,weekStart()); out.slipsFound=sl.filter(x=>x.d.id===d.id).length===2&&sl[0].days>=14;
    const wm=weekMovement(S.deals); out.wmSlipped=wm.slipped.length>=2;
    S.ui.anaTab='week'; go('analytics'); await t(120); out.weekRow=low().includes('slipped (close date pushed)')&&low().includes('slipped 16 days')&&low().includes('slipped 14 days');
    go('home'); await t(120); out.ceoStat=low().includes('slipped this week'); const x=ceoBriefData(filteredDeals()); out.briefLine=ceoBriefText(x).includes('Slipped this week');
    // ---- P57 brand roll-up
    S.ui.pipeTab='forecast'; go('pipeline'); await t(150); const txt=low(); out.brandTable=txt.includes('by brand')&&txt.includes('δ commit vs last week')&&txt.includes('platform'); out.slipCol=txt.includes('slipped (wk)');
    const rows=forecastRoll({month:m,deals:filteredDeals()}); const repTot=rows.reduce((a,r)=>a+r.commit,0); const cells=[...document.querySelectorAll('#main table')][0]; const platRow=[...cells.querySelectorAll('tr')].find(tr=>tr.innerText.toLowerCase().startsWith('platform')); out.totalsMatch=!!platRow&&platRow.innerText.includes(fmtK(repTot));
    // delta when snapshot exists for this month
    const snaps=Object.values(S.live.product||{}).filter(x=>x.id&&x.id.startsWith('snap-')); out.snapPresent=snaps.length>0; const snap=prevSnapshot(); out.deltaState=snap&&snap.month===m?txt.includes('+')||txt.includes('−')||txt.includes('-'):txt.includes('none yet')||txt.includes('snapshot');
    out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
