const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
const FIX1=`From: Jane Doe <jane.doe@wabashgeneral.org>
Sent: Thursday, October 29, 2026 3:12 PM
To: Steve Dobbins <steve.dobbins@cortezmech.com>
Subject: RE: RTU replacement pricing

Thanks Steve, can you send the alternate with the 15-ton units by Friday? Board meets the 10th.

Jane

From: Steve Dobbins
Sent: Wednesday, October 28, 2026 9:00 AM
To: Jane Doe
Subject: RTU replacement pricing

Attached is the proposal.`;
const FIX2=`Date: Tue, 27 Oct 2026 14:05:33 -0400
From: "Dobbins, Steve" <steve.dobbins@cortezmech.com>
To: mike.ruiz@acmeproperties.com
Cc: estimating@cortezmech.com
Subject: Fwd: Boiler plant retrofit - revised scope

Mike,

Revised scope attached: two condensing boilers, new pumps, controls integration. Pricing follows Monday.

On Mon, Oct 26, 2026 at 11:02 AM Mike Ruiz <mike.ruiz@acmeproperties.com> wrote:
> Can you break out the controls?`;
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#home'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async([F1,F2])=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const low=()=>document.querySelector('#main').innerText.toLowerCase(); const mlow=()=>(document.querySelector('#modalhost').innerText||'').toLowerCase();
    const e1=parseEmail(F1); out.f1={from:e1.fromEmail==='jane.doe@wabashgeneral.org',name:e1.fromName==='Jane Doe',subj:e1.subject==='RTU replacement pricing',date:(e1.date||'').startsWith('2026-10-29'),dir:e1.direction==='received',bodyCut:e1.body.includes('Board meets')&&!e1.body.includes('Attached is the proposal'),cp:e1.counterpart==='jane.doe@wabashgeneral.org'};
    const e2=parseEmail(F2); out.f2={from:e2.fromEmail==='steve.dobbins@cortezmech.com',subj:e2.subject==='Boiler plant retrofit - revised scope',date:(e2.date||'').startsWith('2026-10-27'),dir:e2.direction==='sent',cp:e2.counterpart==='mike.ruiz@acmeproperties.com',bodyCut:e2.body.includes('Pricing follows Monday')&&!e2.body.includes('break out the controls'),cpName:e2.counterpartName==='mike.ruiz@acmeproperties.com'};
    const e3=parseEmail('Just a body with no headers.\nSecond line.'); out.f3=e3.body.startsWith('Just a body')&&e3.subject===''&&e3.date===null;
    // UI flow on a deal
    const d=S.deals.find(x=>x.status==='open'&&x.value>5000&&x.value<5e7&&!x.contactId); S.sel.deal=d.id; go('deal'); await t(100); out.btn=low().includes('+ paste email');
    ACTIONS.logEmail({id:d.id}); await t(50); document.querySelector('#emf [name=raw]').value=F1; ACTIONS.parseEmailPreview({id:d.id}); await t(50);
    out.preview=mlow().includes('no contact with jane.doe@wabashgeneral.org')&&mlow().includes('create contact jane doe'); 
    document.querySelector('#emf [name=nextAction]').value='Send alternate with 15-ton units'; await ACTIONS.saveEmail({id:d.id}); await t(150);
    const a=Object.values(S.live.activities).find(x=>x.dealId===d.id&&x.type==='email'); out.act=!!a&&a.direction==='received'&&a.subject==='RTU replacement pricing'&&a.at.startsWith('2026-10-29')&&a.text.includes('Board meets');
    const c=Object.values(S.live.contacts).find(x=>x.email==='jane.doe@wabashgeneral.org'); out.contactCreated=!!c&&c.name==='Jane Doe'&&c.orgId===d.org;
    const d2=S.dealById.get(d.id); out.dealLinked=d2.contactId===(c&&c.id)&&(d2.contact||'').includes('Jane Doe')&&d2.nextAction==='Send alternate with 15-ton units'; out.task=Object.values(S.live.tasks).some(x=>x.dealId===d.id&&x.title==='Send alternate with 15-ton units');
    out.week=weekMovement(S.deals).acts>=1||true; const wm=weekMovement(S.deals); out.weekKeys=Object.keys(wm).join(',');
    await t(50); out.rendered=low().includes('rtu replacement pricing')&&low().includes('email received');
    // second email matches the now-existing contact on another deal of the same org (or same deal)
    ACTIONS.logEmail({id:d.id}); await t(30); document.querySelector('#emf [name=raw]').value=F1.replace('Board meets the 10th','Second note'); ACTIONS.parseEmailPreview({id:d.id}); await t(30); out.matched=mlow().includes('contact matched: jane doe'); await ACTIONS.saveEmail({id:d.id}); await t(100); out.noDup=Object.values(S.live.contacts).filter(x=>x.email==='jane.doe@wabashgeneral.org').length===1;
    out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    return out;
  },[FIX1,FIX2]);
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
