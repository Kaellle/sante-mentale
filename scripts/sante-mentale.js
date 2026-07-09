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

/** Niveaux d'état, du meilleur au pire. */
const LEVELS = [
  { minPct: 90, name: "Stable",        cls: "sm-stable" },
  { minPct: 75, name: "Stressé",       cls: "sm-stresse" },
  { minPct: 50, name: "Perturbé",      cls: "sm-perturbe" },
  { minPct: 25, name: "Instable",      cls: "sm-instable" },
  { minPct: 10, name: "Déséquilibré",  cls: "sm-desequilibre" },
  { minPct: 1,  name: "Brisé",         cls: "sm-brise" },
  { minPct: -Infinity, name: "Perdu",  cls: "sm-perdu" }
];

function smLevel(current, max) {
  const pct = max > 0 ? (current / max) * 100 : 0;
  return LEVELS.find(l => pct >= l.minPct) ?? LEVELS[LEVELS.length - 1];
}

/* ------------------------------------------------------------------ */
/*  Modification de la valeur                                          */
/* ------------------------------------------------------------------ */

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

  if (next !== cur) await actor.setFlag(MODULE_ID, "value", next);
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

  const el = document.createElement("div");
  el.classList.add("sm-tracker");
  el.dataset.tooltip = "Santé Mentale — tapez une valeur, ou +X / -X";
  el.innerHTML = `
    <span class="sm-label">Santé Mentale</span>
    <div class="sm-values">
      <input type="text" class="sm-current" value="${cur}" ${editable ? "" : "disabled"}>
      <span class="sm-sep">/</span>
      <span class="sm-max">${max}</span>
    </div>
    <span class="sm-level ${lvl.cls}">${lvl.name}</span>
  `;

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
    await actor.setFlag(MODULE_ID, "value", next);

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<em>${actor.name} récupère 1 point de Santé Mentale (repos long) : ${next}/${max}.</em>`
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
