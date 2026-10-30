const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
const CSV=`Deal - ID,Deal - Title,Deal - Owner,Deal - Value,Deal - Status,Deal - Stage,Deal - Pipeline,Deal - Organization,Deal - Expected close date,Deal - Won time
900001,Parity test RTU,Steve Dobbins,50000,open,Proposal,Cortez,Parity Test Org,2026-12-15,
900002,Parity test chiller,Steve Dobbins,120000,open,Qualified,Cortez,Parity Test Org,2027-01-10,
900003,Parity test won PM,Steve Dobbins,9000,won,Won,Cortez,Parity Test Org,2026-09-01,2026-09-15 10:00:00`;
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#setup'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async(CSV)=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const low=()=>document.querySelector('#main').innerText.toLowerCase();
    // baseline: live overlay already differs from the raw export only by live edits
    const pc0=parityCheck(); out.baselineSource=!pc0.fromImport&&pc0.srcLabel.toLowerCase().includes('pipedrive export loaded'); const hist=brandTotals(S.hist); out.histSelfParity=Object.keys(hist).length>=7;
    S.ui.setupTab='data'; go('setup'); await t(150); out.card=low().includes('pipedrive parity')&&(low().includes('within 1%')||low().includes('off by more than 1%'));
    // a new deal shows up as a delta for its brand
    const before=parityCheck().rows.find(r=>r.brand==='weber'); await dbWrite('deals','d_parity_1',{id:'d_parity_1',title:'Parity delta',org:'org_servicetitan-otj',brand:'weber',owner:'Mike Weber',line:'project',stage:'lead',status:'open',value:100000,createdAt:nowISO()},false); await t(50); const after=parityCheck().rows.find(r=>r.brand==='weber'); out.deltaCounted=after.dOpen===before.dOpen+1&&Math.round(after.dOpenValue-before.dOpenValue)===100000;
    // import a 3-row fixture: source totals stored and card switches to the import
    render(); await t(80); document.querySelector('#pdTa').value=CSV; await ACTIONS.pdPreview(); await t(80); out.preview=!!document.querySelector('[data-act=pdImport]'); const sel1=document.querySelector('#pdPreview [name="pdst.0"]'); await ACTIONS.pdImport(); await t(300);
    const li=S.live.product['import-last']; out.importRecord=!!li&&li.rows===3&&li.byBrand&&li.byBrand.cortez&&li.byBrand.cortez.open===2&&Math.round(li.byBrand.cortez.openValue)===170000&&Math.round(li.byBrand.cortez.wonFY)===9000;
    const pc1=parityCheck(); out.fromImport=pc1.fromImport&&pc1.srcLabel.toLowerCase().includes('pipedrive import'); const cz=pc1.rows.find(r=>r.brand==='cortez'); out.cortezNow=cz.cur.open>=2&&cz.cur.open>cz.src.open; out.flagged=cz.flag===true;
    render(); await t(100); out.cardImport=low().includes('pipedrive import')&&low().includes('check');
    out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    return out;
  },CSV);
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
