/** Chemins API attendus (même préfixe `/api` que le reste du front ; backend peut aliaser `/api/v1`). */

export const recouvrementPaths = {
  kpis: "/api/recouvrement/kpis",
  facturesImpayees: "/api/recouvrement/factures-impayees",
  transactionsEnAttente: "/api/recouvrement/transactions-en-attente",
  relance: (factureId: number | string) => `/api/recouvrement/factures/${factureId}/relance`,
  payerManuel: (factureId: number | string) => `/api/recouvrement/factures/${factureId}/payer-manuel`,
  rapprocherTransaction: (transactionId: number | string) =>
    `/api/recouvrement/transactions/${transactionId}/rapprocher`,
  ignorerTransaction: (transactionId: number | string) =>
    `/api/recouvrement/transactions/${transactionId}/ignorer`,
  syncQuonto: "/api/quonto/sync-now",
} as const;
