// End-to-end user stories for fashionistas.ai (docs/USER-STORIES.md). Run: BASE=<url> node e2e/stories.spec.js
// Uses the test seller in .env.test-seller. Any listing it creates is deleted at the end.
const pw=require('playwright');const fs=require('fs');const path=require('path');
const env=Object.fromEntries(fs.readFileSync(path.join(__dirname,'..','.env.test-seller'),'utf8').trim().split('\n').map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const B=process.env.BASE||'https://free-v2.fashionistas-ai.pages.dev';
const OUT=process.env.OUT||'shots';fs.mkdirSync(OUT,{recursive:true});
const results=[];const ok=(id,pass,note='')=>{results.push({id,pass,note});console.log((pass?'PASS':'FAIL'),id,note);};
(async()=>{
const br=await pw.chromium.launch();
const mk=(scheme)=>br.newContext({viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:scheme,permissions:['clipboard-read','clipboard-write']});
const ctx=await mk(process.env.SCHEME||'light');const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message.slice(0,120)));
p.on('dialog',d=>d.accept(d.message().includes('link')?'https://www.ebay.com/itm/000000000000':d.defaultValue()));
let token='',listingId=0;
try{
 // S1 sign in
 await p.goto(B+'/',{waitUntil:'networkidle'});
 const lg=await p.evaluate(async([u,pw])=>{const r=await fetch('/w/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:pw})});const d=await r.json();if(d.token){localStorage.setItem('fash_token',d.token);localStorage.setItem('fash_user',JSON.stringify(d.user));}return {s:r.status,t:d.token||''}},[env.TEST_SELLER_USERNAME,env.TEST_SELLER_PASSWORD]);
 token=lg.t; ok('S1 seller signs in',lg.s===200&&!!token);
 await p.reload({waitUntil:'networkidle'});await p.waitForTimeout(1200);
 // S2 snap photo -> AI fills listing
 await p.evaluate(()=>go('snap'));await p.waitForTimeout(800);
 await p.setInputFiles('#lw-gal',path.join(__dirname,'fixtures','jacket.jpg'));
 await p.waitForFunction(()=>{const t=document.querySelector('#lw-title');return t&&t.value&&document.querySelector('#lw-price').value},null,{timeout:60000}).catch(()=>{});
 const ai=await p.evaluate(()=>({t:(document.querySelector('#lw-title')||{}).value,pr:(document.querySelector('#lw-price')||{}).value,d:(document.querySelector('#lw-desc')||{}).value}));
 await p.screenshot({path:OUT+'/s2-ai-filled.png'});
 ok('S2 AI fills title/price/description from a photo',!!(ai.t&&ai.pr&&ai.d),JSON.stringify({title:ai.t,price:ai.pr}));
 await p.fill('#lw-title','E2E TEST — delete me '+Date.now());
 // when the AI is unsure it leaves the category to the seller (by design) — pick one like a seller would
 await p.evaluate(()=>{const st=LW._state().W;if(!st.f.path) LW.catSet('Men/Coats & Jackets');});await p.waitForTimeout(300);
 // S3 post to our shop instantly (title input still focused, like a real phone with the keyboard open)
 await p.focus('#lw-title');
 const t0=Date.now();await p.tap('#lw-next');
 let mine=[];for(let i=0;i<20&&!mine.length;i++){await p.waitForTimeout(1000);mine=await p.evaluate(async(t)=>{const r=await fetch('/w/api/listings',{headers:{Authorization:'Bearer '+t}});const d=await r.json();return (d.listings||d||[]).filter(x=>/E2E TEST/.test(x.title))},token);}
 listingId=mine[0]&&mine[0].id; await p.screenshot({path:OUT+'/s3-posted.png'});
 ok('S3 post to fashionistas.ai is instant and free',!!listingId,'id '+listingId+' in '+((Date.now()-t0)/1000).toFixed(1)+'s');
 // S4 crosslist board: all marketplaces, copy&open, mark listed, mark sold
 await p.goto(B+'/seller/board/',{waitUntil:'networkidle'});await p.waitForTimeout(1500);
 const shops=await p.evaluate(()=>document.querySelectorAll('.bl')[0]?document.querySelectorAll('.bl')[0].querySelectorAll('.bl-shop').length:0);
 ok('S4a board lists every marketplace for the item',shops>=17,shops+' shops');
 const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:8000}).catch(()=>null),p.click(`.bl button[data-act=copy][data-p=poshmark][data-id="${listingId}"]`)]);
 await p.waitForTimeout(1500);if(pop) await pop.close();
 const clip=await p.evaluate(()=>navigator.clipboard.readText().catch(()=>''));
 ok('S4b Copy & open copies the listing and opens Poshmark',/E2E TEST/.test(clip)&&!!pop);
 await p.click(`.bl button[data-act=listed][data-p=ebay][data-id="${listingId}"]`);await p.waitForTimeout(2500);
 const links=await p.evaluate(async(id)=>(await (await fetch('/api/crosslist/links?id='+id)).json()).links,listingId);
 ok('S4c seller marks eBay listed with link; buyers get "Buy on eBay"',links.some(l=>l.platform==='ebay'));
 await p.screenshot({path:OUT+'/s4-board.png'});
 // B-stories (buyer) in a signed-out context
 const bctx=await mk(process.env.SCHEME||'light');const b=await bctx.newPage();b.on('pageerror',e=>errs.push('buyer: '+e.message.slice(0,120)));
 await b.goto(B+'/shop',{waitUntil:'networkidle'});await b.waitForTimeout(2000);
 const cards=await b.evaluate(()=>document.body.innerText.includes('Versace')||document.body.innerText.includes('Jacket'));
 ok('B1 buyer browses the shop signed out',cards);await b.screenshot({path:OUT+'/b1-shop.png'});
 const s=await b.$('input[type=search], #mk-q, input[placeholder*="earch"]');
 if(s){await s.fill('jacket');await b.keyboard.press('Enter');await b.waitForTimeout(1500);}
 const found=await b.evaluate(()=>/jacket/i.test(document.body.innerText));ok('B2 buyer searches',!!s&&found);
 await b.goto(B+'/shop/'+listingId,{waitUntil:'networkidle'});await b.waitForTimeout(3000);
 const it=await b.evaluate(()=>({msg:!![...document.querySelectorAll('button')].find(x=>/^Message/.test(x.innerText)),buy:!![...document.querySelectorAll('button')].find(x=>/Buy now/.test(x.innerText)),try:!!document.querySelector('a[href^="/try-on/"]'),ebay:!![...document.querySelectorAll('a')].find(a=>/Buy on eBay/.test(a.innerText))}));
 await b.screenshot({path:OUT+'/b3-item.png'});
 ok('B3 item page: Message, Buy now (reserve), Try it on, Buy on eBay',it.msg&&it.buy&&it.try&&it.ebay,JSON.stringify(it));
 await b.click('text=Buy now');await b.waitForTimeout(800);
 const sheet=await b.evaluate(()=>/Reserve it/.test(document.body.innerText)&&/No charge/.test(document.body.innerText));
 await b.screenshot({path:OUT+'/b4-reserve.png'});ok('B4 Buy now opens a free reserve/message sheet (no dead end)',sheet);
 await b.goto(B+'/try-on/',{waitUntil:'networkidle'});await b.waitForTimeout(1000);
 const fi=await b.$$('input[type=file]');if(fi[0]) await fi[0].setInputFiles(path.join(__dirname,'fixtures','person.jpg'));await b.waitForTimeout(1500);
 const th=await b.$$('xpath=//*[contains(text(),"try one from the shop")]/following::img');if(th[0]) await th[0].click();await b.waitForTimeout(3000);
 const ql=await b.evaluate(()=>{const q=document.getElementById('quick-look');return !!q&&!q.hidden&&getComputedStyle(q).display!=='none'});
 await b.screenshot({path:OUT+'/b5-tryon.png',fullPage:false});ok('B5 try-on shows an instant free quick look',ql);
 // S5 mark sold
 await p.goto(B+'/seller/board/',{waitUntil:'networkidle'});await p.waitForTimeout(1500);
 await p.click(`.bl button[data-act=sold][data-p=ebay][data-id="${listingId}"]`);await p.waitForTimeout(2500);
 const sold=await p.evaluate(async([t,id])=>{const d=await (await fetch('/api/crosslist/board',{headers:{Authorization:'Bearer '+t}})).json();const l=d.listings.find(x=>x.id===id);return l&&l.shops.ebay.status==='sold'&&l.status==='sold'},[token,listingId]);
 ok('S5 seller marks it sold; board + stats update',sold);await p.screenshot({path:OUT+'/s5-sold.png'});
 await bctx.close();
}catch(e){ok('runner',false,e.message.slice(0,200));}
finally{
 if(listingId&&token){const d=await p.evaluate(async([t,id])=>(await fetch('/w/api/listings/'+id,{method:'DELETE',headers:{Authorization:'Bearer '+t}})).status,[token,listingId]);console.log('cleanup delete listing',listingId,d);}
 console.log('page errors',JSON.stringify(errs));
 fs.writeFileSync(OUT+'/results.json',JSON.stringify(results,null,1));
 await br.close();process.exit(results.every(r=>r.pass)?0:1);
}})();
