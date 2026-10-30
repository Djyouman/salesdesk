const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
const TSV=`ACME Mechanical Estimate\t\t\t\t
Job: East wing RTU replacement\t\t\t\t
\t\t\t\t
Description\tQty\tUnit\tUnit Cost\tExt Cost
Packaged RTU 20 ton gas/electric\t2\tea\t28,000.00\t56,000.00
Roof curb adapters\t2\tea\t1,500\t3,000
Crane service (sub)\t1\tlot\t4,200\t4,200
Freight to site\t1\tlot\t1,800\t1,800
Sheet metal & duct transitions\t1\tlot\t2,400\t2,400
Permit fees\t1\tlot\t650\t650
Installation labor\t96\thrs\t85\t8,160
Subtotal\t\t\t\t76,210
Tax\t\t\t\t3,560
Total Sell\t\t\t\t$112,500`;
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error'&&!/xlsx|cdnjs|ERR_TUNNEL/i.test(m.text()))errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#quotes'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async(TSV)=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const low=()=>document.querySelector('#main').innerText.toLowerCase(); const mlow=()=>(document.querySelector('#modalhost').innerText||'').toLowerCase();
    out.button=low().includes('import estimate');
    const rows=parseDelimited(TSV); out.rows=rows.length; const hi=estFindHeader(rows); out.headerRow=String(rows[hi][0]).toLowerCase()==='description'; const map=estGuessCols(rows[hi]); out.map=map.desc===0&&map.qty===1&&map.unit===2&&map.unitCost===3&&map.ext===4;
    const parsed=estParse(rows,hi,map); out.lines=parsed.lines.length===6; out.hours=parsed.hours===96; out.sell=parsed.sell===112500; out.types=parsed.lines.map(l=>l.type).join(','); out.typesOk=parsed.lines[0].type==='equipment'&&parsed.lines[2].type==='sub'&&parsed.lines[3].type==='freight'&&parsed.lines[5].type==='other'&&parsed.lines[1].type==='material';
    out.cost=Math.round(parsed.lines.reduce((a,l)=>a+l.qty*l.cost,0))===68050;
    // UI flow
    const d=S.deals.find(x=>x.status==='open'&&x.line==='project'&&x.value>20000&&x.value<5e7&&x.owner); ACTIONS.estImportOpen(); await t(50); document.querySelector('#estTa').value=TSV; document.querySelector('#estf [name=dealPick]').value=d.title; await ACTIONS.estPreview(); await t(80); out.preview=mlow().includes('6 cost lines')&&mlow().includes('96 labor hours')&&mlow().includes('12.0 man-days');
    // remap a line type via select then commit
    document.querySelector('#estPrev [name="lt.5"]').value='skip'; await ACTIONS.estCommit(); await t(200);
    const q=Object.values(S.live.quotes).find(x=>x.dealId===d.id&&x.source==='spreadsheet'); out.quote=!!q&&q.options[0].lines.length===5&&q.options[0].price===112500&&q.estimator&&q.importNote.includes('5 lines');
    out.manDays=!!q&&Math.abs(q.options[0].crew*q.options[0].days-12)<0.5; const c=q?quoteCalc(q,gpmdFor(q.brand)):null; out.calc=!!c&&c.price===112500&&c.manDays>0&&isFinite(c.gpmd); out.onQuotePage=S.view==='quote'&&S.sel.quote===q.id;
    out.activity=Object.values(S.live.activities).some(a=>a.dealId===d.id&&a.type==='quote'&&a.text.includes('Estimate imported'));
    // CSV path with a different header vocabulary
    const csv=['Item,Category,Quantity,Rate,Amount','"Chiller, air-cooled 150 ton",Equipment,1,165000,165000','Controls integration,Sub,1,12000,12000','Labor hours,Labor,320,,','TOTAL,,,,250000'].join('\n');
    const r2=parseDelimited(csv); const h2=estFindHeader(r2); const m2=estGuessCols(r2[h2]); const p2=estParse(r2,h2,m2); out.csvLines=p2.lines.length===2&&p2.lines[0].type==='equipment'&&p2.lines[1].type==='sub'; out.csvHours=p2.hours===320; out.csvSell=p2.sell==null && p2.skipped.length===1;
    out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth; return out;
  },TSV);
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
