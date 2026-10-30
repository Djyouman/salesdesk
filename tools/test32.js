const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#setup'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const low=()=>document.querySelector('#main').innerText.toLowerCase(); const mlow=()=>(document.querySelector('#modalhost').innerText||'').toLowerCase();
    S.ui.setupTab='data'; go('setup'); await t(150); out.card=low().includes('intake mailboxes');
    document.querySelector('#intakef [name="intake.cortez"]').value='sales@cortezmech.com'; await ACTIONS.saveIntake(); await t(60); out.saved=(S.live.settings.main.intakeMailboxes||{}).cortez==='sales@cortezmech.com';
    const d=S.deals.find(x=>x.status==='open'&&x.brand==='cortez'&&x.value>5000&&x.value<5e7); const tag=dealTag(d);
    // contact-matched deal
    const c={id:'c_intake_test',name:'Ivy Intake',email:'ivy@intakecustomer.com',phone:'',title:'',orgId:d.org,source:'test'}; await dbWrite('contacts',c.id,c,false); const d2=S.deals.find(x=>x.status==='open'&&x.brand==='cortez'&&x.id!==d.id&&x.value<5e7); await dbWrite('deals',d2.id,{...d2,contactId:c.id},false); await t(50);
    const calls=[]; S.mcp={callTool:async(server,tool,input)=>{ calls.push(input); const items=input.query?[{id:'i1',subject:`Site visit notes [${tag}]`,sender:'pat@customer.org',senderName:'Pat',recipients:null,receivedDateTime:'2026-10-29T12:00:00Z',summary:'Notes from the roof walk.',webLink:'https://outlook.office365.com/owa/?ItemID=i1'}]:[{id:'i2',subject:'Question on the PM agreement',sender:'ivy@intakecustomer.com',senderName:'Ivy Intake',recipients:['sales@cortezmech.com'],receivedDateTime:'2026-10-29T13:00:00Z',summary:'Can we start in January?'},{id:'i3',subject:'Lunch Friday?',sender:'random@somewhere.com',senderName:'Random',receivedDateTime:'2026-10-29T14:00:00Z',summary:'Are you free?'}]; return {content:items.map(x=>({type:'text',text:JSON.stringify(x)})),payload:items[0]} }};
    await ACTIONS.syncIntake(); await t(300); out.calls=calls.length===2&&calls.every(c=>c.mailboxOwnerEmail==='sales@cortezmech.com'); out.callsLegal=calls.every(c=>!(c.mailboxOwnerEmail&&(c.recipient||(c.query&&(c.sender||c.afterDateTime)))));
    const acts=Object.values(S.live.activities); out.tagFiled=acts.some(a=>a.msgId==='i1'&&a.dealId===d.id&&a.via==='intake-sync'); out.contactFiled=acts.some(a=>a.msgId==='i2'&&a.dealId===d2.id&&a.via==='intake-sync'); const un=acts.find(a=>a.msgId==='i3'); out.unmatched=!!un&&!un.dealId&&un.via==='intake-unmatched'; out.lastTouch=(S.dealById.get(d.id).lastActivityAt||'').startsWith('2026-10-29');
    render(); await t(80); out.reviewBanner=low().includes('1 intake email not yet matched'); go('home'); await t(100); out.homeCard=low().includes('intake emails to file');
    ACTIONS.reviewIntake(); await t(40); out.modal=mlow().includes('lunch friday'); document.querySelector('#file-'+un.id).value=d.title; await ACTIONS.fileIntake({id:un.id}); await t(100); out.filedManually=S.live.activities[un.id].dealId===d.id&&S.live.activities[un.id].via==='intake-sync'; closeModal();
    await ACTIONS.syncIntake(); await t(200); out.noDup=Object.values(S.live.activities).filter(a=>a.msgId==='i1').length===1;
    S.mcp=null; render(); out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth; return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
