# ÆON — Le Monde Commun

> **Un seul monde. Construit par tous. En direct.**

Un clicker multijoueur en temps réel où il n'existe **qu'une seule civilisation
mondiale**, partagée par tous les joueurs de la planète. Chaque clic ajoute une
**étincelle** de connaissance à l'humanité entière. Le compteur central est
**réel et partagé** : il monte quand tu joues, et il monte aussi quand d'autres
jouent, même quand tu regardes. Ensemble, vous faites traverser à l'humanité les
**âges**, de la première étincelle à la Transcendance.

🎮 **Jouer en ligne :** https://lovetodev45.github.io/Aloorss/

## Comment ça marche

- **Le noyau** : touche-le (ou maintiens) pour offrir des étincelles.
- **La connaissance mondiale** : un compteur planétaire unique et partagé.
- **Les âges** : 11 paliers franchis par l'humanité entière, en même temps pour
  tout le monde, avec un évènement à chaque passage.
- **Le pouls du monde** : le rythme d'étincelles/seconde révèle combien de
  pionniers sont éveillés en ce moment ailleurs sur Terre.
- **Ta contribution** : ta part personnelle, gardée localement.

## Architecture — zéro backend à gérer

Le front est 100 % statique (servi par GitHub Pages). L'état mondial partagé est
stocké dans un **compteur atomique public compatible CountAPI**
(`abacus.jasoncameron.dev`, avec repli), interrogé toutes les ~1,5 s :

- les clics sont regroupés puis envoyés via un `update` atomique
  (`+N` côté serveur, donc pas de conflit entre joueurs) ;
- la même requête renvoie le nouveau total mondial, qui inclut les clics des
  autres ;
- si le service est injoignable, le jeu continue en mode local et se
  resynchronise dès que le réseau revient.

**Aucun compte, aucune clé, aucun serveur à héberger.**

## Structure du dépôt

| Chemin | Description |
|---|---|
| `index.html` | Le jeu entier : UI, couche réseau, audio, effets |
| `sw.js` | Service worker (coquille hors-ligne ; n'intercepte jamais le compteur) |
| `manifest.webmanifest` | PWA installable |
| `.github/workflows/deploy.yml` | Déploiement automatique sur GitHub Pages |

## Déploiement

Publié via **GitHub Actions** vers **GitHub Pages** à chaque push sur la branche
`claude/wealth-building-feature-LiaF4` — **la seule branche autorisée à publier**
(*Settings → Environments → github-pages*). Un push = un déploiement, sans PR.

Pour réinitialiser le monde commun (repartir de zéro à l'Âge de Pierre) : changer
la constante `NS` (`aeon-monde-commun-v1`) dans `index.html`.
