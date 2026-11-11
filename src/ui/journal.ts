import { GameEvent } from "../core/game";
import { ITEMS } from "../data/items";
import { PATHS } from "../data/skills";

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
  // Le dé de dégâts (Thomas) : « 1d6+2 : 4+2 → 6 dégâts » ; au critique, les dés sont doublés ; un bonus ajouté après
  // (charge, rage…) se voit entre parenthèses.
  const dmg = (() => {
    const d = r.damageRoll;
    if (!d) return `${r.damage} dégâts`;
    const label = `${r.critical ? d.dice.count * 2 : d.dice.count}d${d.dice.sides}${d.dice.bonus > 0 ? `+${d.dice.bonus}` : d.dice.bonus < 0 ? d.dice.bonus : ""}`;
    const parts = d.faces.join("+") + (d.dice.bonus > 0 ? `+${d.dice.bonus}` : d.dice.bonus < 0 ? `${d.dice.bonus}` : "");
    const extra = r.damage - d.rolled;
    return `${label} : ${parts}${extra > 0 ? ` (+${extra})` : ""} → ${r.damage} dégâts`;
  })();
  const outcome = r.critical ? `coup critique, ${dmg}` : r.hit ? `touché, ${dmg}` : r.d20 === 1 ? "échec critique" : "raté";
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
      if (found.kind === "gold") return `Bourse : or ×${e.count}`;
      // Une pierre précieuse : on dit sa valeur, pas son nom (Thomas).
      if (found.kind === "gem") return `Pierre précieuse : +${(found.value ?? 0) * e.count} or.`;
      return `Vous ramassez : ${found.name}${e.count > 1 ? ` ×${e.count}` : ""}.`;
    }
    case "levelup":
      return `Niveau ${e.level} ! Un point à attribuer (touchez votre portrait).`;
    case "death":
      return e.actor.kind === "hero" ? null : `${e.actor.name.charAt(0).toUpperCase()}${e.actor.name.slice(1)} est vaincu${e.actor.name.endsWith("e") ? "e" : ""}.`;
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
    case "furnitureFire": {
      if (e.kind === "webN") return "Le feu prend dans la toile et court de fil en fil !";
      if (e.kind.startsWith("web")) return "Une toile d'araignée s'embrase et disparaît.";
      if (e.kind === "door") return "Une porte de bois flambe et s'effondre en cendres.";
      if (e.kind === "chest") return "Un coffre brûle : son contenu roule à côté.";
      const name = e.kind.startsWith("bunk")
        ? "Un lit"
        : e.kind.startsWith("table")
          ? "La table"
          : e.kind.startsWith("rug")
            ? "Le tapis"
            : e.kind === "barrel"
              ? "Un tonneau"
              : e.kind.startsWith("crate")
                ? "Une caisse"
                : e.kind.startsWith("cocoon")
                  ? "Un cocon"
                  : e.kind === "eggSac"
                    ? "Un sac d'œufs"
                    : "Une chaise";
      return `${name} prend feu !`;
    }
    case "web":
      return `Une toile d'araignée ! Force : ${roll(e.roll, e.bonus, e.roll + e.bonus)} — ${e.escaped ? "vous la déchirez en passant." : "raté, vous voilà englué un tour."}`;
    case "webbed":
      return `La morsure de ${e.by.name.toLowerCase() === "araignée" ? "l'araignée" : e.by.name} vous englue : votre prochain pas servira à vous dégager.`;
    case "stuck":
      return "Vous vous dépêtrez des fils collants.";
    case "webSlow":
      return e.hub ? "La grande toile vous colle aux pieds : un tour de plus." : "Vous déchirez la toile qui vous colle aux pieds : un tour de plus.";
    case "breakWeb":
      if (e.kind === "cocoon") return "Vous crevez un cocon : elle ne s'en nourrira pas.";
      if (e.kind === "eggs") return "Vous écrasez un sac d'œufs.";
      return e.left > 0 ? `Vous tranchez une amarre de la grande toile (encore ${e.left}). La toile vibre…` : "Vous tranchez la dernière amarre !";
    case "boss":
      switch (e.what) {
        case "awake":
          return "La Tisseuse sent vos pas sur sa toile. Elle approche !";
        case "retreatCocoon":
          return "La Tisseuse recule vers un cocon pour s'en nourrir.";
        case "retreatHub":
          return "La Tisseuse remonte dans sa grande toile.";
        case "retreatRing":
          return "La Tisseuse file par une brèche et disparaît dans les couloirs…";
        case "eat":
          return `La Tisseuse dévore un cocon : elle reprend ${e.amount ?? 0} PV.`;
        case "hatch":
          return "Blessée, la Tisseuse fait éclore ses œufs : des araignées en sortent !";
        case "hatchNone":
          return "Blessée, la Tisseuse cherche ses œufs… il n'en reste plus.";
        case "lured":
          return "La flèche fait vibrer la toile. La Tisseuse s'y précipite.";
        case "fallen":
          return "La grande toile s'effondre : la Tisseuse tombe sur le dos, sonnée !";
        case "hubDown":
          return "La grande toile s'effondre : la Tisseuse n'a plus de refuge.";
        case "rise":
          return "La Tisseuse se remet sur ses pattes.";
        case "dead":
          return "La Tisseuse est morte. La toile qui scellait l'escalier tombe.";
      }
      return null;
    case "gravel":
      return e.alerted > 0 ? "Le gravier crisse sous vos pas : on vous a entendu !" : "Le gravier crisse sous vos pas.";
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
    case "trap": {
      const hero = e.victim.kind === "hero";
      const who = hero ? "Vous" : e.victim.name;
      if (e.kind === "pit") return hero ? `La dalle cède : vous tombez dans une fosse (${e.damage} dégâts) et devez en remonter.` : `${who} tombe dans une fosse : ${e.damage} dégâts.`;
      if (e.kind === "needle") return hero ? `Une aiguille empoisonnée vous pique (${e.damage} dégât).` : `${who} marche sur une aiguille empoisonnée.`;
      if (e.kind === "gas") return hero ? "Pschhh… un gaz vert s'échappe de la grille !" : `${who} libère un nuage de gaz vert.`;
      return hero ? `Vous marchez sur un piège à pointes : ${e.damage} dégâts.` : `${who} tombe sur un piège à pointes : ${e.damage} dégâts.`;
    }
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
    case "maiden": {
      const how = e.action === "pick" ? "Vous désamorcez le sarcophage" : "Vous forcez le sarcophage";
      const outcome = e.success ? "réussi, il s'ouvre sans mal." : `raté, une pointe jaillit : ${e.damage} dégâts. Il s'ouvre quand même.`;
      return `${how} : ${roll(e.d20, e.bonus, e.total)} — ${outcome} Un squelette y est pris ; ${e.gold} pièces d'or et ${ITEMS[e.item].name.toLowerCase()}${e.count > 1 ? ` ×${e.count}` : ""} tombent à côté.`;
    }
    case "chest":
      return `Le coffre s'ouvre : ${e.gold} pièces d'or et ${ITEMS[e.item].name.toLowerCase()}${e.count > 1 ? ` ×${e.count}` : ""} tombent à côté.`;
    case "used":
      return e.healed !== undefined ? `Vous mangez : ${ITEMS[e.item].name.toLowerCase()}, +${e.healed} PV.` : "Vous allumez une torche.";
    case "path":
      return `Vous suivez désormais la voie : ${PATHS[e.path].name}.`;
    case "skill":
      return e.path === "blue" ? `Second souffle : +${e.healed} PV.` : "Double frappe !";
    case "lastStand":
      return "Dernier rempart : vous tenez debout, à 1 PV.";
    case "fire":
      return "Vous lancez la potion : les flammes jaillissent !";
    case "burn":
      return e.actor.kind === "hero" ? `Vous brûlez : ${e.damage} dégâts.` : `${e.actor.name} brûle : ${e.damage} dégâts.`;
    case "potion":
      return e.potion === "youth"
        ? `Jouvence : vos points vous reviennent (${e.points} à attribuer).`
        : e.potion === "poison"
          ? "Vous enduisez votre arme de poison (15 coups)."
          : "Vous vous sentez vif : une attaque de plus pendant 4 tours.";
    case "alarm":
      return [
        "",
        "Une cloche sonne : le donjon s'agite.",
        "La cloche sonne encore : alerte.",
        "Traque ! L'étage sait où vous êtes.",
      ][e.stage] ?? null;
    case "dropped":
      return `Vous jetez : ${ITEMS[e.item].name}${e.count > 1 ? ` ×${e.count}` : ""}.`;
    case "slowed":
      return `${e.actor.name} est ralenti.`;
    case "torchOut":
      return "Votre torche s'éteint.";
    case "poisoned":
      return e.actor.kind === "hero" ? "Vous êtes empoisonné !" : `${e.actor.name} est empoisonné.`;
    case "poison":
      return e.actor.kind === "hero"
        ? `Le poison vous ronge : ${e.damage} dégât${e.damage > 1 ? "s" : ""}.`
        : `Le poison ronge ${e.actor.name} : ${e.damage} dégât${e.damage > 1 ? "s" : ""}.`;
    default:
      return null;
  }
}

/** Pourquoi une action de la roue est impossible (le bouton est grisé ; le journal l'explique si on le touche). */
export const REFUSALS = {
  skill: {
    none: "Votre voie n'a pas de compétence à utiliser ici.",
    used: "Plus d'utilisation à cet étage.",
    full: "Vous êtes déjà en pleine santé.",
    "no-target": "Aucun ennemi au contact.",
    danger: "Pas maintenant.",
  },
  hide: {
    hidden: "Vous êtes déjà caché.",
    threatened: "Impossible de se cacher : un ennemi est à votre contact.",
    watched: "Impossible de se cacher : un ennemi vous a en vue.",
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
