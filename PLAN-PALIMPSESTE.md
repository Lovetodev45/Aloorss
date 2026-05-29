# ÆON — Le Palimpseste Vivant
### Plan de conception détaillé · v1

> Concept : l'écran d'ÆON devient un **manuscrit enluminé qui s'écrit et se dessine tout seul**,
> reflet vivant de ta civilisation. Chaque âge le **repeint dans un nouveau médium**.
> 100 % Canvas/SVG 2D → léger, fluide, zéro lag. Direction : enluminure + Léonard + Webb.

---

## 1. Vision en une phrase
Tu ne regardes pas des barres de chiffres : tu regardes **une fresque vivante de l'Humanité se tracer
à l'encre dorée**, page après page, âge après âge — et c'est TON économie qui la dessine.

---

## 2. Le principe central : « ce que tu fais se dessine »
Chaque action du joueur ajoute un **trait** à la fresque. Rien n'est décoratif : tout est lisible.

| Élément de jeu | Ce qui se dessine sur le parchemin |
|---|---|
| 🧠 Connaissance (clic/prod) | l'**encre** se répand ; des **mots/glyphes** s'écrivent en marge |
| 🏛️ Chaque bâtiment construit | une **vignette enluminée** (une cité, un moulin, une fusée…) éclôt à un emplacement |
| 🔬 Chaque découverte | une **ligne de texte** calligraphiée s'inscrit + une dorure |
| 👥 Population | des **silhouettes/foules** minuscules peuplent les marges |
| ⚡ Énergie | des **filaments dorés** (nervures, circuits) relient les vignettes |
| ✨ Culture | des **enluminures florales / arabesques** envahissent les bordures |
| ⚖️ Doctrine choisie | un **sceau** se grave au centre de la page |
| ✦ Transcendance | la page **se retourne** → nouveau parchemin, nouveau médium (voir §4) |

→ Plus tu joues, plus la page se remplit. Une partie = **une œuvre d'art unique**, partageable.

---

## 3. Architecture technique (légère & sûre)
- **1 seul `<canvas>` 2D** plein écran, derrière l'UI en verre (comme aujourd'hui).
- **Rendu en couches (layers) bufferisées** : on ne redessine PAS tout chaque frame.
  - `bgLayer` : le parchemin (texture statique, dessinée 1×).
  - `inkLayer` : traits permanents (vignettes, texte, nervures) — dessiné **à l'événement** (achat, découverte), jamais en boucle.
  - `fxLayer` : animations vivantes légères (scintillement de l'or, encre qui coule) — la SEULE couche animée, throttlée à ~30 fps.
- **Tracé animé** : chaque nouveau trait se dessine progressivement (path « stroke-dashoffset » façon plume).
- **Déterminisme** : positions des vignettes = seed basée sur l'ID du bâtiment → la fresque est stable et reproductible (re-dessinable à l'identique au reload).
- **Perf mobile** : DPR plafonné, fxLayer en pause si onglet caché, aucune allocation par frame.
- **Zéro dépendance** : pur Canvas 2D maison (pas de Three.js). Fichier `palimpseste.js`.

---

## 4. Les 9 médiums (un par âge) — le coup de génie
À chaque transcendance/âge, la fresque se **redessine dans un autre style graphique**. Même données,
rendu radicalement différent → chaque civilisation paraît neuve.

| Âge | Médium visuel | Palette |
|---|---|---|
| 🪨 Pierre | **gravure rupestre** (traits ocre, mains négatives, charbon) | terre, ocre, sang |
| 🏺 Antiquité | **mosaïque / fresque** (tesselles, motifs grecs) | terre cuite, bleu égéen, or |
| 🏰 Moyen Âge | **manuscrit enluminé** (lettrines, feuille d'or, marges fleuries) | parchemin, or, vermillon, outremer |
| 🎨 Renaissance | **dessin à la sanguine / sépia** (croquis de Vinci, schémas) | sépia, sanguine, papier crème |
| ⚙️ Industrielle | **gravure sur cuivre / plan technique** (hachures, vapeur) | cuivre, gris acier, blanc |
| 💾 Information | **blueprint / schéma** (lignes cyan sur fond bleu nuit) | cyan, bleu nuit, blanc |
| 🤖 IA | **circuit imprimé lumineux** (pistes, nœuds qui pulsent) | vert PCB, or, néon |
| 🚀 Spatiale | **carte stellaire** (constellations, orbites, éphémérides) | bleu profond, argent, blanc froid |
| ✦ Transcendance | **fractale d'encre dorée vivante** (auto-similaire, iridescent) | or, iridescent, noir |

La **transition** = animation : la page actuelle se *dissout en poussière dorée*, une nouvelle page
*se déplie*, et le médium change. C'est l'instant « wow » + screenshot.

---

## 5. Lien avec les systèmes EXISTANTS (rien ne se perd)
Le Palimpseste **lit** simplement l'état du jeu déjà en place :
- `G.buildings` → quelles vignettes dessiner (et combien d'exemplaires).
- `G.techs` → quelles lignes de texte calligraphier.
- `G.res` (les 4 ressources) → densité d'encre, foules, nervures, arabesques.
- `G.age` → quel médium appliquer.
- `G.legacies` (héritages) → teinte dominante + motif de bordure.
- doctrines → le sceau central.
- L'éveil/clic → une goutte d'encre + un glyphe.
- Transcendance → tournpage + nouveau médium.

→ **Aucune mécanique ne change.** On ajoute une **fenêtre visuelle** sur ce qui existe déjà.
Le HUD (ressources, onglets, missions, ticker) reste tel quel, posé par-dessus en verre.

---

## 6. Étapes de construction (itératif, validable à chaque pas)
1. **Le parchemin + l'encre de base** : canvas, texture de page, le clic d'éveil fait couler une goutte d'encre dorée animée. *(socle visuel, testable tde suite)*
2. **Les vignettes de bâtiments** : chaque achat trace une enluminure à un emplacement déterministe.
3. **Le texte des découvertes** + nervures d'énergie + arabesques de culture.
4. **Les 9 médiums** + l'animation de tournage de page à la transcendance.
5. **Polish** : scintillement de l'or, sceau de doctrine, teinte d'héritage, bouton « exporter la fresque en image » (partage viral).

Chaque étape est déployée et jouable — on n'attend pas « le grand soir ».

---

## 7. Risques & garde-fous (les leçons de la 3D)
- **Perf** : une seule couche animée, throttlée, en pause si onglet caché. Le reste est statique.
- **Lisibilité** : l'UI reste au-dessus, lisible ; le palimpseste est un fond riche mais jamais criard.
- **Pas de régression** : on construit dans un fichier séparé, activable/désactivable. Si ça ne va pas, on revient au fond actuel en 1 ligne.
- **Sauvegarde** : la fresque est 100 % redéduite de `G` → rien de plus à sauvegarder, aucun risque pour la progression.

---

## 8. Pourquoi ça peut « rester dans les annales »
- **Aucun incrémental n'a cette identité.** C'est immédiatement reconnaissable.
- Chaque partie produit **une œuvre unique** → capture d'écran → partage → bouche-à-oreille.
- Le changement de médium par âge = **5 jeux visuels en un**.
- Ça unit enfin les 3 piliers : **optimisation** (le jeu dessous), **narration** (la chronique qui s'écrit), **art** (la fresque). Comme Paperclips unissait mécanique et propos.
