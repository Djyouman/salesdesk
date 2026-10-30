const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const errs=[]; const out={};
  const boot=async(port)=>{ const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage(); p.on('console',m=>{if(m.type()==='error'&&!/status of 40[13]/.test(m.text()))errs.push(port+' console: '+m.text())}); p.on('pageerror',e=>errs.push(port+' pageerror: '+e.message)); await p.goto(`http://localhost:${port}/#home`); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000&&S.ready,null,{timeout:30000}); return {ctx,p} };
  // owner
  let {ctx,p}=await boot(8790);
  Object.assign(out, await p.evaluate(async()=>{ const t=s=>new Promise(r=>setTimeout(r,s)); const o={}; o.web=window.SALESDESK_WEB===true; o.mode=S.mode; o.me=S.me.name==='Daniel Youman'&&S.me.email==='daniel.youman@flowservice.com'&&S.me.isOwner; o.role=S.role; o.users=Object.keys(S.live.users).length; o.brands=Object.keys(S.live.brands).length; o.liveDeals=Object.keys(S.live.deals).length; o.railNoSnapshotBadge=!document.querySelector('#rail').innerText.toLowerCase().includes('snapshot');
    // write a deal through the API
    const id='d_webtest_1'; const ok=await dbWrite('deals',id,{id,title:'Web test deal',org:'org_servicetitan-otj',brand:'cortez',owner:'Daniel Youman',line:'project',stage:'lead',status:'open',value:1234,createdAt:nowISO()},false); o.write=ok===true; await t(300); const r=await fetch('/api/db/deals/'+id).then(r=>r.json()); o.apiHas=r.doc&&r.doc.title==='Web test deal';
    return o }));
  await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.ready&&Object.keys(S.live.deals).length>0,null,{timeout:30000});
  out.persist=await p.evaluate(()=>!!S.live.deals['d_webtest_1']&&S.dealById.has('d_webtest_1'));
  // polling: write via API directly, expect page to pick it up
  await p.evaluate(()=>fetch('/api/db/deals/d_webtest_2',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'d_webtest_2',title:'Polled deal',org:'org_servicetitan-otj',brand:'cortez',owner:'Daniel Youman',line:'project',stage:'lead',status:'open',value:99})}));
  await p.waitForFunction(()=>!!S.live.deals['d_webtest_2'],null,{timeout:25000}).then(()=>out.polled=true).catch(()=>out.polled=false);
  // hosted email: shim emulates the Microsoft 365 connector over /api/mail/*
  Object.assign(out, await p.evaluate(async()=>{ const o={}; const t=s=>new Promise(r=>setTimeout(r,s)); o.mcp=!!S.mcp&&S.m365.status==='connected'; const d=S.dealById.get('d_webtest_1'); S.sel.deal=d.id; go('deal'); await t(120); o.sendBtn=document.querySelector('#main').innerText.toLowerCase().includes('send email');
    ACTIONS.emailDeal({id:d.id}); await t(40); document.querySelector('#emailf [name=to]').value='pat@customer.org'; await ACTIONS.sendEmail({id:d.id}); await t(300); const a=Object.values(S.live.activities).find(x=>x.dealId===d.id&&x.type==='email'&&x.direction==='sent'); o.sentLogged=!!a&&a.via==='outlook';
    await ACTIONS.syncMail({id:d.id}); await t(400); const synced=Object.values(S.live.activities).filter(x=>x.dealId===d.id&&x.via==='outlook-sync'); o.syncedOwnSent=synced.some(x=>x.direction==='sent'&&x.subject.includes(dealTag(d))); return o }));
  await ctx.close();
  // sales rep matched by display name
  ({ctx,p}=await boot(8791));
  Object.assign(out, await p.evaluate(async()=>{ const o={}; o.salesRole=S.role==='sales'; o.salesUser=S.meUser&&S.meUser.name==='Steve Dobbins'; o.salesOwnOnly=filteredDeals().every(d=>d.owner==='Steve Dobbins'); const r=await fetch('/api/db/settings/main',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({x:1})}); o.salesSettingsDenied=r.status===403; const r2=await fetch('/api/db/activities/act_webtest',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'act_webtest',dealId:'d_webtest_1',type:'call',text:'x',at:new Date().toISOString()})}); o.salesActivityAllowed=r2.status===200; o.salesWritesKept=S.me.writes!==false; const u=await fetch('/api/db/users/rep_steve-dobbins').then(r=>r.json()); o.uidLinked=!!(u.doc&&u.doc.uid); return o }));
  await ctx.close();
  // unknown person in the allowed domain → viewer, no writes
  ({ctx,p}=await boot(8792));
  Object.assign(out, await p.evaluate(async()=>{ const o={}; o.guestRole=S.role==='viewer'; o.guestWrites=S.me.writes; const r=await fetch('/api/db/deals/d_guest',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'d_guest'})}); o.guestDenied=r.status===403; return o }));
  await ctx.close(); await b.close();
  console.log(JSON.stringify(out,null,1)); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
