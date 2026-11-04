// Barre todas las opciones (una a una y por parejas) por los módulos sin DOM y falla si hay excepciones o NaN.
const S=new URL('../src/', import.meta.url).href;
const M=await import(S+'model.js'),P=await import(S+'params.js'),C=await import(S+'cutlist.js'),SIM=await import(S+'sim.js'),FEM=await import(S+'fem.js'),PL=await import(S+'plans.js'),D=await import(S+'dxf.js'),A=await import(S+'assembly.js'),B=await import(S+'bom.js');
const opts=[];
P.SCHEMA.forEach(g=>g.params.forEach(q=>{ if(q.type==='select') opts.push([q.k,Object.keys(q.opts)]); else if(q.type==='bool') opts.push([q.k,[true,false]]);}));
const errs=new Map();
function hasNaN(o,path='',seen=new Set()){ if(typeof o==='number') return Number.isNaN(o)?path:null; if(o&&typeof o==='object'){ if(seen.has(o))return null; seen.add(o); for(const k in o){const r=hasNaN(o[k],path+'.'+k,seen); if(r) return r;} } if(typeof o==='string'&&/NaN|undefined/.test(o)) return path+'(str)'; return null;}
function run(p,label){
  const steps=[['build',()=>M.buildDesign(p)]];
  let d;
  try{ d=M.buildDesign(p);}catch(e){ errs.set(label+' build: '+e.message,(errs.get(label+' build: '+e.message)||0)+1); return;}
  const fns={cutRows:()=>C.cutRows(d),pack:()=>C.packBoards(d),asm:()=>A.planAssembly(d),cases:()=>SIM.runCases(d),bom:()=>B.buildBOM(d),dxf:()=>D.boardsDXF(d),spec:()=>SIM.femSpec(d),
   conj:()=>PL.buildSheets(d,'conjunto'),all:()=>PL.buildSheets(d,'todo')};
  const n=hasNaN({pieces:d.pieces,metrics:d.metrics,hw:d.hw,fixtures:d.fixtures}); if(n) { const k=label+' NaN in design '+n; errs.set(k,1);}
  for(const [k,f] of Object.entries(fns)){ try{ const r=f(); const nn = k==='dxf'? (/NaN|undefined/.test(r)?'dxf':null) : hasNaN(r); if(nn) errs.set(label+' '+k+' NaN '+nn,1);}catch(e){ errs.set(label+' '+k+': '+e.message+' '+(e.stack.split('\n')[1]||''),1);} }
}
run({...P.DEFAULTS},'DEFAULT');
for(const [k,vals] of opts) for(const v of vals) run({...P.DEFAULTS,[k]:v},`${k}=${v}`);
// pairwise
for(let i=0;i<opts.length;i++)for(let j=i+1;j<opts.length;j++) for(const a of opts[i][1]) for(const b of opts[j][1]) run({...P.DEFAULTS,[opts[i][0]]:a,[opts[j][0]]:b},`${opts[i][0]}=${a},${opts[j][0]}=${b}`);
for(const pr of P.PRESETS) run({...P.DEFAULTS,...pr.p},'preset '+pr.id);
// numeric extremes
P.SCHEMA.forEach(g=>g.params.forEach(q=>{ if(q.type) return; for(const v of [q.min,q.max]) run({...P.DEFAULTS,[q.k]:v},`${q.k}=${v}`);}));
const keys=[...errs.keys()]; console.log(keys.length); keys.slice(0,200).forEach(k=>console.log(k));
if (keys.length) process.exit(1);
