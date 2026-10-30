const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#home'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const low=()=>document.querySelector('#main').innerText.toLowerCase(); const mlow=()=>(document.querySelector('#modalhost').innerText||'').toLowerCase();
    const d=S.deals.find(x=>x.status==='open'&&x.value>5000&&x.value<5e7&&x.owner); S.sel.deal=d.id; go('deal'); await t(100);
    out.hiddenWithoutMcp=!low().includes('send email')&&low().includes('+ paste email');
    // fake Microsoft 365 connector
    const sent=[]; const tag=dealTag(d);
    window.S.mcp={callTool:async(server,tool,input)=>{ if(server!=='Microsoft 365')throw {code:'not_in_manifest'}; if(tool==='outlook_send_mail'){sent.push(input);return {content:[{type:'text',text:'ok'}],payload:{ok:true}}} if(tool==='outlook_email_search'){ const items=[{uri:'mail:///messages/m1',id:'m1',subject:`RE: ${d.title} [${tag}]`,sender:'pat@customer.org',senderName:'Pat Customer',recipients:null,receivedDateTime:'2026-10-29T15:12:00Z',summary:'Thanks, please send the alternate.',webLink:'https://outlook.office365.com/owa/?ItemID=m1'},{id:'m2',subject:'Unrelated',sender:'x@y.com',senderName:'X',receivedDateTime:'2026-10-28T10:00:00Z',summary:'noise'},{id:'m3',subject:`${d.title} [${tag}]`,sender:'/O=EXCHANGELABS/OU=EXCHANGE ADMINISTRATIVE GROUP/CN=RECIPIENTS/CN=ABC-STEVE',senderName:'Steve Dobbins',recipients:null,receivedDateTime:'2026-10-27T10:00:00Z',summary:'Proposal attached.'},{moreResults:false,nextOffset:3,note:'x'}]; const sel2=input.query?items:[]; return {content:sel2.map(x=>({type:'text',text:JSON.stringify(x)})),payload:sel2[0]} } throw {code:'bad_request'} },listTools:async()=>({servers:[{server:'Microsoft 365',authStatus:'connected',tools:[]}]})}; S.m365={status:'connected'};
    render(); await t(80); out.buttonsShown=low().includes('send email')&&low().includes('sync inbox')&&low().includes(tag.toLowerCase());
    ACTIONS.emailDeal({id:d.id}); await t(50); out.modal=mlow().includes('email ·')&&document.querySelector('#emailf [name=subject]').value.includes('['+tag+']');
    document.querySelector('#emailf [name=to]').value='pat@customer.org, bad-address'; document.querySelector('#emailf [name=cc]').value='boss@customer.org'; await ACTIONS.sendEmail({id:d.id}); await t(150);
    out.sent=sent.length===1&&sent[0].to.length===1&&sent[0].to[0]==='pat@customer.org'&&sent[0].cc[0]==='boss@customer.org'&&sent[0].bodyType==='html'&&sent[0].subject.includes(tag);
    const a=Object.values(S.live.activities).find(x=>x.dealId===d.id&&x.type==='email'&&x.direction==='sent'); out.logged=!!a&&a.via==='outlook'&&a.subject===sent[0].subject; out.modalClosed=!document.querySelector('#modal');
    await ACTIONS.syncMail({id:d.id}); await t(200); const synced=Object.values(S.live.activities).filter(x=>x.dealId===d.id&&x.via==='outlook-sync'); out.synced=synced.length===2&&synced.some(x=>x.direction==='received'&&x.text.includes('alternate')&&x.link.includes('outlook'))&&synced.some(x=>x.direction==='sent'&&x.msgId==='m3');
    await ACTIONS.syncMail({id:d.id}); await t(150); out.noDup=Object.values(S.live.activities).filter(x=>x.dealId===d.id&&x.via==='outlook-sync').length===2;
    // error branches
    S.mcp={callTool:async()=>{throw {code:'needs_reauth'}}}; ACTIONS.emailDeal({id:d.id}); await t(30); document.querySelector('#emailf [name=to]').value='pat@customer.org'; await ACTIONS.sendEmail({id:d.id}); await t(80); out.reauthMsg=(document.querySelector('#toasts').innerText||'').toLowerCase().includes('reconnect microsoft 365'); out.modalKept=!!document.querySelector('#modal'); closeModal();
    S.mcp={callTool:async()=>{throw {code:'server_not_connected'}}}; await ACTIONS.syncMail({id:d.id}); await t(80); out.notConnectedMsg=(document.querySelector('#toasts').innerText||'').toLowerCase().includes('settings → connectors');
    // mailItems normalizer tolerates array payloads and strings
    out.normArray=mailItems({content:[{type:'text',text:JSON.stringify({id:'a',subject:'s',sender:'jane@x.com',senderName:'Jane'})},{type:'text',text:JSON.stringify({moreResults:true,nextOffset:1})}]}).length===1&&mailItems([{id:'a',subject:'s',from:'Jane <jane@x.com>'}])[0].fromEmail==='jane@x.com'; out.normJunk=mailItems('oops').length===0&&mailItems({value:[]}).length===0;
    S.mcp=null; render(); out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth; return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
