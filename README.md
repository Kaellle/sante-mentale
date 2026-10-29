# Santé Mentale — module Foundry VTT (D&D 5e)

Système de santé mentale maison pour la table des héritiers du Dragons, affiché dans l'en-tête de la fiche de personnage.

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

**Faiblesse de l'Ombre :** le MD attribue à chaque personnage une faiblesse (Malédiction de la Vengeance, Cupidité draconique, Soif de pouvoir, Fascination des secrets, Folie de l'errance). Le défaut d'Ombre actif dépend du palier :

| Palier | Défaut actif |
|---|---|
| Stable, Stressé | aucun |
| Perturbé | 1er défaut |
| Instable | 2e défaut |
| Déséquilibré | 3e défaut |
| Brisé, Perdu | 4e défaut |

## Utilisation

- L'encart apparaît dans l'en-tête de la fiche de personnage, à côté du badge de niveau.
- Le champ de gauche est la SM actuelle : tape une valeur (`42`), ou un delta comme sur les PV (`-5`, `+3`), puis Entrée.
- La première fois, la SM est considérée au maximum.
- La valeur est visible par les joueurs, modifiable uniquement par les propriétaires de la fiche (et le MJ).
- Possibilité de déplacer l'encart avec un shift + clic gauche.
- Le MD choisit la Faiblesse de l'Ombre dans la liste déroulante de l'encart (visible de lui seul) ; le joueur voit le nom de sa faiblesse.
- Survoler la pastille d'état affiche le défaut d'Ombre actif et sa description.

## API pour macros (optionnel)

```js
const sm = game.modules.get("sante-mentale").api;
await sm.adjust(actor, -5);   // perd 5 SM
await sm.set(actor, 40);      // fixe à 40
sm.get(actor);                // valeur actuelle
sm.max(actor);                // maximum
sm.level(actor);              // "Stable", "Brisé", etc.
sm.shadow(actor);             // "Soif de pouvoir" (ou null)
sm.flaw(actor);               // défaut actif : "Arrogant" (ou null)
```
## Données

La valeur actuelle est stockée dans un flag de l'acteur : `flags.sante-mentale.value`.
La Faiblesse de l'Ombre aussi : `flags.sante-mentale.shadow` (`vengeance`, `dragonSickness`, `power`, `secrets`, `wandering`).
Le maximum n'est jamais stocké, il est recalculé en direct.
