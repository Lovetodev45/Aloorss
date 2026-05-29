# ÆON — Que faut-il pour un succès mondial ?
### Recherche documentée (game design + graphismes + distribution)

> Synthèse de ~25 recherches web multi-sources, vérifiées et croisées.
> Chaque affirmation est sourcée. Recommandations priorisées pour ÆON à la fin.

---

## ⚠️ La vérité sur le « 80 % de la population »

Aucun jeu de l'histoire n'a atteint ça, et aucun ne l'atteindra. Le **plafond réel** :

- **Minecraft**, le jeu le plus vendu de tous les temps : ~300 M de copies = **~3,75 % de l'humanité**. ([SQ Magazine](https://sqmagazine.co.uk/minecraft-statistics/))
- Tout le marché *idle/incrémental* réuni : **~400 M de joueurs actifs/mois**, tous jeux confondus. ([Growth Market Reports](https://growthmarketreports.com/report/idle-games-market))

**Ce qu'un excellent jeu incrémental indé peut réalistement viser :**
| Niveau | Exemple | Chiffre |
|---|---|---|
| Viral éclair (solo dev) | Universal Paperclips | **450 000 joueurs en 11 jours** ([Wikipedia](https://en.wikipedia.org/wiki/Universal_Paperclips)) |
| Hit durable web | Cookie Clicker | **~4 M joueurs/jour**, 13 ans d'existence ([SteamCharts](https://steamcharts.com/app/1454400)) |
| Succès commercial mobile | AdVenture Capitalist | **50 M téléchargements** en 6 ans ([Pocket Gamer](https://www.pocketgamer.com/adventure-capitalist/adventure-capitalist-on-its-6th-year-a-walk-down-memory-lane/)) |
| Succès Steam de niche | Melvor Idle | **500k–1M** possesseurs, $6,7M ([SteamSpy](https://steamspy.com/app/1267910)) |

**Objectif réaliste et ambitieux pour ÆON : "faire un Universal Paperclips"** — exploser sur Reddit/Hacker News, atteindre des centaines de milliers de joueurs, devenir une référence du genre. C'est atteignable. Le reste suit.

---

## 1. GAME DESIGN — ce qui crée la rétention et l'addiction

### 🔴 Priorité absolue : des couches de prestige imbriquées
Le simple reset ne suffit pas. Les jeux qui retiennent le plus empilent **plusieurs niveaux de prestige, chacun débloquant de NOUVELLES mécaniques** (pas juste des chiffres plus gros).
- *Antimatter Dimensions* : Infinity → Eternity → Reality, chaque couche = un nouveau système. ([PinkCrow](https://pinkcrow.net/game-idea/best-idle-games/))
- **ÆON a déjà une couche** (Transcendance → Étincelles). Il en faut **au moins 2-3**, avec des systèmes neufs à chaque palier.

### 🔴 Introduire de NOUVELLES mécaniques, pas juste des nombres
La cause n°1 d'abandon : « j'ai compris, ça ne fait que grossir ». La parade : débloquer des systèmes inédits aux moments de blocage.
- *Kittens Game* : 30+ bâtiments, 100+ technos échelonnés — un nouveau système apparaît pile quand on bloque. ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/KittensGame))

### 🟠 Le rythme « mur → percée »
Le joueur bute sur un mur, prestige, et l'explosion exponentielle pulvérise l'ancien contenu : **catharsis dopaminergique**. C'est CE moment qui fait revenir. ([MrMine blog](https://blog.mrmine.com/the-evolution-and-origins-of-idle-clicker-and-incremental-games/))

### 🟠 Récompense variable (effet machine à sous)
Débloquages imprévisibles = même boucle dopaminergique que le jeu d'argent. ([PlayMushies](https://www.playmushies.com/blog/dopamine-simulator-games-why-theyre-addictive.html))

### 🟠 Progrès hors-ligne = clé de la rétention J1
Gagner en étant fermé supprime le sentiment de « temps perdu » et **augmente la rétention J1 d'environ 30 %**. ÆON l'a déjà — à renforcer (notifications). ([GeekExtreme](https://www.geekextreme.com/idle-games-offline-progression-math/))

### 🟢 Les 30 premières minutes = quick wins
Récompenses toutes les quelques secondes au début → accroche avant que le grind n'exige de la patience. ([Adjust](https://www.adjust.com/blog/how-to-make-an-idle-game/))

### 🟢 Retour quotidien
Bonus de connexion + notifications créent l'habitude sur 1-7 jours. ÆON a le bonus quotidien ; il manque les **notifications push** (la PWA le permet). ([MindStudios](https://games.themindstudios.com/post/idle-clicker-game-design-and-monetization/))

### 📊 Données chiffrées clés (à garder en tête)
- Les jeux qui cumulent **pacing exponentiel + prestige imbriqué + progrès hors-ligne** atteignent **200 à 500+ heures** d'engagement par joueur. Ceux qui n'en ont qu'un ou deux plafonnent vite. ([PinkCrow](https://pinkcrow.net/game-idea/best-idle-games/))
- **Équilibre optimal : ~60 % de progrès idle / 40 % actif.** Trop d'idle = pas d'agentivité ; trop d'actif = ce n'est plus un idle. ([GridInc](https://gridinc.co.za/blog/idle-games-best-practices))
- Les joueurs idle font **~5,3 sessions/jour** et des sessions plus longues que le hypercasual. ([GameDesignSkills](https://gamedesignskills.com/game-design/player-retention/))
- **Aversion à la perte** : la douleur de perdre fait ~2× le plaisir de gagner. L'idle accumule « sans douleur » → on n'ose plus quitter. ([MrMine](https://blog.mrmine.com/the-evolution-and-origins-of-idle-clicker-and-incremental-games/))
- Orteil (Cookie Clicker) : *« les gens accumulent, puis n'osent plus arrêter car ils auraient gâché le temps investi. »* ([VICE](https://www.vice.com/en/article/cookie-clicker-wasnt-meant-to-be-fun-why-is-it-so-popular-8-years-later/))
- Frank Lantz (Universal Paperclips) : le clicker rend **viscérale** la croissance exponentielle — « tenir le poids des nombres dans ses mains ». ([PC Games Insider](https://www.pcgamesinsider.biz/interviews-and-opinion/66271/interview-paperclips-developer-frank-lantz/))

---

## 2. VIRALITÉ — ce qui fait qu'on en parle

### 🔴 Le TWIST narratif non-spoilable (le plus puissant)
Le facteur viral n°1 du genre. Un retournement qu'on veut faire découvrir aux autres **sans le spoiler**.
- *Universal Paperclips* : compteur de trombones → IA qui dévore l'univers. **450k joueurs en 11 jours** via Hacker News. ([IF50](https://if50.substack.com/p/2017-universal-paperclips))
- *A Dark Room* : « en dit plus en disant moins » (New York Times), Best-of-Year Forbes/Paste/Giant Bomb.
- **ÆON a déjà ses révélations** (twist d'identité, fin secrète). C'est son **atout viral majeur** — à soigner et mettre en avant.

### 🔴 La carte de résultat partageable (effet Wordle)
La grille emoji de Wordle = **32,2 M de tweets, 6,6 mille milliards de vues**, jusqu'à 500k tweets/jour. ([Concurate](https://concurate.com/how-wordle-went-viral/), [Wikipedia](https://en.wikipedia.org/wiki/Wordle))
- **ÆON a déjà une carte-image** de partage → la rendre **plus distinctive, comparable, non-spoiler** (ex. « J'ai atteint l'Ère de l'IA en X temps, cycle N° »).

### 🟠 Zéro installation = avantage viral
Un lien qui lance le jeu en 2 secondes. 45 % des joueurs casual préfèrent désormais le navigateur à l'app. ([Medium](https://medium.com/@280134408zaro/the-rise-of-browser-based-challenge-games-in-2025-why-small-skill-driven-titles-are-winning-again-05a66fbe8722)) — **ÆON l'a déjà** (PWA web).

### 🟠 Compréhensible en < 30 secondes
Cookie Clicker = « clique un cookie ». Wordle = « devine un mot ». ÆON doit **accrocher en une phrase**.

### 🟢 Amorçage Hacker News + Reddit → Twitter → presse
Universal Paperclips et Cookie Clicker ont percé via HN/Reddit d'abord. C'est le chemin.

---

## 3. GRAPHISMES — ce qui marche VRAIMENT (résultat contre-intuitif)

### 🔴 Le minimalisme DOMINE le haut du panier — par choix, pas par budget
> Les 3 plus grands succès du genre — **Cookie Clicker, Universal Paperclips, Antimatter Dimensions** — utilisent une présentation **délibérément minimale**.

- Universal Paperclips : **« juste du texte, quelques lignes et boutons, sans couleur »** — choix assumé de Frank Lantz pour qu'on « sente le poids des nombres ». 450k joueurs quand même. ([Wikipedia](https://en.wikipedia.org/wiki/Universal_Paperclips))
- Cookie Clicker : « pas besoin de graphismes réalistes ni de gros budget ». ([Playgama](https://playgama.com/blog/general/who-are-the-developers-behind-cookie-clicker-and-what-game-design-principles-can-i-learn-from-their-success/))

**Implication directe pour ÆON :** la planète 3D est un **différenciateur** (peu de jeux du genre en ont), mais elle ne doit JAMAIS gêner la lisibilité des nombres ni les perfs. **Le gameplay et la clarté priment sur le spectacle.**

### 🔴 La lisibilité des nombres est un problème UX central
Abréviations (K, M, B, T, AA…) et notation scientifique obligatoires. Compteurs en **32-48px**, taux en **18-24px min**. Divulgation progressive (montrer la complexité petit à petit). ([InnoGames](https://blog.innogames.com/dealing-with-huge-numbers-in-idle-games/), [SEELE AI](https://www.seeles.ai/resources/blogs/scratch-clicker-game-ui))

### 🟠 « Juice » (Jonasson & Purho, GDC) : feedback satisfaisant
Screen shake, particules, tweening/easing, son synchronisé, anticipation. ([GDC Vault](https://www.gdcvault.com/play/1016487/Juice-It-or-Lose)) — **ÆON a déjà** sons + particules + combos + secousses. ✅

### 🟠 Mais attention au « Juice Problem » : trop tue
Trop d'effets nuit aux perfs (surtout mobile) et **distrait du cœur de jeu**. Le juice doit *renforcer* la mécanique, pas l'enterrer. ([Wayline](https://www.wayline.io/blog/the-juice-problem-how-exaggerated-feedback-is-harming-game-design)) — **C'est exactement le piège récent d'ÆON** (planète saturée, bâtiments géants).

### 🟢 La 3D n'est PAS requise et coûte des perfs
Egg Inc réussit en 3D mais c'est **l'exception**. Le calcul de ressources à chaque frame tue les perfs mobiles. ([Medium](https://medium.com/@tommcfly2025/clicker-games-a-technical-exploration-of-incremental-system-architecture-b6d842e6963e))

---

## 4. DISTRIBUTION — d'où viennent les joueurs

| Canal | Échelle | Note |
|---|---|---|
| **r/incremental_games** | **180k abonnés** | LE juge de paix du genre. Pas de lien referral, anti-spam strict. Le lancement s'y joue. ([GummySearch](https://gummysearch.com/r/incremental_games/)) |
| **Poki** | **100M+ MAU, 700 Md parties/mois** | Plateforme web géante, curation sélective (~300 jeux/an). ([Game Developer](https://www.gamedeveloper.com/business/the-huge-hidden-web-game-market-no-one-talks-about-and-how-to-get-in-)) |
| **CrazyGames** | **35-40M MAU** | Plus accessible (~900 jeux/an). |
| **itch.io** | 200k+ jeux | Beaucoup à 0 vue ; les features cyclent vite. Bon pour une page propre. ([HowToMarketAGame](https://howtomarketagame.com/2025/05/12/benchmark-itch-io-traffic/)) |
| **Hacker News** | — | Tremplin tech (Universal Paperclips y a explosé). |
| **Steam** | — | Pipeline éprouvé : prototype web gratuit → version premium (Melvor: 8 449 avis, 92 % positifs). |
| **Mobile** | marché **$3-14 Md** | Le vrai argent du genre (65 %+ du revenu). |

**Le chemin gagnant validé :** prototype web gratuit → **post r/incremental_games** taillé pour leurs codes → si ça prend, Hacker News/Twitter → version Steam/mobile.

---

## 5. RECOMMANDATIONS PRIORISÉES POUR ÆON

### 🔴 À faire en priorité (impact maximal)
1. **Soigner le hook narratif des 60 premières secondes** + mettre le twist en valeur. C'est l'atout viral n°1 d'ÆON, gratuit en dev. (cf. Universal Paperclips)
2. **Garantir la lisibilité absolue des nombres** (gros, abrégés, contrastés) — la 3D ne doit jamais les masquer. C'est un échec UX courant.
3. **Discipliner le visuel 3D** : la planète doit être *élégante et lisible*, jamais saturée. « Le juice renforce, il n'enterre pas. » (cf. le récent problème de bâtiments géants)
4. **Ajouter une 2e couche de prestige** qui débloque une *nouvelle mécanique* (pas juste un multiplicateur).

### 🟠 Ensuite (rétention & viralité)
5. **Carte de partage distinctive** (temps, âge, cycle — comparable, non-spoiler façon Wordle).
6. **Notifications push PWA** (« ta civilisation a atteint l'Ère Spatiale en ton absence »).
7. **Débloquer de nouveaux systèmes aux murs** de progression (anti-ennui façon Kittens Game).
8. **Quick wins dans les 30 premières minutes** (récompenses très fréquentes au début).

### 🟢 Pour le lancement
9. **Préparer un post r/incremental_games** soigné (titre honnête, GIF de 5 s, « vanilla JS, hors-ligne, sans pub »).
10. **Page itch.io** + amorçage Hacker News/Twitter.
11. Plus tard : **version Steam/mobile** si le web prend.

---

### Ce qu'ÆON a déjà bien (✅)
Zéro installation (PWA) · sons + particules + juice · twist narratif + fin secrète · bonus quotidien · gains hors-ligne · prestige (1 couche) · carte de partage · planète 3D différenciante.

### Le vrai verdict
ÆON **coche déjà beaucoup de cases**. Les deux leviers décisifs ne sont pas « plus de 3D » mais :
1. **Le hook narratif** (ce qui fait qu'on en PARLE) — son arme secrète.
2. **La clarté + la profondeur de la boucle** (ce qui fait qu'on REVIENT) — couches de prestige + nouvelles mécaniques.

Le succès se joue là, pas dans le spectacle visuel.
