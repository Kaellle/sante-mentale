# Santé Mentale — module Foundry VTT (D&D 5e)

Système de santé mentale maison, affiché dans l'en-tête de la fiche de personnage.

## Règles implémentées

**Score maximum (calculé automatiquement, se met à jour si les caracs changent) :**

> SM max = (Sagesse × 5) + (Mod. Intelligence × 2) + (Mod. Charisme × 2)

**Niveaux d'état (selon le % de SM restant) :**

| Niveau | Seuil |
|---|---|
| Stable | 90 % ou plus |
| Stressé | 75 % à 89 % |
| Perturbé | 50 % à 74 % |
| Instable | 25 % à 49 % |
| Déséquilibré | 10 % à 24 % |
| Brisé | 1 % à 9 % |
| Perdu | moins de 1 % |

**Récupération :** +1 SM après chaque repos long (message dans le chat).

## Installation

1. Ouvre le dossier de données de Foundry : `Data/modules/`
2. Décompresse le zip dedans — tu dois obtenir `Data/modules/sante-mentale/module.json`
3. Relance Foundry (ou F5), puis dans ton monde : **Paramètres → Gérer les modules → coche "Santé Mentale"**

## Utilisation

- L'encart apparaît dans l'en-tête de la fiche de personnage, à côté du badge de niveau.
- Le champ de gauche est la SM actuelle : tape une valeur (`42`), ou un delta comme sur les PV (`-5`, `+3`), puis Entrée.
- La première fois, la SM est considérée au maximum.
- La valeur est visible par les joueurs, modifiable uniquement par les propriétaires de la fiche (et le MJ).

## API pour macros (optionnel)

```js
const sm = game.modules.get("sante-mentale").api;
await sm.adjust(actor, -5);   // perd 5 SM
await sm.set(actor, 40);      // fixe à 40
sm.get(actor);                // valeur actuelle
sm.max(actor);                // maximum
sm.level(actor);              // "Stable", "Brisé", etc.
```

Pratique pour un item macro MidiQOL : par exemple un sort d'horreur qui fait perdre de la SM à la cible.

## Données

La valeur actuelle est stockée dans un flag de l'acteur : `flags.sante-mentale.value`.
Le maximum n'est jamais stocké, il est recalculé en direct.
