/**
 * Réglages des statistiques anonymes (`src/telemetry/telemetry.ts`). `url` : l'adresse de la Lambda AWS (« Function
 * URL ») une fois créée (voir `aws/telemetry/README.md`) ; vide, rien n'est jamais envoyé.
 */
export const TELEMETRY = {
  url: "",
  /** Envoi par lots de 25 événements au plus. */
  batchSize: 25,
  /** Sans réseau : 500 événements gardés au plus (les plus anciens partent). */
  maxQueue: 500,
  /** Un essai d'envoi toutes les 30 secondes. */
  flushSeconds: 30,
};
