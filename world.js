/* ============================================================
   ÆON — Monde 3D : l'ORGANISME COSMIQUE VIVANT (Three.js)
   La civilisation n'est pas une carte : c'est un organisme suspendu
   dans le vide. Surface noire organique (GLSL). Les 4 ressources
   s'expriment SUR lui : connaissance = veines bleues, culture =
   glyphes dorés, énergie = pulsation interne, population = nuée en
   orbite. Les âges le recolorent. API conservée pour index.html.
   ============================================================ */
(function(){
"use strict";

if(typeof THREE==="undefined"){
  window.World={ init:()=>false, isActive:()=>false, setAge(){}, ping(){},
    syncBuildings(){}, setVitals(){}, onPick(){}, onWorldClick(){}, focusBuilding(){},
    transcendBurst(){}, resize(){} };
  return;
}

// Palette par âge (0..8) : base sombre, base2, liseré (rim), couleur des veines
const AGE_COL=[
  {base:0x241410,b2:0x4a2418,rim:0x7a3a22,vein:0x9cc3ff}, // Pierre — terre/braise
  {base:0x1c1810,b2:0x3e3018,rim:0xc9a44a,vein:0xbcd0ff}, // Antiquité — bronze
  {base:0x0a1024,b2:0x1a2444,rim:0xc9a44a,vein:0xbcd0ff}, // Moyen Âge — bleu nuit/or
  {base:0x12161e,b2:0x2a3c3a,rim:0x6fd8c0,vein:0xd6f0ff}, // Renaissance — émeraude/lumière
  {base:0x161210,b2:0x3a2e1e,rim:0xd9a93a,vein:0xe6d2a0}, // Industrielle — laiton
  {base:0x081420,b2:0x123448,rim:0x5ee0e0,vein:0x9fe8ff}, // Information — cyan
  {base:0x120a22,b2:0x2a1648,rim:0xc49aff,vein:0xd8b8ff}, // IA — violet néon
  {base:0x0a1024,b2:0x16245a,rim:0x6f9aff,vein:0xb8d0ff}, // Spatiale — bleu profond
  {base:0x1a1430,b2:0x3a2c60,rim:0xfff0c0,vein:0xeae0ff}, // Transcendance — iridescent
];

const R=2;
let renderer,scene,camera,raf,raycaster,ndc;
let organism,sphere,surfMat,veins=[],glyphs,popCloud,popData=[],burst,burstData=[],burstOn=false;
let starfield;
const uni={
  uTime:{value:0}, uEnergy:{value:0},
  uClickPos:{value:new THREE.Vector3(0,1,0)}, uClickAge:{value:99}, uClickStr:{value:0},
  uBase:{value:new THREE.Color(AGE_COL[0].base)}, uB2:{value:new THREE.Color(AGE_COL[0].b2)},
  uRim:{value:new THREE.Color(AGE_COL[0].rim)},
};
// niveaux visuels 0..1 (lissés)
const vit={know:0,energy:0,culture:0,pop:0};      // cibles
const vf ={know:0,energy:0,culture:0,pop:0};      // valeurs lissées
let devLevel=0;                                    // depuis syncBuildings (fallback)
let ageF=0, ageTarget=0, prevAgeInt=-1;
let ok=false, worldClickCb=null;

let camTheta=0.7,camPhi=1.12,camDist=8,camDistT=8;
let drag=false,lx=0,ly=0,downX=0,downY=0,auto=true,pinch0=0,pinchD0=0;
let _last=0;

function randDir(){ const u=Math.random()*2-1,t=Math.random()*6.283,s=Math.sqrt(1-u*u);
  return new THREE.Vector3(Math.cos(t)*s,u,Math.sin(t)*s); }
function lerpCol(target,hex,k){ target.lerp(new THREE.Color(hex),k); }

// ---------- INIT ----------
function init(){
  const canvas=document.getElementById("world");
  if(!canvas) return false;
  try{ renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:"high-performance"}); }
  catch(e){ console.warn("WebGL indispo",e); return false; }
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.setSize(innerWidth,innerHeight,false);
  renderer.setClearColor(0x04040a,1);

  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,0.1,1000);
  raycaster=new THREE.Raycaster(); ndc=new THREE.Vector2();

  scene.add(new THREE.AmbientLight(0x0a0a1a,1.0));
  const gold=new THREE.DirectionalLight(0xffd9a0,1.3); gold.position.set(5,4,6); scene.add(gold);
  scene.add(new THREE.HemisphereLight(0x2a3cff,0x140820,0.5));

  buildStars(); buildOrganism(); buildVeins(); buildGlyphs(); buildPop(); buildBurst();
  bindInput(canvas);
  addEventListener("resize",resize);
  ok=true; applyAge(); updateCam(); animate();
  return true;
}

function buildStars(){
  const N=1300,p=new Float32Array(N*3),c=new Float32Array(N*3);
  for(let i=0;i<N;i++){const r=70+Math.random()*220,u=Math.random()*2-1,t=Math.random()*6.283,s=Math.sqrt(1-u*u);
    p[i*3]=Math.cos(t)*s*r;p[i*3+1]=u*r;p[i*3+2]=Math.sin(t)*s*r;
    const b=0.45+Math.random()*0.55;c[i*3]=b*0.7;c[i*3+1]=b*0.78;c[i*3+2]=b;}
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.BufferAttribute(p,3));
  g.setAttribute("color",new THREE.BufferAttribute(c,3));
  starfield=new THREE.Points(g,new THREE.PointsMaterial({size:0.5,vertexColors:true,transparent:true,opacity:.8,sizeAttenuation:true}));
  scene.add(starfield);
}

const SNOISE=`
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod(i,289.0);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=1.0/7.0;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){float a=0.5,s=0.0;for(int i=0;i<4;i++){s+=a*snoise(p);p*=2.0;a*=0.5;}return s;}
`;
function buildOrganism(){
  organism=new THREE.Group(); scene.add(organism);
  surfMat=new THREE.ShaderMaterial({
    uniforms:uni,
    vertexShader:`varying vec3 vLocal;varying vec3 vN;varying vec3 vView;
      void main(){vLocal=position;vec4 mv=modelViewMatrix*vec4(position,1.0);vView=mv.xyz;
      vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:SNOISE+`
      precision highp float;
      varying vec3 vLocal;varying vec3 vN;varying vec3 vView;
      uniform float uTime,uEnergy,uClickAge,uClickStr;
      uniform vec3 uClickPos,uBase,uB2,uRim;
      void main(){
        vec3 N=normalize(vN);vec3 V=normalize(-vView);
        float fres=pow(1.0-max(dot(N,V),0.0),3.0);
        vec3 dir=normalize(vLocal);
        float n=fbm(vLocal*1.8+vec3(0.0,0.0,uTime*0.035));
        vec3 base=mix(uBase,uB2,n*0.5+0.5);
        float dif=max(dot(N,normalize(vec3(0.6,0.55,0.7))),0.0);
        vec3 col=base*(0.18+dif*0.55);
        float veins=pow(max(fbm(vLocal*2.4+vec3(7.0)),0.0),2.0);
        float beat=0.5+0.5*sin(uTime*2.0+fbm(vLocal*2.0)*6.28);
        col+=vec3(0.9,0.45,0.12)*veins*beat*uEnergy*0.9;
        col+=uRim*fres*0.4;
        col+=vec3(0.2,0.26,0.7)*fres*0.22;
        float ang=acos(clamp(dot(dir,normalize(uClickPos)),-1.0,1.0));
        float radius=uClickAge*2.2;
        float band=smoothstep(0.30,0.0,abs(ang-radius));
        float fade=exp(-uClickAge*1.7);
        col+=vec3(0.55,0.72,1.0)*band*fade*(0.9+uClickStr*0.06);
        gl_FragColor=vec4(col,1.0);
      }`,
  });
  sphere=new THREE.Mesh(new THREE.SphereGeometry(R,128,128),surfMat);
  organism.add(sphere);
}

// CONNAISSANCE — veines (TubeGeometry)
const MAXVEINS=46;
function buildVeins(){
  for(let i=0;i<MAXVEINS;i++){
    let p=randDir(); let tan=randDir().cross(p).normalize();
    const pts=[p.clone().multiplyScalar(R*1.006)];
    const steps=14+Math.floor(Math.random()*10);
    for(let s=0;s<steps;s++){ tan.applyAxisAngle(p.clone(),(Math.random()-0.5)*0.8);
      p.addScaledVector(tan,0.16).normalize(); tan.sub(p.clone().multiplyScalar(tan.dot(p))).normalize();
      pts.push(p.clone().multiplyScalar(R*1.006)); }
    const geo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),steps*2,0.012,5,false);
    const mat=new THREE.MeshBasicMaterial({color:AGE_COL[0].vein,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
    const m=new THREE.Mesh(geo,mat); m.userData.op=0; veins.push(m); organism.add(m);
  }
}
// CULTURE — glyphes dorés
const MAXGLYPHS=520; let glyphShown=0;
function buildGlyphs(){
  const pos=new Float32Array(MAXGLYPHS*3);
  for(let i=0;i<MAXGLYPHS;i++){const d=randDir().multiplyScalar(R*1.015);pos[i*3]=d.x;pos[i*3+1]=d.y;pos[i*3+2]=d.z;}
  const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.BufferAttribute(pos,3)); g.setDrawRange(0,0);
  glyphs=new THREE.Points(g,new THREE.PointsMaterial({color:0xf5c87a,size:0.055,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true}));
  organism.add(glyphs);
}
// POPULATION — nuée orbitale
const MAXPOP=1100; let popShown=0;
function buildPop(){
  const pos=new Float32Array(MAXPOP*3);
  for(let i=0;i<MAXPOP;i++){const dir=randDir(),r=R*1.07+Math.random()*0.26;
    popData.push({dir,r,ang:Math.random()*6.283,sp:0.15+Math.random()*0.4,axis:randDir()});
    const d=dir.clone().multiplyScalar(r);pos[i*3]=d.x;pos[i*3+1]=d.y;pos[i*3+2]=d.z;}
  const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.BufferAttribute(pos,3)); g.setDrawRange(0,0);
  popCloud=new THREE.Points(g,new THREE.PointsMaterial({color:0xbcd4ff,size:0.035,transparent:true,opacity:0.85,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true}));
  scene.add(popCloud);
}
// BURST de transition
const MAXBURST=320;
function buildBurst(){
  const pos=new Float32Array(MAXBURST*3),col=new Float32Array(MAXBURST*3);
  for(let i=0;i<MAXBURST;i++){burstData.push({v:new THREE.Vector3(),life:0});pos[i*3+1]=-999;}
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.BufferAttribute(pos,3));
  g.setAttribute("color",new THREE.BufferAttribute(col,3));
  burst=new THREE.Points(g,new THREE.PointsMaterial({size:0.09,vertexColors:true,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true}));
  scene.add(burst);
}
function fireBurst(hex){
  burstOn=true; const c=new THREE.Color(hex);
  const pos=burst.geometry.attributes.position.array, col=burst.geometry.attributes.color.array;
  for(let i=0;i<MAXBURST;i++){const d=randDir();
    burstData[i].v=d.clone().multiplyScalar(2+Math.random()*5);burstData[i].life=1;
    const o=d.clone().multiplyScalar(R*1.02);pos[i*3]=o.x;pos[i*3+1]=o.y;pos[i*3+2]=o.z;
    col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;}
  burst.geometry.attributes.position.needsUpdate=true;
  burst.geometry.attributes.color.needsUpdate=true;
}

// ---------- CONTRÔLES ----------
function updateCam(){const x=camDist*Math.sin(camPhi)*Math.cos(camTheta),y=camDist*Math.cos(camPhi),z=camDist*Math.sin(camPhi)*Math.sin(camTheta);
  camera.position.set(x,y,z);camera.lookAt(0,0,0);}
function bindInput(canvas){
  canvas.addEventListener("pointerdown",e=>{drag=true;lx=e.clientX;ly=e.clientY;downX=e.clientX;downY=e.clientY;auto=false;canvas.setPointerCapture&&canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener("pointermove",e=>{if(!drag)return;const dx=e.clientX-lx,dy=e.clientY-ly;lx=e.clientX;ly=e.clientY;camTheta-=dx*0.005;camPhi=Math.max(0.25,Math.min(Math.PI-0.25,camPhi-dy*0.005));});
  canvas.addEventListener("pointerup",e=>{drag=false;if(Math.abs(e.clientX-downX)<6&&Math.abs(e.clientY-downY)<6)pick(e.clientX,e.clientY);setTimeout(()=>auto=true,4000);});
  canvas.addEventListener("wheel",e=>{e.preventDefault();camDistT=Math.max(4.5,Math.min(11,camDistT+e.deltaY*0.006));},{passive:false});
  canvas.addEventListener("touchstart",e=>{if(e.touches.length===2){pinchD0=td(e);pinch0=camDistT;}});
  canvas.addEventListener("touchmove",e=>{if(e.touches.length===2){e.preventDefault();camDistT=Math.max(4.5,Math.min(11,pinch0*(pinchD0/Math.max(1,td(e)))));}},{passive:false});
}
function td(e){const a=e.touches[0],b=e.touches[1];return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);}
function pick(px,py){
  ndc.x=(px/innerWidth)*2-1;ndc.y=-(py/innerHeight)*2+1;
  raycaster.setFromCamera(ndc,camera);
  const hit=raycaster.intersectObject(sphere,false);
  if(!hit.length) return;
  const local=organism.worldToLocal(hit[0].point.clone()).normalize();
  uni.uClickPos.value.copy(local); uni.uClickAge.value=0; uni.uClickStr.value=Math.min(20,uni.uClickStr.value+3);
  if(worldClickCb) worldClickCb(hit[0].point);
}

// ---------- ÂGE ----------
function applyAge(){
  const a=Math.max(0,Math.min(AGE_COL.length-1,Math.round(ageF)));
  const A=AGE_COL[a];
  // lissage progressif des couleurs (appelé chaque frame)
  lerpCol(uni.uBase.value,A.base,0.04); lerpCol(uni.uB2.value,A.b2,0.04); lerpCol(uni.uRim.value,A.rim,0.04);
  for(const v of veins) lerpCol(v.material.color,A.vein,0.04);
}

// ---------- BOUCLE ----------
function animate(){
  if(!ok) return;
  raf=requestAnimationFrame(animate);
  const now=performance.now(); const dt=Math.min(0.1,(now-(_last||now))/1000); _last=now;

  ageF+=(ageTarget-ageF)*0.04;

  // vitals lissés (cibles posées par setVitals, sinon fallback dev)
  for(const k in vit) vf[k]+=((vit[k]||0)-vf[k])*0.05;
  uni.uTime.value=now*0.001;
  uni.uEnergy.value+=(vf.energy-uni.uEnergy.value)*0.05;
  uni.uClickAge.value+=dt; uni.uClickStr.value*=0.94;

  // CONNAISSANCE → veines
  const tv=Math.round(vf.know*MAXVEINS);
  for(let i=0;i<MAXVEINS;i++){const want=i<tv?1:0;const v=veins[i];
    v.userData.op+=((want?0.85:0)-v.userData.op)*0.06; v.material.opacity=v.userData.op; v.visible=v.userData.op>0.01;}
  // CULTURE → glyphes
  glyphShown+=(Math.round(vf.culture*MAXGLYPHS)-glyphShown)*0.08;
  glyphs.geometry.setDrawRange(0,Math.floor(glyphShown));
  glyphs.material.opacity=0.45+0.45*Math.abs(Math.sin(now*0.0008));
  // POPULATION → nuée
  popShown+=(Math.round(vf.pop*MAXPOP)-popShown)*0.08;
  const visN=Math.floor(popShown); popCloud.geometry.setDrawRange(0,visN);
  const parr=popCloud.geometry.attributes.position.array;
  for(let i=0;i<visN;i++){const d=popData[i];d.ang+=d.sp*dt;
    const v=d.dir.clone().applyAxisAngle(d.axis,d.ang).multiplyScalar(d.r);parr[i*3]=v.x;parr[i*3+1]=v.y;parr[i*3+2]=v.z;}
  if(visN>0) popCloud.geometry.attributes.position.needsUpdate=true;
  // ÉNERGIE → pulsation
  sphere.scale.setScalar(1+Math.sin(now*0.0018)*0.012*uni.uEnergy.value+uni.uClickStr.value*0.003);

  organism.rotation.y+=0.001;
  if(auto) camTheta+=0.0005;
  camDist+=(camDistT-camDist)*0.1; updateCam();
  applyAge();

  if(burstOn){const pos=burst.geometry.attributes.position.array;let alive=0;
    for(let i=0;i<MAXBURST;i++){const b=burstData[i];if(b.life>0){alive++;b.life-=dt*0.8;
      pos[i*3]+=b.v.x*dt;pos[i*3+1]+=b.v.y*dt;pos[i*3+2]+=b.v.z*dt;b.v.multiplyScalar(0.96);
      if(b.life<=0)pos[i*3+1]=-999;}}
    burst.geometry.attributes.position.needsUpdate=true; if(alive===0) burstOn=false;}

  if(starfield) starfield.rotation.y+=0.00012;
  renderer.render(scene,camera);
}

function resize(){ if(!ok)return; camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight,false); }

// ---------- API (conservée pour index.html) ----------
window.World={
  init,
  isActive(){ return ok; },
  setAge(a,instant){
    const rising=a>prevAgeInt && prevAgeInt>=0 && !instant && ok;
    ageTarget=a; if(instant) ageF=a;
    if(rising){ fireBurst(AGE_COL[Math.min(a,AGE_COL.length-1)].rim); uni.uClickStr.value=12; uni.uClickAge.value=0; }
    prevAgeInt=Math.floor(a);
  },
  // vitals 0..1 : connaissance, énergie, culture, population (appelé chaque frame par le jeu)
  setVitals(v){ if(!v)return;
    vit.know=clamp01(v.know); vit.energy=clamp01(v.energy); vit.culture=clamp01(v.culture); vit.pop=clamp01(v.pop); },
  // compat : densité visuelle dérivée des bâtiments si setVitals n'est pas appelé
  syncBuildings(counts){ if(!ok)return; let t=0; for(const k in counts)t+=counts[k]||0;
    devLevel=1-Math.exp(-t/45);
    // si le jeu n'utilise pas setVitals, on alimente la connaissance via dev
    if(vit.know< devLevel) vit.know=Math.max(vit.know,devLevel*0.6); },
  ping(s){ uni.uClickStr.value=Math.min(20,uni.uClickStr.value+(s||0.5)*4); uni.uClickAge.value=Math.min(uni.uClickAge.value,0.05); },
  onPick(){ /* plus de bâtiments à picker : noop */ },
  onWorldClick(fn){ worldClickCb=fn; },
  focusBuilding(){ uni.uClickStr.value=Math.min(20,uni.uClickStr.value+4); uni.uClickAge.value=0;
    // petite gerbe de glyphes culturels
  },
  transcendBurst(){ if(!ok)return; fireBurst(0xfff0c0); uni.uClickStr.value=18; uni.uClickAge.value=0; },
  resize,
};
function clamp01(x){ return x<0?0:x>1?1:(isFinite(x)?x:0); }

})();
