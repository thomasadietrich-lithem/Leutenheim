import { GameEvent } from "../core/game";
import { ITEMS } from "../data/items";
import { RULES } from "../data/rules";

/**
 * Tous les textes du journal (sous le dé), au même endroit : les règles produisent des événements, ce fichier dit
 * comment les raconter. Ce qui reste dans `main.ts`, ce sont les effets (sons, textes flottants, animations).
 * Règle : la difficulté à atteindre n'est jamais écrite, seulement le jet et son résultat.
 */

/** Ce qui ne figure pas dans l'événement lui-même mais change le texte. */
export interface JournalContext {
  /** Étage où l'on se trouve (après un escalier). */
  depth: number;
  /** Il ne reste plus aucune méthode pour ouvrir la porte : il faudra une clef. */
  doorHopeless: boolean;
}

/** « + 3 » ou « − 5 » : le bonus tel qu'on l'écrit sous le dé. */
function signed(bonus: number): string {
  return bonus >= 0 ? `+ ${bonus}` : `− ${-bonus}`;
}

function roll(d20: number, bonus: number, total: number): string {
  return `${d20} ${signed(bonus)} = ${total}`;
}

function describeAttack(e: Extract<GameEvent, { type: "attack" }>): string {
  const r = e.result;
  const who =
    e.attacker.kind === "hero"
      ? `${e.ranged ? "Vous tirez sur" : "Vous attaquez"} ${e.target.name}`
      : e.opportunity
        ? `Attaque d'opportunité de ${e.attacker.name}`
        : `${e.attacker.name} vous attaque`;
  const outcome = r.critical ? `coup critique, ${r.damage} dégâts` : r.hit ? `touché, ${r.damage} dégâts` : r.d20 === 1 ? "échec critique" : "raté";
  const mode =
    r.mode === "advantage" ? ` (avantage : ${r.rolls.join(" et ")})` : r.mode === "disadvantage" ? ` (désavantage : ${r.rolls.join(" et ")})` : "";
  return `${who} : ${r.d20} + ${r.bonus} = ${r.total}${mode} — ${outcome}`;
}

/** La ligne du journal pour un événement, ou `null` s'il ne s'écrit pas (il se voit ou s'entend seulement). */
export function describe(e: GameEvent, ctx: JournalContext): string | null {
  switch (e.type) {
    case "attack":
      return describeAttack(e);
    case "door": {
      if (e.action === "key") return "Vous ouvrez la porte avec la clef.";
      const what = e.action === "pick" ? "Vous crochetez la serrure" : "Vous enfoncez la porte";
      const outcome = e.action === "pick" ? (e.success ? "elle s'ouvre" : "raté") : e.success ? "elle cède" : "elle résiste";
      const dead = !e.success && ctx.doorHopeless ? " Il vous faudrait une clef." : "";
      return `${what} : ${roll(e.d20, e.bonus, e.total)} — ${outcome}.${dead}`;
    }
    case "arrow":
      if (!e.kept) return "La flèche se brise.";
      if (!e.hit) return e.via ? "La flèche rebondit et retombe au sol." : "La flèche se plante au sol.";
      return null;
    case "pickup": {
      const found = ITEMS[e.item];
      return found.kind === "gold" ? `Bourse : or ×${e.count}` : `Vous ramassez : ${found.name}${e.count > 1 ? ` ×${e.count}` : ""}.`;
    }
    case "levelup":
      return `Niveau ${e.level} ! Vous gagnez ${RULES.hpPerLevel} points de vie.`;
    case "death":
      return e.actor.kind === "hero" ? null : `${e.actor.name} est vaincu.`;
    case "bagFull":
      return "Le sac est plein : l'objet reste au sol.";
    case "stairs":
      return e.direction === "down"
        ? `Vous descendez à l'étage ${ctx.depth}.${e.healed > 0 ? ` Vous récupérez ${e.healed} PV.` : ""}`
        : `Vous remontez à l'étage ${ctx.depth}.`;
    case "hide":
      return `Vous vous cachez : ${roll(e.d20, e.bonus, e.total)} — ${e.success ? "réussi, les monstres perdent votre trace." : "raté, vous restez visible."}`;
    case "revealed":
      return "Vous sortez de l'ombre.";
    case "jump":
      return `Vous tentez de vous dégager : ${roll(e.d20, e.bonus, e.total)} — ${e.success ? "réussi, d'un bond." : "raté, vous restez au contact."}`;
    case "push": {
      const name = e.target.name;
      const outcome = !e.success
        ? `${name} ne bouge pas.`
        : e.slam > 0
          ? `${name} heurte le mur : ${e.slam} dégâts, il est sonné.`
          : e.moved
            ? `${name} recule, sonné.`
            : `${name} est bloqué, mais sonné.`;
      return `Vous poussez ${name} : ${roll(e.d20, e.bonus, e.total)} — ${outcome}`;
    }
    case "trap":
      return e.victim.kind === "hero" ? `Vous marchez sur un piège : ${e.damage} dégâts.` : `${e.victim.name} tombe sur un piège : ${e.damage} dégâts.`;
    case "search":
      return e.phase === "start" ? "Vous fouillez la salle…" : "Fouille interrompue : un ennemi approche !";
    case "searched": {
      const outcome = !e.success ? "vous ne trouvez rien." : e.found.length > 0 ? "vous découvrez une cache !" : "rien n'est caché ici.";
      return `Vous fouillez la salle : ${roll(e.d20, e.bonus, e.total)} — ${outcome}`;
    }
    case "rest":
      return e.phase === "start"
        ? "Vous vous installez pour vous reposer…"
        : e.phase === "interrupted"
          ? "Repos interrompu : un ennemi approche !"
          : `Vous vous êtes reposé : +${e.healed} PV.`;
    case "fountain":
      return e.healed > 0 ? `Vous buvez à la fontaine : +${e.healed} PV. Elle se tarit.` : "Vous buvez à la fontaine. Elle se tarit.";
    case "chest":
      return `Le coffre contient ${e.gold} pièces d'or.`;
    case "used":
      return e.healed !== undefined ? `Vous mangez : ${ITEMS[e.item].name.toLowerCase()}, +${e.healed} PV.` : "Vous allumez une torche.";
    case "torchOut":
      return "Votre torche s'éteint.";
    case "poisoned":
      return `${e.actor.name} est empoisonné.`;
    case "poison":
      return `Le poison ronge ${e.actor.name} : ${e.damage} dégât${e.damage > 1 ? "s" : ""}.`;
    default:
      return null;
  }
}

/** Pourquoi une action de la roue est impossible (le bouton est grisé ; le journal l'explique si on le touche). */
export const REFUSALS = {
  hide: {
    hidden: "Vous êtes déjà caché.",
    threatened: "Impossible de se cacher : un ennemi est à votre contact.",
    "no-cover": "Rien pour vous cacher ici : il faut une colonne à côté de vous, ou un angle de mur.",
    torch: "Impossible de se cacher avec une torche allumée.",
  },
  disengage: {
    safe: "Aucun ennemi au contact : rien à quoi se dérober.",
    "no-room": "Pas la place de sauter : tout est bouché autour de vous.",
  },
  search: {
    corridor: "Il n'y a rien à fouiller ici : placez-vous dans une salle.",
    searched: "Vous avez déjà fouillé cette salle.",
    danger: "Impossible de fouiller : un ennemi est en vue.",
  },
  rest: {
    full: "Vous êtes en pleine forme : inutile de vous reposer.",
    used: "Vous vous êtes déjà reposé à cet étage.",
    danger: "Impossible de se reposer : un ennemi est en vue.",
  },
} as const;
