/* ============================================================
   ÆON — Monde 3D (Three.js)
   Direction artistique : une planète vivante vue de l'espace.
   La civilisation s'illumine — des lumières de cités s'allument et
   s'étendent sur la face nuit à mesure que l'humanité progresse,
   comme la Terre vue de nuit. La palette évolue avec les âges
   (braise → électrique → iridescent). Mégastructures en orbite à
   l'ère spatiale. Aucune dépendance externe (Three.js embarqué).
   Expose window.World.
   ============================================================ */
(function(){
"use strict";

if(typeof THREE==="undefined"){
  window.World={ init:()=>false, isActive:()=>false, setAge(){}, ping(){},
    syncBuildings(){}, onPick(){}, onWorldClick(){}, focusBuilding(){},
    transcendBurst(){}, resize(){} };
  return;
}

const PLANET_R = 5;

// Palette par âge : sol clair, sol sombre, océan, lumières de cité, atmosphère
const AGE_PAL = [
  {l1:0x6e5a44, l2:0x4a3a2a, sea:0x141019, city:0xff7a2a, atm:0x5a4632}, // Pierre — braise
  {l1:0x7d8a45, l2:0x5a6230, sea:0x163048, city:0xffb454, atm:0x9aa84a}, // Antiquité
  {l1:0x6a7a4a, l2:0x46502f, sea:0x162a3a, city:0xffc15a, atm:0x8a6a78}, // Moyen Âge
  {l1:0x5a9078, l2:0x3a6052, sea:0x123040, city:0xffe08a, atm:0x4fb5a3}, // Renaissance
  {l1:0x8a6a40, l2:0x5e4a2c, sea:0x1a1612, city:0xffcf6a, atm:0xc79348}, // Industrielle
  {l1:0x3a6a7a, l2:0x244650, sea:0x0a2235, city:0x8fe4ff, atm:0x3aa0e6}, // Information — bleu/cyan
  {l1:0x52407a, l2:0x382a55, sea:0x140c28, city:0xc49aff, atm:0x9a5cff}, // IA — violet néon
  {l1:0x3a4a7a, l2:0x263255, sea:0x0a1230, city:0x9ab8ff, atm:0x4d7cff}, // Spatiale — bleu profond
  {l1:0x9a7ad0, l2:0x6a52a0, sea:0x2a1c4a, city:0xfff0c0, atm:0xc9a8ff}, // Transcendance — iridescent
];

let renderer, scene, camera, raf;
let planet, planetMat, atmosphere, cloudMesh, ringMesh, coreGlow, starfield;
let raycaster, ndc;
let satGroup=null, satellites=[];
let particleSys, pool=[], pHead=0;

let ageF=0, ageTarget=0, prevAgeInt=-1;
let devF=0, devTarget=0;          // niveau de développement 0..1 (lumières)
let pulse=0;
let ok=false;

let camTheta=0.7, camPhi=1.12, camDist=16, camDistTarget=16;
let dragging=false, lastX=0, lastY=0, autoRotate=true;
let pinchD0=0, pinchStart=0, downX=0, downY=0;
let camAnim=null;
let pickCb=null, worldClickCb=null;
let _last=0;

// ---------- couleurs ----------
function col(hex){ return new THREE.Color(hex); }
function blend(field){
  const a=Math.max(0,Math.min(AGE_PAL.length-1,ageF));
  const i=Math.floor(a), f=a-i;
  const lo=AGE_PAL[i], hi=AGE_PAL[Math.min(i+1,AGE_PAL.length-1)];
  return col(lo[field]).lerp(col(hi[field]), f);
}

// ============================================================
//   INIT
// ============================================================
function init(){
  const canvas=document.getElementById("world");
  if(!canvas) return false;
  try{
    renderer=new THREE.WebGLRenderer({canvas, antialias:true, alpha:false, powerPreference:"high-performance"});
  }catch(e){ console.warn("WebGL indisponible",e); return false; }
  renderer.setPixelRatio(Math.min(devicePixelRatio||1, 2));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.setClearColor(0x04040c, 1);

  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(45, innerWidth/innerHeight, 0.1, 3000);
  raycaster=new THREE.Raycaster();
  ndc=new THREE.Vector2();

  buildStars();
  buildPlanet();
  buildClouds();
  buildAtmosphere();
  buildRing();
  buildSatellites();
  buildParticles();

  scene.add(new THREE.AmbientLight(0x2a2a44, 1.0));
  const sun=new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(6,3,8); scene.add(sun);

  bindInput(canvas);
  addEventListener("resize", resize);
  ok=true;
  applyAge();
  updateCamera();
  animate();
  return true;
}

// ---------- étoiles ----------
function buildStars(){
  const N=2200, pos=new Float32Array(N*3), c=new Float32Array(N*3);
  for(let i=0;i<N;i++){
    const r=300+Math.random()*900;
    const u=Math.random()*2-1, t=Math.random()*6.283, s=Math.sqrt(1-u*u);
    pos[i*3]=Math.cos(t)*s*r; pos[i*3+1]=u*r; pos[i*3+2]=Math.sin(t)*s*r;
    const b=0.5+Math.random()*0.5, tint=Math.random();
    c[i*3]=b*(0.7+tint*0.3); c[i*3+1]=b*0.8; c[i*3+2]=b;
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.BufferAttribute(pos,3));
  g.setAttribute("color",new THREE.BufferAttribute(c,3));
  starfield=new THREE.Points(g,new THREE.PointsMaterial({size:1.5,vertexColors:true,transparent:true,opacity:0.9,sizeAttenuation:true}));
  scene.add(starfield);
}

// ---------- planète (shader : jour + lumières de cité côté nuit) ----------
function buildPlanet(){
  const geo=new THREE.SphereGeometry(PLANET_R, 96, 96);
  planetMat=new THREE.ShaderMaterial({
    uniforms:{
      uTime:{value:0},
      uDev:{value:0},
      uLand1:{value:col(AGE_PAL[0].l1)},
      uLand2:{value:col(AGE_PAL[0].l2)},
      uSea:{value:col(AGE_PAL[0].sea)},
      uCity:{value:col(AGE_PAL[0].city)},
      uAtm:{value:col(AGE_PAL[0].atm)},
      uLightDir:{value:new THREE.Vector3(0.7,0.35,0.6).normalize()},
      uAge:{value:0},
      uPulse:{value:0},
    },
    vertexShader:`
      varying vec3 vN; varying vec3 vL; varying vec3 vW;
      void main(){
        vL=position;
        vec4 wp=modelMatrix*vec4(position,1.0);
        vW=wp.xyz;
        vN=normalize(mat3(modelMatrix)*normal);
        gl_Position=projectionMatrix*viewMatrix*wp;
      }`,
    fragmentShader:`
      precision highp float;
      varying vec3 vN; varying vec3 vL; varying vec3 vW;
      uniform float uTime, uDev, uAge, uPulse;
      uniform vec3 uLand1,uLand2,uSea,uCity,uAtm,uLightDir;

      float hash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float noise(vec3 x){ vec3 i=floor(x),f=fract(x); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                       mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                       mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
      float fbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.03; a*=0.5; } return s; }

      void main(){
        vec3 n=normalize(vN);
        vec3 L=normalize(uLightDir);
        float diff=dot(n,L);
        float day=smoothstep(-0.15,0.35,diff);     // 1 côté jour, 0 côté nuit
        float night=1.0-day;

        // continents
        float cont=fbm(vL*1.6);
        float detail=fbm(vL*4.5)*0.4;
        float land=smoothstep(0.46,0.54,cont);
        vec3 landCol=mix(uLand2,uLand1, clamp(cont+detail,0.0,1.0));
        vec3 base=mix(uSea, landCol, land);

        // éclairage doux + ambiance
        float lit=0.18+0.95*max(diff,0.0);
        vec3 dayCol=base*lit;

        // --- lumières de cités (face nuit) ---
        // motif cellulaire ; le seuil baisse quand le développement monte → plus de villes
        float cells=fbm(vL*7.0);
        float fine=fbm(vL*16.0);
        float thr=mix(0.78,0.40,clamp(uDev,0.0,1.0));
        float cityMask=smoothstep(thr,thr+0.06,cells)*land;
        cityMask*=smoothstep(0.45,0.7,fine);        // grain de "points lumineux"
        float flick=0.75+0.25*sin(uTime*2.5+cells*60.0);
        vec3 lights=uCity*cityMask*flick*night*(0.6+uDev*1.4);

        // pulsation de clic : flash global léger
        lights+=uCity*night*cityMask*uPulse*1.2;

        vec3 c=dayCol+lights;

        // rim atmosphérique
        vec3 V=normalize(cameraPosition-vW);
        float rim=pow(1.0-max(dot(n,V),0.0),3.0);
        c+=uAtm*rim*(0.35+0.4*day);

        // noyau de transcendance (âge 8) : la planète rayonne
        float tr=smoothstep(7.2,8.0,uAge);
        vec3 iri=0.5+0.5*cos(vec3(0.0,2.1,4.2)+cont*6.0+uTime*0.5);
        c=mix(c, iri, tr*0.55);
        c+=iri*tr*0.3;

        gl_FragColor=vec4(c,1.0);
      }`,
  });
  planet=new THREE.Mesh(geo, planetMat);
  scene.add(planet);
}

// ---------- nuages ----------
function buildClouds(){
  const tex=makeCloudTex();
  cloudMesh=new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_R*1.02, 64, 64),
    new THREE.MeshStandardMaterial({color:0xffffff, transparent:true, opacity:0.0, alphaMap:tex, depthWrite:false, roughness:1})
  );
  scene.add(cloudMesh);
}
function makeCloudTex(){
  const s=512, cv=document.createElement("canvas"); cv.width=s*2; cv.height=s;
  const x=cv.getContext("2d"); x.fillStyle="#000"; x.fillRect(0,0,s*2,s);
  for(let i=0;i<90;i++){
    const r=20+Math.random()*70, px=Math.random()*s*2, py=Math.random()*s;
    const g=x.createRadialGradient(px,py,0,px,py,r);
    g.addColorStop(0,"rgba(255,255,255,"+(0.35+Math.random()*0.35)+")");
    g.addColorStop(1,"rgba(255,255,255,0)");
    x.fillStyle=g; x.beginPath(); x.arc(px,py,r,0,7); x.fill();
  }
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}

// ---------- halo atmosphérique (sphère arrière) ----------
function buildAtmosphere(){
  atmosphere=new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_R*1.18, 64, 64),
    new THREE.MeshBasicMaterial({color:AGE_PAL[0].atm, transparent:true, opacity:0.18, side:THREE.BackSide, blending:THREE.AdditiveBlending, depthWrite:false})
  );
  scene.add(atmosphere);

  coreGlow=new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_R*1.05, 32, 32),
    new THREE.MeshBasicMaterial({color:0xfff0c0, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false})
  );
  scene.add(coreGlow);
}

// ---------- anneau (ère spatiale) ----------
function buildRing(){
  const g=new THREE.RingGeometry(PLANET_R*1.55, PLANET_R*2.3, 128, 1);
  ringMesh=new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    color:0x9ab8ff, transparent:true, opacity:0, side:THREE.DoubleSide,
    blending:THREE.AdditiveBlending, depthWrite:false}));
  ringMesh.rotation.x=Math.PI*0.5-0.42; ringMesh.rotation.z=0.22;
  scene.add(ringMesh);
}

// ---------- satellites/mégastructures en orbite (ère spatiale) ----------
function buildSatellites(){
  satGroup=new THREE.Group(); scene.add(satGroup);
  const defs=[
    {r:PLANET_R*1.75, sp:0.18, ph:0.0,  tilt:0.35, kind:"station"},
    {r:PLANET_R*1.95, sp:0.13, ph:2.1,  tilt:-0.25, kind:"station"},
    {r:PLANET_R*2.15, sp:0.10, ph:4.0,  tilt:0.5,  kind:"dyson"},
  ];
  for(const d of defs){
    let mesh;
    if(d.kind==="dyson"){
      mesh=new THREE.Mesh(new THREE.TorusGeometry(0.5,0.06,8,24),
        new THREE.MeshStandardMaterial({color:0xffe07a,emissive:0xffaa22,emissiveIntensity:1.2,roughness:0.4,metalness:0.6}));
    } else {
      const grp=new THREE.Group();
      const body=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.22,0.5),
        new THREE.MeshStandardMaterial({color:0xcfd6e6,emissive:0x335577,emissiveIntensity:0.6,roughness:0.5,metalness:0.7}));
      const panelMat=new THREE.MeshStandardMaterial({color:0x2a4a8a,emissive:0x1a2a5a,emissiveIntensity:0.5,roughness:0.4,metalness:0.3,side:THREE.DoubleSide});
      const p1=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.01,0.3),panelMat); p1.position.x=0.5;
      const p2=p1.clone(); p2.position.x=-0.5;
      grp.add(body,p1,p2); mesh=grp;
    }
    mesh.visible=false;
    mesh.userData={r:d.r,sp:d.sp,ph:d.ph,tilt:d.tilt};
    satGroup.add(mesh); satellites.push(mesh);
  }
}

// ---------- particules (clic, transcendance) ----------
const PMAX=500;
function buildParticles(){
  const pos=new Float32Array(PMAX*3), c=new Float32Array(PMAX*3);
  for(let i=0;i<PMAX;i++){ pool.push({life:0}); pos[i*3+1]=-9999; }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.BufferAttribute(pos,3));
  g.setAttribute("color",new THREE.BufferAttribute(c,3));
  particleSys=new THREE.Points(g,new THREE.PointsMaterial({size:0.13,vertexColors:true,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true}));
  scene.add(particleSys);
}
function emit(origin,n,color,spread,speed){
  const c=col(color||0xa99bff);
  for(let i=0;i<n;i++){
    const p=pool[pHead]; pHead=(pHead+1)%PMAX;
    p.x=origin.x;p.y=origin.y;p.z=origin.z;
    const dir=origin.clone().normalize();
    const rnd=new THREE.Vector3(Math.random()-0.5,Math.random()-0.5,Math.random()-0.5).multiplyScalar(spread||1);
    const v=dir.multiplyScalar(speed||0.06).add(rnd.multiplyScalar(0.04));
    p.vx=v.x;p.vy=v.y;p.vz=v.z; p.life=1; p.r=c.r;p.g=c.g;p.b=c.b;
  }
}
function updateParticles(dt){
  if(!particleSys) return;
  const pos=particleSys.geometry.attributes.position.array;
  const c=particleSys.geometry.attributes.color.array;
  for(let i=0;i<PMAX;i++){
    const p=pool[i];
    if(p.life>0){
      p.life-=dt*1.3; p.x+=p.vx;p.y+=p.vy;p.z+=p.vz;
      const d=Math.hypot(p.x,p.y,p.z)||1, g=0.0005;
      p.vx-=p.x/d*g;p.vy-=p.y/d*g;p.vz-=p.z/d*g;
      pos[i*3]=p.x;pos[i*3+1]=p.y;pos[i*3+2]=p.z;
      const l=Math.max(0,p.life);
      c[i*3]=p.r*l;c[i*3+1]=p.g*l;c[i*3+2]=p.b*l;
    } else { pos[i*3+1]=-9999; }
  }
  particleSys.geometry.attributes.position.needsUpdate=true;
  particleSys.geometry.attributes.color.needsUpdate=true;
}

// ============================================================
//   INTERACTION
// ============================================================
function bindInput(canvas){
  canvas.addEventListener("pointerdown",e=>{
    dragging=true; lastX=e.clientX; lastY=e.clientY; downX=e.clientX; downY=e.clientY;
    autoRotate=false; canvas.setPointerCapture&&canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove",e=>{
    if(!dragging) return;
    const dx=e.clientX-lastX, dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY;
    camTheta-=dx*0.005;
    camPhi=Math.max(0.3,Math.min(Math.PI-0.3,camPhi-dy*0.005));
  });
  canvas.addEventListener("pointerup",e=>{
    dragging=false;
    if(Math.abs(e.clientX-downX)<6 && Math.abs(e.clientY-downY)<6) handleClick(e.clientX,e.clientY);
    setTimeout(()=>autoRotate=true,5000);
  });
  canvas.addEventListener("wheel",e=>{ e.preventDefault();
    camDistTarget=Math.max(9,Math.min(46,camDistTarget+e.deltaY*0.012)); },{passive:false});
  canvas.addEventListener("touchstart",e=>{ if(e.touches.length===2){ pinchD0=tdist(e); pinchStart=camDistTarget; }});
  canvas.addEventListener("touchmove",e=>{ if(e.touches.length===2){ e.preventDefault();
    camDistTarget=Math.max(9,Math.min(46,pinchStart*(pinchD0/Math.max(1,tdist(e))))); }},{passive:false});
}
function tdist(e){ const a=e.touches[0],b=e.touches[1]; return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY); }

function handleClick(px,py){
  ndc.x=(px/innerWidth)*2-1; ndc.y=-(py/innerHeight)*2+1;
  raycaster.setFromCamera(ndc,camera);
  const hit=raycaster.intersectObject(planet,false);
  if(hit.length){
    emit(hit[0].point, 16, blend("city").getHex(), 0.9, 0.08);
    pulse=Math.min(pulse+0.9,1.8);
    if(worldClickCb) worldClickCb(hit[0].point);
  }
}

// ============================================================
//   CAMÉRA
// ============================================================
function updateCamera(){
  const x=camDist*Math.sin(camPhi)*Math.cos(camTheta);
  const y=camDist*Math.cos(camPhi);
  const z=camDist*Math.sin(camPhi)*Math.sin(camTheta);
  camera.position.set(x,y,z); camera.lookAt(0,0,0);
}
function cinematic(){ camAnim={t:0,dur:2400,from:camDist,close:11,fromT:camTheta}; }
function tickCam(dt){
  if(!camAnim) return false;
  camAnim.t+=dt*1000;
  const k=Math.min(1,camAnim.t/camAnim.dur);
  let d;
  if(k<0.4) d=lerp(camAnim.from,camAnim.close,easeIO(k/0.4));
  else if(k<0.6) d=camAnim.close;
  else d=lerp(camAnim.close,camDistTarget,easeIO((k-0.6)/0.4));
  camDist=d; camTheta=camAnim.fromT+k*0.7;
  if(k>=1){ camAnim=null; return false; }
  return true;
}
function easeIO(x){ return x<0.5?2*x*x:1-Math.pow(-2*x+2,2)/2; }
function lerp(a,b,t){ return a+(b-a)*t; }

// ============================================================
//   VISUEL PAR ÂGE
// ============================================================
function applyAge(){
  if(!planetMat) return;
  planetMat.uniforms.uLand1.value.copy(blend("l1"));
  planetMat.uniforms.uLand2.value.copy(blend("l2"));
  planetMat.uniforms.uSea.value.copy(blend("sea"));
  planetMat.uniforms.uCity.value.copy(blend("city"));
  planetMat.uniforms.uAtm.value.copy(blend("atm"));
  planetMat.uniforms.uAge.value=ageF;
  atmosphere.material.color.copy(blend("atm"));
  atmosphere.material.opacity=0.14+0.025*ageF;

  const tr=Math.max(0,(ageF-7)/1.5);
  coreGlow.material.opacity=tr*0.45;
  coreGlow.scale.setScalar(1+tr*0.1+pulse*0.04);

  // anneau + satellites : ère spatiale (≥7)
  const sp=Math.min(1,Math.max(0,(ageF-6.5)/1.2));
  if(ringMesh){ ringMesh.material.opacity=sp*0.45; ringMesh.material.color.copy(blend("atm")); }
  for(const s of satellites) s.visible = sp>0.05;

  if(cloudMesh){
    const cl=Math.min(1,Math.max(0,(ageF-0.4)/2))*Math.max(0,1-tr);
    cloudMesh.material.opacity=cl*0.45;
    cloudMesh.material.color.copy(col(0xffffff).lerp(blend("atm"),0.25));
  }
}

// ============================================================
//   BOUCLE
// ============================================================
function animate(){
  if(!ok) return;
  raf=requestAnimationFrame(animate);
  const now=performance.now();
  const dt=Math.min(0.05,(now-(_last||now))/1000); _last=now;

  ageF+=(ageTarget-ageF)*0.04;
  devF+=(devTarget-devF)*0.05;
  pulse*=0.9;

  if(!tickCam(dt)){
    camDist+=(camDistTarget-camDist)*0.1;
    if(autoRotate) camTheta+=0.0008;
  }
  updateCamera();
  updateParticles(dt);

  if(planetMat){
    planetMat.uniforms.uTime.value=now*0.001;
    planetMat.uniforms.uDev.value=devF;
    planetMat.uniforms.uPulse.value=pulse;
  }
  if(planet) planet.rotation.y+=0.0014;
  if(cloudMesh) cloudMesh.rotation.y+=0.0008;
  if(ringMesh) ringMesh.rotation.z+=0.0003;
  if(starfield) starfield.rotation.y+=0.00012;

  // satellites en orbite
  for(const s of satellites){
    if(!s.visible) continue;
    const u=s.userData;
    const ph=u.ph+now*0.001*u.sp;
    s.position.set(Math.cos(ph)*u.r, Math.sin(ph)*u.r*Math.sin(u.tilt), Math.sin(ph)*u.r*Math.cos(u.tilt));
    s.rotation.y+=0.01; s.rotation.x+=0.004;
  }

  applyAge();
  renderer.render(scene,camera);
}

function resize(){
  if(!ok) return;
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight,false);
}

// ============================================================
//   API PUBLIQUE
// ============================================================
window.World={
  init,
  isActive(){ return ok; },
  setAge(a,instant){
    const rising = a>prevAgeInt && prevAgeInt>=0 && !instant && ok;
    ageTarget=a;
    if(instant){ ageF=a; applyAge(); }
    else if(rising){
      cinematic();
      emit(new THREE.Vector3(0,PLANET_R*1.05,0), 90, 0xffe08a, 2.0, 0.11);
      pulse=Math.min(pulse+1.4,1.9);
    }
    prevAgeInt=Math.floor(a);
  },
  // niveau de développement (lumières) déduit des bâtiments
  setDevelopment(d){ devTarget=Math.max(0,Math.min(1,d)); },
  syncBuildings(counts){
    if(!ok) return;
    let total=0; for(const k in counts) total+=counts[k]||0;
    // dev croît avec le nb de bâtiments et l'âge ; courbe douce, plafonnée
    const fromBuild=1-Math.exp(-total/45);          // 0..~1, saturant
    const fromAge=ageF/8*0.35;
    devTarget=Math.max(0,Math.min(1, 0.05+fromBuild*0.75+fromAge));
  },
  ping(s){ pulse=Math.min(pulse+(s||0.5),1.9); },
  onPick(fn){ pickCb=fn; },          // conservé pour compat (non utilisé désormais)
  onWorldClick(fn){ worldClickCb=fn; },
  focusBuilding(){
    // petite étincelle de cité à un point aléatoire de la surface
    const u=Math.random()*2-1, t=Math.random()*6.283, s=Math.sqrt(1-u*u);
    const p=new THREE.Vector3(Math.cos(t)*s,u,Math.sin(t)*s).multiplyScalar(PLANET_R);
    emit(p, 8, blend("city").getHex(), 0.5, 0.05);
    pulse=Math.min(pulse+0.3,1.9);
  },
  transcendBurst(){
    if(!ok) return;
    emit(new THREE.Vector3(0,0,0), 260, 0xfff0c0, 2.6, 0.14);
    pulse=1.9; cinematic();
  },
  resize,
};

})();
