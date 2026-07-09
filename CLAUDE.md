# Santé Mentale — module Foundry VTT

## Contexte

Module maison pour une table de D&D 5e (règles 2014) jouée en français sur Foundry VTT v13.
Il implémente le système de santé mentale (SM) de la table. Auteur : Jordan (GitHub : Kaellle).
L'environnement de jeu utilise aussi MidiQOL, DAE et des item macros — toute automatisation
future doit rester compatible avec cet écosystème.

## Règles du jeu implémentées (NE PAS MODIFIER sans demande explicite)

- **SM max** = (valeur de Sagesse × 5) + (mod. Intelligence × 2) + (mod. Charisme × 2)
  - Exemple : SAG 14, INT 12 (+1), CHA 16 (+3) → 70 + 2 + 6 = 78
  - Le max n'est jamais stocké : recalculé en direct depuis `actor.system.abilities`
- **Niveaux d'état** (% de SM restant) :
  Stable ≥90 % · Stressé 75–89 % · Perturbé 50–74 % · Instable 25–49 % ·
  Déséquilibré 10–24 % · Brisé 1–9 % · Perdu <1 %
- **Récupération** : +1 SM après chaque repos long (message dans le chat)
- Philosophie : PAS de full automatisation. Le MJ et les joueurs gèrent les pertes à la main.

## Architecture

- `module.json` — manifest (compat Foundry v12/v13, système dnd5e requis)
- `scripts/sante-mentale.js` — tout le code (ES module, pas de build step)
- `styles/sante-mentale.css` — encart sombre assorti à la fiche dnd5e v2
- Valeur actuelle stockée dans `actor.flags["sante-mentale"].value` (jamais le max)
- UI : encart injecté dans l'en-tête de la fiche personnage (`.sheet-header .right`,
  avec fallbacks), à côté du badge de niveau. Champ éditable acceptant valeur absolue ou delta (+X/-X)
- Hooks : `renderActorSheet` (dnd5e ≤4.x, AppV1/jQuery) ET `renderActorSheetV2`
  (dnd5e 5.x, AppV2/HTMLElement) — le handler normalise les deux cas
- Repos long : hook `dnd5e.restCompleted`, teste `result.longRest === true || result.type === "long"`
- API macros exposée sur `game.modules.get("sante-mentale").api` : `get`, `max`, `set`, `adjust`, `level`

## Conventions

- Tout en français : UI, commentaires, messages de chat, README
- Uniquement les personnages de type `character` (pas les PNJ pour l'instant)
- Code défensif sur les sélecteurs DOM (la structure des fiches dnd5e change entre versions)
- Pas de dépendance à d'autres modules

## Release / déploiement

- Dépôt : https://github.com/Kaellle/sante-mentale
- Installation sur le serveur Foundry via l'URL de manifest :
  `https://github.com/Kaellle/sante-mentale/releases/latest/download/module.json`
- Pour publier une version : incrémenter `"version"` dans module.json, zipper le dossier
  (le zip contient le dossier `sante-mentale/` à sa racine), créer une release GitHub
  taguée `vX.Y.Z` avec DEUX assets attachés : `sante-mentale.zip` ET `module.json`
- Test local rapide : copier les fichiers dans `Data/modules/sante-mentale/` du Foundry et F5

## Pistes évoquées pour plus tard (non implémentées)

- Table de troubles aléatoires déclenchée sous certains seuils
- Perte de SM via item macros MidiQOL (sorts d'horreur, etc.) en utilisant l'API `adjust`
