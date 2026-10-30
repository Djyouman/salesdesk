const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#quotes'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const low=()=>document.querySelector('#main').innerText.toLowerCase();
    // below-floor quote as sales
    const d=S.deals.find(x=>x.status==='open'&&x.line==='project'&&x.id.startsWith('pd_')&&x.value<5e7&&x.owner==='Steve Dobbins'); await ACTIONS.newQuote({deal:d.id}); await t(40); const q=Object.values(S.live.quotes).find(x=>x.dealId===d.id);
    document.querySelector('#qform [name="opt.0.crew"]').value='4'; document.querySelector('#qform [name="opt.0.days"]').value='20'; document.querySelector('#qform [name="opt.0.l.0.cost"]').value='5000'; document.querySelector('#qform [name="opt.0.price"]').value='60000'; await ACTIONS.saveQuote({id:q.id}); let c=quoteCalc(S.live.quotes[q.id]); out.belowFloor=c.gpmd<c.req; out.verdict=c.verdict;
    S.forceRole='sales'; S.forceUser={name:'Steve Dobbins',brand:'cortez'}; recompute(); await ACTIONS.setQuoteStatus({id:q.id,status:'sent'}); await t(40); let qq=S.live.quotes[q.id]; out.salesBlocked=qq.status==='draft'&&!!qq.approvalRequested; out.activity=Object.values(S.live.activities).some(a=>a.dealId===d.id&&/sign-off requested/.test(a.text));
    render(); await t(80); out.bannerSales=low().includes('needs gm sign-off')&&!document.querySelector('[data-act=approveQuote]');
    // proposal download blocked for sales
    await ACTIONS.makeProposal({id:q.id}); await t(60); const pr=Object.values(S.live.proposals).find(x=>x.quoteId===q.id); S.downloads={save:async()=>{out.downloadCalled=true;return {status:'saved'}}}; await dbWrite('proposals',pr.id,{...pr,scope:'scope'},false); await ACTIONS.downloadProposal({id:pr.id}); out.downloadBlocked=!out.downloadCalled;
    // manager approves
    S.forceRole='brandmgr'; S.forceUser={name:'Dave Shephard',brand:'cortez',brands:['cortez']}; recompute(); go('home'); await t(100); out.homeCard=low().includes('awaiting gpmd sign-off'); go('quote',{quote:q.id}); await t(80); out.approveBtn=!!document.querySelector('[data-act=approveQuote]');
    ACTIONS.approveQuote({id:q.id}); await ACTIONS.doApprove({id:q.id}); out.noteRequired=!!document.querySelector('#apNote'); document.querySelector('#apNote').value='Strategic hospital account, fills March capacity'; await ACTIONS.doApprove({id:q.id}); await t(60); qq=S.live.quotes[q.id]; out.approved=qq.status==='sent'&&qq.approval&&qq.approval.by==='Dave Shephard'&&!qq.approvalRequested; out.dealStageProposal=dealStage(S.dealById.get(d.id))==='proposal';
    await ACTIONS.downloadProposal({id:pr.id}); out.downloadAfter=out.downloadCalled===true;
    // above-floor unaffected for sales
    S.forceRole='sales'; S.forceUser={name:'Steve Dobbins',brand:'cortez'}; recompute(); const d2=S.deals.find(x=>x.status==='open'&&x.line==='project'&&x.id.startsWith('pd_')&&x.value<5e7&&x.owner==='Steve Dobbins'&&x.id!==d.id); await ACTIONS.newQuote({deal:d2.id}); await t(40); const q2=Object.values(S.live.quotes).find(x=>x.dealId===d2.id); document.querySelector('#qform [name="opt.0.l.0.cost"]').value='120000'; await ACTIONS.saveQuote({id:q2.id}); out.aboveVerdict=quoteCalc(S.live.quotes[q2.id]).verdict; await ACTIONS.setQuoteStatus({id:q2.id,status:'sent'}); out.aboveSent=S.live.quotes[q2.id].status==='sent';
    // decline path
    S.forceRole='owner'; S.forceUser=null; recompute(); const d3=S.deals.find(x=>x.status==='open'&&x.line==='project'&&x.id.startsWith('pd_')&&x.value<5e7&&![d.id,d2.id].includes(x.id)); await ACTIONS.newQuote({deal:d3.id}); await t(40); const q3=Object.values(S.live.quotes).find(x=>x.dealId===d3.id); document.querySelector('#qform [name="opt.0.crew"]').value='5'; document.querySelector('#qform [name="opt.0.days"]').value='20'; document.querySelector('#qform [name="opt.0.price"]').value='60000'; await ACTIONS.saveQuote({id:q3.id}); await dbWrite('quotes',q3.id,{...S.live.quotes[q3.id],approvalRequested:{by:'x',at:nowISO()}},false); await ACTIONS.declineQuote({id:q3.id}); out.declined=S.live.quotes[q3.id].status==='draft'&&!S.live.quotes[q3.id].approvalRequested&&!!S.live.quotes[q3.id].declined;
    // P38 accuracy
    const snap=buildSnapshot(); out.snapHasCommit=!!snap.commitByRep&&!!snap.month; const prevM=new Date(); prevM.setMonth(prevM.getMonth()-1); const pm=prevM.toISOString().slice(0,7); const rep=S.deals.find(x=>x.status==='won'&&x.won===pm&&x.value<5e7).owner; await dbWrite('product','snap-2026-W39',{...snap,id:'snap-2026-W39',week:'2026-W39',month:pm,commitByRep:{[rep]:{commit:100000,best:150000,plan:120000}}},false); const fa=forecastAccuracy(); out.faRow=fa.find(x=>x.rep===rep&&x.month===pm); out.faOk=!!out.faRow&&out.faRow.hit===out.faRow.won/100000;
    S.ui.anaTab='reps'; go('analytics'); await t(120); out.faTable=low().includes('forecast accuracy')&&low().includes(pm); out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
