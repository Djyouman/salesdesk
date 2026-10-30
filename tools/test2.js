const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#home'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s));
    // P15 more nav
    out.tabbarCount=document.querySelectorAll('#tabbar a').length; out.moreLabel=document.querySelector('#tabbar a:last-child').textContent.trim();
    ACTIONS.moreNav(); out.moreItems=[...document.querySelectorAll('#modal a')].map(a=>a.textContent.trim()); closeModal();
    location.hash='#analytics'; await t(100); out.anaH1=document.querySelector('#main h1').textContent; out.anaOverflow=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    // P13a quote save
    const d=S.deals.find(x=>x.status==='open'&&x.value>1e5&&x.value<5e7&&x.id.startsWith('pd_')); const v0=d.value,s0=dealStage(d);
    await ACTIONS.newQuote({deal:d.id}); await t(50); const q=Object.values(S.live.quotes).find(x=>x.dealId===d.id); out.quoteNumber=q.number;
    await ACTIONS.addLine({id:q.id,i:0}); out.valueUnchanged=S.dealById.get(d.id).value===v0&&dealStage(S.dealById.get(d.id))===s0;
    out.verdictBeforeCost=quoteCalc(S.live.quotes[q.id]).verdict;
    document.querySelector('#qform [name="opt.0.l.0.cost"]').value='120000'; await ACTIONS.saveQuote({id:q.id}); const c=quoteCalc(S.live.quotes[q.id]); out.synced=S.dealById.get(d.id).value===c.price&&['quoted','proposal','verbal'].includes(dealStage(S.dealById.get(d.id))); out.verdictAfter=c.verdict; out.gmAtReq=c.gmAtReq;
    // P13b gpmd blank
    ACTIONS.editGpmd({id:'default'}); document.querySelector('#gf [name=requiredGpmd]').value=''; await ACTIONS.saveGpmd({id:'default'}); out.gpmdDefaultKept=gpmdFor('rbrooks').requiredGpmd===850;
    // P13c/d close
    const d2=S.deals.find(x=>x.status==='open'&&x.value<1e6&&x.id.startsWith('pd_')&&x.id!==d.id);
    ACTIONS.closeDeal({id:d2.id,result:'lost'}); out.reasonFirst=document.querySelector('#closef [name=reason]').value; document.querySelector('#closef [name=when]').value='';
    await ACTIONS.doClose({id:d2.id,result:'lost'}); out.modalStillOpen=!!document.querySelector('#closef'); document.querySelector('#closef [name=reason]').value='Timing'; await ACTIONS.doClose({id:d2.id,result:'lost'}); const d2b=S.dealById.get(d2.id); out.lostYear=d2b.lostYear; out.lostReason=d2b.lostReason;
    ACTIONS.closeDeal({id:d.id,result:'won'}); out.wonDefaultFromQuote=+document.querySelector('#closef [name=value]').value===c.price; document.querySelector('#closef [name=when]').value=''; await ACTIONS.doClose({id:d.id,result:'won'}); out.wonMonth=S.dealById.get(d.id).won; out.quoteAccepted=S.live.quotes[q.id].status;
    await ACTIONS.reopenDeal({id:d.id}); out.reopenClean=S.dealById.get(d.id).lostReason==null&&S.dealById.get(d.id).wonDate==null;
    // P18 quick log
    const d3=S.deals.find(x=>x.status==='open'&&x.id.startsWith('pd_')&&x.id!==d.id&&x.id!==d2.id); ACTIONS.quickLog({id:d3.id}); document.querySelector('#qlf [name=text]').value='Spoke with facilities'; document.querySelector('#qlf [name=nextDate]').value=todayISO(); document.querySelector('#qlf [name=nextAction]').value='Send pricing'; await ACTIONS.saveQuickLog({id:d3.id}); const d3b=S.dealById.get(d3.id); out.nextDate=d3b.nextDate===todayISO(); out.lastTouch=!!d3b.lastActivityAt; out.actCount=Object.values(S.live.activities).filter(a=>a.dealId===d3.id).length;
    location.hash='#home'; await t(120); out.todayShows=document.querySelector('#main').innerText.includes('Send pricing'); out.homeOverflow=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    // P14 deep link
    go('deal',{deal:'pd_233'}); await t(50); out.hash=location.hash; go('account',{org:d3b.org}); await t(50); out.hashOrg=location.hash;
    return out;
  });
  await p.goto(base+'#deal-pd-233'); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000); await p.waitForTimeout(100);
  r.deepH1=await p.evaluate(()=>document.querySelector('#main h1').textContent);
  await p.goto(base+'#account-org-'+(r.hashOrg||'').split('-org-')[1]); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000); await p.waitForTimeout(100); r.deepOrg=await p.evaluate(()=>document.querySelector('#main h1').textContent);
  await p.goto(base+'#deal-pd-999999999'); await p.waitForFunction(()=>window.S&&S.loaded); await p.waitForTimeout(100); r.notFound=await p.evaluate(()=>document.querySelector('#main').innerText.includes('not found'));
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
