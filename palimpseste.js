/* ============================================================
   ÆON — LE PALIMPSESTE VIVANT (étape 1 : parchemin + encre)
   Canvas 2D pur, zéro dépendance. Un manuscrit qui se tache
   d'encre dorée vivante au fil de tes éveils. Léger & fluide :
   - couche PARCHEMIN dessinée une seule fois (statique)
   - couche ENCRE : taches permanentes posées à l'événement
   - couche FX : gouttes animées (la seule boucle, throttlée, en
     pause si l'onglet est caché)
   Expose window.Palim.
   ============================================================ */
(function(){
"use strict";

let cv, ctx, W=0, H=0, dpr=1, ok=false, raf=null, hidden=false;
let parchment=null;        // canvas hors-écran : le fond (statique)
let inkCanvas=null, inkCtx=null;  // canvas hors-écran : taches permanentes
let drops=[];              // gouttes vivantes en cours d'animation
let lastFrame=0;

// teinte d'encre courante (évoluera avec l'âge plus tard)
let inkColor={r:201,g:164,b:74};   // or vieilli

function rnd(a,b){ return a+Math.random()*(b-a); }

// ---------- Parchemin (dessiné une fois) ----------
function buildParchment(){
  parchment=document.createElement("canvas");
  parchment.width=W; parchment.height=H;
  const p=parchment.getContext("2d");
  // fond profond, légèrement chaud vers le centre
  const g=p.createRadialGradient(W*0.5,H*0.42,Math.min(W,H)*0.1, W*0.5,H*0.5,Math.max(W,H)*0.75);
  g.addColorStop(0,"#0b0a12"); g.addColorStop(1,"#050509");
  p.fillStyle=g; p.fillRect(0,0,W,H);
  // grain de parchemin : milliers de points très discrets
  const n=Math.floor(W*H/2600);
  for(let i=0;i<n;i++){
    const x=Math.random()*W, y=Math.random()*H, a=Math.random()*0.04;
    p.fillStyle=`rgba(201,180,140,${a})`;
    p.fillRect(x,y,1,1);
  }
  // quelques fibres/veines très douces
  p.strokeStyle="rgba(160,140,100,0.05)"; p.lineWidth=1;
  for(let i=0;i<26;i++){
    p.beginPath(); let x=Math.random()*W, y=Math.random()*H;
    p.moveTo(x,y);
    for(let k=0;k<5;k++){ x+=rnd(-60,60); y+=rnd(-40,40); p.lineTo(x,y); }
    p.stroke();
  }
  // vignette sombre sur les bords (cadre de page)
  const vg=p.createRadialGradient(W*0.5,H*0.5,Math.min(W,H)*0.3, W*0.5,H*0.5,Math.max(W,H)*0.7);
  vg.addColorStop(0,"rgba(0,0,0,0)"); vg.addColorStop(1,"rgba(0,0,0,0.55)");
  p.fillStyle=vg; p.fillRect(0,0,W,H);
}

// ---------- Init ----------
function init(){
  cv=document.getElementById("palim"); if(!cv) return false;
  ctx=cv.getContext("2d"); if(!ctx) return false;
  resize();
  addEventListener("resize", debounce(resize, 220));
  document.addEventListener("visibilitychange", ()=>{ hidden=document.hidden; if(!hidden) loop(); });
  ok=true; loop();
  return true;
}
function resize(){
  dpr=Math.min(devicePixelRatio||1, 2);
  W=innerWidth; H=innerHeight;
  cv.width=Math.floor(W*dpr); cv.height=Math.floor(H*dpr);
  cv.style.width=W+"px"; cv.style.height=H+"px";
  ctx.setTransform(dpr,0,0,dpr,0,0);
  buildParchment();
  // (ré)alloue la couche d'encre permanente et la repeint
  const old=inkCanvas;
  inkCanvas=document.createElement("canvas"); inkCanvas.width=W; inkCanvas.height=H;
  inkCtx=inkCanvas.getContext("2d");
  if(old){ try{ inkCtx.drawImage(old,0,0,W,H); }catch(e){} }
}
function debounce(fn,ms){ let t; return(...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }

// ---------- Une tache d'encre permanente (posée immédiatement) ----------
function stainAt(x,y,radius){
  if(!inkCtx) return;
  const c=inkColor;
  // halo doux
  const g=inkCtx.createRadialGradient(x,y,0,x,y,radius);
  g.addColorStop(0,`rgba(${c.r},${c.g},${c.b},0.30)`);
  g.addColorStop(0.5,`rgba(${c.r},${c.g},${c.b},0.12)`);
  g.addColorStop(1,`rgba(${c.r},${c.g},${c.b},0)`);
  inkCtx.fillStyle=g; inkCtx.beginPath(); inkCtx.arc(x,y,radius,0,7); inkCtx.fill();
  // petites éclaboussures organiques autour
  const sp=3+Math.floor(radius/6);
  for(let i=0;i<sp;i++){
    const a=Math.random()*7, d=rnd(radius*0.3,radius*1.1);
    const sx=x+Math.cos(a)*d, sy=y+Math.sin(a)*d, sr=rnd(1,radius*0.18);
    inkCtx.fillStyle=`rgba(${c.r},${c.g},${c.b},${rnd(0.05,0.18).toFixed(3)})`;
    inkCtx.beginPath(); inkCtx.arc(sx,sy,sr,0,7); inkCtx.fill();
  }
}

// ---------- API : goutte d'encre vivante (au clic d'éveil) ----------
function inkDrop(x,y,strength){
  if(!ok) return;
  strength=strength||1;
  // si pas de position fournie, tombe vers le centre-haut
  if(x==null){ x=W*0.5+rnd(-W*0.12,W*0.12); y=H*0.34+rnd(-30,30); }
  drops.push({x,y, r:0, max:rnd(14,26)*Math.min(2,strength), life:1, vy:rnd(8,18)});
  if(hidden) loop();
}

// ---------- Boucle (seule couche animée) ----------
function loop(now){
  if(!ok) return;
  now=now||performance.now();
  const dt=Math.min(0.05,(now-(lastFrame||now))/1000); lastFrame=now;

  // composition : parchemin + encre permanente + gouttes vivantes
  ctx.clearRect(0,0,W,H);
  if(parchment) ctx.drawImage(parchment,0,0,W,H);
  if(inkCanvas) ctx.drawImage(inkCanvas,0,0,W,H);

  // gouttes animées
  const c=inkColor;
  for(let i=drops.length-1;i>=0;i--){
    const d=drops[i];
    d.r+=(d.max-d.r)*0.18;        // s'épanouit
    d.y+=d.vy*dt;                  // coule légèrement vers le bas
    d.vy*=0.96; d.life-=dt*0.9;
    const a=Math.max(0,d.life);
    const g=ctx.createRadialGradient(d.x,d.y,0,d.x,d.y,Math.max(1,d.r));
    g.addColorStop(0,`rgba(${c.r},${c.g},${c.b},${(0.5*a).toFixed(3)})`);
    g.addColorStop(0.6,`rgba(${c.r},${c.g},${c.b},${(0.18*a).toFixed(3)})`);
    g.addColorStop(1,`rgba(${c.r},${c.g},${c.b},0)`);
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(d.x,d.y,Math.max(1,d.r),0,7); ctx.fill();
    // quand la goutte a fini de s'épanouir, on fixe une tache permanente puis on la retire
    if(d.life<=0.35 && !d._stained){ d._stained=true; stainAt(d.x,d.y,d.r*0.9); }
    if(d.life<=0) drops.splice(i,1);
  }

  // throttle : si plus aucune goutte vivante et onglet visible, on se met en veille
  if(drops.length>0 && !hidden){ raf=requestAnimationFrame(loop); }
  else { raf=null; }
}

// ---------- API publique ----------
window.Palim={
  init,
  isActive(){ return ok; },
  inkDrop,
  setInk(r,g,b){ inkColor={r,g,b}; },   // pour faire évoluer la teinte (âges, héritages — étapes suivantes)
  resize,
};

})();
