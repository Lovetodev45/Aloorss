/* ============================================================
   ÆON — L'ARBRE-MANDALA FRACTAL DE LA CIVILISATION
   Une fractale générée par TES choix : elle pousse du centre
   (la première étincelle) vers l'extérieur, âge par âge. Les
   doctrines tordent les fourches, les héritages sculptent la
   forme, les bâtiments deviennent des bourgeons. Auto-similaire,
   unique à chaque partie. Zoom/déplacement. Canvas 2D pur.

   Perf : la fractale est générée 1× dans un buffer hors-écran
   quand l'état change ; le zoom/déplacement ne fait que
   transformer ce buffer. Animation seulement onglet ouvert.
   Expose window.Palim.
   ============================================================ */
(function(){
"use strict";

let cv, ctx, W=0, H=0, dpr=1, ok=false, raf=null, hidden=false;
let buffer=null, bctx=null, BS=0;      // buffer carré hors-écran (la fractale dessinée)
let lastSig="", state=null;
let rot=0, lastFrame=0, glow=0;
// caméra (zoom / déplacement, pour "jouer avec")
let zoom=1, zoomT=1, panX=0, panY=0, drag=false, lx=0, ly=0, pinchD0=0, pinch0=1;

function lerp(a,b,t){return a+(b-a)*t;}
// PRNG déterministe d'après une graine de chaîne
function rng(strSeed){ let h=2166136261; const s=String(strSeed);
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return ()=>{ h+=0x6D2B79F5; let t=h; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
function hex(c){ return `rgb(${c.r|0},${c.g|0},${c.b|0})`; }
function mix(a,b,t){ return {r:lerp(a.r,b.r,t),g:lerp(a.g,b.g,t),b:lerp(a.b,b.b,t)}; }

// palette par âge (cœur → extrémités)
const AGE_COL=[
  {r:200,g:120,b:70},{r:210,g:170,b:80},{r:200,g:140,b:95},{r:120,g:200,b:170},
  {r:220,g:170,b:90},{r:110,g:190,b:240},{r:185,g:130,b:245},{r:130,g:170,b:255},{r:245,g:225,b:165}
];

function init(){
  cv=document.getElementById("palim"); if(!cv) return false;
  ctx=cv.getContext("2d"); if(!ctx) return false;
  sizeCanvas();
  bindInput();
  addEventListener("resize", debounce(()=>{ sizeCanvas(); lastSig=""; regen(); }, 220));
  document.addEventListener("visibilitychange", ()=>{ hidden=document.hidden; if(!hidden) loop(); });
  ok=true; loop();
  return true;
}
function debounce(fn,ms){ let t; return(...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }
function sizeCanvas(){
  dpr=Math.min(devicePixelRatio||1, 2);
  const r=cv.getBoundingClientRect();
  W=Math.max(280,Math.floor(r.width||cv.clientWidth||640));
  H=Math.max(280,Math.floor(r.height||cv.clientHeight||480));
  cv.width=Math.floor(W*dpr); cv.height=Math.floor(H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  // buffer carré (assez grand pour zoomer sans flou)
  BS=Math.floor(Math.min(1400, Math.max(W,H)*1.6));
  buffer=document.createElement("canvas"); buffer.width=BS; buffer.height=BS;
  bctx=buffer.getContext("2d");
}

// ============================================================
//  GÉNÉRATION DE LA FRACTALE (récursive, bornée par budget)
// ============================================================
function regen(){
  if(!bctx) return;
  const s=state||{};
  bctx.clearRect(0,0,BS,BS);
  // fond cosmique très sombre du buffer
  const bg=bctx.createRadialGradient(BS/2,BS/2,0,BS/2,BS/2,BS/2);
  bg.addColorStop(0,"#0a0c18"); bg.addColorStop(1,"#04050b");
  bctx.fillStyle=bg; bctx.fillRect(0,0,BS,BS);

  const age=Math.max(0,Math.min(8, s.age||0));
  const leg=s.legacies||{};
  const doc=s.doctrines||{};
  const buildings=s.buildings||{};
  const techs=s.techs||0;

  // --- paramètres FRACTALS dérivés des choix ---
  const lc=(id)=>leg[id]||0;                          // niveau d'un héritage
  const curiosite=lc("curiosite"), ambition=lc("ambition"),
        harmonie=lc("harmonie"), sagesse=lc("sagesse");
  // nb de branches par fourche : Curiosité densifie (2→4)
  const branches=2+Math.min(2, Math.round(curiosite/3));
  // symétrie : Harmonie crée un mandala (répétitions radiales)
  const symmetry=harmonie>=1 ? Math.min(8, 2+harmonie) : 1;
  // longueur des branches : Ambition allonge
  const lenBase=BS*0.085*(1+ambition*0.10);
  // profondeur = âge atteint (+1), bornée
  const depth=Math.min(9, age+2);
  // angle d'ouverture, influencé par doctrines
  let spread=0.62;
  // chaque doctrine "penche" la croissance
  let bias=0;
  if(doc.doctrine_anc==="chasse") bias+=0.18; else if(doc.doctrine_anc==="cueillette") bias-=0.18;
  if(doc.doctrine_med==="foi") spread*=1.25; else if(doc.doctrine_med==="raison") spread*=0.8;
  if(doc.doctrine_ind==="capital") bias+=0.12; else if(doc.doctrine_ind==="ouvrier") spread*=1.15;
  if(doc.doctrine_ia==="fusion_ia") spread*=0.85; else if(doc.doctrine_ia==="servir_ia") branchesBoost();
  function branchesBoost(){}

  // bourgeons : compteur de bâtiments par ressource (couleur des extrémités)
  const resCount={know:0,energy:0,culture:0,pop:0};
  for(const id in buildings){ const res=(window.__BRES&&window.__BRES[id])||"know"; resCount[res]+=buildings[id]||0; }
  const RESC={know:{r:156,g:195,b:255},energy:{r:224,g:162,b:74},culture:{r:214,g:160,b:208},pop:{r:168,g:196,b:255}};

  // budget de branches total (perf) — généreux mais borné
  let budget=2600;
  const cx=BS/2, cy=BS/2;
  const baseSeed="aeon|"+age+"|"+JSON.stringify(leg)+"|"+JSON.stringify(doc)+"|"+techs;

  // halo de Sagesse (filaments lumineux derrière l'arbre)
  if(sagesse>0){
    bctx.globalCompositeOperation="lighter";
    const hg=bctx.createRadialGradient(cx,cy,0,cx,cy,BS*0.5);
    hg.addColorStop(0,`rgba(245,225,165,${0.04+sagesse*0.015})`); hg.addColorStop(1,"rgba(0,0,0,0)");
    bctx.fillStyle=hg; bctx.fillRect(0,0,BS,BS);
    bctx.globalCompositeOperation="source-over";
  }

  // fonction récursive de croissance d'une branche
  function grow(x,y,ang,len,d,seed){
    if(d>depth || len<3 || budget<=0) return;
    budget--;
    const rand=rng(seed);
    const x2=x+Math.cos(ang)*len, y2=y+Math.sin(ang)*len;
    // couleur : interpole du cœur (âge tôt) vers l'âge courant selon la profondeur
    const t=d/Math.max(1,depth);
    const col=mix(AGE_COL[0], AGE_COL[age], t);
    const lw=Math.max(0.6,(depth-d)*0.7+0.6);
    bctx.strokeStyle=`rgba(${col.r|0},${col.g|0},${col.b|0},${(0.32+0.5*(1-t)).toFixed(3)})`;
    bctx.lineWidth=lw; bctx.lineCap="round";
    bctx.beginPath(); bctx.moveTo(x,y);
    // courbure douce (organique)
    const mx=(x+x2)/2+Math.cos(ang+1.57)*len*0.12*(rand()-0.5);
    const my=(y+y2)/2+Math.sin(ang+1.57)*len*0.12*(rand()-0.5);
    bctx.quadraticCurveTo(mx,my,x2,y2); bctx.stroke();

    // bourgeon (extrémité) : à la dernière génération, fleur colorée par ressource dominante
    if(d>=depth-1 || (d>=2 && rand()<0.12)){
      const totalRes=resCount.know+resCount.energy+resCount.culture+resCount.pop||1;
      // choisit une ressource pondérée par les bâtiments possédés
      let pick="know", roll=rand()*totalRes, acc=0;
      for(const k in resCount){ acc+=resCount[k]; if(roll<=acc){ pick=k; break; } }
      const bc=RESC[pick]||RESC.know, br=lw*1.6+1.5;
      bctx.globalCompositeOperation="lighter";
      const fg=bctx.createRadialGradient(x2,y2,0,x2,y2,br*2.4);
      fg.addColorStop(0,`rgba(${bc.r},${bc.g},${bc.b},0.85)`); fg.addColorStop(1,`rgba(${bc.r},${bc.g},${bc.b},0)`);
      bctx.fillStyle=fg; bctx.beginPath(); bctx.arc(x2,y2,br*2.4,0,7); bctx.fill();
      bctx.globalCompositeOperation="source-over";
    }
    // fourche : 'branches' enfants, écartés par 'spread', penchés par 'bias'
    const childLen=len*(0.74-d*0.005);
    for(let i=0;i<branches;i++){
      const off=(i-(branches-1)/2);
      const na=ang + off*spread/Math.max(1,branches-1)*1.4 + bias*0.3 + (rand()-0.5)*0.12;
      grow(x2,y2,na,childLen,d+1,seed+"-"+i);
    }
  }

  // tronc(s) de départ : répétés en symétrie radiale (Harmonie → mandala)
  for(let k=0;k<symmetry;k++){
    const baseAng=-Math.PI/2 + (k/symmetry)*Math.PI*2;
    grow(cx,cy, baseAng, lenBase, 0, baseSeed+"|"+k);
    if(budget<=0) break;
  }

  // cœur lumineux (la première étincelle)
  bctx.globalCompositeOperation="lighter";
  const core=mix(AGE_COL[age],{r:255,g:245,b:210},0.5);
  const cg=bctx.createRadialGradient(cx,cy,0,cx,cy,BS*0.05);
  cg.addColorStop(0,`rgba(${core.r|0},${core.g|0},${core.b|0},0.95)`); cg.addColorStop(1,"rgba(0,0,0,0)");
  bctx.fillStyle=cg; bctx.beginPath(); bctx.arc(cx,cy,BS*0.05,0,7); bctx.fill();
  bctx.globalCompositeOperation="source-over";
}

// ============================================================
//  SYNC (depuis le jeu) — ne régénère que si l'état change
// ============================================================
function sync(s){
  if(!ok) return;
  state=s||state;
  const sig=stateSig();
  if(sig!==lastSig){ lastSig=sig; regen(); }
}
function stateSig(){
  const s=state||{}; const b=s.buildings||{};
  let sig=(s.age||0)+"|"+(s.techs||0)+"|"+JSON.stringify(s.legacies||{})+"|"+JSON.stringify(s.doctrines||{})+"|";
  let tot=0; for(const k in b) tot+=b[k]||0; sig+=tot;
  return sig;
}

// ============================================================
//  INTERACTION : zoom / déplacement (jouer avec)
// ============================================================
function bindInput(){
  cv.style.touchAction="none"; cv.style.cursor="grab";
  cv.addEventListener("pointerdown",e=>{ drag=true; lx=e.clientX; ly=e.clientY; cv.style.cursor="grabbing"; cv.setPointerCapture&&cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove",e=>{ if(!drag)return; panX+=(e.clientX-lx); panY+=(e.clientY-ly); lx=e.clientX; ly=e.clientY; wake(); });
  cv.addEventListener("pointerup",()=>{ drag=false; cv.style.cursor="grab"; });
  cv.addEventListener("wheel",e=>{ e.preventDefault(); zoomT=Math.max(0.6,Math.min(6, zoomT*(e.deltaY<0?1.15:0.87))); wake(); },{passive:false});
  cv.addEventListener("touchstart",e=>{ if(e.touches.length===2){ pinchD0=tdist(e); pinch0=zoomT; } });
  cv.addEventListener("touchmove",e=>{ if(e.touches.length===2){ e.preventDefault(); zoomT=Math.max(0.6,Math.min(6, pinch0*(tdist(e)/Math.max(1,pinchD0)))); wake(); } },{passive:false});
  cv.addEventListener("dblclick",()=>{ zoomT=1; panX=panY=0; wake(); });   // double-clic = recentrer
}
function tdist(e){ const a=e.touches[0],b=e.touches[1]; return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY); }
let _wakeUntil=0;
function wake(){ _wakeUntil=performance.now()+1200; if(!raf) loop(); }

// ============================================================
//  BOUCLE DE RENDU (compose le buffer transformé + halo animé)
// ============================================================
function loop(now){
  if(!ok) return;
  now=now||performance.now();
  const dt=Math.min(0.05,(now-(lastFrame||now))/1000); lastFrame=now;
  zoom+=(zoomT-zoom)*0.12;
  rot+=0.0006;             // rotation lente méditative
  glow+=dt;

  ctx.clearRect(0,0,W,H);
  // fond cosmique de la zone visible
  const bg=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*0.7);
  bg.addColorStop(0,"#070914"); bg.addColorStop(1,"#04050b");
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  if(buffer){
    ctx.save();
    ctx.translate(W/2+panX, H/2+panY);
    ctx.rotate(rot);
    const scale=(Math.min(W,H)/BS)*1.35*zoom;
    ctx.scale(scale,scale);
    ctx.globalAlpha=1;
    ctx.drawImage(buffer,-BS/2,-BS/2);
    // léger halo additif pulsant pour la vie
    ctx.globalCompositeOperation="lighter";
    ctx.globalAlpha=0.05+0.04*Math.sin(glow*1.2);
    ctx.drawImage(buffer,-BS/2,-BS/2);
    ctx.restore();
    ctx.globalAlpha=1; ctx.globalCompositeOperation="source-over";
  }
  // continue d'animer en douceur quand visible (rotation lente = peu coûteux),
  // sinon on s'arrête après l'interaction
  if(!hidden) raf=requestAnimationFrame(loop); else raf=null;
}

// gouttes d'encre : on conserve l'API (effet discret au clic) — ici une petite pulsation
function inkDrop(){ glow+=0.4; wake(); }

window.Palim={
  init, isActive(){ return ok; }, sync, inkDrop,
  resize(){ sizeCanvas(); lastSig=""; regen(); },
  recenter(){ zoomT=1; panX=panY=0; wake(); },
  setInk(){}
};
})();
