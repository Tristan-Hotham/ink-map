// Usage: node code/qa_pops.js <shots.json from 03_renders.py> "<page url with tj, dem, maponly>" lat,lon,zoomFrom,zoomTo
// Count glyph and name "pops" through a scripted zoom: features visible in the central part of the view at one step that are
// gone at the next step although still well inside the view.
const fs=require('fs'),path=require('path');const {chromium}=require('playwright');
(async()=>{const cfg=JSON.parse(fs.readFileSync(process.argv[2]));const url=process.argv[3];const [lat,lon,z0,z1]=process.argv[4].split(',').map(Number);
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:1000,height:700}});
await p.route(/cdn\.jsdelivr\.net\/npm\/maplibre-gl@4\.7\.1\/dist\/(.*)/,(r,q)=>{const f=path.join(cfg.maplibre,q.url().split('/dist/')[1]);r.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.css')?'text/css':'application/javascript'})});
await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
await p.goto(url+`&at=${lat},${lon},${z0}`);await p.waitForFunction(()=>window.__map,null,{timeout:60000});
const res=await p.evaluate(async([lat,lon,z0,z1])=>{const m=window.__map;const idle=()=>new Promise(r=>{let d=false;const f=()=>{if(!d){d=true;setTimeout(r,500)}};m.once('idle',f);setTimeout(f,40000)});
 await idle();
 const snap=(layers)=>{const W=m.getCanvas().clientWidth,H=m.getCanvas().clientHeight;const out=new Map();
   for(const f of m.queryRenderedFeatures({layers:layers.filter(l=>m.getLayer(l))})){const c=f.geometry.type==='Point'?f.geometry.coordinates:null;if(!c)continue;const k=f.layer.id.startsWith('relief')?(c[0].toFixed(4)+','+c[1].toFixed(4)+','+f.properties.k):(f.properties.name||f.properties.n||'')+'|'+c[0].toFixed(3);out.set(k,c)}return out};
 const G=['relief'],N=['towns','villages','hamlets','peaks','hills','cities','capitals','bigcities','heritage','xplaces'];
 let prevG=snap(G),prevN=snap(N);const steps=[];
 for(let z=z0+0.25;z<=z1+1e-6;z+=0.25){m.jumpTo({center:[lon,lat],zoom:z});await idle();
   const W=m.getCanvas().clientWidth,H=m.getCanvas().clientHeight;const inner=c=>{const q=m.project(c);return q.x>W*0.2&&q.x<W*0.8&&q.y>H*0.2&&q.y<H*0.8};
   const g=snap(G),n=snap(N);let gp=0,gk=0,np=0,nk=0;
   const near=(cur,k,c,tol,byName)=>{const q=m.project(c);for(const [k2,c2] of cur){if(byName?k2.split('|')[0]!==k.split('|')[0]:k2.split(',')[2]!==k.split(',')[2])continue;const q2=m.project(c2);if(Math.abs(q.x-q2.x)<tol&&Math.abs(q.y-q2.y)<tol)return true}return false};
   for(const [k,c] of prevG){if(!inner(c))continue;gk++;if(!near(g,k,c,4,false))gp++}
   for(const [k,c] of prevN){if(!inner(c))continue;nk++;if(!near(n,k,c,40,true))np++}
   steps.push({z:+z.toFixed(2),glyphs:gk,glyph_pops:gp,names:nk,name_pops:np});prevG=g;prevN=n}
 return steps},[lat,lon,z0,z1]);
const t=res.reduce((a,s)=>({g:a.g+s.glyphs,gp:a.gp+s.glyph_pops,n:a.n+s.names,np:a.np+s.name_pops}),{g:0,gp:0,n:0,np:0});
console.log(JSON.stringify({total:t,share_glyph_pops:+(t.gp/t.g).toFixed(4),share_name_pops:+(t.np/t.n).toFixed(4),steps:res}));
await b.close();})();
