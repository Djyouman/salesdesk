const {chromium}=require('playwright');
const SP='/tmp/claude-0/-home-user/6acfb783-111b-5de3-b9b4-2c736854bf59/scratchpad/';
const base='http://localhost:8787/salesdesk.html';
(async()=>{
  const b=await chromium.launch(); const errs=[];
  const views=['home','pipeline','accounts','quotes','plan','analytics','team','assistant','setup'];
  for(const [w,h] of [[1400,900],[400,800]]){ for(const theme of ['light','dark']){
    const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:theme}); const p=await ctx.newPage();
    p.on('console',m=>{if(m.type()==='error')errs.push(`${w}/${theme} console: ${m.text()}`)}); p.on('pageerror',e=>errs.push(`${w}/${theme} pageerror: ${e.message}`));
    await p.goto(base+'#home'); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals&&S.deals.length>1000,{timeout:20000});
    for(const v of views){ await p.evaluate(v=>{location.hash='#'+v},v); await p.waitForTimeout(150); const ov=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth); if(ov>1)errs.push(`${w}/${theme} #${v} horizontal overflow ${ov}px`); const txt=await p.evaluate(()=>document.querySelector('#main').innerText.length); if(txt<50)errs.push(`${w}/${theme} #${v} nearly empty`); }
    // sub tabs
    for(const [k,vals,view] of [['pipeTab',['list','forecast','closed'],'pipeline'],['acctTab',['merge','pm','whitespace'],'accounts'],['planTab',['goals','reps'],'plan'],['anaTab',['winrate','reps','aging','trend'],'analytics'],['teamTab',['groups'],'team'],['setupTab',['gpmd','roles','data','about'],'setup']]){ await p.evaluate(v=>{location.hash='#'+v},view); await p.waitForTimeout(50); for(const val of vals){ await p.evaluate(([k,val])=>{S.ui[k]=val;render()},[k,val]); await p.waitForTimeout(60); const ov=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth); if(ov>1)errs.push(`${w}/${theme} ${view}/${val} overflow ${ov}px`);} }
    if(w===1400&&theme==='light'){ await p.evaluate(()=>{location.hash='#home';S.ui.brand='';render()}); await p.waitForTimeout(100); await p.screenshot({path:SP+'home.png'}); await p.evaluate(()=>{location.hash='#pipeline';S.ui.pipeTab='board';render()}); await p.waitForTimeout(100); await p.screenshot({path:SP+'board.png'}); }
    if(w===400&&theme==='dark'){ await p.evaluate(()=>{location.hash='#home';render()}); await p.waitForTimeout(100); await p.screenshot({path:SP+'home-m.png',fullPage:false}); }
    await ctx.close();
  }}
  // functional flow in local mode
  const ctx=await b.newContext({viewport:{width:1400,height:900}}); const p=await ctx.newPage();
  p.on('console',m=>{if(m.type()==='error')errs.push('flow console: '+m.text())}); p.on('pageerror',e=>errs.push('flow pageerror: '+e.message));
  await p.goto(base+'#pipeline'); await p.waitForFunction(()=>window.S&&S.loaded&&S.deals.length>1000);
  const r=await p.evaluate(async()=>{
    const out={};
    // new deal
    ACTIONS.newDeal({}); document.querySelector('#dealf [name=title]').value='Test Chiller Replacement'; document.querySelector('#dealf [name=orgName]').value='Wabash General Hospital'; document.querySelector('#dealf [name=value]').value='250000'; document.querySelector('#dealf [name=close]').value='2026-12-15';
    await ACTIONS.createDeal(); await new Promise(r=>setTimeout(r,100));
    const d=S.deals.find(x=>x.title==='Test Chiller Replacement'); out.dealCreated=!!d; out.orgMatched=d&&orgName(d.org)==='Wabash General Hospital';
    // stage change
    await setStage(d,'quoted'); out.stage=S.dealById.get(d.id).stage;
    // quote
    await ACTIONS.newQuote({deal:d.id}); await new Promise(r=>setTimeout(r,100)); const q=Object.values(S.live.quotes).find(x=>x.dealId===d.id); out.quote=!!q;
    document.querySelector('#qform [name="opt.0.crew"]').value='4'; document.querySelector('#qform [name="opt.0.days"]').value='15'; document.querySelector('#qform [name="opt.0.l.0.cost"]').value='120000';
    await ACTIONS.saveQuote({id:q.id}); const c=quoteCalc(S.live.quotes[q.id]); out.calc=c; out.dealValueSynced=S.dealById.get(d.id).value===c.price;
    await ACTIONS.addOption({id:q.id}); out.options=S.live.quotes[q.id].options.length;
    await ACTIONS.makeProposal({id:q.id}); await new Promise(r=>setTimeout(r,100)); const pr=Object.values(S.live.proposals)[0]; out.proposal=!!pr; out.propHtmlLen=renderProposalDoc(pr,true).length; out.propBrand=pr.brand;
    // merge split
    const o=S.orgsAll.find(x=>x.mergeStatus==='proposed'&&x.aliases.length>=2); const before=S.orgsAll.length; await ACTIONS.mergeSplit({id:o.id}); out.splitAdded=S.orgsAll.length-before; out.splitAliasCount=o.aliases.length;
    const o2=S.orgsAll.find(x=>x.mergeStatus==='proposed'); await ACTIONS.mergeAccept({id:o2.id}); out.accepted=S.orgById.get(o2.id).mergeStatus;
    // close won
    const d2=S.deals.find(x=>x.status==='open'&&x.value<1e6&&x.id.startsWith('pd_')); ACTIONS.closeDeal({id:d2.id,result:'won'}); await ACTIONS.doClose({id:d2.id,result:'won'}); out.won=S.dealById.get(d2.id).status; out.persisted=!!JSON.parse(localStorage.getItem('sd_local_v1')).live.deals[d2.id];
    // role computations
    out.role=S.role; out.histCount=S.hist.length; out.orgCount=S.orgsAll.length; out.users=S.users.length;
    return out;
  });
  console.log(JSON.stringify(r,null,1));
  await p.goto(base+'#proposal'); await p.waitForFunction(()=>window.S&&S.loaded); await p.evaluate(()=>{S.sel.proposal=Object.keys(S.live.proposals)[0];render()}); await p.waitForTimeout(200); await p.screenshot({path:SP+'proposal.png',fullPage:true});
  await p.evaluate(()=>{location.hash='#quote';S.sel.quote=Object.keys(S.live.quotes)[0];render()}); await p.waitForTimeout(200); await p.screenshot({path:SP+'quote.png',fullPage:true});
  await ctx.close(); await b.close();
  console.log('ERRORS',errs.length); errs.slice(0,30).forEach(e=>console.log(' -',e));
})().catch(e=>{console.error(e);process.exit(1)});
