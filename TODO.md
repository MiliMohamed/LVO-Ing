# TODO

## Phase: Multi-sites client (siteId) — séparation réelle

### Backend
  - [x] Mettre à jour `server/src/store.ts` : ajouter `siteId` à `ClientDocumentRow`.
- [x] Mettre à jour `server/src/index.ts`:
  - [x] `GET /api/client/documents` : accepter `?siteId=` et filtrer par siteId.
  - [x] `POST /api/client/documents` : recevoir `siteId` et stocker dans `clientDocuments`.


### Frontend (espace client)
- [x] Ajouter un sélecteur de site dans `frontend/app/espace-client/(portal)/layout.tsx`.
  - [x] Charger `/api/client/sites`.
  - [x] Persister le site choisi dans `localStorage`.

- [ ] Mettre à jour `frontend/app/espace-client/(portal)/documents/page.tsx` :
  - [ ] Charger documents avec `?siteId=`.
  - [ ] Envoyer `siteId` au dépôt.
  - [ ] Afficher le nom du site sélectionné.

### Validation
- [ ] Lancer `frontend` build/typecheck.
- [ ] Tester manuellement :
  - [ ] changer de site → liste documents change
  - [ ] dépôt → document apparaît dans le bon site

