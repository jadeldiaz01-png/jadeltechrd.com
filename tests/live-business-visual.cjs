'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');
const axe = require('axe-core');
const base = 'https://jadeltechrd.com';
const target = base+'/soluciones-negocios.html';
const dir = process.env.EVIDENCE_DIR || 'mobile-cert';
fs.mkdirSync(dir,{recursive:true});
const report={url:target,viewports:[],links:[],accessibility:[],navigation:[],submitted:false,paid:false};
(async()=>{
 const browser=await puppeteer.launch({headless:true,protocolTimeout:60000,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try {
  for(const width of [320,360,412,768,1365]){
   const page=await browser.newPage(),mobile=width<=768;
   await page.setViewport({width,height:915,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
   await page.setCacheEnabled(false);
   const errors=[],failed=[];
   page.on('pageerror',e=>errors.push(String(e)));
   page.on('requestfailed',r=>{if(r.url().startsWith(base)) failed.push(r.url())});
   const response=await page.goto(target,{waitUntil:'load',timeout:40000});
   assert.equal(response.status(),200,'live landing must return HTTP 200');
   assert.match(response.headers()['content-type']||'',/text\/html/);
   await page.waitForSelector('#soluciones .proof-panel',{visible:true});
   const state=await page.evaluate(()=>{
    const grid=document.querySelector('#soluciones .revenue-grid-3');
    const primary=document.querySelector('.revenue-cta .button.primary')?.getBoundingClientRect();
    return {innerWidth,documentWidth:document.documentElement.scrollWidth,
     heading:document.querySelector('h1')?.textContent?.trim(),lang:document.documentElement.lang,
     title:document.title,headings:document.querySelectorAll('h1').length,
     cards:document.querySelectorAll('#soluciones .proof-panel').length,
     gridTracks:getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length,
     faqCount:document.querySelectorAll('.revenue-faq details').length,
     ctaWidth:primary?.width,ctaHeight:primary?.height,
     unlabelledImages:[...document.images].filter(x=>!x.hasAttribute('alt')).length};
   });
   report.viewports.push({width,...state,errors,failed});
   assert.equal(state.innerWidth,width);
   assert.ok(state.documentWidth<=width+1,'horizontal overflow on '+width+'px: '+state.documentWidth);
   assert.equal(state.lang,'es');
   assert.equal(state.headings,1);
   assert.match(state.heading,/presencia digital/);
   assert.equal(state.cards,3);
   assert.equal(state.faqCount,3);
   assert.equal(state.gridTracks,width<=820?1:3);
   assert.ok(state.ctaWidth>=100&&state.ctaHeight>=38,'primary CTA tap size');
   assert.equal(state.unlabelledImages,0);
   assert.deepEqual(errors,[]);
   assert.deepEqual(failed,[]);
   if([360,412,1365].includes(width))await page.screenshot({path:path.join(dir,'landing-'+width+'.png'),fullPage:true});
   if(width===412||width===1365){
    await page.evaluate(axe.source);
    const results=await page.evaluate(async()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));
    const violations=results.violations.map(v=>({id:v.id,impact:v.impact,selectors:v.nodes.map(n=>n.target).slice(0,12)}));
    report.accessibility.push({width,violations});
    assert.deepEqual(violations.filter(x=>['critical','serious'].includes(x.impact)),[],'serious WCAG errors');
   }
   console.log('LIVE_BUSINESS_'+width+'_VIEWPORT=PASS');
   await page.close();
  }
  const page=await browser.newPage();
  await page.setViewport({width:412,height:915,isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await page.goto(target,{waitUntil:'load',timeout:40000});
  const links=await page.$$eval('a[href]',xs=>xs.map(x=>({href:x.getAttribute('href'),label:x.textContent.trim()||x.getAttribute('aria-label')})));
  assert.ok(links.length>=10);
  for(const link of links){
   assert.ok(link.label,'empty accessible link');
   assert.equal(new URL(link.href,base).origin,base,'external link outside scope');
   assert.ok(!/paypal\.com|checkout|payment-order/.test(link.href),'unexpected payment link');
  }
  report.links=links; console.log('LIVE_BUSINESS_LINK_AUDIT=PASS');
  await page.click('.revenue-faq details summary');
  assert.equal(await page.$eval('.revenue-faq details',el=>el.open),true);
  console.log('LIVE_BUSINESS_FAQ=PASS');
  await page.click('.revenue-cta a[href="#soluciones"]');
  assert.equal(new URL(page.url()).hash,'#soluciones');
  console.log('LIVE_BUSINESS_ANCHOR=PASS');
  for(const [campaign,id] of [['automation_repair','architecture'],['web_intake','architecture'],['whatsapp_support','support'],['scope_first','architecture']]){
   await page.goto(target,{waitUntil:'load',timeout:40000});
   const selector='a[href*="utm_campaign='+campaign+'"]';
   const href=await page.$eval(selector,x=>x.getAttribute('href'));
   assert.equal(new URL(href,base).searchParams.get('services'),id);
   await page.click(selector);
   await page.waitForFunction(value=>document.querySelector('input[name="service_ids"][value="'+value+'"]')?.checked===true,{timeout:15000},id);
   assert.equal(new URL(page.url()).pathname,'/solicitar-proyecto.html');
   report.navigation.push({campaign,service:id,success:true});
   console.log('LIVE_BUSINESS_CTA_'+campaign.toUpperCase()+'=PASS');
  }
  console.log('LIVE_BUSINESS_NO_FORM_SUBMISSION=PASS');
  console.log('LIVE_BUSINESS_NO_PAYMENT=PASS');
  await page.close();
 } catch(err){report.failure=String(err.stack||err);throw err}
 finally{fs.writeFileSync(path.join(dir,'audit.json'),JSON.stringify(report,null,2));await browser.close()}
})().catch(err=>{console.error(err.stack||err);process.exitCode=1});
