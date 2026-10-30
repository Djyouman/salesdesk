const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#accounts'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const low=()=>document.querySelector('#main').innerText.toLowerCase();
    S.ui.acctTab='parents'; render(); await t(100); const hints=S.orgsAll.filter(o=>o.parentHint&&!o.parentId&&!o.parentDismissed); out.hints=hints.length; out.hintsShown=low().includes('hints to confirm');
    const h=hints.find(o=>resolveParentHint(o.parentHint)); const par=resolveParentHint(h.parentHint); await ACTIONS.confirmParent({id:h.id}); await t(60); out.confirmed=S.orgById.get(h.id).parentId===par.id; out.parentsTable=low().includes(par.name.toLowerCase());
    const h2=hints.find(o=>!resolveParentHint(o.parentHint)&&o.id!==h.id); if(h2){await ACTIONS.confirmParent({id:h2.id}); await t(60); const pid=S.orgById.get(h2.id).parentId; out.createdParent=!!pid&&orgName(pid).toLowerCase()===h2.parentHint.toLowerCase()}
    const h3=hints.find(o=>o.id!==h.id&&o.id!==(h2||{}).id); await ACTIONS.dismissParent({id:h3.id}); out.dismissed=S.orgById.get(h3.id).parentDismissed===true;
    const r1=rollup(par.id); out.rollupIncludesChild=r1.ids.includes(h.id)&&r1.wonValue>=S.orgById.get(h.id).wonValue;
    go('account',{org:par.id}); await t(80); out.rollupCard=low().includes('parent account roll-up')&&low().includes(S.orgById.get(h.id).name.toLowerCase().slice(0,12)); out.ovAcct=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    go('account',{org:h.id}); await t(60); out.childLink=low().includes('child of');
    // self-parent guard
    ACTIONS.setParent({id:par.id}); document.querySelector('#parTarget').value=par.name; await ACTIONS.saveParent({id:par.id}); out.selfGuard=!S.orgById.get(par.id).parentId;
    // cross-brand tab
    S.ui.acctTab='cross'; go('accounts'); await t(120); out.cross=low().includes('multi-brand accounts')&&low().includes('cross-sell'); out.ovCross=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    S.ui.anaTab='overview'; go('analytics'); await t(120); out.topAccounts=low().includes('top accounts (rolled up)'); out.ovAna=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    const tool=aiTools().find(x=>x.name==='account_lookup').execute({name:par.name.slice(0,8)}); out.toolParent=tool.some(x=>x.children&&x.children.length);
    return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
