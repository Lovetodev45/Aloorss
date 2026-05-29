/* ============================================================
   ÆON — FRACTALE DE CIVILISATION (Ensemble de Julia, WebGL)
   Une VRAIE fractale : auto-similaire, détail infini, zoom réel
   sans flou. Le paramètre c et la palette sont dérivés de TES
   choix (âge, héritages, doctrines, bâtiments). Rendue par un
   shader sur un seul quad → ultra léger (le GPU fait tout).
   Zoom / déplacement fluides. Repli Canvas 2D si WebGL absent.
   Expose window.Palim.
   ============================================================ */
(function(){
"use strict";

let cv, gl, prog, ok=false, raf=null, hidden=false;
let uni={}, W=0, H=0, dpr=1, lastFrame=0, t0=0;
let state=null, lastSig="";
let ok2d=false, ctx2d=null;     // repli Canvas 2D
// caméra
let zoom=1, zoomT=1, cx=0, cy=0, drag=false, lx=0, ly=0, pinchD0=0, pinch0=1;
// paramètres de la fractale (lissés vers leurs cibles → transitions douces)
let cRe=0, cIm=0, cReT=-0.4, cImT=0.6;
let colA=[0.1,0.12,0.2], colB=[0.9,0.7,0.3], colC=[0.4,0.6,1.0];
let colAT=colA.slice(), colBT=colB.slice(), colCT=colC.slice();
let iterF=160, iterT=160, wakeUntil=0;

function lerp(a,b,t){return a+(b-a)*t;}

// ---------- shaders ----------
const VERT=`attribute vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }`;
const FRAG=`
precision highp float;
uniform vec2 uRes;
uniform vec2 uC;          // paramètre de Julia
uniform vec2 uCenter;     // déplacement
uniform float uZoom;
uniform float uTime;
uniform float uIter;      // nb d'itérations
uniform vec3 uA,uB,uC2;   // palette (3 couleurs)
// couleur douce par interpolation
vec3 pal(float t){
  t=clamp(t,0.0,1.0);
  if(t<0.5){ return mix(uA,uB,t*2.0); }
  return mix(uB,uC2,(t-0.5)*2.0);
}
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*uRes)/uRes.y;   // -0.5..0.5 (ratio corrigé)
  // coordonnée dans le plan complexe (zoom réel : on divise par uZoom)
  vec2 z=uv*(3.0/uZoom)+uCenter;
  vec2 c=uC;
  float n=0.0; float m=uIter;
  float smoothv=0.0;
  for(int i=0;i<1000;i++){
    if(float(i)>=m) break;
    // z = z^2 + c
    z=vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
    if(dot(z,z)>16.0){
      // lissage (smooth iteration count) → dégradés continus, pas de bandes
      smoothv=float(i) - log2(log2(dot(z,z))) + 4.0;
      n=1.0; break;
    }
  }
  if(n<0.5){
    // intérieur : sombre, légère respiration
    gl_FragColor=vec4(uA*0.35,1.0);
  } else {
    float t=smoothv/m;
    // animation très douce de la teinte
    vec3 col=pal(fract(t*3.0 + uTime*0.02));
    // halo lumineux près du bord
    col+=pal(t)*0.5;
    gl_FragColor=vec4(col,1.0);
  }
}`;

function compile(type,src){ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){ console.warn("shader",gl.getShaderInfoLog(s)); return null; } return s; }

function init(){
  cv=document.getElementById("palim"); if(!cv) return false;
  gl=cv.getContext("webgl",{antialias:true,alpha:false,powerPreference:"high-performance"})||cv.getContext("experimental-webgl");
  if(!gl){ return init2D(); }   // repli si pas de WebGL
  const vs=compile(gl.VERTEX_SHADER,VERT), fs=compile(gl.FRAGMENT_SHADER,FRAG);
  if(!vs||!fs){ return init2D(); }
  prog=gl.createProgram(); gl.attachShader(prog,vs); gl.attachShader(prog,fs); gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){ console.warn(gl.getProgramInfoLog(prog)); return init2D(); }
  gl.useProgram(prog);
  const buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(prog,"p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  ["uRes","uC","uCenter","uZoom","uTime","uIter","uA","uB","uC2"].forEach(n=>uni[n]=gl.getUniformLocation(prog,n));
  sizeCanvas(); bindInput();
  addEventListener("resize",debounce(sizeCanvas,200));
  document.addEventListener("visibilitychange",()=>{ hidden=document.hidden; if(!hidden) loop(); });
  ok=true; t0=performance.now(); loop();
  return true;
}
function debounce(fn,ms){ let t; return(...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }
function sizeCanvas(){
  dpr=Math.min(devicePixelRatio||1, /android|iphone|ipad/i.test(navigator.userAgent)?1.5:2);
  const r=cv.getBoundingClientRect();
  W=Math.max(280,Math.floor((r.width||cv.clientWidth||640)));
  H=Math.max(280,Math.floor((r.height||cv.clientHeight||480)));
  cv.width=Math.floor(W*dpr); cv.height=Math.floor(H*dpr);
  if(gl) gl.viewport(0,0,cv.width,cv.height);
}

// ============================================================
//  Paramètres dérivés des choix du joueur
// ============================================================
function sync(s){
  if(!ok && !ok2d) return;
  state=s||state; const sig=stateSig();
  if(sig===lastSig) return; lastSig=sig;
  computeParams();
}
function stateSig(){ const s=state||{}; const b=s.buildings||{};
  let t=0; for(const k in b) t+=b[k]||0;
  return (s.age||0)+"|"+(s.techs||0)+"|"+JSON.stringify(s.legacies||{})+"|"+JSON.stringify(s.doctrines||{})+"|"+t; }

// jolis points c (chacun donne une forme de Julia spectaculaire et connue)
const C_PRESETS=[
  [-0.40,0.60],[-0.70,0.27],[-0.835,-0.232],[0.285,0.01],[-0.8,0.156],
  [-0.7269,0.1889],[0.45,0.1428],[-0.162,1.04],[-0.79,0.15]
];
function computeParams(){
  const s=state||{}; const age=Math.max(0,Math.min(8,s.age||0));
  const leg=s.legacies||{}, doc=s.doctrines||{};
  const lc=(id)=>leg[id]||0;
  // base : preset selon l'âge (la forme évolue à chaque ère)
  let [re,im]=C_PRESETS[age];
  // les héritages déplacent finement c → forme propre à TES choix
  re+= lc("ambition")*0.012 - lc("harmonie")*0.010;
  im+= lc("curiosite")*0.012 - lc("sagesse")*0.008;
  // les doctrines inclinent encore
  if(doc.doctrine_anc==="chasse") re+=0.03; else if(doc.doctrine_anc==="cueillette") im+=0.03;
  if(doc.doctrine_med==="foi") im+=0.02; else if(doc.doctrine_med==="raison") re-=0.02;
  if(doc.doctrine_ind==="capital") re+=0.015; else if(doc.doctrine_ind==="ouvrier") im-=0.015;
  if(doc.doctrine_ia==="fusion_ia") im+=0.025; else if(doc.doctrine_ia==="servir_ia") re-=0.02;
  cReT=re; cImT=im;
  // itérations : plus on avance, plus c'est détaillé (borné pour la perf)
  iterT=120+age*30+Math.min(120,(s.techs||0)*6);
  // palette : teinte par âge + dominante de ressource
  const PAL=[
    [[0.10,0.04,0.03],[0.85,0.45,0.15],[0.98,0.8,0.4]],   // Pierre braise
    [[0.06,0.06,0.04],[0.80,0.62,0.22],[0.98,0.9,0.5]],   // Antiquité or
    [[0.04,0.05,0.12],[0.55,0.3,0.6],[0.95,0.8,0.45]],    // Moyen Âge pourpre/or
    [[0.04,0.10,0.10],[0.25,0.7,0.6],[0.95,0.92,0.7]],    // Renaissance émeraude
    [[0.08,0.06,0.04],[0.75,0.5,0.2],[0.95,0.85,0.6]],    // Industrielle laiton
    [[0.02,0.06,0.12],[0.2,0.6,0.85],[0.7,0.95,1.0]],     // Information cyan
    [[0.06,0.03,0.12],[0.55,0.25,0.85],[0.85,0.7,1.0]],   // IA violet
    [[0.03,0.05,0.14],[0.3,0.45,0.9],[0.8,0.88,1.0]],     // Spatiale bleu
    [[0.10,0.08,0.14],[0.7,0.55,0.9],[1.0,0.95,0.75]],    // Transcendance iridescent
  ][age];
  colAT=PAL[0].slice(); colBT=PAL[1].slice(); colCT=PAL[2].slice();
  wake();
}

// ============================================================
//  Interaction zoom / déplacement
// ============================================================
function bindInput(){
  cv.style.touchAction="none"; cv.style.cursor="grab";
  cv.addEventListener("pointerdown",e=>{ drag=true; lx=e.clientX; ly=e.clientY; cv.style.cursor="grabbing"; cv.setPointerCapture&&cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove",e=>{ if(!drag)return;
    cx-=(e.clientX-lx)/(H*0.5)*(1.5/zoom); cy+=(e.clientY-ly)/(H*0.5)*(1.5/zoom);
    lx=e.clientX; ly=e.clientY; wake(); });
  cv.addEventListener("pointerup",()=>{ drag=false; cv.style.cursor="grab"; });
  cv.addEventListener("wheel",e=>{ e.preventDefault(); zoomT=Math.max(0.5,Math.min(4000, zoomT*(e.deltaY<0?1.2:0.83))); wake(); },{passive:false});
  cv.addEventListener("touchstart",e=>{ if(e.touches.length===2){ pinchD0=tdist(e); pinch0=zoomT; } });
  cv.addEventListener("touchmove",e=>{ if(e.touches.length===2){ e.preventDefault(); zoomT=Math.max(0.5,Math.min(4000, pinch0*(tdist(e)/Math.max(1,pinchD0)))); wake(); } },{passive:false});
  cv.addEventListener("dblclick",()=>{ zoomT=1; cx=cy=0; wake(); });
}
function tdist(e){ const a=e.touches[0],b=e.touches[1]; return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY); }
function wake(){ if(ok2d){ draw2D(); return; } wakeUntil=performance.now()+1500; if(!raf) loop(); }

// ============================================================
//  Boucle de rendu (GPU)
// ============================================================
function loop(now){
  if(!ok) return;
  now=now||performance.now();
  // lissage doux des paramètres
  cRe+=(cReT-cRe)*0.06; cIm+=(cImT-cIm)*0.06;
  zoom+=(zoomT-zoom)*0.12; iterF+=(iterT-iterF)*0.08;
  for(let i=0;i<3;i++){ colA[i]+=(colAT[i]-colA[i])*0.06; colB[i]+=(colBT[i]-colB[i])*0.06; colC[i]+=(colCT[i]-colC[i])*0.06; }

  gl.uniform2f(uni.uRes,cv.width,cv.height);
  gl.uniform2f(uni.uC,cRe,cIm);
  gl.uniform2f(uni.uCenter,cx,cy);
  gl.uniform1f(uni.uZoom,zoom);
  gl.uniform1f(uni.uTime,(now-t0)/1000);
  gl.uniform1f(uni.uIter,iterF);
  gl.uniform3fv(uni.uA,colA); gl.uniform3fv(uni.uB,colB); gl.uniform3fv(uni.uC2,colC);
  gl.drawArrays(gl.TRIANGLES,0,3);

  // anime en continu tant que visible (le shader respire doucement) ; coût GPU minime
  if(!hidden) raf=requestAnimationFrame(loop); else raf=null;
}

// ============================================================
//  Repli Canvas 2D (si WebGL indisponible) — Julia en JS, basse résolution
// ============================================================
function init2D(){
  ctx2d=cv.getContext("2d"); if(!ctx2d) return false;
  sizeCanvas(); bindInput();
  addEventListener("resize",debounce(()=>{ sizeCanvas(); lastSig=""; computeParams(); draw2D(); },200));
  ok2d=true; ok=true; // ok=true pour que sync fonctionne
  computeParams(); draw2D();
  // pas de boucle animée en 2D (trop coûteux) : on redessine sur interaction
  return true;
}
function draw2D(){
  if(!ctx2d) return;
  const w=Math.min(360,cv.width), h=Math.min(360,cv.height); // basse résolution puis upscale
  const img=ctx2d.createImageData(w,h), d=img.data;
  const it=Math.min(120,iterF);
  for(let py=0;py<h;py++)for(let px=0;px<w;px++){
    let zx=( (px/w-0.5)*3/zoom )+cx, zy=( (py/h-0.5)*3/zoom )+cy, i=0;
    for(;i<it;i++){ const xt=zx*zx-zy*zy+cReT; zy=2*zx*zy+cImT; zx=xt; if(zx*zx+zy*zy>16) break; }
    const t=i/it, o=(py*w+px)*4;
    const c = i>=it ? [colAT[0]*90,colAT[1]*90,colAT[2]*90]
                    : [ (colBT[0]*255)*(0.4+t), (colBT[1]*255)*(0.4+t), (colCT[2]*255)*(0.4+t) ];
    d[o]=c[0]; d[o+1]=c[1]; d[o+2]=c[2]; d[o+3]=255;
  }
  // upscale sur le canvas plein
  const tmp=document.createElement("canvas"); tmp.width=w; tmp.height=h; tmp.getContext("2d").putImageData(img,0,0);
  ctx2d.imageSmoothingEnabled=true; ctx2d.clearRect(0,0,cv.width,cv.height);
  ctx2d.drawImage(tmp,0,0,cv.width,cv.height);
}
window.Palim={
  init, isActive(){ return ok; }, sync,
  inkDrop(){ /* la fractale n'a pas besoin de gouttes */ },
  resize(){ sizeCanvas(); if(ok2d) draw2D(); },
  recenter(){ zoomT=1; cx=cy=0; wake(); },
  setInk(){}
};
})();
