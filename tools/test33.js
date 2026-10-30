const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|cdnjs/.test(m.text()))errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#quotes'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const P=(csv)=>{const rows=parseDelimited(csv);const hi=estFindHeader(rows);const m=estGuessCols(rows[hi]);return {rows,hi,m,p:estParse(rows,hi,m)}};
    // 1 whole-word totals
    let x=P(['Description,Qty,Unit Cost,Total','Sump pump duplex,1,4200,4200','Overhead ductwork,1,1800,1800','Bid bond,1,900,900','Total Cost,,,6900'].join('\n')); out.wordsKept=x.p.lines.length===3&&x.p.lines.some(l=>/sump/i.test(l.desc))&&x.p.lines.some(l=>/overhead/i.test(l.desc))&&x.p.lines.some(l=>/bid bond/i.test(l.desc)); out.totalCostNotSell=x.p.sell==null&&x.p.skipped.length===1;
    // 2 Unit Cost not stolen as Unit
    x=P(['Description,Qty,Unit Cost','Packaged RTU 20 ton,2,28000','Curb,2,1500'].join('\n')); out.unitCostMapped=x.m.unitCost===2&&x.m.unit===undefined&&x.p.lines.length===2&&x.p.lines[0].cost===28000&&x.p.lines[0].unit==='ea';
    // 3 Install phase column
    x=P(['Description,Phase,Qty,Unit Cost','Packaged RTU 20 ton,Install,2,28000','Rigging labor,Install,16,85'].join('\n')); out.installNotLabor=x.p.lines.some(l=>l.type==='equipment'&&l.cost===28000); out.laborRowHours=x.p.hours===16||x.p.lines.some(l=>l.type==='other');
    // 4 sell only from sell rows
    x=P(['Description,Qty,Unit Cost,Total','Chiller,1,165000,165000','Total Sell,,,250000'].join('\n')); out.sellFromSellRow=x.p.sell===250000; x=P(['Description,Qty,Unit Cost,Total','Chiller,1,165000,165000','Total,,,165000'].join('\n')); out.totalRowNotSell=x.p.sell==null;
    // 6 quoted multi-line TSV cell
    x=P('Description\tQty\tUnit Cost\n"RTU, 20 ton\nwith economizer"\t2\t28000'); out.tsvQuoted=x.p.lines.length===1&&x.p.lines[0].desc.includes('economizer');
    // 5 deal picker by id with duplicate titles
    const dups=Object.values(S.deals.reduce((a,d)=>{(a[d.title]=a[d.title]||[]).push(d);return a},{})).find(g=>g.filter(d=>d.status==='open').length>1); out.dupExists=!!dups;
    if(dups){ ACTIONS.estImportOpen({deal:dups[1].id}); await t(50); document.querySelector('#estTa').value='Description\tQty\tUnit Cost\nTest line\t1\t100'; await ACTIONS.estPreview(); await t(60); const before=Object.keys(S.live.quotes).length; await ACTIONS.estCommit(); await t(200); const q=Object.values(S.live.quotes).find(q=>q.source==='spreadsheet'&&q.dealId===dups[1].id); out.dupResolved=!!q&&Object.keys(S.live.quotes).length===before+1 }
    // 7 addresses with display names; 8 per-deal dedupe; greeting
    const d=S.deals.find(x=>x.status==='open'&&x.value>5000&&x.value<5e7&&x.owner); const d2=S.deals.find(x=>x.status==='open'&&x.id!==d.id&&x.value<5e7&&x.brand===d.brand); const sent=[]; const tagA=dealTag(d), tagB=dealTag(d2);
    S.mcp={callTool:async(sv,tool,input)=>{ if(tool==='outlook_send_mail'){sent.push(input);return {content:[],payload:{ok:true}}} const items=[{id:'x1',subject:`For B [${tagB}]`,sender:'pat@customer.org',senderName:'Pat',receivedDateTime:'2026-10-29T10:00:00Z',summary:'b'},{id:'x2',subject:'Plain contact mail',sender:'pat@customer.org',senderName:'Pat',receivedDateTime:'2026-10-29T11:00:00Z',summary:'both'}]; return {content:items.map(i=>({type:'text',text:JSON.stringify(i)})),payload:items[0]} }}; S.m365={status:'connected'};
    await dbWrite('contacts','c_pat_test',{id:'c_pat_test',name:'Pat Customer',email:'pat@customer.org',orgId:d.org},false); await dbWrite('deals',d.id,{...d,contactId:'c_pat_test',contact:'Customer, Pat <pat@customer.org>'},false); await dbWrite('deals',d2.id,{...d2,contactId:'c_pat_test'},false); await t(50);
    S.sel.deal=d.id; go('deal'); await t(80); ACTIONS.emailDeal({id:d.id}); await t(40); out.greeting=document.querySelector('#emailf [name=body]').value.includes('Hi Pat,'); document.querySelector('#emailf [name=to]').value='Pat Customer <pat@customer.org>; boss@customer.org'; document.querySelector('#emailf [name=cc]').value='pat@customer.org, cfo@customer.org'; document.querySelector('#emailf [name=subject]').value='x'.repeat(300); await ACTIONS.sendEmail({id:d.id}); await t(120);
    out.addrParsed=sent.length===1&&sent[0].to.join(',')==='pat@customer.org,boss@customer.org'&&sent[0].cc.join(',')==='cfo@customer.org'&&sent[0].subject.length===255;
    await ACTIONS.syncMail({id:d.id}); await t(150); await ACTIONS.syncMail({id:d2.id}); await t(150); const acts=Object.values(S.live.activities).filter(a=>a.via==='outlook-sync'); out.taggedOnlyToB=acts.filter(a=>a.msgId==='x1').every(a=>a.dealId===d2.id)&&acts.some(a=>a.msgId==='x1'); out.contactMailBoth=acts.filter(a=>a.msgId==='x2').map(a=>a.dealId).sort().join()===[d.id,d2.id].sort().join();
    // 9 clear permit fee; 10 profile license
    const q=Object.values(S.live.quotes).find(x=>x.type!=='maintenance')||Object.values(S.live.quotes)[0]; S.sel.quote=q.id; go('quote'); await t(120); const pf=document.querySelector('#qform [name=permitFee]'); if(pf){ pf.value='650'; let n=readQuoteForm(S.live.quotes[q.id]); out.permitSet=n.permitFee===650; pf.value=''; n=readQuoteForm({...S.live.quotes[q.id],permitFee:650}); out.permitCleared=n.permitFee===null }
    await dbWrite('brands','weber',{...(S.live.brands.weber||{}),profile:{license:'PA-123456'}},false); const pr={...Object.values(S.live.proposals)[0],brand:'weber'}; const html=renderProposalDoc(pr,false); out.profileLicense=html.includes('License PA-123456');
    S.mcp=null; render(); out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth; return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
