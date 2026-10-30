const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#home'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const low=()=>document.querySelector('#main').innerText.toLowerCase();
    // (a) stage conflicts: probability-derived stage kept
    const conf=S.deals.filter(d=>d.stageConflict); out.conflicts=conf.length; out.conflictStageIsProb=conf.every(d=>{const r=d.prob; const exp=r>=.75?'verbal':r>=.5?'proposal':r>=.4?'quoted':r>=.2?'qualified':'lead'; return dealStage(d)===exp});
    // (b) velocity excludes import timestamps and labels them
    S.ui.anaTab='aging'; go('analytics'); await t(150); const txt=low(); out.agingLabel=txt.includes('june 23 export'); out.noHugeMedian=!/median[\s\S]{0,400}\b(1[2-9]\d|[2-9]\d\d)\b/.test(txt.split('stage velocity')[1]||'');
    out.proposalAge=txt.includes('proposal to close')&&txt.includes('median days'); const pa=proposalAge(); out.paBrands=pa.map(x=>x.brand+':'+x.medianDays); out.stuckList=txt.includes('open proposals over 2');
    out.parked=txt.includes('paused and outlier'); out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    // (c) pdGm never >100%
    const bad=S.deals.filter(d=>(d.pdGm||0)>1); out.noBadGm=bad.length===0;
    // (d) implied GPMD only when hours>=8 and button present
    const small=S.deals.find(d=>d.status==='open'&&(d.estManHours||d.forecastLaborHours)&&(d.estManHours||d.forecastLaborHours)<8); if(small){go('deal',{deal:small.id});await t(80);out.smallNoGpmd=!low().includes('implied gpmd')}
    const big=S.deals.find(d=>d.status==='open'&&d.value>1000&&d.value<5e7&&(d.estManHours||d.forecastLaborHours)>=16&&d.brand==='cortez'); go('deal',{deal:big.id}); await t(80); out.bigGpmd=low().includes('implied gpmd'); out.btn=!!document.querySelector('[data-act=quoteFromHours]');
    // P28 quote from hours
    const v0=big.value,s0=dealStage(big); await ACTIONS.quoteFromHours({id:big.id}); await t(80); const q=Object.values(S.live.quotes).find(x=>x.dealId===big.id); const c=quoteCalc(q); const hrs=big.estManHours||big.forecastLaborHours; out.qManDays=Math.abs(c.manDays-Math.round(hrs/8*10)/10)<0.01; out.qPrice=c.price===v0; out.qVerdict=['chase','reprice','pass'].includes(c.verdict); out.dealUnchanged=S.dealById.get(big.id).value===v0&&dealStage(S.dealById.get(big.id))===s0;
    // P27 canonical lost
    out.canon=[canonLost('Cheaper bid'),canonLost('Out Bid'),canonLost('No Response from Customer'),canonLost('To be funded later'),canonLost('Went with a competitor')];
    const d2=S.deals.find(x=>x.status==='open'&&x.value<1e6&&x.id.startsWith('pd_')&&x.id!==big.id); ACTIONS.closeDeal({id:d2.id,result:'lost'}); document.querySelector('#closef [name=reason]').value='Price'; await ACTIONS.doClose({id:d2.id,result:'lost'}); out.lostStored=S.dealById.get(d2.id).lostReason==='Price'&&S.dealById.get(d2.id).lostReasonRaw==='Price';
    S.ui.anaTab='winrate'; go('analytics'); await t(120); const wr=low(); const sec=wr.split('lost reasons')[1]||''; out.reasonRowsSmall=(sec.match(/\n(price|lost to competitor|no response|funding \/ timing|no decision \/ shelved|no bid|scope \/ fit|relationship|other)\t/g)||[]).length<=9; const tool=aiTools().find(x=>x.name==='lost_reasons').execute({}); out.toolCanon=tool.every(x=>LOST_CANON.some(([k])=>k===x.reason)||x.reason==='Other'); out.priceCount=(tool.find(x=>x.reason==='Price')||{}).n;
    // P33 board hides paused/outliers
    S.ui.pipeTab='board'; go('pipeline'); await t(120); out.bannerParked=low().includes('kept off the board'); out.noMegaCard=!document.querySelector('.dc.flag');
    // verticals exclusion note
    S.ui.anaTab='vertical'; go('analytics'); await t(120); out.vertNote=low().includes('never passed prospect');
    // P32 contact linking
    out.contactIds=S.deals.filter(d=>d.contactId).length; const noorg=S.deals.find(d=>d.org==='org_no-organization'&&d.status==='open'); if(noorg){go('deal',{deal:noorg.id});await t(60);out.noOrgHidden=!document.querySelector('#main').innerText.includes('Facilities Director')}
    return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
