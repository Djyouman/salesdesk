const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const out={};
  for(const w of [400,1400]){ const ctx=await b.newContext({viewport:{width:w,height:900}}); const p=await ctx.newPage();
    p.on('console',m=>{if(m.type()==='error')errs.push(w+' console: '+m.text())}); p.on('pageerror',e=>errs.push(w+' pageerror: '+e.message));
    await p.goto(base+'#home'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
    out[w]=await p.evaluate(async()=>{ const o={}; const t=s=>new Promise(r=>setTimeout(r,s)); const vis=el=>!!(el&&el.checkVisibility&&el.checkVisibility({contentVisibilityAuto:true,visibilityProperty:true}));
      const d=S.deals.find(x=>x.status==='open'&&x.value>5000&&x.value<5e7); ACTIONS.quickLog({id:d.id}); await t(40);
      const det=document.querySelector('#qlf details.more'); o.detailsPresent=!!det; o.openByDefault=det.open; o.stageVisible=vis(document.querySelector('#qlf [name=stage]')); o.textVisible=vis(document.querySelector('#qlf [name=text]'))&&vis(document.querySelector('#qlf [name=nextDate]'));
      o.summaryText=det.querySelector('summary').innerText.toLowerCase().includes('more:');
      det.open=!det.open; await t(20); o.toggles=vis(document.querySelector('#qlf [name=stage]'))===det.open;
      // save still works with details closed
      det.open=false; document.querySelector('#qlf [name=text]').value='two-step log'; document.querySelector('#qlf [name=nextAction]').value='Call back'; await ACTIONS.saveQuickLog({id:d.id}); await t(100); const d2=S.dealById.get(d.id); o.saved=Object.values(S.live.activities).some(a=>a.dealId===d.id&&a.text.startsWith('two-step'))&&d2.nextAction==='Call back'&&d2.close===(d.close||null);
      // quote line editor
      const q=Object.values(S.live.quotes)[0]; if(q){ S.sel.quote=q.id; go('quote'); await t(150); const line=document.querySelector('#qform .line'); if(line){ const cols=getComputedStyle(line).gridTemplateColumns.split(' ').length; o.lineCols=cols; o.lineCard=window.innerWidth<=600?cols===2&&getComputedStyle(line).borderTopWidth!=='0px':cols>=6; o.placeholders=!!document.querySelector('#qform .line input[placeholder="Unit cost"]'); const lsel=line.querySelector('select'); o.lineSelectFull=window.innerWidth>600||!lsel||getComputedStyle(lsel).gridColumnStart==='1'; } }
      o.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth; return o });
    await ctx.close() }
  await b.close(); console.log(JSON.stringify(out,null,1)); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
