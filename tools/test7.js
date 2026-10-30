const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#home'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const today=todayISO();
    // P3: quick log with next action creates a task; Home shows it; Done completes and clears nextDate
    const d=S.deals.find(x=>x.status==='open'&&x.id.startsWith('pd_')&&x.value<1e6); ACTIONS.quickLog({id:d.id}); document.querySelector('#qlf [name=text]').value='Met on site'; document.querySelector('#qlf [name=nextDate]').value=today; document.querySelector('#qlf [name=nextAction]').value='Send pricing'; await ACTIONS.saveQuickLog({id:d.id}); await t(50);
    const ts=openTasks(d.id); out.taskCreated=ts.length===1&&ts[0].title==='Send pricing'&&ts[0].due===today; out.nextMirrors=S.dealById.get(d.id).nextDate===today;
    go('home'); await t(100); out.homeShowsTask=document.querySelector('#main').innerText.includes('Send pricing'); out.homeDoneBtn=!!document.querySelector('#main [data-act=doneTask]');
    await completeTask(ts[0].id); await t(50); out.taskDone=S.live.tasks[ts[0].id].done===true; out.nextCleared=S.dealById.get(d.id).nextDate==null; out.activityLogged=Object.values(S.live.activities).some(a=>a.dealId===d.id&&a.type==='task');
    // deal page add task
    go('deal',{deal:d.id}); await t(60); ACTIONS.newTask({id:d.id}); document.querySelector('#tf [name=title]').value='Call GC'; document.querySelector('#tf [name=due]').value='2026-11-05'; await ACTIONS.saveTask({id:d.id}); await t(50); out.dealTask=openTasks(d.id).length===1&&S.dealById.get(d.id).nextDate==='2026-11-05'; out.dealTaskShown=document.querySelector('#main').innerText.includes('Call GC'); out.dealOv=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    // P9 contacts import
    S.ui.setupTab='data'; go('setup'); await t(80); const csv='name,title,phone,email,account\n"Doe, Jane",Facilities Director,561-555-0100,jane@example.com,Wabash General Hospital\nBob Smith,PM,,bob@newco.com,Totally New Co LLC\n'; document.querySelector('#csvTa').value=csv; await ACTIONS.importContacts(); await t(50);
    const cs=Object.values(S.live.contacts); out.contacts=cs.length; const jane=cs.find(c=>c.email==='jane@example.com'); out.janeName=jane&&jane.name; out.janeMatched=jane&&orgName(jane.orgId)==='Wabash General Hospital'; out.newOrg=S.orgsAll.some(o=>o.name==='Totally New Co LLC');
    document.querySelector('#csvTa').value=csv; await ACTIONS.importContacts(); out.idempotent=Object.values(S.live.contacts).length===cs.length;
    const wd=S.deals.find(x=>orgName(x.org)==='Wabash General Hospital'); go('deal',{deal:wd.id}); await t(60); out.contactOnDeal=document.querySelector('#main').innerText.includes('Facilities Director');
    // P10 queue: simulate db mode write failure
    S.mode='db'; S.db={doc:()=>({set:async()=>{throw {code:'unavailable',message:'network'}},update:async()=>{throw {code:'unavailable',message:'network'}},delete:async()=>{throw {code:'unavailable'}}})};
    const ok=await dbWrite('deals',d.id,{...S.dealById.get(d.id),notes:'offline edit'},false); out.queuedOk=ok===true&&S.queue.length===1&&S.dealById.get(d.id).notes==='offline edit'; out.queuePersisted=JSON.parse(localStorage.getItem('sd_queue_v1')).length===1;
    go('home'); await t(60); out.queueBanner=document.querySelector('#main').innerText.includes('waiting to sync');
    let sets=0; S.db={doc:()=>({set:async()=>{sets++},update:async()=>{sets++},delete:async()=>{}})}; await flushQueue(); out.flushed=S.queue.length===0&&sets===1;
    // permission error not queued
    S.db={doc:()=>({set:async()=>{throw {code:'invalid_argument',message:'denied'}},update:async()=>{throw {code:'invalid_argument'}},delete:async()=>{}})}; const ok2=await dbWrite('deals',d.id,{...S.dealById.get(d.id),notes:'x'},false); out.permNotQueued=ok2===false&&S.queue.length===0;
    S.mode='local'; S.db=null; return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
