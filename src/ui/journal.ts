import { QUEST_TASKS } from "../data/quests";
import { GameEvent } from "../core/game";
import { ItemDef, ITEMS } from "../data/items";
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
    case "arrow": {
      // Le nom du projectile vient de l'objet (règle : chaque arme de jet donne `single`).
      const what = (e.ammo && (ITEMS[e.ammo] as ItemDef).single) || "La flèche";
      if (e.planted) return null;
      if (!e.kept) return e.endless ? null : `${what} se brise.`;
      if (!e.hit) return e.via ? `${what} rebondit et retombe au sol.` : `${what} se plante au sol.`;
      return null;
    }
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
      // Le bon nom pour chaque PNJ (Thomas, 2026-11-17 : « Krik » s'affichait quand Morillon partait, en section 2).
      const name = ({ gluck: "Gluck", soeur: "Sœur Osseuse", krik: "Krik", grum: "Grum", fifrelin: "Fifrelin", morillon: "Morillon", vernis: "Vernis", maestro: "Le Maestro", plumeau: "Plumeau", clavicule: "Sœur Clavicule", osselet: "Maître Osselet" } as Record<string, string>)[e.who] ?? "Krik";
      const apples = (e.drops ?? []).some((d) => d.item === "pomme");
      const gold = (e.drops ?? []).some((d) => d.item === "or");
      const why = e.fled === "fire"
        ? (e.who === "gluck" ? " Gluck détale, la queue en feu : « Aïe aïe aïe ! » —" : e.who === "soeur" ? " « Mes os ! Mon voile ! » Sœur Osseuse s'enfuit en flammes —" : e.who === "krik" ? " « Je brûle ! C'est vrai, en plus ! » Krik détale —" : ` « Au feu ! » ${name} détale —`)
        : e.fled === "gas"
          ? (e.who === "gluck" ? " Gluck s'étrangle, tousse et file —" : e.who === "soeur" ? " Sœur Osseuse tousse… sans poumons, mais elle s'en va —" : e.who === "krik" ? " « C'est du poison ! Je le sais, je l'ai volé ! » Krik file —" : ` ${name} tousse et file —`)
          : "";
      return `${why ? why.trim() + " " : ""}Pouf ! ${name} disparaît dans un petit nuage.${apples ? " Des pommes roulent par terre." : ""}${gold ? " De l'or tinte sur les dalles." : ""}`;
    }
    case "statue":
      if (e.look) return "Une statue de pierre. Froide, lourde… et pleine, on dirait.";
      if (e.grille)
        return e.success
          ? `Jet de force : d20 ${e.d20} + ${e.bonus} = ${e.total} — CLANG ! La grille s'arrache de ses gonds.`
          : `Jet de force : d20 ${e.d20} + ${e.bonus} = ${e.total} — CLANG. La grille tremble, mais tient. Tout l'étage a entendu.`;
      return e.success
        ? `Jet de force : d20 ${e.d20} + ${e.bonus} = ${e.total} — CRAC ! La statue s'effondre. Quelque chose brille dans les gravats.`
        : `Jet de force : d20 ${e.d20} + ${e.bonus} = ${e.total} — BONG. La statue tient bon.`;
    case "luckyDie":
      return "Le d20 enchanté s'illumine : votre 1 devient un 20. Coup critique !";
    case "luck":
      return "Chance ! Votre 1 est relancé.";
    case "stubborn":
      return "Têtu ! Vous relancez le dé.";
    case "opportunist":
      return `${capFirst(e.actor.name)} s'éloigne : vous en profitez pour frapper, avec l'avantage.`;
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
      if (e.reason === "bout") return "GONG ! Grosse-Dent et Fil-de-Fer se jettent l'un sur l'autre. Fifrelin hurle les cotes.";
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
    case "bout":
      if (e.what === "duelWin") return `Grosse-Dent s'écroule. Fifrelin, livide, vous tend la caisse du tripot : ${e.gold} or.`;
      if (e.what === "caught") return null;
      return e.what === "win"
        ? `${e.winner === "small" ? "Fil-de-Fer" : "Grosse-Dent"} l'emporte, salue la foule et disparaît dans un nuage de fumée. Pari gagné : Fifrelin vous paie ${e.gold} or.`
        : `${e.winner === "small" ? "Fil-de-Fer" : "Grosse-Dent"} l'emporte, salue la foule et disparaît dans un nuage de fumée. Pari perdu.`;
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
    case "disarm":
      return e.success
        ? `Désamorcer : ${roll(e.d20, e.bonus, e.total)} — le piège ne fera plus de mal.`
        : e.sprung
          ? `Désamorcer : ${roll(e.d20, e.bonus, e.total)} — clac ! Le piège part sous vos doigts.`
          : `Désamorcer : ${roll(e.d20, e.bonus, e.total)} — le mécanisme résiste. Vous pouvez réessayer.`;
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
          if (e.kind === "carillon") return null;
          if (e.kind === "pretresse") return "La Grande Prêtresse s'effondre au pied du socle vide. Les chaînes pendent, brisées : la cloche n'est plus là. Elle sonne encore plus bas.";
          return e.fled && e.fled.length > 0
            ? "La Tisseuse est morte. Ses petits détalent… et disparaissent dans un nuage de fumée."
            : "La Tisseuse est morte. La toile qui scellait l'escalier tombe.";
      }
      return null;
    case "gravel":
      if (e.monster) return null;
      if (e.water) return e.alerted > 0 ? "Plic, ploc : l'eau clapote sous vos pas… on vous a entendu !" : null;
      return e.alerted > 0 ? "Le gravier crisse sous vos pas : on vous a entendu !" : "Le gravier crisse sous vos pas.";
    case "jump":
      return `Vous tentez de vous dégager : ${roll(e.d20, e.bonus, e.total)} — ${e.success ? "réussi, d'un bond." : "raté, vous restez au contact."}`;
    case "getUp":
      return null;
    case "rise":
      return e.what === "down"
        ? "Le Kobold envahi s'effondre… mais le champignon sur son crâne palpite encore. Achevez-le, ou brûlez-le !"
        : "Le Kobold envahi se relève, tiré par son champignon.";
    case "beam":
      return e.what === "charge"
        ? "Le crâne lunaire se charge : une ligne de lumière s'allume… Sortez-en !"
        : `Le rayon de lune part sur toute la ligne (${e.damage ?? 0} dégâts à qui s'y trouve).`;
    case "numb":
      return "Engourdi par l'encens, vous perdez ce tour.";
    case "priestess":
      switch (e.what) {
        case "awake":
          return "La Grande Prêtresse lève son bâton. « La Lune pâle vous voit. » Éteignez ses cierges, restez dans l'ombre, frappez-la quand elle chante.";
        case "call":
          return "Elle appelle la lune : un cercle s'allume. Le puits va y glisser, et les gisants qu'il touchera se lèveront.";
        case "moved":
          return "Le puits de lune glisse sur les dalles.";
        case "snuff":
          return e.left === 0 ? "Vous soufflez le dernier cierge violet : le puits n'est plus qu'un filet de lune." : `Vous soufflez un cierge violet : la lune rétrécit (encore ${e.left ?? 0}).`;
        case "colossus":
          return "Blessée, la Prêtresse monte chanter dans la lumière. Tous les os de la salle se lèvent : le Colosse ! Cassez ses bras, ou son crâne, pour mettre son cœur à nu.";
        case "regrow":
          return "Dans la lune, un morceau du Colosse se ressoude !";
        case "partDown":
          return "Un morceau du Colosse se brise.";
        case "colossusDown":
          return "Le cœur de lune éclate : le Colosse s'écroule. La Prêtresse retombe, épuisée !";
        case "aloft":
          return "Elle chante dans le puits, hors d'atteinte : il faut la toucher de loin.";
      }
      return null;
    case "enigma":
      return ({
        locked: "Le coffre d'argent est fermé à clef : il faut la clef d'argent de cette salle.",
        opened: "La clef d'argent tourne dans la serrure : le coffre s'ouvre.",
        planted: "La flèche se plante dans la cible.",
        recoil: "Touchée par la flèche de recul, la cible bleue recule : le passage est ouvert !",
        bounce: "La flèche rebondit sur les cibles noires… mais pas sur toutes.",
        key: "La flèche a touché toutes les cibles noires : une clef d'argent tombe au fond de la salle !",
        plate: "Sous votre poids de géant, la grande dalle s'enfonce.",
        gate: "Dans un grincement de chaînes, la herse se lève.",
        seen: "Les yeux du gardien s'allument : la herse tombe ! Elle se relèvera quand vous serez sorti.",
        lift: "Derrière vous, la herse se relève.",
        torch: "À la lumière de la torche, des pièges apparaissent… et des croix de craie sur les dalles sûres.",
        sink: "La glace cède : vous regagnez la rive, trempé.",
      } as Record<string, string>)[e.what] ?? null;
    case "iceSlide":
      return "Vous glissez sur la glace, la traversez d'un trait… et tombez de l'autre côté.";
    case "frost":
      return e.what === "freeze" ? `${capFirst(e.actor.name)} gèle sur place.` : `La glace craque : ${e.actor.name} dégèle.`;
    case "undead":
      switch (e.what) {
        case "pile":
          return "Le squelette s'effondre en tas d'os… Si la lune le touche, il se relèvera. Brisez-lui le crâne !";
        case "crush":
          return "Crac ! Le crâne éclate : ce squelette ne se relèvera plus.";
        case "rise":
          return "Les os s'assemblent, la lune les relève : le squelette est debout.";
        case "chant0":
          return "L'acolyte lève les bras et entonne un chant… Frappez-le avant qu'il chante !";
        case "chant":
          return "L'acolyte chante pour la Lune pâle : les morts autour de lui reprennent des forces.";
        case "daze":
          return "Frappé en plein chant, l'acolyte s'étrangle : il est sonné.";
        case "wake":
          return "La pierre craque… Le gisant se lève de sa dalle !";
        case "rest":
          return "Loin de la lune, le gisant se recouche et redevient pierre.";
        case "eat":
          return `Un rat d'ossuaire dévore ${e.item ? ITEMS[e.item as keyof typeof ITEMS]?.name.toLowerCase() ?? "la nourriture" : "la nourriture"} laissée au sol. Il l'a mangée !`;
      }
      return null;
    case "alembic":
      return `Vous ouvrez le robinet de l'alambic : une fiole se remplit, tiède et luisante. (${ITEMS[e.item].name})`;
    case "burst":
      return "Pouf ! Le sporelin éclate en un nuage de spores.";
    case "whistle":
      return "Le Kobold cueilleur porte un sifflet à son masque : FUIIIT ! L'étage est prévenu.";
    case "lostTrack":
      return "Le myconide s'arrête et tend son chapeau : il ne vous entend plus.";
    case "secret":
      return e.what === "glimpse"
        ? "Par un creux du mur, vous apercevez… une pièce, de l'autre côté. Fouiller cette salle la trouverait peut-être."
        : "Un pan de mur cède sous vos doigts : une pièce secrète !";
    case "zone":
      if (e.what === "found") return "Toc, toc… Ce tonneau dans le mur sonne creux. Il y a quelque chose derrière : poussez-le !";
      if (e.what === "pushed") return "Vous poussez : ça glisse, et derrière, un passage !";
      if (e.what === "stuck") return "Vous poussez de toutes vos forces… ça ne bouge pas. Encore !";
      if (e.what === "wall") return "Un grondement : derrière l'autel, un pan de mur coulisse. La sacristie !";
      if (e.what === "cierge") return (e.woke ?? 0) >= 3 ? "Le troisième cierge s'allume." : `Le cierge s'allume (${e.woke ?? 1} sur 3).`;
      if (e.what === "noflame") return "Il vous faut une flamme : une torche, allumée ou dans le sac.";
      if (e.what === "bell") return "Sous la grille, très loin, très bas… une cloche sonne. La cloche de Leutenheim !";
      if (e.what === "hen") return "Vous attrapez la poule d'or ! Elle caquète, outrée.";
      if (e.what === "henFlees") return "Côt côt ! La poule d'or détale. Approchez-la sans vous montrer.";
      if (e.what === "hat") return "Vous coiffez l'épouvantail de votre casque. Il a l'air ravi. Enfin, il a l'air.";
      if (e.what === "nohat") return "Il vous faut un casque dans le sac.";
      if (e.what === "complice") return "Sous la caisse retournée, un Kobold ! Le complice de Fifrelin bondit sur vous.";
      if (e.what === "courier") return "Le coursier file dans l'escalier avec votre mise. « À l'étage suivant ! »";
      if (e.what === "courierLost") return "Un monstre attrape le coursier : il lâche tout et s'enfuit. Votre mise est perdue.";
      if (e.what === "thief") return "« AU VOLEUR ! » Gluck se réveille en sursaut, et tout le cellier avec lui.";
      return e.what === "tapestry"
        ? "Vous tranchez la tapisserie : derrière, un passage."
        : e.what === "candle"
          ? "Vous soufflez la bougie. Le noir. Les dormeurs n'entendront plus rien."
          : e.what === "plate"
            ? (e.woke ?? 0) > 1
              ? `Clac ! La dalle s'enfonce, une niche s'ouvre… et le bruit réveille ${e.woke} dormeurs !`
              : e.woke
                ? "Clac ! La dalle s'enfonce, une niche s'ouvre… et le bruit réveille un dormeur !"
                : "Clac ! La dalle s'enfonce, une niche s'ouvre."
            : null;
    case "sandboxReset":
      return "De retour au HUB : toutes les salles d'essai sont remises à neuf.";
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
      if (e.kind === "snare") return hero ? "Des fils pâles se dressent et vous ligotent : deux tours pour vous en défaire." : `${who} se fait ligoter par le mycélium.`;
      if (e.kind === "hooks") return hero ? `Des racines-crochets jaillissent du sol (${e.damage} dégâts) et vous retiennent.` : `${who} se fait harponner par des racines : ${e.damage} dégâts.`;
      if (e.kind === "spores") return hero ? "Pouf ! Les vesses-de-loup crèvent en un nuage de spores." : `${who} écrase des vesses-de-loup : un nuage de spores.`;
      if (e.kind === "tombSlab") return hero ? `La dalle bascule : vous tombez dans un caveau (${e.damage} dégâts) et devez en remonter.` : `${who} tombe dans un caveau : ${e.damage} dégâts.`;
      if (e.kind === "boneHands") return hero ? `Des mains d'os jaillissent du sol et vous agrippent les chevilles (${e.damage} dégâts) : deux tours pour vous dégager.` : `${who} se fait agripper par des mains d'os.`;
      if (e.kind === "censer") return hero ? "L'encensoir crache un nuage violet : l'encens engourdit." : `${who} renverse un encensoir : un nuage violet.`;
      if (e.kind === "moonMirror") return hero ? "Le miroir renvoie la lune : un éclair froid ! Tout l'ossuaire vous a vu, et les morts autour s'agitent." : `${who} marche sur un miroir de lune : la lumière jaillit.`;
      if (e.kind === "pendulum") return hero ? `La lame pendule vous fauche au passage : ${e.damage} dégâts.` : `${who} se fait faucher par la lame pendule : ${e.damage} dégâts.`;
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
      return e.corridor ? `Vous fouillez les environs : ${roll(e.d20, e.bonus, e.total)} — ${outcome}` : `Vous fouillez la salle : ${roll(e.d20, e.bonus, e.total)} — ${outcome}`;
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
      // Le cas ordinaire : trois lots. S'il en manque un (plus aucun bibelot à donner), la phrase courte.
      if (e.golden && e.golden.length >= 2) return `Le coffre doré s'ouvre : ${e.gold} pièces d'or, ${ITEMS[e.item].name.toLowerCase()}, ${e.golden.map((id) => ITEMS[id].name.toLowerCase()).join(" et ")} !`;
      if (e.golden) return `Le coffre doré s'ouvre : ${e.gold} pièces d'or, ${[e.item, ...e.golden].filter((id) => id !== "or").map((id) => ITEMS[id].name.toLowerCase()).join(" et ")} !`;
      return `Le coffre s'ouvre : ${e.gold} pièces d'or et ${ITEMS[e.item].name.toLowerCase()}${e.count > 1 ? ` ×${e.count}` : ""} tombent à côté.`;
    case "used":
      return e.healed !== undefined ? `Vous mangez : ${ITEMS[e.item].name.toLowerCase()}, +${e.healed} PV.` : "Vous allumez une torche.";
    case "path":
      return `Vous suivez désormais la voie : ${PATHS[e.path].name}.`;
    case "skill":
      return e.path === "blue" ? `Second souffle : +${e.healed} PV.` : "Double frappe !";
    case "mushHush":
      return e.dark ? "Le bruit fait se refermer les champignons lumineux : la salle plonge dans le noir." : "Les champignons lumineux se rouvrent doucement.";
    case "sporeBlast":
      return "Le nuage de spores touche les flammes et EXPLOSE !";
    case "puffball":
      return e.what === "sleep" ? "Une vesse-de-loup bleue crève : un nuage qui endort." : "Une vesse-de-loup rose crève : un nuage qui rend hargneux.";
    case "niche":
      return "Clac ! La dalle s'enfonce. Un grondement : un pan de mur coulisse et découvre une niche.";
    case "skeleton":
      return e.item ? `Vous fouillez le squelette : ${e.gold} pièces d'or et ${ITEMS[e.item].name.toLowerCase()}.` : `Vous fouillez le squelette : ${e.gold} pièces d'or. Rien d'autre.`;
    case "theft":
      return e.what === "apple"
        ? e.success
          ? `Discrétion : ${roll(e.d20, e.bonus, e.total)} — la pomme dorée glisse hors de sa cloche. Personne n'a rien vu.`
          : `Discrétion : ${roll(e.d20, e.bonus, e.total)} — la cloche tinte. « AU VOLEUR ! »${e.watched ? " (Vernis vous regardait.)" : ""}`
        : e.success
          ? `Discrétion : ${roll(e.d20, e.bonus, e.total)} — le canard est à vous. Le Kobold ronfle toujours.`
          : `Discrétion : ${roll(e.d20, e.bonus, e.total)} — le canard couine. Le Kobold ouvre un œil…`;
    case "artifact":
      return e.what === "paint"
        ? "Trois coups de pinceau : un mur se dresse là où il n'y en avait pas."
        : e.what === "unpaint"
          ? "La peinture du faux mur s'écaille et disparaît."
          : e.traps || e.secret
            ? `Le diapason chante : ${e.traps ? `pièges révélés : ${e.traps}` : "aucun piège"}${e.secret ? ", un passage secret s'ouvre" : ""}.`
            : "Le diapason chante : rien de caché alentour.";
    case "power":
      if (e.power === "bastion") return "Bastion ! Les coups reçus sont divisés par deux, et qui vous frappe recule.";
      if (e.power === "execution") return "Exécution ! L'ennemi tombe d'un coup.";
      if (e.power === "soif_sang") return `Soif de sang : +${e.healed ?? 0} PV.`;
      return e.power === "riposte"
        ? "Riposte !"
        : e.power === "tourbillon"
          ? `Tourbillon ! Ennemis frappés : ${e.count}.`
          : e.power === "charge"
            ? "Charge !"
            : `Cri de guerre ! Ennemis impressionnés : ${e.count}${e.fled ? `, en fuite : ${e.fled}` : ""}.`;
    case "lastStand":
      return "Dernier rempart : vous tenez debout, à 1 PV.";
    case "fire":
      return "Vous lancez la potion : les flammes jaillissent !";
    case "torchThrown":
      return e.doused ? "Vous lancez la torche… elle s'éteint dans l'eau." : "Vous lancez la torche : la case prend feu.";
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
          : e.potion === "frost"
            ? "Un souffle glacé jaillit de vous : tout ce qui vous touche gèle."
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
      if (e.actor.defId === "carillon")
        return (
          {
            stone: "Le Carillon se fige : il ne sonnera pas pendant 2 tours.",
            discord: "Le Carillon tremble et se cogne lui-même : il perd un tour.",
            grow: "Le Carillon enfle. Sa prochaine onde frappera deux fois plus fort…",
            slip: "Le Carillon est enraciné dans le mycélium : il ne glisse pas.",
            smoke: "La fumée ne cache rien au Carillon : son onde est un son.",
            fog: "Le brouillard n'arrête pas le son : l'onde vous trouvera quand même.",
          } as Record<string, string>
        )[e.potion] ?? null;
      if (e.actor.defId === "pretresse")
        return (
          {
            stone: "La Grande Prêtresse se fige un instant (2 tours).",
            discord: "Prise de doute, la Grande Prêtresse se griffe le masque : elle perd un tour.",
            grow: "La Grande Prêtresse grandit. Ses coups de bâton feront deux fois plus mal…",
            slip: "Ses pieds dérapent : chaque coup la fera glisser.",
            fog: "Dans le brouillard, la Grande Prêtresse ne vous voit plus : elle n'appelle plus la lune sur vous.",
          } as Record<string, string>
        )[e.potion] ?? null;
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
      if (e.note === "healed") return "La fiole éclate : la jouvence éclabousse la créature… qui reprend toutes ses forces. Oups.";
      if (e.note === "angry") return "La fiole éclate : la créature, aspergée de vitesse, s'agite dans tous les sens.";
      if (e.potion === "youth" || e.potion === "haste" || e.potion === "urchin") return "La fiole éclate : la potion se répand sur les dalles, parmi les éclats de verre.";
      if (e.potion === "frost") return "La fiole éclate : le givre se répand en croix, tout gèle.";
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
    case "torchHush":
      return e.lit ? "Vous rallumez votre torche." : "Vous étouffez votre torche pour vous cacher.";
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
  /** Pouvoirs du Rang II qui s'utilisent (voie rouge). */
  power: {
    none: "Vous n'avez pas ce pouvoir.",
    used: "Plus d'utilisation à cet étage.",
    "no-target": "Personne à portée.",
  },
  chargeNoTarget: "Aucun ennemi à 2 ou 3 cases en ligne droite, chemin libre.",
  hide: {
    hidden: "Vous êtes déjà caché.",
    threatened: "Impossible de se cacher : un ennemi est à votre contact.",
    watched: "Impossible de se cacher : un ennemi vous a en vue.",
    "no-cover": "Rien pour vous cacher : il faut une colonne ou un angle de mur.",
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
