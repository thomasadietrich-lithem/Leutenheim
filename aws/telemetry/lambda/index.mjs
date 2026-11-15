// Statistiques anonymes de Cave Roller (Thomas, 2026-11-15) : reçoit les lots d'événements du jeu (navigateur ou
// appli) et les range dans S3, un fichier par lot, une ligne par événement, rangés par jour (pour Athena).
// Rien de personnel : l'adresse IP de l'appelant n'est JAMAIS lue ni gardée.
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

const s3 = new S3Client({});
const BUCKET = process.env.BUCKET;
const MAX_EVENTS = 50;
const MAX_BODY = 64 * 1024;
const NAME = /^[a-z_]{1,32}$/;

/** Garde seulement des valeurs simples et courtes. */
function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (!/^[A-Za-z_]{1,24}$/.test(k)) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 80);
  }
  return out;
}

const reply = (status, text = "") => ({ statusCode: status, headers: { "Content-Type": "text/plain" }, body: text });

export const handler = async (event) => {
  if (event.requestContext?.http?.method !== "POST") return reply(405);
  let raw = event.body ?? "";
  if (event.isBase64Encoded) raw = Buffer.from(raw, "base64").toString("utf8");
  if (raw.length > MAX_BODY) return reply(413);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400, "json");
  }
  const ctx = clean({ device: body.device, version: body.version, platform: body.platform, build: body.build, lang: body.lang });
  const events = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS) : [];
  const received = Date.now();
  const lines = events
    .filter((e) => e && NAME.test(e.e) && typeof e.run === "string")
    .map((e) => JSON.stringify({ ...clean(e), ...ctx, received }));
  if (lines.length === 0) return reply(204);
  const now = new Date(received);
  const day = now.toISOString().slice(0, 10);
  const key = `events/dt=${day}/${now.toISOString().slice(11, 19).replaceAll(":", "-")}-${randomUUID()}.jsonl`;
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: lines.join("\n") + "\n", ContentType: "application/x-ndjson" }));
  return reply(204);
};
