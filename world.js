/* ============================================================
   ÆON — Monde 3D (Three.js)
   Une vraie scène : caméra orbitale, planète sphérique, et les
   bâtiments apparaissent physiquement sur la surface quand on les
   construit. Clic-picking sur les objets. La planète évolue avec
   les âges. Expose window.World pour le moteur de jeu.
   ============================================================ */
(function(){
"use strict";

if(typeof THREE==="undefined"){ console.warn("THREE absent — monde 3D désactivé"); window.World=stub(); return; }

function stub(){ return {
  init(){return false;}, setAge(){}, ping(){}, isActive(){return false;},
  syncBuildings(){}, onPick(){}, focusBuilding(){}, resize(){}
}; }

// ---- Constantes monde ----
const PLANET_R = 5;
// Palette de surface par âge (sol, océan, atmosphère)
const AGE_PALETTE = [
  {land:0x6b5641, sea:0x10131a, atm:0x4a4036, emis:0xff5a1e}, // Pierre — roche/braise
  {land:0x7a8c3f, sea:0x163048, atm:0x9aa84a, emis:0xffb454}, // Antiquité
  {land:0x5c7048, sea:0x16283a, atm:0x8a5a78, emis:0xe8b04a}, // Moyen Âge
  {land:0x4a8c7a, sea:0x123040, atm:0x3fb5a3, emis:0xf5c542}, // Renaissance
  {land:0x8a6a3a, sea:0x1a1410, atm:0xc79348, emis:0xff9a3c}, // Industrielle
  {land:0x2a5a6a, sea:0x0a2235, atm:0x3aa0e6, emis:0x5ee0e0}, // Information
  {land:0x4a2a7a, sea:0x140c28, atm:0x9a5cff, emis:0x54e0b0}, // IA
  {land:0x2a3a7a, sea:0x0a1230, atm:0x4d7cff, emis:0x62e0e0}, // Spatiale
  {land:0x9a7ad0, sea:0x2a1c4a, atm:0xc9a8ff, emis:0xfff0b8}, // Transcendance
];

// Forme/couleur par type de bâtiment (id du jeu)
const BUILDING_MESH = {
  feu:     {h:0.18, color:0xff7a2a, emissive:0xff5a1e, shape:"cone"},
  tribu:   {h:0.22, color:0xb5895a, emissive:0x000000, shape:"hut"},
  champ:   {h:0.08, color:0x9bcf4a, emissive:0x000000, shape:"flat"},
  temple:  {h:0.45, color:0xe6d8b0, emissive:0x000000, shape:"temple"},
  ecole:   {h:0.30, color:0xc9b48a, emissive:0x000000, shape:"box"},
  moulin:  {h:0.40, color:0xcfcfcf, emissive:0x000000, shape:"tower"},
  cite:    {h:0.55, color:0xb0b0c0, emissive:0xffcc66, shape:"city"},
  atelier: {h:0.35, color:0xd9a0c0, emissive:0x000000, shape:"box"},
  usine:   {h:0.45, color:0x8a8a8a, emissive:0xff6a2a, shape:"factory"},
  labo:    {h:0.40, color:0xa0d0d0, emissive:0x55ffcc, shape:"dome"},
  serveur: {h:0.42, color:0x6a8aff, emissive:0x5ee0e0, shape:"box"},
  reseau:  {h:0.30, color:0xff6fb5, emissive:0xff6fb5, shape:"ring"},
  ia:      {h:0.55, color:0x9a5cff, emissive:0x9a5cff, shape:"obelisk"},
  fusion:  {h:0.50, color:0xffd24a, emissive:0xffaa22, shape:"dome"},
  colonie: {h:0.60, color:0xc0c0d0, emissive:0x88ccff, shape:"sat", orbit:true},
  dyson:   {h:0.70, color:0xffe07a, emissive:0xffcc44, shape:"sat", orbit:true},
  esprit:  {h:0.65, color:0xe0c8ff, emissive:0xc9a8ff, shape:"obelisk"},
};

let renderer, scene, camera, raf, raycaster, pointerNDC;
let planet, planetMat, atmosphere, cloudLayer, starfield, sunLight, coreGlow;
let slotsGroup, orbitGroup;     // groupes pour bâtiments au sol / en orbite
let ageF=0, ageTarget=0, pulse=0, ok=false;
let camTheta=0.6, camPhi=1.15, camDist=20, camDistTarget=20;
let dragging=false, lastX=0, lastY=0, autoRotate=true, idleT=0;
let pinchStart=0, pinchDistStart=0;
let buildingNodes={};           // id -> {meshes:[], count, slots:[...]}
let pickList=[];                // meshes pickables -> {id}
let pickCallback=null, emptyClickCallback=null;
const tmpV=new THREE.Vector3();

// Systèmes "monde vivant"
let particleSys, particlePool=[], particleHead=0;
let cloudMesh, ringMesh;
let camAnim=null;              // animation cinématique de caméra
let prevAgeInt=-1;             // pour détecter les passages d'âge
const clock={t:0};

// Slots déterministes sur la sphère (spirale de Fibonacci) — stables entre renders
const SLOT_COUNT=520;
let SLOTS=[];
function buildSlots(){
  SLOTS=[];
  const gold=Math.PI*(3-Math.sqrt(5));
  for(let i=0;i<SLOT_COUNT;i++){
    const y=1-(i/(SLOT_COUNT-1))*2;
    const r=Math.sqrt(1-y*y);
    const th=gold*i;
    SLOTS.push(new THREE.Vector3(Math.cos(th)*r, y, Math.sin(th)*r));
  }
}

function lerpColor(a,b,t){
  const ca=new THREE.Color(a), cb=new THREE.Color(b);
  return ca.lerp(cb,t);
}
function ageBlend(field){
  const a=Math.max(0,Math.min(AGE_PALETTE.length-1,ageF));
  const i=Math.floor(a), f=a-i;
  const lo=AGE_PALETTE[i], hi=AGE_PALETTE[Math.min(i+1,AGE_PALETTE.length-1)];
  return lerpColor(lo[field], hi[field], f);
}

// ---- Construction de la scène ----
function init(){
  const canvas=document.getElementById("world");
  if(!canvas) return false;
  try{
    renderer=new THREE.WebGLRenderer({canvas, antialias:true, alpha:false, powerPreference:"high-performance"});
  }catch(e){ console.warn("WebGL indispo",e); return false; }
  renderer.setPixelRatio(Math.min(devicePixelRatio||1, 2));
  renderer.setSize(innerWidth, innerHeight, false);

  scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2(0x05050e, 0.012);

  camera=new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 0.1, 2000);

  raycaster=new THREE.Raycaster();
  pointerNDC=new THREE.Vector2();

  buildSlots();
  buildStars();
  buildPlanet();
  buildClouds();
  buildRing();
  buildParticles();
  buildLights();

  slotsGroup=new THREE.Group(); planet.add(slotsGroup);   // tourne avec la planète
  orbitGroup=new THREE.Group(); scene.add(orbitGroup);    // orbites indépendantes

  bindInput(canvas);
  addEventListener("resize", resize);
  ok=true;
  updateCamera(true);
  animate();
  return true;
}

function buildStars(){
  const N=1800, pos=new Float32Array(N*3), col=new Float32Array(N*3);
  for(let i=0;i<N;i++){
    const r=200+Math.random()*600;
    const u=Math.random()*2-1, t=Math.random()*Math.PI*2, s=Math.sqrt(1-u*u);
    pos[i*3]=Math.cos(t)*s*r; pos[i*3+1]=u*r; pos[i*3+2]=Math.sin(t)*s*r;
    const b=0.5+Math.random()*0.5; col[i*3]=b*0.8; col[i*3+1]=b*0.8; col[i*3+2]=b;
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.BufferAttribute(pos,3));
  g.setAttribute("color",new THREE.BufferAttribute(col,3));
  starfield=new THREE.Points(g, new THREE.PointsMaterial({size:1.4, vertexColors:true, transparent:true, opacity:0.9, sizeAttenuation:true}));
  scene.add(starfield);
}

function buildPlanet(){
  const geo=new THREE.IcosahedronGeometry(PLANET_R, 6);
  // relief procédural figé dans la géométrie
  const pos=geo.attributes.position;
  const v=new THREE.Vector3();
  for(let i=0;i<pos.count;i++){
    v.fromBufferAttribute(pos,i).normalize();
    const n=fbm(v.x*1.8, v.y*1.8, v.z*1.8);
    const elev=1 + (n-0.5)*0.10;
    v.multiplyScalar(PLANET_R*elev);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  planetMat=new THREE.MeshStandardMaterial({
    color:ageBlend("land"), roughness:0.92, metalness:0.05,
    emissive:new THREE.Color(0x000000), emissiveIntensity:0.4, flatShading:true,
  });
  planet=new THREE.Mesh(geo, planetMat);
  scene.add(planet);

  // atmosphère (sphère arrière additive)
  const atmGeo=new THREE.SphereGeometry(PLANET_R*1.14, 48, 48);
  const atmMat=new THREE.MeshBasicMaterial({color:ageBlend("atm"), transparent:true, opacity:0.16, side:THREE.BackSide, blending:THREE.AdditiveBlending});
  atmosphere=new THREE.Mesh(atmGeo, atmMat);
  scene.add(atmosphere);

  // noyau lumineux (transcendance)
  const coreMat=new THREE.MeshBasicMaterial({color:0xfff0b8, transparent:true, opacity:0, blending:THREE.AdditiveBlending});
  coreGlow=new THREE.Mesh(new THREE.SphereGeometry(PLANET_R*1.02, 32,32), coreMat);
  scene.add(coreGlow);
}

function buildLights(){
  scene.add(new THREE.AmbientLight(0x404060, 1.1));
  sunLight=new THREE.DirectionalLight(0xfff2d8, 2.2);
  sunLight.position.set(8, 6, 10);
  scene.add(sunLight);
  const rim=new THREE.DirectionalLight(0x4060ff, 0.6);
  rim.position.set(-8,-4,-6); scene.add(rim);
}

// ---- Nuages (couche translucide qui dérive) ----
function buildClouds(){
  const geo=new THREE.SphereGeometry(PLANET_R*1.05, 48, 48);
  const mat=new THREE.MeshStandardMaterial({
    color:0xffffff, transparent:true, opacity:0.0, roughness:1, metalness:0,
    alphaMap:makeCloudTexture(), depthWrite:false,
  });
  cloudMesh=new THREE.Mesh(geo, mat);
  scene.add(cloudMesh);
}
function makeCloudTexture(){
  const s=256, cv=document.createElement("canvas"); cv.width=cv.height=s;
  const x=cv.getContext("2d");
  x.fillStyle="#000"; x.fillRect(0,0,s,s);
  for(let i=0;i<140;i++){
    const r=8+Math.random()*26, px=Math.random()*s, py=Math.random()*s;
    const g=x.createRadialGradient(px,py,0,px,py,r);
    g.addColorStop(0,"rgba(255,255,255,"+(0.4+Math.random()*0.4)+")");
    g.addColorStop(1,"rgba(255,255,255,0)");
    x.fillStyle=g; x.beginPath(); x.arc(px,py,r,0,7); x.fill();
  }
  const tex=new THREE.CanvasTexture(cv);
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  return tex;
}

// ---- Anneau planétaire (apparaît à l'ère spatiale) ----
function buildRing(){
  const geo=new THREE.RingGeometry(PLANET_R*1.5, PLANET_R*2.2, 96, 1);
  // incline les UV pour un dégradé radial
  const mat=new THREE.MeshBasicMaterial({
    color:0x88aaff, transparent:true, opacity:0, side:THREE.DoubleSide,
    blending:THREE.AdditiveBlending, depthWrite:false,
  });
  ringMesh=new THREE.Mesh(geo, mat);
  ringMesh.rotation.x=Math.PI*0.5 - 0.35;
  ringMesh.rotation.z=0.2;
  scene.add(ringMesh);
}

// ---- Système de particules 3D (clics, transcendance) ----
const PARTICLE_MAX=600;
function buildParticles(){
  const pos=new Float32Array(PARTICLE_MAX*3);
  const col=new Float32Array(PARTICLE_MAX*3);
  for(let i=0;i<PARTICLE_MAX;i++){
    particlePool.push({life:0, vx:0,vy:0,vz:0, x:0,y:0,z:0});
    pos[i*3]=0;pos[i*3+1]=-9999;pos[i*3+2]=0;
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.BufferAttribute(pos,3));
  g.setAttribute("color",new THREE.BufferAttribute(col,3));
  particleSys=new THREE.Points(g, new THREE.PointsMaterial({
    size:0.16, vertexColors:true, transparent:true, opacity:0.95,
    blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true,
  }));
  scene.add(particleSys);
}
function emitParticles(origin, n, color, spread, speed){
  const c=new THREE.Color(color||0xa99bff);
  for(let i=0;i<n;i++){
    const p=particlePool[particleHead];
    particleHead=(particleHead+1)%PARTICLE_MAX;
    p.x=origin.x; p.y=origin.y; p.z=origin.z;
    // direction : vers l'extérieur + dispersion
    const dir=origin.clone().normalize();
    const rnd=new THREE.Vector3((Math.random()-0.5),(Math.random()-0.5),(Math.random()-0.5)).multiplyScalar(spread||1);
    const vel=dir.multiplyScalar(speed||0.06).add(rnd.multiplyScalar(0.03));
    p.vx=vel.x; p.vy=vel.y; p.vz=vel.z;
    p.life=1; p.r=c.r; p.g=c.g; p.b=c.b;
  }
}
function updateParticles(dt){
  if(!particleSys) return;
  const pos=particleSys.geometry.attributes.position.array;
  const col=particleSys.geometry.attributes.color.array;
  for(let i=0;i<PARTICLE_MAX;i++){
    const p=particlePool[i];
    if(p.life>0){
      p.life-=dt*1.4;
      p.x+=p.vx; p.y+=p.vy; p.z+=p.vz;
      // légère attraction vers la planète (gravité)
      const d=Math.hypot(p.x,p.y,p.z)||1;
      const g=0.0006;
      p.vx-=p.x/d*g; p.vy-=p.y/d*g; p.vz-=p.z/d*g;
      pos[i*3]=p.x; pos[i*3+1]=p.y; pos[i*3+2]=p.z;
      const l=Math.max(0,p.life);
      col[i*3]=p.r*l; col[i*3+1]=p.g*l; col[i*3+2]=p.b*l;
    } else {
      pos[i*3+1]=-9999;
    }
  }
  particleSys.geometry.attributes.position.needsUpdate=true;
  particleSys.geometry.attributes.color.needsUpdate=true;
}

// ---- bruit (fbm) JS, pour relief & placement ----
function hash3(x,y,z){ let h=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453; return h-Math.floor(h); }
function noise3(x,y,z){
  const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z);
  const xf=x-xi,yf=y-yi,zf=z-zi;
  const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),w=zf*zf*(3-2*zf);
  function H(a,b,c){return hash3(xi+a,yi+b,zi+c);}
  return lerp(lerp(lerp(H(0,0,0),H(1,0,0),u),lerp(H(0,1,0),H(1,1,0),u),v),
              lerp(lerp(H(0,0,1),H(1,0,1),u),lerp(H(0,1,1),H(1,1,1),u),v),w);
}
function fbm(x,y,z){ let a=0.5,s=0; for(let i=0;i<4;i++){ s+=a*noise3(x,y,z); x*=2.03;y*=2.03;z*=2.03;a*=0.5; } return s; }
function lerp(a,b,t){return a+(b-a)*t;}

// ============================================================
//   Bâtiments : géométries
// ============================================================
function makeBuildingMesh(id){
  const def=BUILDING_MESH[id]||{h:0.3,color:0xcccccc,emissive:0,shape:"box"};
  // échelle : un bâtiment fait au max ~6 % du rayon de la planète (def.h∈[0.08..0.7])
  const h=def.h*PLANET_R*0.10;
  const mat=new THREE.MeshStandardMaterial({
    color:def.color, roughness:0.6, metalness:0.25,
    emissive:new THREE.Color(def.emissive||0x000000),
    emissiveIntensity:def.emissive?0.9:0.0,
  });
  let g;
  switch(def.shape){
    case "cone": g=new THREE.ConeGeometry(h*0.5,h,6); break;
    case "hut": g=new THREE.ConeGeometry(h*0.7,h,5); break;
    case "flat": g=new THREE.BoxGeometry(h*1.6,h*0.3,h*1.6); break;
    case "temple": g=new THREE.CylinderGeometry(h*0.5,h*0.6,h,6); break;
    case "tower": g=new THREE.CylinderGeometry(h*0.25,h*0.35,h,7); break;
    case "city": g=new THREE.BoxGeometry(h*0.7,h,h*0.7); break;
    case "factory": g=new THREE.BoxGeometry(h*0.9,h*0.8,h*0.9); break;
    case "dome": g=new THREE.SphereGeometry(h*0.6,12,8,0,Math.PI*2,0,Math.PI/2); break;
    case "obelisk": g=new THREE.ConeGeometry(h*0.28,h*1.4,4); break;
    case "ring": g=new THREE.TorusGeometry(h*0.6,h*0.14,8,16); break;
    case "sat": g=new THREE.OctahedronGeometry(h*0.6,0); break;
    default: g=new THREE.BoxGeometry(h*0.6,h,h*0.6);
  }
  const mesh=new THREE.Mesh(g,mat);
  mesh.userData.height=h;
  mesh.userData.shape=def.shape;
  return mesh;
}

// place un mesh sur un slot de la sphère, orienté vers l'extérieur
function placeOnSurface(mesh, slotIdx){
  const dir=SLOTS[slotIdx % SLOTS.length];
  const surfaceR=PLANET_R*1.0;
  tmpV.copy(dir).multiplyScalar(surfaceR);
  // hauteur : poser la base sur la surface
  const h=mesh.userData.height||0.3;
  const up=dir.clone();
  mesh.position.copy(tmpV).addScaledVector(up, h*0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), up);
  mesh.userData.slotIdx=slotIdx;
}

// ---- Synchronisation depuis l'état du jeu ----
// counts: {id: count}. On instancie jusqu'à un plafond visuel par type.
const VISUAL_CAP=12;
function syncBuildings(counts){
  if(!ok) return;
  let slotCursor=0;
  for(const id in BUILDING_MESH){
    const want=Math.min(counts[id]||0, VISUAL_CAP);
    if(!buildingNodes[id]) buildingNodes[id]={meshes:[], orbit:!!(BUILDING_MESH[id].orbit)};
    const node=buildingNodes[id];
    // ajoute les manquants
    while(node.meshes.length < want){
      const m=makeBuildingMesh(id);
      m.userData.bid=id;
      m.scale.setScalar(0.01); // anim d'apparition
      if(node.orbit){ orbitGroup.add(m); node._needOrbit=true; }
      else slotsGroup.add(m);
      node.meshes.push(m);
      pickList.push(m);
      m.userData._spawnT=performance.now();
    }
    // retire le surplus (prestige/reset)
    while(node.meshes.length > want){
      const m=node.meshes.pop();
      (node.orbit?orbitGroup:slotsGroup).remove(m);
      const pi=pickList.indexOf(m); if(pi>=0) pickList.splice(pi,1);
      m.geometry.dispose(); m.material.dispose();
    }
  }
  // (re)placement déterministe : on parcourt les types dans l'ordre, slots consécutifs
  slotCursor=0;
  let orbitIdx=0;
  for(const id in BUILDING_MESH){
    const node=buildingNodes[id]; if(!node) continue;
    for(let k=0;k<node.meshes.length;k++){
      const m=node.meshes[k];
      if(node.orbit){
        // disposition orbitale : anneau autour de la planète
        m.userData.orbitR=PLANET_R*(1.9+0.25*(orbitIdx%3));
        m.userData.orbitSpeed=0.12+0.04*(orbitIdx%4);
        m.userData.orbitPhase=(orbitIdx*1.7)%(Math.PI*2);
        m.userData.orbitTilt=(orbitIdx%2?0.4:-0.3);
        orbitIdx++;
      }else{
        placeOnSurface(m, slotCursor++);
      }
    }
  }
}

// ---- Interaction ----
function bindInput(canvas){
  canvas.addEventListener("pointerdown", e=>{
    dragging=true; lastX=e.clientX; lastY=e.clientY; autoRotate=false; idleT=0;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    pointerNDC._downX=e.clientX; pointerNDC._downY=e.clientY;
  });
  canvas.addEventListener("pointermove", e=>{
    if(!dragging) return;
    const dx=e.clientX-lastX, dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY;
    camTheta -= dx*0.005;
    camPhi = Math.max(0.25, Math.min(Math.PI-0.25, camPhi - dy*0.005));
  });
  canvas.addEventListener("pointerup", e=>{
    dragging=false;
    const dx=Math.abs(e.clientX-(pointerNDC._downX||0)), dy=Math.abs(e.clientY-(pointerNDC._downY||0));
    if(dx<6 && dy<6) handleClick(e.clientX,e.clientY); // c'était un clic, pas un drag
    setTimeout(()=>autoRotate=true, 4000);
  });
  canvas.addEventListener("wheel", e=>{
    e.preventDefault();
    camDistTarget=Math.max(12, Math.min(48, camDistTarget + e.deltaY*0.012));
  }, {passive:false});
  // pinch zoom
  canvas.addEventListener("touchstart", e=>{ if(e.touches.length===2){
    pinchDistStart=touchDist(e); pinchStart=camDistTarget; } });
  canvas.addEventListener("touchmove", e=>{ if(e.touches.length===2){
    e.preventDefault(); const d=touchDist(e);
    camDistTarget=Math.max(12,Math.min(48, pinchStart*(pinchDistStart/Math.max(1,d)))); } }, {passive:false});
}
function touchDist(e){ const a=e.touches[0],b=e.touches[1];
  return Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY); }

function handleClick(px,py){
  pointerNDC.x=(px/innerWidth)*2-1;
  pointerNDC.y=-(py/innerHeight)*2+1;
  raycaster.setFromCamera(pointerNDC, camera);
  const hits=raycaster.intersectObjects(pickList, false);
  if(hits.length){
    const m=hits[0].object;
    spawnHitFX(m);
    emitParticles(hits[0].point, 14, ageBlend("emis").getHex(), 1.2, 0.07);
    if(pickCallback) pickCallback(m.userData.bid, m, hits[0].point);
    return;
  }
  // clic sur la planète elle-même ?
  const ph=raycaster.intersectObject(planet, false);
  if(ph.length){
    emitParticles(ph[0].point, 18, 0xa9c2ff, 0.9, 0.08);
    if(emptyClickCallback) emptyClickCallback(ph[0].point);
    pulse=Math.min(pulse+0.8,1.6);
  }
}
function spawnHitFX(m){
  m.userData._hitT=performance.now();
}

// callbacks publics
function onPick(fn){ pickCallback=fn; }
function onWorldClick(fn){ emptyClickCallback=fn; }

// ---- Caméra ----
function updateCamera(instant){
  const t=camTheta, p=camPhi;
  const x=camDist*Math.sin(p)*Math.cos(t);
  const y=camDist*Math.cos(p);
  const z=camDist*Math.sin(p)*Math.sin(t);
  camera.position.set(x,y,z);
  camera.lookAt(0,0,0);
}

// ---- Thème par âge ----
function applyAgeVisual(){
  if(!planetMat) return;
  planetMat.color.copy(ageBlend("land"));
  planetMat.emissive.copy(ageBlend("emis"));
  planetMat.emissiveIntensity=0.10 + 0.05*Math.min(ageF,2) + (ageF>6? (ageF-6)*0.25:0);
  atmosphere.material.color.copy(ageBlend("atm"));
  atmosphere.material.opacity=0.12+0.03*ageF;
  sunLight.color.copy(lerpColor(0xfff2d8, 0xcfe0ff, Math.min(ageF/8,1)));
  // noyau de transcendance
  const tr=Math.max(0,(ageF-7)/1.5);
  coreGlow.material.opacity=tr*0.5;
  coreGlow.scale.setScalar(1+tr*0.15+pulse*0.05);
  scene.fog.color.setHex(ageF>5?0x070a16:0x05050e);

  // nuages : apparaissent dès qu'il y a de la vie (Antiquité), disparaissent à la Transcendance
  if(cloudMesh){
    const cl=Math.min(1, Math.max(0, (ageF-0.5)/2)) * Math.max(0, 1-tr);
    cloudMesh.material.opacity=cl*0.5;
    cloudMesh.material.color.copy(lerpColor(0xffffff, 0xbfcfff, Math.min(ageF/8,1)));
  }
  // anneau planétaire : ère spatiale → transcendance
  if(ringMesh){
    const rg=Math.min(1, Math.max(0, (ageF-6.5)/1.5));
    ringMesh.material.opacity=rg*0.5;
    ringMesh.material.color.copy(ageBlend("atm"));
  }
}

// ---- Caméra cinématique (transition d'âge) ----
function cinematicAge(){
  // zoom rapproché puis recul, et petit tour
  const startDist=camDist;
  camAnim={t:0, dur:2200, fromDist:startDist, toClose:13, fromTheta:camTheta};
}
function tickCamAnim(dt){
  if(!camAnim) return false;
  camAnim.t+=dt*1000;
  const k=Math.min(1, camAnim.t/camAnim.dur);
  // courbe : plonge (0→0.4), tient (0.4→0.6), recule (0.6→1)
  let d;
  if(k<0.4){ const e=easeInOut(k/0.4); d=lerp(camAnim.fromDist, camAnim.toClose, e); }
  else if(k<0.6){ d=camAnim.toClose; }
  else { const e=easeInOut((k-0.6)/0.4); d=lerp(camAnim.toClose, camDistTarget, e); }
  camDist=d;
  camTheta=camAnim.fromTheta + k*0.9; // panoramique
  if(k>=1){ camAnim=null; return false; }
  return true;
}
function easeInOut(x){ return x<0.5? 2*x*x : 1-Math.pow(-2*x+2,2)/2; }

// ---- Boucle ----
let _lastFrame=0;
function animate(){
  if(!ok) return;
  raf=requestAnimationFrame(animate);
  const now=performance.now();
  const dt=Math.min(0.05, (now-(_lastFrame||now))/1000); _lastFrame=now;

  // lissages
  ageF += (ageTarget-ageF)*0.04;
  pulse *= 0.92;

  // caméra : animation cinématique prioritaire, sinon lissage normal
  if(!tickCamAnim(dt)){
    camDist += (camDistTarget-camDist)*0.1;
    if(autoRotate){ idleT++; camTheta += 0.0009; }
  }
  updateCamera();

  // particules 3D
  updateParticles(dt);

  // rotation planète + couches
  if(planet){ planet.rotation.y += 0.0016; }
  if(cloudMesh){ cloudMesh.rotation.y += 0.0009; cloudMesh.rotation.x += 0.0001; }
  if(ringMesh){ ringMesh.rotation.z += 0.0004; }
  if(starfield){ starfield.rotation.y += 0.00015; }

  // anims d'apparition + hit + orbites
  for(const id in buildingNodes){
    const node=buildingNodes[id];
    for(const m of node.meshes){
      // spawn pop
      const st=m.userData._spawnT;
      if(st!=null){
        const k=Math.min(1,(now-st)/350);
        const s=easeOutBack(k);
        m.scale.setScalar(s);
        if(k>=1) m.userData._spawnT=null;
      }
      // hit bounce
      const ht=m.userData._hitT;
      if(ht!=null){
        const k=(now-ht)/250;
        if(k>=1){ m.userData._hitT=null; }
        else { const b=1+Math.sin(k*Math.PI)*0.25; m.scale.setScalar(b); }
      }
      // orbites
      if(node.orbit){
        const r=m.userData.orbitR||PLANET_R*2;
        const sp=m.userData.orbitSpeed||0.1;
        const ph=(m.userData.orbitPhase||0)+now*0.001*sp;
        const tilt=m.userData.orbitTilt||0;
        m.position.set(Math.cos(ph)*r, Math.sin(ph)*r*Math.sin(tilt), Math.sin(ph)*r*Math.cos(tilt));
        m.rotation.y += 0.02;
      }
    }
  }

  applyAgeVisual();
  renderer.render(scene, camera);
}
function easeOutBack(x){ const c1=1.70158,c3=c1+1; return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2); }

function resize(){
  if(!ok) return;
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
}

// ---- API publique ----
window.World={
  init,
  isActive(){ return ok; },
  setAge(a,instant){
    const rising = a>prevAgeInt && prevAgeInt>=0 && !instant && ok;
    ageTarget=a;
    if(instant){ ageF=a; if(applyAgeVisual) applyAgeVisual(); }
    else if(rising && ok){
      // transition cinématique + gerbe de particules dorées
      cinematicAge();
      emitParticles(new THREE.Vector3(0, PLANET_R*1.1, 0), 120, 0xffe07a, 2.2, 0.12);
      pulse=Math.min(pulse+1.2,1.8);
    }
    prevAgeInt=Math.floor(a);
  },
  ping(s){ pulse=Math.min(pulse+(s||0.5),1.6); },
  syncBuildings,
  onPick, onWorldClick,
  focusBuilding(id){
    const node=buildingNodes[id]; if(!node||!node.meshes.length) return;
    const m=node.meshes[0]; spawnHitFX(m);
    if(m.position) emitParticles(m.position.clone(), 12, 0x9affc2, 0.8, 0.05);
  },
  // gerbe spectaculaire (transcendance)
  transcendBurst(){
    if(!ok) return;
    emitParticles(new THREE.Vector3(0,0,0), 300, 0xfff0b8, 3.0, 0.16);
    pulse=1.8; cinematicAge();
  },
  resize,
};

})();
