const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#home'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s));
    const o=S.orgsAll.find(x=>x.mergeStatus==='proposed'&&x.aliases.length>=3&&S.deals.some(d=>d.org===x.id&&d.site===2)); const site=o.aliases[1]; const nBefore=S.deals.filter(d=>d.org===o.id&&d.site===2).length; const n3=S.deals.filter(d=>d.org===o.id&&d.site===3).length;
    go('account',{org:o.id}); await t(60); out.moveIcon=document.querySelectorAll('[data-act=moveSite]').length===o.aliases.length;
    ACTIONS.moveSite({id:o.id,i:2}); document.querySelector('#mvTarget').value='Brand New Target Co'; await ACTIONS.doMoveSite({id:o.id,i:2}); await t(80);
    const tgt=S.orgsAll.find(x=>x.name==='Brand New Target Co'); out.targetCreated=!!tgt; out.movedDeals=S.deals.filter(d=>d.org===tgt.id).length===nBefore; out.aliasAdded=(tgt.aliases||[]).includes(site); out.sourceAliasRemoved=!S.orgById.get(o.id).aliases.includes(site); out.renumbered=S.deals.filter(d=>d.org===o.id&&d.site===2).length===n3; out.landedOnTarget=location.hash.includes('account-org');
    // velocity: stage a few deals
    const ds=S.deals.filter(d=>d.status==='open'&&d.brand==='cortez'&&d.id.startsWith('pd_')).slice(0,3); for(const d of ds)await setStage(d,'proposal'); S.ui.anaTab='aging'; go('analytics'); await t(100); const txt=document.querySelector('#main').innerText; out.velocityShown=txt.includes('Stage velocity')&&txt.includes('Proposal'); out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
