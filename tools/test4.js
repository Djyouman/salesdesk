const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#home'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s));
    out.briefOnHome=document.querySelector('#main').innerText.includes('This week, platform'); out.homeOv=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    const d=S.deals.find(x=>x.status==='open'&&x.value<1e6&&x.id.startsWith('pd_')); await setStage(d,'verbal');
    ACTIONS.closeDeal({id:d.id,result:'lost'}); document.querySelector('#closef [name=reason]').value='Lost to competitor'; await ACTIONS.doClose({id:d.id,result:'lost'});
    const d2=S.deals.find(x=>x.status==='open'&&x.value<1e6&&x.id.startsWith('pd_')&&x.id!==d.id); ACTIONS.closeDeal({id:d2.id,result:'won'}); await ACTIONS.doClose({id:d2.id,result:'won'});
    const w=weekMovement(S.deals); out.weekWon=w.won.length; out.weekLost=w.lost.length; out.weekAdv=w.advanced.length;
    const txt=ceoBriefText(ceoBriefData(S.deals)); out.briefLines=txt.split('\n').length; out.briefHasBrand=txt.includes('R. Brooks');
    S.ui.anaTab='week'; go('analytics'); await t(120); out.weekTab=document.querySelector('#main').innerText.includes('Lost to competitor'); out.weekOv=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    S.ui.anaTab='winrate'; render(); await t(60); out.lostReasons=document.querySelector('#main').innerText.includes('Lost to competitor');
    // links
    const d3=S.deals.find(x=>x.status==='open'&&x.id.startsWith('pd_')&&x.id!==d.id&&x.id!==d2.id); go('deal',{deal:d3.id}); await t(60); ACTIONS.addLink({id:d3.id}); document.querySelector('#lf [name=label]').value='Drawings'; document.querySelector('#lf [name=url]').value='notalink'; await ACTIONS.saveLink({id:d3.id}); out.badUrlRejected=!!document.querySelector('#lf'); document.querySelector('#lf [name=url]').value='https://flowservicepartners.sharepoint.com/x'; await ACTIONS.saveLink({id:d3.id}); out.linkSaved=(S.dealById.get(d3.id).links||[]).length===1; out.linkShown=document.querySelector('#main').innerText.includes('Drawings'); await ACTIONS.removeLink({id:d3.id,i:0}); out.linkRemoved=(S.dealById.get(d3.id).links||[]).length===0; out.dealOv=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
