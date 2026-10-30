const {chromium}=require('playwright');
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[]; const ctx=await b.newContext({viewport:{width:400,height:800}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(base+'#pipeline'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={}; const t=s=>new Promise(r=>setTimeout(r,s)); const rows=()=>document.querySelectorAll('#main table tr.row').length; const time=fn=>{const a=performance.now();fn();render();return Math.round(performance.now()-a)};
    S.ui.brand='';S.ui.owner=''; out.ms={};
    out.ms.home=time(()=>{S.view='home'}); out.ms.list=time(()=>{S.view='pipeline';S.ui.pipeTab='list'}); out.listRows=rows(); const total=S.ui.pipeTab==='list'?(()=>{const m=document.querySelector('#main small.hint').textContent.match(/(\d+) deals/);return m?+m[1]:0})():0; out.total=total;
    const btn=document.querySelector('#main [data-act=showMore]'); out.moreBtn=!!btn&&btn.textContent.includes('Show 200 more')&&btn.textContent.includes((total-200)+' remaining');
    btn.click(); await t(50); out.after=rows()===Math.min(400,total); const b2=document.querySelector('#main [data-act=showMore]'); out.remaining=!b2||b2.textContent.includes((total-400)+' remaining');
    S.ui.pipeTab='closed'; render(); out.closedRows=rows()===200&&!!document.querySelector('#main [data-act=showMore]');
    go('accounts'); await t(80); out.resetOnNav=Object.keys(S.ui.more||{}).length===0; out.ms.accounts=time(()=>{S.view='accounts';S.ui.acctTab='list'}); out.acctRows=rows()===200;
    out.ms.pm=time(()=>{S.ui.acctTab='pm'}); out.ms.analytics=time(()=>{S.view='analytics';S.ui.anaTab='overview'}); out.ms.cross=time(()=>{S.view='accounts';S.ui.acctTab='cross'});
    out.allUnder120=Object.values(out.ms).every(v=>v<120); out.ov=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    // dq filter still works with paging
    S.view='pipeline'; S.ui.pipeTab='list'; S.ui.dq={issue:'noclose',rep:''}; render(); const dqn=document.querySelectorAll('#main table tr.row').length; out.dqRows=dqn>0&&dqn<=200; S.ui.dq=null;
    return out;
  });
  console.log(JSON.stringify(r,null,1)); await b.close(); console.log('ERRORS',errs.length); errs.forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
