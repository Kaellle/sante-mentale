/**
 * Santé Mentale — module maison pour D&D 5e
 *
 * Règles :
 *  - SM max = (Sagesse × 5) + (Mod. Intelligence × 2) + (Mod. Charisme × 2)
 *  - Niveaux d'état selon le pourcentage de SM restant
 *  - +1 SM après chaque repos long
 *
 * La valeur actuelle est stockée dans un flag de l'acteur :
 *   actor.flags["sante-mentale"].value
 */

const MODULE_ID = "sante-mentale";

/* Indique visuellement (curseur "grab") que Shift+glisser est possible. */
window.addEventListener("keydown", ev => {
  if (ev.key === "Shift") document.body.classList.add("sm-shift-held");
});
window.addEventListener("keyup", ev => {
  if (ev.key === "Shift") document.body.classList.remove("sm-shift-held");
});
window.addEventListener("blur", () => document.body.classList.remove("sm-shift-held"));

/* ------------------------------------------------------------------ */
/*  Calculs                                                            */
/* ------------------------------------------------------------------ */

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/** Échappe le HTML avant insertion dans un message de chat (ex. nom de personnage). */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** SM maximum, recalculé en direct depuis les caractéristiques. */
function smMax(actor) {
  const ab = actor?.system?.abilities;
  if (!ab) return 0;
  const wis = ab.wis?.value ?? 10;
  const intMod = ab.int?.mod ?? 0;
  const chaMod = ab.cha?.mod ?? 0;
  return Math.max(1, (wis * 5) + (intMod * 2) + (chaMod * 2));
}

/** SM actuelle (par défaut : au maximum si jamais touchée). */
function smCurrent(actor) {
  const raw = actor.getFlag(MODULE_ID, "value");
  const max = smMax(actor);
  if (raw === undefined || raw === null) return max;
  return clamp(Number(raw) || 0, 0, max);
}

/**
 * Niveaux d'état, du meilleur au pire.
 * flaw : indice du défaut d'Ombre actif à ce palier (null = aucun).
 */
const LEVELS = [
  { minPct: 90, name: "Stable",        cls: "sm-stable",       flaw: null },
  { minPct: 75, name: "Stressé",       cls: "sm-stresse",      flaw: null },
  { minPct: 50, name: "Perturbé",      cls: "sm-perturbe",     flaw: 0 },
  { minPct: 25, name: "Instable",      cls: "sm-instable",     flaw: 1 },
  { minPct: 10, name: "Déséquilibré",  cls: "sm-desequilibre", flaw: 2 },
  { minPct: 1,  name: "Brisé",         cls: "sm-brise",        flaw: 3 },
  { minPct: -Infinity, name: "Perdu",  cls: "sm-perdu",        flaw: 3 }
];

/* ------------------------------------------------------------------ */
/*  Faiblesses de l'Ombre                                              */
/* ------------------------------------------------------------------ */

/**
 * Faiblesses de l'Ombre et leurs 4 défauts, dans l'ordre du tableau des règles
 * (1er défaut à Perturbé ... 4e défaut à Brisé).
 * Choisie par le MD, stockée dans actor.flags["sante-mentale"].shadow
 */
const SHADOWS = {
  vengeance: {
    name: "Malédiction de la Vengeance",
    flaws: [
      { name: "Rancunier",  desc: "Règle ses comptes avec une rancune féroce, réelle ou imaginée. Cela peut aller d'une impolitesse marquée à de véritables insultes blessantes." },
      { name: "Brutal",     desc: "Réagit avec violence à la moindre provocation. Manque cruellement de retenue, même dans les situations les plus simples." },
      { name: "Cruel",      desc: "Indifférent à la souffrance qu'il cause, il devient inutilement sauvage et sadique envers ses ennemis." },
      { name: "Meurtrier",  desc: "En vient à considérer le meurtre comme un outil normal pour parvenir à ses fins, ou simplement pour imposer sa volonté." }
    ]
  },
  dragonSickness: {
    name: "Cupidité draconique",
    flaws: [
      { name: "Avide",      desc: "Ne cherche qu'à accumuler richesses et objets précieux, non par besoin, mais par pur désir de possession." },
      { name: "Méfiant",    desc: "Craint pour son trésor : même les conseils d'amis proches lui paraissent suspects." },
      { name: "Fourbe",     desc: "N'éprouve aucune honte à mentir ou manipuler si cela sert ses intérêts. La fin justifie les moyens." },
      { name: "Voleur",     desc: "Convaincu que tout ce qu'il désire lui revient de droit. Il vole sans remords, ayant sacrifié l'amour des siens et son propre respect." }
    ]
  },
  power: {
    name: "Soif de pouvoir",
    flaws: [
      { name: "Ressentiment",    desc: "En veut à ceux qu'il protège, persuadé que ses sacrifices ne sont pas reconnus. Il devient amer et aigri envers ses alliés." },
      { name: "Arrogant",        desc: "S'empresse de souligner son importance à chaque occasion, souvent au détriment de ses compagnons, qu'il rabaisse ouvertement." },
      { name: "Trop sûr de soi", desc: "Son orgueil aveuglant l'empêche de reconnaître ses propres limites. Il s'engage dans n'importe quelle action, sans souci des conséquences pour autrui." },
      { name: "Tyrannique",      desc: "Érige ses désirs en croisade légitime, ignore la vie des autres et emploie n'importe quel moyen pour parvenir à ses fins. Toute opposition est une trahison impardonnable." }
    ]
  },
  secrets: {
    name: "Fascination des secrets",
    flaws: [
      { name: "Hautain",      desc: "Ne reconnaît pas la sagesse d'autrui, et rejette les conseils et les offres d'aide avec mépris." },
      { name: "Moqueur",      desc: "Traite les idées et les initiatives des autres avec dérision, et saisit chaque occasion pour les ridiculiser." },
      { name: "Manipulateur", desc: "Cache ses pensées et intentions, ne donne jamais de conseils et n'écoute que son propre jugement. Il peut faire mine d'accepter une idée... pour mieux la trahir ensuite." },
      { name: "Traître",      desc: "Ne mérite plus la confiance de personne. Il est prêt à trahir ses amis et alliés dès que cela sert ses intérêts." }
    ]
  },
  wandering: {
    name: "Folie de l'errance",
    flaws: [
      { name: "Oisif",       desc: "Il faut beaucoup d'efforts pour le motiver. Il est facilement distrait et doit être poussé à agir, même dans des situations urgentes." },
      { name: "Distrait",    desc: "Rêvasse constamment, perd le fil de ses pensées, et oublie facilement même les choses importantes." },
      { name: "Indifférent", desc: "Se coupe du monde. Il n'éprouve plus de compassion, et perd tout intérêt pour ce qui ne le touche pas directement." },
      { name: "Lâche",       desc: "Ne se soucie que de sa propre sécurité, quelles que soient les circonstances. Il est prêt à tout sacrifier pour sauver sa peau face au danger." }
    ]
  }
};

/** Faiblesse de l'Ombre attribuée par le MD (ou null). */
function smShadow(actor) {
  return SHADOWS[actor.getFlag(MODULE_ID, "shadow")] ?? null;
}

/** Défaut d'Ombre actif pour un palier donné (ou null). */
function smFlaw(actor, lvl) {
  const shadow = smShadow(actor);
  if (!shadow || lvl.flaw === null) return null;
  return { ...shadow.flaws[lvl.flaw], rank: lvl.flaw + 1 };
}

/** Contenu de l'infobulle de la pastille d'état. */
function flawTooltip(actor, lvl) {
  const shadow = smShadow(actor);
  if (!shadow) return "Aucune Faiblesse de l'Ombre attribuée par le MD.";
  const flaw = smFlaw(actor, lvl);
  if (!flaw) return `<strong>${shadow.name}</strong><br>Aucun défaut d'Ombre actif.`;
  return `<strong>${flaw.rank}${flaw.rank === 1 ? "er" : "e"} défaut d'Ombre : ${flaw.name}</strong><br>${flaw.desc}`;
}

function smLevel(current, max) {
  const pct = max > 0 ? (current / max) * 100 : 0;
  return LEVELS.find(l => pct >= l.minPct) ?? LEVELS[LEVELS.length - 1];
}

/* ------------------------------------------------------------------ */
/*  Modification de la valeur                                          */
/* ------------------------------------------------------------------ */

/**
 * Enregistre la nouvelle valeur et annonce en privé le changement de palier
 * d'état si la modification en fait franchir un (dans un sens ou l'autre).
 */
async function commitValue(actor, cur, next, max) {
  if (next === cur) return;

  const before = smLevel(cur, max);
  await actor.setFlag(MODULE_ID, "value", next);
  const after = smLevel(next, max);

  if (after.name !== before.name) {
    const flaw = smFlaw(actor, after);
    const flawText = flaw ? ` Défaut d'Ombre : ${flaw.name}.` : "";
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<em>${escapeHtml(actor.name)} passe de ${before.name} à ${after.name}.${flawText}</em>`,
      whisper: [game.user.id]
    });
  }
}

/**
 * Applique une nouvelle valeur. Accepte :
 *  - un nombre absolu : "42"
 *  - un delta : "+5" ou "-3" (comme les PV sur la fiche dnd5e)
 */
async function applyInput(actor, rawText) {
  const text = String(rawText).trim();
  const max = smMax(actor);
  const cur = smCurrent(actor);

  let next;
  if (/^[+-]/.test(text)) next = cur + (parseInt(text, 10) || 0);
  else next = parseInt(text, 10);

  if (Number.isNaN(next)) next = cur;
  next = clamp(next, 0, max);

  await commitValue(actor, cur, next, max);
  return next;
}

/* ------------------------------------------------------------------ */
/*  Déplacement de l'encart (Shift + clic gauche)                      */
/* ------------------------------------------------------------------ */

/** Rend l'encart déplaçable ; la position choisie est mémorisée côté client (par joueur). */
function makeDraggable(tracker) {
  let dragging = false;
  let startX = 0, startY = 0, origLeft = 0, origTop = 0;

  tracker.addEventListener("pointerdown", ev => {
    if (!ev.shiftKey || ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();

    const parentRect = tracker.offsetParent?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const rect = tracker.getBoundingClientRect();
    origLeft = rect.left - parentRect.left;
    origTop = rect.top - parentRect.top;

    tracker.style.position = "absolute";
    tracker.style.left = `${origLeft}px`;
    tracker.style.top = `${origTop}px`;
    tracker.style.margin = "0";

    dragging = true;
    startX = ev.clientX;
    startY = ev.clientY;
    tracker.classList.add("sm-tracker--dragging");
    tracker.setPointerCapture(ev.pointerId);
  });

  tracker.addEventListener("pointermove", ev => {
    if (!dragging) return;
    tracker.style.left = `${origLeft + (ev.clientX - startX)}px`;
    tracker.style.top = `${origTop + (ev.clientY - startY)}px`;
  });

  const stopDrag = async () => {
    if (!dragging) return;
    dragging = false;
    tracker.classList.remove("sm-tracker--dragging");
    const left = parseFloat(tracker.style.left) || 0;
    const top = parseFloat(tracker.style.top) || 0;
    await game.settings.set(MODULE_ID, "trackerPosition", { left, top });
  };
  tracker.addEventListener("pointerup", stopDrag);
  tracker.addEventListener("pointercancel", stopDrag);

  // Shift + clic droit : remet l'encart à sa place par défaut.
  tracker.addEventListener("contextmenu", async ev => {
    if (!ev.shiftKey) return;
    ev.preventDefault();
    await game.settings.set(MODULE_ID, "trackerPosition", null);
    tracker.style.position = "";
    tracker.style.left = "";
    tracker.style.top = "";
    tracker.style.margin = "";
  });
}

/** Applique la position mémorisée (si l'utilisateur a déjà déplacé l'encart). */
function applySavedPosition(tracker) {
  const pos = game.settings.get(MODULE_ID, "trackerPosition");
  if (!pos) return;
  tracker.style.position = "absolute";
  tracker.style.left = `${pos.left}px`;
  tracker.style.top = `${pos.top}px`;
  tracker.style.margin = "0";
}

/* ------------------------------------------------------------------ */
/*  Affichage sur la fiche                                             */
/* ------------------------------------------------------------------ */

function buildTracker(actor) {
  const max = smMax(actor);
  const cur = smCurrent(actor);
  const lvl = smLevel(cur, max);
  const editable = actor.isOwner;

  const shadowKey = actor.getFlag(MODULE_ID, "shadow") ?? "";
  const shadow = smShadow(actor);

  // MD : liste déroulante ; joueur : simple rappel du nom de la faiblesse.
  let shadowHtml = "";
  if (game.user.isGM) {
    const options = Object.entries(SHADOWS)
      .map(([key, s]) => `<option value="${key}" ${key === shadowKey ? "selected" : ""}>${s.name}</option>`)
      .join("");
    shadowHtml = `<select class="sm-shadow"><option value="">Faiblesse de l'Ombre…</option>${options}</select>`;
  } else if (shadow) {
    shadowHtml = `<span class="sm-shadow-name">${shadow.name}</span>`;
  }

  const el = document.createElement("div");
  el.classList.add("sm-tracker");
  el.innerHTML = `
    <span class="sm-label">Santé Mentale</span>
    <div class="sm-values">
      <input type="text" class="sm-current" value="${cur}" ${editable ? "" : "disabled"}>
      <span class="sm-sep">/</span>
      <span class="sm-max">${max}</span>
    </div>
    <span class="sm-level ${lvl.cls}">${lvl.name}</span>
    ${shadowHtml}
  `;
  el.querySelector(".sm-values").dataset.tooltip = "Santé Mentale — tapez une valeur, ou +X / -X";

  // Infobulle HTML : data-tooltip-html depuis Foundry v13, data-tooltip avant.
  const badge = el.querySelector(".sm-level");
  const tip = flawTooltip(actor, lvl);
  if (game.release.generation >= 13) badge.dataset.tooltipHtml = tip;
  else badge.dataset.tooltip = tip;

  el.querySelector(".sm-shadow")?.addEventListener("change", async ev => {
    if (ev.target.value) await actor.setFlag(MODULE_ID, "shadow", ev.target.value);
    else await actor.unsetFlag(MODULE_ID, "shadow");
  });

  const input = el.querySelector(".sm-current");
  input.addEventListener("change", async ev => {
    ev.preventDefault();
    const next = await applyInput(actor, ev.target.value);
    ev.target.value = next; // au cas où setFlag ne re-rend pas la fiche
  });
  // Évite que la touche Entrée soumette/ferme quoi que ce soit
  input.addEventListener("keydown", ev => {
    if (ev.key === "Enter") { ev.preventDefault(); ev.stopPropagation(); input.blur(); }
  });
  input.addEventListener("focus", ev => ev.target.select());

  return el;
}

/** Trouve le bon endroit dans l'en-tête de la fiche, selon la version du système. */
function findSlot(root) {
  return (
    root.querySelector(".sheet-header .right") ??      // fiche dnd5e "v2" : colonne de droite (badge de niveau)
    root.querySelector(".sheet-header .header-elements") ??
    root.querySelector(".sheet-header") ??
    root.querySelector("header.sheet-header") ??
    null
  );
}

function onRenderSheet(app, htmlArg) {
  const actor = app.actor ?? app.document;
  if (!actor || actor.type !== "character") return;

  // jQuery (AppV1) ou HTMLElement (AppV2 / Foundry v13)
  const root = htmlArg instanceof HTMLElement ? htmlArg : htmlArg?.[0];
  if (!root) return;

  // Pas de doublon si la fiche se re-rend partiellement
  root.querySelectorAll(".sm-tracker").forEach(n => n.remove());

  const slot = findSlot(root);
  if (!slot) return;

  // Point d'ancrage pour le positionnement absolu quand l'encart est déplacé.
  if (getComputedStyle(slot).position === "static") slot.style.position = "relative";

  const tracker = buildTracker(actor);
  makeDraggable(tracker);
  applySavedPosition(tracker);

  // Dans la fiche v2, ".right" contient le badge de niveau : on se place juste avant.
  if (slot.classList.contains("right")) slot.insertAdjacentElement("afterbegin", tracker);
  else slot.appendChild(tracker);
}

/* ------------------------------------------------------------------ */
/*  Repos long : +1 SM                                                 */
/* ------------------------------------------------------------------ */

Hooks.on("dnd5e.restCompleted", async (actor, result) => {
  try {
    if (!actor || actor.type !== "character") return;
    const isLong = result?.longRest === true || result?.type === "long";
    if (!isLong) return;
    if (!actor.isOwner) return; // seul le client propriétaire applique la récup

    const max = smMax(actor);
    const cur = smCurrent(actor);
    if (cur >= max) return;

    const next = Math.min(max, cur + 1);
    await commitValue(actor, cur, next, max);

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<em>${escapeHtml(actor.name)} récupère 1 point de Santé Mentale (repos long) : ${next}/${max}.</em>`,
      whisper: [game.user.id]
    });
  } catch (err) {
    console.error(`${MODULE_ID} | erreur lors du repos long`, err);
  }
});

/* ------------------------------------------------------------------ */
/*  Hooks de rendu + API pour macros                                   */
/* ------------------------------------------------------------------ */

Hooks.once("init", () => {
  // Position de l'encart après Shift+glisser, mémorisée par joueur (pas sur l'acteur).
  game.settings.register(MODULE_ID, "trackerPosition", {
    scope: "client",
    config: false,
    type: Object,
    default: null
  });

  // API accessible depuis des macros :
  //   const sm = game.modules.get("sante-mentale").api;
  //   sm.adjust(actor, -5);   sm.set(actor, 40);   sm.get(actor);
  const mod = game.modules.get(MODULE_ID);
  if (mod) {
    mod.api = {
      max: smMax,
      get: smCurrent,
      level: (actor) => smLevel(smCurrent(actor), smMax(actor)).name,
      shadow: (actor) => smShadow(actor)?.name ?? null,
      flaw: (actor) => smFlaw(actor, smLevel(smCurrent(actor), smMax(actor)))?.name ?? null,
      set: async (actor, value) => applyInput(actor, String(value)),
      adjust: async (actor, delta) =>
        applyInput(actor, (delta >= 0 ? "+" : "") + delta)
    };
  }
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | prêt — Santé Mentale = (SAG ×5) + (Mod INT ×2) + (Mod CHA ×2)`);
});

// Fiche AppV1 (dnd5e 3.x / 4.x)
Hooks.on("renderActorSheet", onRenderSheet);
// Fiche AppV2 (dnd5e 5.x sur Foundry v13)
Hooks.on("renderActorSheetV2", onRenderSheet);
