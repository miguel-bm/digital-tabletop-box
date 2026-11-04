// Comprueba solapes entre piezas (cajas envolventes; los marcos con ventana y los dedos dan falsos positivos conocidos).
const S=new URL('../src/', import.meta.url).href;
const M=await import(S+'model.js'),P=await import(S+'params.js');
const box=s=>{const [u0,v0,u1,v1]=s.rect,[t0,t1]=[Math.min(...s.t),Math.max(...s.t)];
 if(s.plane==='XY')return [u0,v0,t0,u1,v1,t1]; if(s.plane==='XZ')return [u0,t0,v0,u1,t1,v1]; return [t0,v0,u0,t1,v1,u1];};
// sub-boxes after removing notches (approx: boxes of notches subtracted -> we check overlap volume minus notch overlap)
const ov=(a,b)=>{const d=[0,1,2].map(i=>Math.min(a[i+3],b[i+3])-Math.max(a[i],b[i]));return d.every(x=>x>0.05)?d:null;};
function check(p,label){
 const d=M.buildDesign(p); const sol=[];
 d.pieces.forEach(pc=>{ if(pc.role==='tv') { const tv=pc.tv, pr=M.tvProfile(p,tv), nx=100, nz=120; for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){ const x0=tv.x0+(tv.x1-tv.x0)*i/nx, x1=tv.x0+(tv.x1-tv.x0)*(i+1)/nx, z0=tv.z0+(tv.z1-tv.z0)*j/nz, z1=tv.z0+(tv.z1-tv.z0)*(j+1)/nz; let dm=0; for(const x of [x0,(x0+x1)/2,x1])for(const z of [z0,(z0+z1)/2,z1]) dm=Math.max(dm,pr.depth(x,z)); sol.push({id:'TV',pc:'TV',b:[x0,tv.yS-dm,z0,x1,tv.yS,z1]}); } return;}
   (pc.solids||[]).forEach((s,i)=>sol.push({id:pc.id+(pc.solids.length>1?'.'+i:''),pc:pc.id,b:box(s),s}));});
 const out=[];
 for(let i=0;i<sol.length;i++)for(let j=i+1;j<sol.length;j++){ if(sol[i].pc&&sol[i].pc===sol[j].pc) continue; if(/^G/.test(sol[i].id)||/^G/.test(sol[j].id)) continue; const o=ov(sol[i].b,sol[j].b); if(o) out.push(`${sol[i].id}x${sol[j].id} [${o.map(x=>x.toFixed(1))}]`);}
 console.log(label, out.length? out.join('  '):'none');
}
const D=P.DEFAULTS;
check(D,"default"); check({...D,vesaDx:10},"vesaDx10"); check({...D,vesa:100},"vesa100"); check({...D,vesa:400,vesaDx:0},"vesa400");
for(const [k,v] of [['frame','rebaje'],['frame','pinzado'],['mount','vesa'],['mount','espuma'],['centerFeet',false],['source','minipc'],['joint','dedos'],['joint','rebaje'],['cable','ranura'],['cable','panel'],['handle','embutida'],['handle','laterales'],['lid',true],['portSide','izquierda'],['frame2Split',false],['pockets',true],['fans',true],['cornerBlocks',false],['protector','ninguno']]) check({...D,[k]:v},k+'='+v);
check({...D,frame:'simple',protector:'ninguno'},'simple+noprot'); check({...D,mount:'vesa',frame:'rebaje',edgeSupport:false,margin:20},'antiguo'); check({...D,edgeSupport:false,margin:20},'sin bandeja');
check({...D,portBay:60,portSide:'izquierda'},'bay60 izq');
check({...D,margin:0},'margin0');
