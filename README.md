# ÆON — La Simulation de l'Humanité

Une épopée incrémentale jouable dans le navigateur : guidez l'espèce humaine
de la première étincelle de conscience à l'Âge de Pierre jusqu'à la
Transcendance spatiale.

🎮 **Jouer en ligne :** https://lovetodev45.github.io/Aloorss/

## Le jeu

- **9 âges** à traverser : Pierre → Antiquité → Moyen Âge → Renaissance →
  Industrielle → Information → IA → Spatiale → Transcendance
- **4 ressources** : 🧠 Connaissance, ⚡ Énergie, ✨ Culture, 👥 Population
- **17 bâtiments** (du feu de camp à la sphère de Dyson) et **15 découvertes**
  (la Roue, l'Imprimerie, l'IA, la Singularité…)
- **Évènements aléatoires** à choix, **gains hors-ligne**, **sauvegarde
  automatique** + export/import
- **Prestige** : *Transcender* pour gagner des Étincelles d'Éon
  (+3 % de production permanente chacune)

Tout est contenu dans un seul fichier `index.html` : aucune dépendance,
aucune clé d'API, 100 % hors-ligne. Aucune donnée ne quitte le navigateur.

## Structure du dépôt

| Chemin | Description |
|---|---|
| `index.html` | Le jeu ÆON (page d'accueil) |
| `aloorss/` | Ancien projet Aloorss, archivé |
| `.github/workflows/deploy.yml` | Déploiement automatique sur GitHub Pages |

## Déploiement

Le site est publié via **GitHub Actions** vers **GitHub Pages** à chaque push
sur la branche `claude/wealth-building-feature-LiaF4` — c'est **la seule branche
autorisée à publier** (réglage *Settings → Environments → github-pages*).

👉 **Pour mettre le jeu à jour : pousser directement sur
`claude/wealth-building-feature-LiaF4`.** Un push = un déploiement, sans PR.

Pour que la publication fonctionne :

1. Dépôt **public** (Pages gratuit ne sert pas les dépôts privés)
2. **Settings → Pages → Source : GitHub Actions**

Le déploiement peut aussi être lancé manuellement depuis l'onglet **Actions**
(*workflow_dispatch*).
