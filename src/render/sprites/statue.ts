/**
 * Statue de pierre (planche `art/murs_v2.png`, proposée le 2026-11-12 ; Thomas : « une statue qui cache quelque chose »).
 * 16 × 27 : elle monte au-dessus de sa case. `statueCracked` : la statue creuse dont Gluck a parlé, une fissure où
 * brille un peu d'or. `statueBroken` : le socle resté debout, des gravats.
 */
const PALETTE: Record<string, string> = { K: "#0c0a10", S: "#7c809e", D: "#545670", H: "#b6bad6", d: "#221e2c", G: "#f0c050", g: "#a87c1c" };

const STATUE = [
  "......KKKK......",
  ".....KDSSDK.....",
  "....KDSHHSDK....",
  "....KSHddHSK....",
  "....KSdKKdSK....",
  ".....KSddSK.....",
  "...KKDSSSSDKK...",
  "..KDSSSSSSSSDK..",
  "..KSSHSSSSHSSK..",
  ".KDSHHSSSSHHSDK.",
  ".KSSHSSHHSSHSSK.",
  ".KSSSSSHHSSSSSK.",
  "..KSSSSHHSSSSK..",
  "..KDSSSHHSSSDK..",
  "..KSSSSHHSSSSK..",
  "..KDSSSSSSSSDK..",
  "..KSSSSSSSSSSK..",
  "..KDSSSSSSSSDK..",
  "...KSSSSSSSSK...",
  "...KSSSDDSSSK...",
  "...KSSSDDSSSK...",
  "..KKSSSDDSSSKK..",
  ".KHHHHHHHHHHHHK.",
  "KHSSSSSSSSSSSSHK",
  "KDSSSSSSSSSSSSDK",
  "KDDDDDDDDDDDDDDK",
  ".KKKKKKKKKKKKKK.",
];

/** La fissure qui « sonne creux », et l'or qui brille au fond. */
function cracked(): string[] {
  const rows = STATUE.map((r) => r.split(""));
  for (const [x, y, c] of [[9, 14, "K"], [10, 15, "K"], [9, 16, "G"], [10, 17, "K"], [9, 18, "K"], [10, 16, "g"]] as const) rows[y][x] = c;
  return rows.map((r) => r.join(""));
}

const BROKEN = [
  "................",
  "....K.....K.....",
  "...KSK...KHK....",
  "..KSDSK.KSSDK...",
  "..KKSSSKSSSKK...",
  ".KHHHHHHHHHHHHK.",
  "KHSSSSSSSSSSSSHK",
  "KDSSSSSSSSSSSSDK",
  "KDDDDDDDDDDDDDDK",
  ".KKKKKKKKKKKKKK.",
  ".KSK......KHSK..",
  "KSDK.KSK..KDK...",
];

export const STATUES: Record<string, { palette: Record<string, string>; rows: string[] }> = {
  statue: { palette: PALETTE, rows: STATUE },
  statueCracked: { palette: PALETTE, rows: cracked() },
  statueBroken: { palette: PALETTE, rows: BROKEN },
};
