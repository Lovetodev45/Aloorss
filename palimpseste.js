/* ============================================================
   ÆON — LE PALIMPSESTE VIVANT
   Une fresque qui se dessine selon TA partie : chaque bâtiment
   devient une vignette enluminée, chaque découverte une ligne
   calligraphiée, l'encre coule à chaque éveil. Canvas 2D pur.
   Couches bufferisées (parchemin statique + fresque redessinée
   seulement quand l'état change + gouttes animées throttlées).
   Expose window.Palim.
   ============================================================ */
(function(){
"use strict";

let cv, ctx, W=0, H=0, dpr=1, ok=false, raf=null, hidden=false;
let parchment=null;            // fond statique
let fresco=null, fctx=null;    // fresque (vignettes+texte+nervures) — redessinée à l'événement
let drops=[];                  // gouttes vivantes (clic)
let lastFrame=0, shimmer=0;
let inkColor={r:201,g:164,b:74};
let lastSig="";                // signature d'état (pour ne redessiner que si ça change)

function rnd(a,b){ return a+Math.random()*(b-a); }
// PRNG déterministe à partir d'une chaîne → positions stables (même fresque au reload)
function seed(str){ let h=2166136261; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return ()=>{ h+=0x6D2B79F5; let t=h; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }

// ---------- INIT ----------
function init(){
  cv=document.getElementById("palim"); if(!cv) return false;
  ctx=cv.getContext("2d"); if(!ctx) return false;
  resize();
  addEventListener("resize", debounce(()=>{ resize(); lastSig=""; redrawIfNeeded(true); }, 220));
  document.addEventListener("visibilitychange", ()=>{ hidden=document.hidden; if(!hidden) tick(); });
  ok=true;
  compose();           // affiche le parchemin tout de suite
  return true;
}
function debounce(fn,ms){ let t; return(...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }
function resize(){
  dpr=Math.min(devicePixelRatio||1, 2);
  W=innerWidth; H=innerHeight;
  cv.width=Math.floor(W*dpr); cv.height=Math.floor(H*dpr);
  cv.style.width=W+"px"; cv.style.height=H+"px";
  ctx.setTransform(dpr,0,0,dpr,0,0);
  buildParchment();
  fresco=document.createElement("canvas"); fresco.width=W; fresco.height=H;
  fctx=fresco.getContext("2d");
}

// ---------- Parchemin (visible, chaud) ----------
function buildParchment(){
  parchment=document.createElement("canvas"); parchment.width=W; parchment.height=H;
  const p=parchment.getContext("2d");
  const g=p.createRadialGradient(W*0.5,H*0.4,Math.min(W,H)*0.05, W*0.5,H*0.55,Math.max(W,H)*0.85);
  g.addColorStop(0,"#332a1a"); g.addColorStop(0.5,"#241d12"); g.addColorStop(1,"#0c0a10");
  p.fillStyle=g; p.fillRect(0,0,W,H);
  const n=Math.floor(W*H/1600);
  for(let i=0;i<n;i++){ p.fillStyle=`rgba(225,205,155,${Math.random()*0.06})`; p.fillRect(Math.random()*W,Math.random()*H,1,1); }
  p.strokeStyle="rgba(190,165,115,0.06)"; p.lineWidth=1;
  for(let i=0;i<30;i++){ p.beginPath(); let x=Math.random()*W,y=Math.random()*H; p.moveTo(x,y);
    for(let k=0;k<5;k++){ x+=rnd(-70,70); y+=rnd(-46,46); p.lineTo(x,y); } p.stroke(); }
  for(let i=0;i<5;i++){ const x=rnd(W*0.15,W*0.85),y=rnd(H*0.2,H*0.8),r=rnd(50,130);
    const tg=p.createRadialGradient(x,y,r*0.4,x,y,r); tg.addColorStop(0,"rgba(90,70,40,0.12)"); tg.addColorStop(1,"rgba(90,70,40,0)");
    p.fillStyle=tg; p.beginPath(); p.arc(x,y,r,0,7); p.fill(); }
  // cadre doré enluminé
  const m=Math.min(W,H)*0.05;
  p.strokeStyle="rgba(201,164,74,0.30)"; p.lineWidth=2; p.strokeRect(m,m,W-2*m,H-2*m);
  p.strokeStyle="rgba(201,164,74,0.15)"; p.lineWidth=1; p.strokeRect(m+6,m+6,W-2*m-12,H-2*m-12);
  const vg=p.createRadialGradient(W*0.5,H*0.5,Math.min(W,H)*0.4, W*0.5,H*0.5,Math.max(W,H)*0.72);
  vg.addColorStop(0,"rgba(0,0,0,0)"); vg.addColorStop(1,"rgba(0,0,0,0.45)");
  p.fillStyle=vg; p.fillRect(0,0,W,H);
}

// ============================================================
//  La FRESQUE — dessinée selon l'état du jeu (vignettes + texte)
// ============================================================
let _state={buildings:{}, techs:0, age:0, ink:inkColor};
// appelée par le jeu (render) : ne redessine que si l'état visuel a changé
function sync(state){
  if(!ok) return;
  _state=state||_state;
  if(state&&state.ink) inkColor=state.ink;
  redrawIfNeeded(false);
}
function stateSig(){
  const b=_state.buildings||{};
  let s=_state.age+"|"+(_state.techs||0)+"|";
  for(const k in b) s+=k+b[k]+",";
  return s;
}
function redrawIfNeeded(force){
  const sig=stateSig();
  if(!force && sig===lastSig) return;
  lastSig=sig;
  drawFresco();
  if(!raf) tick();   // recompose une fois
}

// Glyphes/formes par type de bâtiment (silhouette enluminée simple)
function vignetteShape(fc,x,y,r,res,sd){
  // couleur selon ressource
  const col = res==="know"? "#cdb56a" : res==="energy"? "#e0a24a" : res==="culture"? "#d6a0d0" : "#a8c4ff";
  fc.save(); fc.translate(x,y);
  fc.strokeStyle=col; fc.fillStyle=col; fc.lineWidth=1.4; fc.globalAlpha=0.85;
  // halo
  fc.globalAlpha=0.12; fc.beginPath(); fc.arc(0,0,r*1.6,0,7); fc.fill(); fc.globalAlpha=0.9;
  // petite "construction" : tours/toits stylisés, variés par seed
  const t=Math.floor(sd()*3);
  fc.beginPath();
  if(t===0){ // tours
    for(let i=-1;i<=1;i++){ const h=r*(0.8+sd()*0.8); fc.rect(i*r*0.6-r*0.18,-h, r*0.36, h); }
    fc.fill();
  } else if(t===1){ // dôme/temple
    fc.moveTo(-r,0); fc.lineTo(r,0); fc.lineTo(r*0.6,-r*0.7); fc.lineTo(0,-r*1.1); fc.lineTo(-r*0.6,-r*0.7); fc.closePath(); fc.fill();
  } else { // toits pointus (cité)
    for(let i=-1;i<=1;i++){ fc.moveTo(i*r*0.7-r*0.3,0); fc.lineTo(i*r*0.7,-r*0.9); fc.lineTo(i*r*0.7+r*0.3,0); }
    fc.fill();
  }
  // contour doré
  fc.globalAlpha=0.5; fc.strokeStyle="#f4e6c0"; fc.beginPath(); fc.arc(0,0,r*1.6,0,7); fc.stroke();
  fc.restore();
}

function drawFresco(){
  if(!fctx) return;
  fctx.clearRect(0,0,W,H);
  const b=_state.buildings||{};
  const cx=W*0.5, cy=H*0.5;
  const ringMax=Math.min(W,H)*0.40;
  // chaque bâtiment possédé = des vignettes disposées en spirale déterministe autour du centre
  let idx=0, total=0;
  for(const k in b) total+=Math.min(b[k],12);
  const sd=seed("aeon-fresco");
  // nervures d'énergie : relient le centre aux vignettes (dessinées d'abord, en dessous)
  const points=[];
  for(const id in b){
    const count=Math.min(b[id],12);
    const res=(window.__BRES&&window.__BRES[id])||"know";
    for(let i=0;i<count;i++){
      const a=idx*2.399963; // angle d'or
      const rad=ringMax*Math.sqrt((idx+1)/Math.max(total,1));
      const x=cx+Math.cos(a)*rad, y=cy+Math.sin(a)*rad*0.72; // léger aplatissement
      points.push({x,y,res,sd}); idx++;
    }
  }
  // nervures (sous les vignettes)
  fctx.strokeStyle="rgba(224,162,74,0.10)"; fctx.lineWidth=1;
  for(const pt of points){ fctx.beginPath(); fctx.moveTo(cx,cy); fctx.lineTo(pt.x,pt.y); fctx.stroke(); }
  // vignettes
  for(const pt of points){ vignetteShape(fctx, pt.x, pt.y, 9, pt.res, seed("v"+pt.x.toFixed(0)+pt.y.toFixed(0))); }
  // lignes de texte (découvertes) calligraphiées en marge gauche
  const tn=_state.techs||0;
  fctx.strokeStyle="rgba(205,180,140,0.5)"; fctx.lineWidth=1.5;
  const mx=Math.min(W,H)*0.07, top=H*0.22, lh=18;
  for(let i=0;i<tn && i<18;i++){
    const yy=top+i*lh; const wlen=rnd(40,120);
    fctx.beginPath(); fctx.moveTo(mx, yy);
    // simulacre d'écriture manuscrite (petites ondulations)
    let xx=mx; while(xx<mx+wlen){ const nx=xx+rnd(6,12); fctx.quadraticCurveTo((xx+nx)/2, yy+rnd(-4,4), nx, yy); xx=nx; }
    fctx.stroke();
    // lettrine dorée en début de ligne
    fctx.fillStyle="rgba(201,164,74,0.6)"; fctx.fillRect(mx-10, yy-7, 5, 12);
  }
}

// ---------- Goutte d'encre (clic) ----------
function inkDrop(x,y,strength){
  if(!ok) return; strength=strength||1;
  if(x==null){ x=W*0.5+rnd(-W*0.1,W*0.1); y=H*0.5+rnd(-H*0.08,H*0.08); }
  drops.push({x,y,r:0,max:rnd(12,22)*Math.min(2.5,strength),life:1,vy:rnd(6,14)});
  if(!raf) tick();
}

// ---------- Composition (parchemin + fresque + gouttes + shimmer) ----------
function compose(){
  ctx.clearRect(0,0,W,H);
  if(parchment) ctx.drawImage(parchment,0,0,W,H);
  if(fresco) ctx.drawImage(fresco,0,0,W,H);
}
function tick(now){
  if(!ok) return;
  now=now||performance.now();
  const dt=Math.min(0.05,(now-(lastFrame||now))/1000); lastFrame=now;
  shimmer+=dt;
  compose();
  // gouttes vivantes
  const c=inkColor;
  for(let i=drops.length-1;i>=0;i--){ const d=drops[i];
    d.r+=(d.max-d.r)*0.18; d.y+=d.vy*dt; d.vy*=0.96; d.life-=dt*0.9;
    const a=Math.max(0,d.life);
    const g=ctx.createRadialGradient(d.x,d.y,0,d.x,d.y,Math.max(1,d.r));
    g.addColorStop(0,`rgba(${c.r},${c.g},${c.b},${(0.55*a).toFixed(3)})`);
    g.addColorStop(1,`rgba(${c.r},${c.g},${c.b},0)`);
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(d.x,d.y,Math.max(1,d.r),0,7); ctx.fill();
    if(d.life<=0) drops.splice(i,1);
  }
  // léger scintillement de l'or sur la fresque (très discret)
  if(fresco){ ctx.globalAlpha=0.04+0.03*Math.sin(shimmer*1.5); ctx.drawImage(fresco,0,0,W,H); ctx.globalAlpha=1; }
  // continue d'animer tant qu'il y a des gouttes OU pour le shimmer doux (throttlé)
  if(!hidden && (drops.length>0)) raf=requestAnimationFrame(tick);
  else raf=null;
}

window.Palim={
  init, isActive(){ return ok; }, inkDrop, sync,
  setInk(r,g,b){ inkColor={r,g,b}; },
  resize,
};
})();
