import { QUEST_TASKS } from "../data/quests";
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
  /** Le héros voit-il ce personnage ? (Une querelle hors de vue ne s'écrit pas.) */
  sees?: (a: { x: number; y: number }) => boolean;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
/** « le Kobold », « l'araignée », « la Tisseuse ». */
const the = (n: string): string => (/^(la |le |l')/i.test(n) ? n : /^[aeiouyéh]/i.test(n) ? `l'${n.toLowerCase()}` : `le ${n}`);

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
      // La porte du poulet : rien n'y fait, jamais.
      if (e.sealed) {
        const tried = e.action === "pick" ? "Vous crochetez la serrure" : "Vous enfoncez la porte";
        return `${tried} : ${roll(e.d20, e.bonus, e.total)} — rien. Elle ne bouge pas d'un pouce. On dirait qu'elle attend quelque chose.`;
      }
      const what = e.action === "pick" ? "Vous crochetez la serrure" : "Vous enfoncez la porte";
      const outcome = e.action === "pick" ? (e.success ? "elle s'ouvre" : "raté") : e.success ? "elle cède" : "elle résiste";
      const dead = !e.success && ctx.doorHopeless ? " Il vous faudrait une clef." : "";
      return `${what} : ${roll(e.d20, e.bonus, e.total)} — ${outcome}.${dead}`;
    }
    case "chicken":
      if (!e.door) {
        return e.seen
          ? "Le poulet prend peur, file droit devant et s'écrase contre un mur dans un nuage de plumes."
          : "Le poulet prend peur et détale… Au loin, un choc mou. Un poulet semble s'être viandé contre un mur ; il faudrait peut-être investiguer.";
      }
      return e.seen
        ? "Le poulet prend peur, file à travers le donjon, défonce la porte et s'écrase contre le mur du fond dans un nuage de plumes."
        : "Le poulet prend peur et détale… Au loin, un fracas. Un poulet semble s'être viandé contre un mur ; il faudrait peut-être investiguer.";
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
      return `Niveau ${e.level} ! Un point à attribuer.`;
    case "death":
      return e.actor.kind === "hero" ? null : e.actor.name.endsWith("e") ? `${capFirst(e.actor.name)} est vaincue.` : `${capFirst(e.actor.name)} est vaincu.`;
    case "npc": {
      if (e.what !== "leave") return null;
      const name = e.who === "gluck" ? "Gluck" : e.who === "soeur" ? "Sœur Osseuse" : "Krik";
      const apples = (e.drops ?? []).some((d) => d.item === "pomme");
      const gold = (e.drops ?? []).some((d) => d.item === "or");
      const why = e.fled === "fire"
        ? (e.who === "gluck" ? " Gluck détale, la queue en feu : « Aïe aïe aïe ! » —" : e.who === "soeur" ? " « Mes os ! Mon voile ! » Sœur Osseuse s'enfuit en flammes —" : " « Je brûle ! C'est vrai, en plus ! » Krik détale —")
        : e.fled === "gas"
          ? (e.who === "gluck" ? " Gluck s'étrangle, tousse et file —" : e.who === "soeur" ? " Sœur Osseuse tousse… sans poumons, mais elle s'en va —" : " « C'est du poison ! Je le sais, je l'ai volé ! » Krik file —")
          : "";
      return `${why ? why.trim() + " " : ""}Pouf ! ${name} disparaît dans un petit nuage.${apples ? " Des pommes roulent par terre." : ""}${gold ? " De l'or tinte sur les dalles." : ""}`;
    }
    case "statue":
      if (e.look) return "Une statue de pierre. Froide, lourde… et pleine, on dirait.";
      return e.success
        ? `Jet de force : d20 ${e.d20} + ${e.bonus} = ${e.total} — CRAC ! La statue s'effondre. Quelque chose brille dans les gravats.`
        : `Jet de force : d20 ${e.d20} + ${e.bonus} = ${e.total} — BONG. La statue tient bon.`;
    case "luck":
      return "Chance ! Votre 1 est relancé.";
    case "npcRoll":
      return `Jet de ${e.stat.toLowerCase()} : d20 ${e.d20} ${e.bonus < 0 ? "−" : "+"} ${Math.abs(e.bonus)} = ${e.total} — ${e.success ? "réussi" : "raté"}.`;
    case "counter":
      if (e.what === "count") return e.first ? `Derrière cette porte, une petite voix compte : « ${e.n}… ${e.n}… ${e.n}… »` : null;
      if (e.what === "poke") return `Vous collez l'œil au trou… un doigt crasseux s'y enfonce tout droit. Aïe ! Derrière, la voix reprend : « ${e.n}… ${e.n}… ${e.n}… »`;
      return `Derrière la porte, un petit Kobold, le doigt encore en l'air, vous regarde : « …${e.n} ? »`;
    case "bell": {
      // La cloche d'alarme : on se moque gentiment du héros (Thomas, 2026-11-12). Depuis le synopsis (2026-11-13) : ce
      // n'est PAS la cloche volée de Leutenheim, juste une cloche à vache. Mais elle réveille quand même tout l'étage.
      const first = [
        "CLONC ! Ce n'est pas la cloche de Leutenheim : c'est une cloche à vache. Tout l'étage vous a quand même entendu.",
        "CLONC ! Fausse joie : une cloche à vache. Les Kobolds, eux, ont bien entendu.",
      ];
      const again = [
        "CLONC ! Toujours pas la bonne cloche.",
        "CLONC ! Quelque part, une vache répond.",
        "CLONC ! Les Kobolds accourent, déçus que ce ne soit que vous.",
        "CLONC ! Le donjon applaudit votre sens de la discrétion.",
        "CLONC ! La vraie, elle, sonne sous vos pieds. Celle-ci sonne surtout l'alerte.",
      ];
      const pool = e.rings === 1 ? first : again;
      return pool[e.joke % pool.length];
    }
    case "feud":
      return ctx.sees?.(e.a) || ctx.sees?.(e.b)
        ? e.reason === "shot"
          ? `La pierre du frondeur frappe ${the(e.a.name)}, qui se retourne contre lui !`
          : e.reason === "discord"
          ? `La potion de discorde éclate : ${the(e.a.name)} et ${the(e.b.name)} se jettent l'un sur l'autre !`
          : e.reason === "species"
          ? `${cap(the(e.a.name))} se jette sur ${the(e.b.name)} ! Entre araignées et Kobolds, ce n'est pas l'amour fou.`
          : e.reason === "fog"
          ? `Dans le brouillard, ${the(e.a.name)} et ${the(e.b.name)} se cognent… et se battent !`
          : `${cap(the(e.a.name))} et ${the(e.b.name)} se bloquent le passage… et en viennent aux mains !`
        : null;
    case "infight":
      return null;
    case "heavyBlow":
      return e.kind === "stun" ? `Le coup assomme ${e.actor.name} : il perd son prochain tour.`
        : e.kind === "knockback" ? `Coup critique : ${e.actor.name} est projeté en arrière !` : `D'un seul coup !`;
    case "bounce":
      if (e.messy) return `Pas de place d'un seul tenant : ${ITEMS[e.item].name.toLowerCase()}${e.count > 1 ? ` ×${e.count}` : ""} tombe par terre. Rangez le sac pour lui faire un trou.`;
      return `Sac plein : ${ITEMS[e.item].name.toLowerCase()}${e.count > 1 ? ` ×${e.count}` : ""} tombe par terre.`;
    case "bagFull":
      if (e.messy) return "Il reste de la place, mais pas d'un seul tenant : rangez le sac (touchez un objet, puis une case libre).";
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
    case "trapDodged":
      return `Un piège ! Agilité : ${roll(e.d20, e.bonus, e.d20 + e.bonus)} — vous l'évitez d'un bond.`;
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
      if (e.water) return e.alerted > 0 ? "Plic, ploc : l'eau clapote sous vos pas… on vous a entendu !" : null;
      return e.alerted > 0 ? "Le gravier crisse sous vos pas : on vous a entendu !" : "Le gravier crisse sous vos pas.";
    case "jump":
      return `Vous tentez de vous dégager : ${roll(e.d20, e.bonus, e.total)} — ${e.success ? "réussi, d'un bond." : "raté, vous restez au contact."}`;
    case "getUp":
      return null;
    case "push": {
      const name = e.target.name;
      const outcome = !e.success
        ? `${name} ne bouge pas.`
        : e.slam > 0
          ? `${name} heurte le mur : ${e.slam} dégâts, il tombe à la renverse.`
          : e.prone
            ? `${name} tombe à la renverse !`
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
      const traps = e.traps?.length ?? 0;
      const outcome = !e.success
        ? "vous ne trouvez rien."
        : e.found.length > 0 && traps > 0
          ? "vous découvrez une cache et un piège caché !"
          : e.found.length > 0
            ? "vous découvrez une cache !"
            : traps > 0
              ? "vous repérez un piège caché !"
              : "rien n'est caché ici.";
      return `Vous fouillez la salle : ${roll(e.d20, e.bonus, e.total)} — ${outcome}`;
    }
    case "rest":
      return e.phase === "start"
        ? "Vous vous installez pour vous reposer…"
        : e.phase === "interrupted"
          ? "Repos interrompu : un ennemi approche !"
          : `Vous vous êtes reposé : +${e.healed} PV.`;
    case "fountain":
      return `Vous croquez la pomme dorée de l'autel${e.healed > 0 ? ` : +${e.healed} PV` : ""}. Une douce chaleur vous enveloppe : vous êtes béni (+1 à l'attaque, +1 CA).`;
    case "blessEnd":
      return "La bénédiction de l'autel s'estompe.";
    case "maiden": {
      const how = e.action === "pick" ? "Vous désamorcez le sarcophage" : "Vous forcez le sarcophage";
      const outcome = e.success ? "réussi, il s'ouvre sans mal." : `raté, une pointe jaillit : ${e.damage} dégâts. Il s'ouvre quand même.`;
      return `${how} : ${roll(e.d20, e.bonus, e.total)} — ${outcome} Un squelette y est pris ; ${e.gold} pièces d'or et ${ITEMS[e.item].name.toLowerCase()}${e.count > 1 ? ` ×${e.count}` : ""} tombent à côté.`;
    }
    case "shop":
      return "Le Colporteur ouvre son sac.";
    case "bought":
      return `Vous achetez ${ITEMS[e.item].name.toLowerCase()}${e.count > 1 ? ` ×${e.count}` : ""} au Colporteur : ${e.price} or.`;
    case "sold":
      return `Vous vendez ${ITEMS[e.item].name.toLowerCase()}${e.count > 1 ? ` ×${e.count}` : ""} au Colporteur : +${e.price} or.`;
    case "merchantHides":
      return "Des pas approchent : le Colporteur se fond dans l'ombre.";
    case "merchantLeaves":
      return e.seen ? "Trop de bruit : le Colporteur plie bagage et disparaît." : "Quelque part, le Colporteur a plié bagage : trop de bruit sur cet étage.";
    case "merchantShows":
      return "Le Colporteur ressort de l'ombre.";
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
          : e.potion === "stone"
            ? "Votre peau se fige… vous voilà statue. Les monstres ne vous voient plus."
          : e.potion === "urchin"
            ? "Des piquants vous hérissent la peau : qui vous frappe s'y pique."
          : e.potion === "grow"
            ? "Vous grandissez d'un coup ! Vos coups font deux fois plus mal… mais les portes sont trop étroites."
            : "Vous vous sentez vif : une attaque de plus pendant 4 tours.";
    case "bath":
      return e.what === "splash"
        ? "SPLASH ! Le Kobold bondit hors de son bain, couvert de mousse, une serviette à la main."
        : e.what === "scratch"
          ? "Scrrratch ! Le disque s'arrête. Dans la baignoire, quelqu'un grogne."
          : e.what === "towel"
            ? "Un coup de serviette en pleine figure : votre prochain coup sera moins précis."
            : "« AU SECOURS ! ON M'ATTAQUE DANS MON BAIN ! » Le Kobold s'enfuit en glissant.";
    case "thorns":
      return `${capFirst(e.actor.name)} se pique : ${e.damage} dégât${e.damage > 1 ? "s" : ""}.`;
    case "grow":
      if (e.actor.kind === "hero") return e.back ? "Vous rétrécissez : vous repassez les portes." : null;
      return e.back ? `${capFirst(e.actor.name)} reprend sa taille.` : `${capFirst(e.actor.name)} grandit d'un coup ! Ses coups feront deux fois plus mal, mais il ne passe plus les portes.`;
    case "slippery":
      return `${capFirst(e.actor.name)} est couvert d'huile : chaque coup le fera glisser.`;
    case "slide":
      return e.bumps > 0
        ? `${capFirst(e.actor.name)} glisse, rebondit contre le mur${e.bumps > 1 ? " deux fois" : ""} et se cogne (${e.damage} dégâts).`
        : `${capFirst(e.actor.name)} glisse sur ${e.path.length} cases.`;
    case "bossPotion":
      return e.potion === "stone"
        ? "La carapace de la Tisseuse se fige… mais elle s'en dégage vite (2 tours)."
        : e.potion === "discord"
          ? "Prise de folie, la Tisseuse se mord les pattes !"
          : e.potion === "grow"
            ? "La Tisseuse grandit encore. Ses morsures feront deux fois plus mal…"
            : e.potion === "slip"
              ? "La Tisseuse dérape sur ses propres pattes : chaque coup la fera glisser."
              : e.potion === "smoke"
                ? "Dans la fumée, la Tisseuse perd votre piste un instant."
                : e.potion === "fog"
                  ? "Dans le brouillard, la Tisseuse ne sent plus que ce qui la touche."
                  : null;
    case "stone":
      return e.what === "heroBack" ? "La pierre se fissure : vous pouvez de nouveau bouger." : e.what === "petrified" ? `${capFirst(e.actor.name)} se change en pierre.` : `${capFirst(e.actor.name)} redevient chair et os.`;
    case "flee":
      return `${capFirst(e.actor.name)} détale, la queue entre les jambes !`;
    case "lullaby":
      return `Quelques notes de flûte… ${e.actor.name} s'endort.`;
    case "doused":
      return e.actor.kind === "hero" ? "Pschh ! L'eau éteint vos flammes." : null;
    case "quest":
      if (e.what === "fail" && e.id === "krik_magot" && !e.gold) return "Krik attendra son magot longtemps.";
      if (e.what === "fail") return QUEST_TASKS[e.id].failed.replace("{0}", String(e.gold ?? 0));
      if (e.what === "lost") return "Quête perdue : la personne qui l'avait donnée s'est enfuie.";
      if (e.what === "start") return `Nouvelle quête — ${QUEST_TASKS[e.id].goal.replace(/ \{0\}\/\{1\}$/, "")}.`;
      return null;
    case "krikReturn":
      return e.amount > 0
        ? `Un petit Kobold coursier vous rattrape : « De la part de Krik. » ${e.amount} pièces ! Il avait dit vrai.`
        : "Un petit Kobold coursier vous rattrape : « De la part de Krik : il a tout revendu trois fois. Désolé. » Votre investissement est perdu.";
    case "alarmDown":
      return ["Le donjon se calme.", "Le donjon se calme un peu : il n'est plus qu'agité.", "La traque s'essouffle : l'étage reste en alerte."][e.stage] ?? null;
    case "alarm":
      return [
        "",
        "Une cloche sonne : le donjon s'agite.",
        "La cloche sonne encore : alerte.",
        "Traque ! L'étage sait où vous êtes.",
      ][e.stage] ?? null;
    case "potionThrown":
      return e.potion === "poison" ? "La fiole éclate : un nuage vert empoisonné se répand." : null;
    case "shatter":
      return e.potion === "fire"
        ? "La fiole se brise sur les dalles : le feu prend !"
        : e.potion === "poison"
          ? "La fiole se brise sur les dalles : un petit nuage vert s'en échappe."
          : "La fiole se brise sur les dalles. Quel gâchis.";
    case "dropped":
      return `Vous jetez : ${ITEMS[e.item].name}${e.count > 1 ? ` ×${e.count}` : ""}.`;
    case "slowed":
      return `${e.actor.name} est ralenti.`;
    case "torchOut":
      return "Votre torche s'éteint.";
    case "poisoned":
      if (e.immune) return `${capFirst(e.actor.name)} ne craint pas le poison.`;
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
    "no-cover": "Rien pour vous cacher : il faut une colonne ou un angle de mur.",
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

function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
