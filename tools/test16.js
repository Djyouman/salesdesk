const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#setup'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const low=()=>document.querySelector('#main').innerText.toLowerCase();
    const bs=brands(); out.allHavePalette=Object.values(bs).every(b=>(b.palette||[]).length>=5&&b.source); out.das=bs.dynamic.palette.map(x=>x[0]+' '+x[1]).slice(0,3); out.childersAccent=bs.childers.accent==='#CE2B2F'&&bs.childers.font.includes('Roboto Condensed'); out.cortezYellow=bs.cortez.palette.some(x=>x[0]==='Cortez Yellow'&&x[1]==='#FFDE00'); out.altmanPrimary=bs.altman.primary==='#003B5C'; out.fspNames=bs.fsp.palette.map(x=>x[0]);
    out.noGenericNames=!Object.values(bs).some(b=>(b.palette||[]).some(x=>/^(brand|primary|secondary|accent)$/i.test(x[0])));
    S.ui.setupTab='brands'; render(); await t(100); const txt=low(); out.setupShowsTokens=txt.includes('ultra navy')&&txt.includes('das red')&&txt.includes('#0a2240')&&txt.includes('source:'); out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    // edit palette token roundtrip
    ACTIONS.editBrand({id:'weber'}); out.editorRows=document.querySelectorAll('#bf [name^="pn."]').length>=7; document.querySelector('#bf [name="ph.0"]').value='#dc6515'; await ACTIONS.saveBrand({id:'weber'}); await t(40); out.savedPalette=(S.live.brands.weber.palette||[]).length>=7&&brands().weber.primary==='#DC6515';
    // proposal uses tokens
    const d=S.deals.find(x=>x.status==='open'&&x.brand==='childers')||S.deals.find(x=>x.status==='open'&&x.brand==='cortez'&&x.value<5e7); await ACTIONS.newQuote({deal:d.id}); await t(40); const q=Object.values(S.live.quotes).find(x=>x.dealId===d.id); q.scope='Scope.'; await saveQuote(q,true,false); await ACTIONS.makeProposal({id:q.id}); await t(40); const pr=Object.values(S.live.proposals).find(x=>x.quoteId===q.id); const html=renderProposalDoc(pr,true); out.propTokens=html.includes('--tx:')&&html.includes('--bf:')&&html.includes(brands()[d.brand].primary);
    // rep modal
    go('team'); await t(80); const link=document.querySelector('#main [data-act=repModal]'); out.teamLinks=!!link; const rep='Steve Dobbins'; ACTIONS.repModal({name:rep}); await t(60); const mt=document.querySelector('#modal').innerText.toLowerCase(); out.modalOpen=mt.includes('steve dobbins')&&mt.includes('open bids')&&mt.includes('win rate'); const n=S.deals.filter(x=>x.owner===rep&&x.status==='open'&&!x.paused&&x.value<5e7).length; out.bidRows=document.querySelectorAll('#modal tr.row').length===Math.min(60,n); out.modalOv=document.querySelector('#modal .box').scrollWidth<=document.querySelector('#modal .box').clientWidth+1;
    const first=document.querySelector('#modal tr.row'); const id=first.dataset.id; ACTIONS.repOpenDeal({id}); await t(60); out.openedDeal=S.view==='deal'&&S.sel.deal===id&&!document.querySelector('#modal');
    out.dealOwnerLink=!!document.querySelector('#main [data-act=repModal]'); S.ui.anaTab='reps'; go('analytics'); await t(100); out.anaLinks=document.querySelectorAll('#main [data-act=repModal]').length>5; S.ui.owner='Hank Duus'; go('pipeline'); await t(80); out.filterRepCard=!!document.querySelector('#main [data-act=repModal][data-name="Hank Duus"]'); S.ui.owner='';
    return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
