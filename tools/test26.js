const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#home'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const low=()=>document.querySelector('#main').innerText.toLowerCase();
    const d=S.deals.find(x=>x.status==='open'&&x.line==='project'&&x.value>20000&&x.value<5e7&&x.owner); await ACTIONS.newQuote({deal:d.id}); await t(100); const q=Object.values(S.live.quotes).find(x=>x.dealId===d.id); 
    // template with equipment lines
    S.sel.quote=q.id; go('quote'); await t(120); const tsel=document.querySelector('#qform [name=template]'); if(tsel){ tsel.value='rtu'; await ACTIONS.applyTemplate({id:q.id}); await t(120) } else { const q0=S.live.quotes[q.id]; q0.options[0].lines=[{type:'equipment',desc:'Packaged RTU, 20 ton',qty:2,unit:'ea',cost:28000},{type:'freight',desc:'Freight to site',qty:1,unit:'lot',cost:1800},{type:'material',desc:'Curb adapters',qty:2,unit:'ea',cost:1500}]; await saveQuote(q0,true,false); await t(50) }
    S.sel.quote=q.id; go('quote'); await t(150); out.leadField=!!document.querySelector('#qform [name=leadTime]'); out.warrantyDefault=(document.querySelector('#qform [name=warranty]')||{}).value.includes('One-year'); out.freightType=[...document.querySelectorAll('#qform select option')].some(o=>o.value==='freight');
    document.querySelector('#qform [name=leadTime]').value='10–12 weeks ARO; 3 days on site'; document.querySelector('#qform [name=scope]').value='Replace two rooftop units.'; const q1=readQuoteForm(S.live.quotes[q.id]); out.readsFields=q1.leadTime.startsWith('10–12')&&q1.warranty.includes('One-year'); await saveQuote(q1,true,false); await t(60);
    await ACTIONS.makeProposal({id:q.id}); await t(120); const pr=Object.values(S.live.proposals).find(x=>x.quoteId===q.id); out.propFields=pr.leadTime.startsWith('10–12')&&pr.warranty.includes('One-year');
    const html=renderProposalDoc(pr,true); out.schedule=html.includes('Equipment schedule')&&html.includes('Executive summary')&&html.includes('class="lh"')&&html.includes('Accepted for')&&/RTU|Rooftop|rooftop/i.test(html); out.leadSection=html.includes('Schedule and lead time')&&html.includes('10–12 weeks'); out.warrantySection=html.includes('<h2>Warranty</h2>'); out.printCss=html.includes('@page{size:letter')&&html.includes('pdfnote')&&html.includes('lang="en"')&&html.includes('break-inside:avoid');
    // maintenance proposal unaffected
    const mq=Object.values(S.live.quotes).find(x=>x.type==='maintenance'); if(mq){ const mp=proposalFromQuote(mq); const mh=renderProposalDoc(mp,false); out.maintNoWarranty=!mh.includes('<h2>Warranty</h2>')&&!mh.includes('Equipment schedule') } else out.maintNoWarranty='n/a';
    // all brands render without overflow
    out.brands={}; for(const bk of Object.keys(brands())){ const pp={...pr,brand:bk}; document.querySelector('#main').innerHTML=renderProposalDoc(pp,false); await t(20); const ov=document.documentElement.scrollWidth-document.documentElement.clientWidth; const cover=document.querySelector('#main .lh'); out.brands[bk]=ov<=0&&!!cover&&cover.innerText.length>20 }
    out.allBrandsOk=Object.values(out.brands).every(Boolean);
    // markup pricing includes freight markup
    const g=gpmdFor(q.brand); out.freightMarkup=g.markups.freight!=null;
    render(); await t(50); out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
