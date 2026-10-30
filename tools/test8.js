const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:1400,height:900}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#setup'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); S.ui.setupTab='data'; render(); await t(50);
    const d=S.deals.find(x=>x.status==='open'&&x.id.startsWith('pd_')&&dealStage(x)==='lead'&&x.value<5e7); const pid=d.pd; const beforeCount=S.deals.length;
    const deals=`Deal - ID,Deal - Title,Deal - Organization,Deal - Owner,Deal - Value,Deal - Stage,Deal - Status,Deal - Expected close date,Deal - Pipeline,Deal - Lost reason\n${pid},${d.title.replace(/,/g,' ')},Some Org,${d.owner},123456,Proposal Submitted,open,2026-12-20,R.Brooks,\n999999001,Brand New Imported Deal,Imported Org LLC,Hank Duus,50000,Qualified - Site Visit,open,2027-01-15,R.Brooks,\n999999002,Old Lost One,Imported Org LLC,Hank Duus,80000,Lost,lost,2026-05-01,Cortez,Price\n`;
    document.querySelector('#pdTa').value=deals; await ACTIONS.pdPreview(); await t(50); out.kind=S._pd.kind; out.stagesDetected=S._pd.stages; out.guess=[...document.querySelectorAll('#pdPreview select')].map(s=>s.value);
    await ACTIONS.pdImport(); await t(50); const dd=S.dealById.get(d.id); out.existingStage=dealStage(dd); out.existingValue=dd.value; out.existingPdStage=dd.pdStageName; out.titleKept=dd.title===d.title;
    const nd=S.dealById.get('pd_999999001'); out.newCreated=!!nd&&nd.brand==='rbrooks'&&dealStage(nd)==='qualified'&&orgName(nd.org)==='Imported Org LLC'; const ld=S.dealById.get('pd_999999002'); out.lostImported=ld&&ld.status==='lost'&&ld.lostReason==='Price'&&ld.brand==='cortez'; out.countDelta=S.deals.length-beforeCount;
    const writesBefore=Object.keys(S.live.deals).length; document.querySelector('#pdTa').value=deals; await ACTIONS.pdPreview(); await t(30); await ACTIONS.pdImport(); await t(30); out.idempotentDeals=Object.keys(S.live.deals).length===writesBefore&&S._pdResult.includes('0 updated');
    const notes=`Deal - ID,Content,Add time,User\n${pid},"<p>Met with <b>facilities</b>, wants pricing by Friday</p>",2026-10-12 14:03:00,Hank Duus\n${pid},Second note,2026-10-13 09:00:00,Hank Duus\n`;
    document.querySelector('#pdTa').value=notes; await ACTIONS.pdPreview(); await t(30); out.notesKind=S._pd.kind; await ACTIONS.pdImport(); await t(30); const acts=Object.values(S.live.activities).filter(a=>a.dealId===d.id&&a.source==='pipedrive'); out.notes=acts.length===2&&acts.some(a=>a.text.includes('wants pricing')&&!a.text.includes('<')); document.querySelector('#pdTa').value=notes; await ACTIONS.pdPreview(); await t(30); await ACTIONS.pdImport(); out.notesIdem=Object.values(S.live.activities).filter(a=>a.dealId===d.id&&a.source==='pipedrive').length===2;
    const persons=`Person - ID,Person - Name,Person - Organization,Person - Email,Person - Phone,Person - Job title\n501,Jane Facilities,Imported Org LLC,jane@imported.com,555-0101,Director\n`;
    document.querySelector('#pdTa').value=persons; await ACTIONS.pdPreview(); await t(30); out.personsKind=S._pd.kind; await ACTIONS.pdImport(); const c=S.live.contacts['c_jane-imported-com']; out.person=!!c&&orgName(c.orgId)==='Imported Org LLC';
    const acts2=`Deal - ID,Subject,Type,Due date,Done,Assigned to user\n${pid},Send proposal,Email,2026-11-03,false,Hank Duus\n${pid},Site walk,Meeting,2026-10-01,true,Hank Duus\n`;
    document.querySelector('#pdTa').value=acts2; await ACTIONS.pdPreview(); await t(30); out.actKind=S._pd.kind; await ACTIONS.pdImport(); await t(30); const ts=Object.values(S.live.tasks).filter(x=>x.dealId===d.id); out.tasks=ts.length===2&&ts.filter(x=>x.done).length===1; out.nextFromTask=S.dealById.get(d.id).nextDate==='2026-11-03';
    out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth; return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
