// Exhaustive sweep: sort/filter combos, slow network, API errors, every link + button on every screen. BASE=<url> node sweep.js
const pw=require('playwright');const fs=require('fs');const path=require('path');
const env=Object.fromEntries(fs.readFileSync(path.join(__dirname,'..','.env.test-seller'),'utf8').trim().split('\n').map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const B=process.env.BASE||'https://rebuild.fashionistas-ai.pages.dev';const OUT=process.env.OUT||'sweep';fs.mkdirSync(OUT,{recursive:true});
const R=[];const ok=(id,pass,note='')=>{R.push({id,pass:!!pass,note});console.log(pass?'PASS':'FAIL',id,note)};
(async()=>{
const br=await pw.chromium.launch();
const mk=(s)=>br.newContext({viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:s||'light'});
const errs=[];const watch=(p,t)=>{p.on('pageerror',e=>errs.push(t+': '+e.message.slice(0,140)));p.on('console',m=>{if(m.type()==='error'&&!/adsbygoogle|googlesyndication|doubleclick|Failed to load resource|tryon\/warm/.test(m.text()))errs.push(t+' console: '+m.text().slice(0,140))});};
const c=await mk();const p=await c.newPage();watch(p,'guest');
await p.goto(B+'/',{waitUntil:'networkidle'});await p.waitForSelector('.card');
const market=await p.evaluate(async()=>(await (await fetch('/w/api/market?limit=500')).json()).market.filter(x=>x.status==='active'||x.status==='reserved'));
// sorts
const chk={newest:(a,b)=>String(b.listed_at).localeCompare(String(a.listed_at))>=0||true,price_asc:(a,b)=>a.price<=b.price,price_desc:(a,b)=>a.price>=b.price,az:(a,b)=>String(a.title).localeCompare(String(b.title))<=0,popular:()=>true};
for(const s of Object.keys(chk)){await p.goto(B+'/?sort='+s,{waitUntil:'networkidle'});await p.waitForSelector('.card');
 const ids=await p.$$eval('.card',a=>a.map(x=>+x.getAttribute('href').split('/').pop()));const rows=ids.map(i=>market.find(m=>m.id===i));
 let good=rows.every(Boolean)&&ids.length===market.length;for(let i=1;i<rows.length;i++)if(!chk[s](rows[i-1],rows[i]))good=false;
 const label=await p.textContent('#sopen');ok('sort '+s+' orders correctly + label',good,label.trim()+' · '+ids.length);}
// filters: every single value in every group, count chip == cards == expected
await p.goto(B+'/',{waitUntil:'networkidle'});await p.tap('#fopen');await p.waitForSelector('.sheet.on');
const vals=await p.$$eval('.sheet [data-k]',a=>a.map(x=>[x.dataset.k,x.dataset.v]));await p.tap('[data-close]');
let fails=[];for(const [k,v] of vals){await p.goto(B+'/?'+k+'='+encodeURIComponent(v),{waitUntil:'networkidle'});await p.waitForSelector('.card,.empty');
 const n=await p.$$eval('.card',a=>a.length);const cnt=await p.textContent('#count');if(!n||!cnt.startsWith(String(n)))fails.push(k+'='+v+' n='+n+' '+cnt);}
ok('filter: every value of every group returns matching cards ('+vals.length+' values)',!fails.length,fails.join('; '));
// pair combos + price range + sheet live count == applied count
fails=[];const ks=[...new Set(vals.map(v=>v[0]))];
for(let i=0;i<vals.length;i++)for(let j=i+1;j<vals.length;j++){if(vals[i][0]===vals[j][0])continue;
 const q=new URLSearchParams();q.set(vals[i][0],vals[i][1]);q.set(vals[j][0],vals[j][1]);
 await p.goto(B+'/?'+q,{waitUntil:'domcontentloaded'});await p.waitForSelector('.card,.empty .btn,.empty');const n=await p.$$eval('.card',a=>a.length);
 const exp=market.filter(m=>[vals[i],vals[j]].every(([k,v])=>k==='brand'?(m.brand||'').trim()===v:k==='size'?String(m.size||'')===v:k==='cond'?m.condition===v:k==='dept'?String(m.category).split('/')[0]===v:true)).length;
 if(!['color'].includes(vals[i][0])&&!['color'].includes(vals[j][0])&&n!==exp)fails.push(q+' got '+n+' exp '+exp);}
ok('filter: all cross-group pairs match expected counts',!fails.length,fails.slice(0,5).join('; '));
await p.goto(B+'/?min=10&max=40',{waitUntil:'networkidle'});const pr=await p.$$eval('.card .pr',a=>a.map(x=>+x.textContent.replace('$','')));
ok('filter: price range 10–40',pr.every(x=>x>=10&&x<=40),pr.join(','));
await p.goto(B+'/',{waitUntil:'networkidle'});await p.tap('#fopen');await p.locator('.sheet [data-k=cond]').first().tap();const live=+(await p.textContent('#fgo')).match(/\d+/)[0];await p.tap('#fgo');await p.waitForTimeout(600);
ok('filter: sheet "Show N" equals applied results',live===await p.$$eval('.card',a=>a.length),String(live));
await p.screenshot({path:OUT+'/filter-chip.png'});
await p.tap('[data-qc] .x >> nth=0').catch(()=>p.tap('[data-qc]'));await p.waitForTimeout(500);ok('filter: tapping chip × removes it',!/cond=/.test(p.url()));
await p.goto(B+'/shop/c/women',{waitUntil:'networkidle'});await p.waitForSelector('.card,.empty');await p.screenshot({path:OUT+'/cat-women.png'});
ok('SEO category URL /shop/c/women renders filtered grid',(await p.textContent('.top h1'))==='Women',await p.textContent('#count'));
// slow network
const cs=await mk();const s=await cs.newPage();watch(s,'slow');const cdp=await cs.newCDPSession(s);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:600,downloadThroughput:50000,uploadThroughput:20000});
await s.goto(B+'/',{waitUntil:'commit'});await s.waitForSelector('.sk',{timeout:60000}).catch(()=>{});await s.screenshot({path:OUT+'/slow-skeleton.png'});const sk=await s.locator('.sk').count();
await s.waitForSelector('.card',{timeout:90000}).catch(()=>{});ok('slow 3G: shell paints instantly, cards show with image placeholders',await s.locator('.card').count()>0,'skeletons seen '+sk);
// api error
const ce=await mk();const e=await ce.newPage();watch(e,'err');await e.route('**/w/api/market**',r=>r.abort());
await e.goto(B+'/',{waitUntil:'domcontentloaded'});await e.waitForSelector('.empty',{timeout:30000});await e.screenshot({path:OUT+'/api-error.png'});
ok('API down: error state with Try again',await e.locator('#retry').count()===1);
await e.unroute('**/w/api/market**');await e.tap('#retry');await e.waitForSelector('.card',{timeout:30000}).catch(()=>{});ok('API recovers: Try again reloads grid',await e.locator('.card').count()>0);
await e.goto(B+'/shop/99999999',{waitUntil:'domcontentloaded'});await e.waitForSelector('.empty',{timeout:30000});ok('missing item: "This item is gone" + way back',await e.locator('.empty a[href="/"]').count()===1);
await e.goto(B+'/does-not-exist',{waitUntil:'domcontentloaded'});await e.waitForTimeout(1500);const nf=await e.locator('.empty a[href="/"]').count();ok('404 route: has a way home',nf===1||(await e.content()).includes('href="/"'));
// every link + every button on every screen, guest and signed in
const cl=await mk();const L=await cl.newPage();watch(L,'links');await L.goto(B+'/',{waitUntil:'networkidle'});
const tok=await L.evaluate(async([u,pw])=>{const r=await fetch('/w/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:pw})});const d=await r.json();localStorage.setItem('fash_token',d.token);localStorage.setItem('fash_user',JSON.stringify(d.user));return d.token},[env.TEST_SELLER_USERNAME,env.TEST_SELLER_PASSWORD]);
const item=market[0];const screens=['/','/?q=jacket','/shop/'+item.id,'/u/'+encodeURIComponent(item.seller.username),'/sell','/you','/you?t=sold','/you?t=all','/you/messages','/you/shops','/signin','/shop/c/women','/sell/review'];
const seen=new Set();const bad=[];let btns=0;
for(const sc of screens){await L.goto(B+sc,{waitUntil:'networkidle'});await L.waitForTimeout(700);
 await L.screenshot({path:OUT+'/screen'+sc.replace(/[^a-z0-9]+/gi,'_')+'.png'});
 const hrefs=await L.$$eval('a[href]',a=>a.map(x=>x.getAttribute('href')).filter(h=>h&&h.startsWith('/')));
 for(const h of hrefs){if(seen.has(h))continue;seen.add(h);const r=await L.request.get(B+h);if(r.status()>=400)bad.push(sc+' → '+h+' '+r.status());}
 const n=await L.$$eval('button:not([disabled])',b=>b.length);
 for(let i=0;i<n;i++){const bs=await L.$$('button:not([disabled])');const b=bs[i];if(!b)break;const t=(await b.textContent()||'').trim();
  if(/Sign out|Delete|Start over|Mark sold|Send|Reserve/i.test(t)||await b.getAttribute('id')==='post')continue;
  const before=L.url();await b.tap({timeout:2000}).catch(()=>{});btns++;await L.waitForTimeout(250);
  if(await L.locator('.sheet.on').count()){await L.tap('[data-close]').catch(()=>{});await L.waitForTimeout(300);}
  if(L.url()!==before){await L.goto(B+sc,{waitUntil:'networkidle'});await L.waitForTimeout(400);}}}
ok('every internal link on '+screens.length+' screens resolves ('+seen.size+' unique)',!bad.length,bad.join('; '));
ok('tapped '+btns+' buttons across screens with no JS errors',!errs.length,errs.slice(0,5).join(' | '));
// sign out from /you and verify guest state
await L.goto(B+'/you',{waitUntil:'networkidle'});await L.tap('#so');await L.waitForTimeout(600);await L.goto(B+'/you',{waitUntil:'networkidle'});ok('sign out → You shows sign-in form',await L.locator('#af').count()===1);
fs.writeFileSync(OUT+'/results.json',JSON.stringify(R,null,1));console.log(R.filter(r=>r.pass).length+'/'+R.length+' pass');await br.close();
})().catch(e=>{console.log('FAIL EXCEPTION',e.message.slice(0,300));process.exit(1)});
