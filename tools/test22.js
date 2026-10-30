const {chromium}=require('playwright'); const fs=require('fs');
const base='http://localhost:8787/salesdesk.html';
const axePath='/tmp/claude-0/-home-user/6acfb783-111b-5de3-b9b4-2c736854bf59/scratchpad/axe/node_modules/axe-core/axe.min.js';
const axe=fs.existsSync(axePath)?fs.readFileSync(axePath,'utf8'):null;
(async()=>{
  const b=await chromium.launch(); const errs=[]; const out={axe:{}};
  for(const [w,scheme] of [[1400,'light'],[400,'dark']]){ const ctx=await b.newContext({viewport:{width:w,height:900},colorScheme:scheme}); const p=await ctx.newPage();
    p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
    await p.goto(base+'#home'); await p.evaluate((sch)=>{localStorage.clear(); localStorage.setItem('sd_theme',sch)},scheme); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
    if(axe){ await p.addScriptTag({content:axe});
      for(const v of ['home','pipeline','deal','quote','proposal']){ const r=await p.evaluate(async(v)=>{ if(v==='deal'){S.sel.deal=S.deals.find(x=>x.status==='open'&&x.value>5000&&x.value<5e7).id} if(v==='quote'){S.sel.quote=Object.values(S.live.quotes)[0].id} if(v==='proposal'){S.sel.proposal=Object.values(S.live.proposals)[0].id} if(v==='pipeline')S.ui.pipeTab='board'; S.view=v; render(); await new Promise(r=>setTimeout(r,80)); const res=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}); return res.violations.filter(x=>x.impact==='serious'||x.impact==='critical').map(x=>x.id+':'+x.nodes.length) },v); out.axe[`${v}@${w}/${scheme}`]=r } }
    if(w===400){ const r=await p.evaluate(async()=>{ const o={}; const t=s=>new Promise(r=>setTimeout(r,s));
      o.lang=document.documentElement.lang==='en'; o.live=document.querySelector('#toasts').getAttribute('aria-live')==='polite';
      go('home'); await t(80); o.current=!!document.querySelector('#rail a[aria-current=page], #tabbar a[aria-current=page]');
      const d=S.deals.find(x=>x.status==='open'&&x.value>5000&&x.value<5e7&&dealStage(x)==='qualified'); S.sel.deal=d.id; go('deal'); await t(100);
      const chip=document.querySelector('#main .chip[data-act=stage][data-stage=proposal]'); o.chipFocusable=chip&&chip.tabIndex===0&&chip.getAttribute('role')==='button'; chip.focus(); chip.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); await t(150); o.kbdStage=dealStage(S.dealById.get(d.id))==='proposal';
      ACTIONS.quickLog({id:d.id}); await t(40); const box=document.querySelector('#modal [role=dialog]'); o.dialog=!!box&&box.getAttribute('aria-modal')==='true'&&!!document.getElementById('modal-title'); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await t(30); o.escape=!document.querySelector('#modal');
      const row=document.querySelector('#main tr[data-go]'); o.rowFocusable=!row||row.tabIndex===0;
      S.view='pipeline'; S.ui.pipeTab='list'; render(); await t(50); const r2=document.querySelector('#main tr[data-go]'); r2.focus(); r2.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); await t(120); o.rowEnter=S.view==='deal';
      o.selectsNamed=[...document.querySelectorAll('select')].every(s=>s.getAttribute('aria-label')||s.closest('label')||s.id&&document.querySelector(`label[for="${s.id}"]`));
      return o }); Object.assign(out,r) }
    await ctx.close() }
  out.axeClean=Object.values(out.axe).every(v=>v.length===0);
  console.log(JSON.stringify(out,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
