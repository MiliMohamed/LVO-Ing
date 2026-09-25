# Déploiement du CRM LVO sur un VPS OVH

Périmètre : **landing CRM, `/login`, `/crm/*`** et leur API. Tout tient dans ce dépôt ;
rien ne dépend du backend Spring, du `mms-analyzer`, ni du site public / portails
(dépôt monorepo `lvo-web`, non déployé ici).

```
Internet ──443──► Caddy ─┬─ /api/*  ──► crm-server:8081 (Express + Prisma)
                         └─ le reste ─► crm-frontend:3100 (Next.js standalone)
                                           crm-server ─► postgres · minio · gotenberg
```

Seul Caddy publie des ports. Postgres, MinIO et Gotenberg ne sont joignables que par le
réseau Docker interne.

## 1. VPS (manuel, espace client OVH)

Commander un **VPS OVH, Ubuntu 24.04 LTS, 4 vCore / 8 Go** (ONLYOFFICE non inclus) en
ajoutant ta clé SSH publique à la commande. Noter l'IP.

Puis, depuis ton poste :

```sh
scp deploy/setup-vps.sh ubuntu@<IP>:/tmp/
ssh ubuntu@<IP> 'sudo DEPLOY_USER=lvo sh /tmp/setup-vps.sh'
```

Le script crée l'utilisateur `lvo` (ta clé recopiée), coupe le login root et par mot de
passe, active `ufw` (22/80/443), `fail2ban`, les mises à jour de sécurité, 4 Go de swap et
Docker. **Avant de fermer ta session**, vérifie `ssh lvo@<IP>` dans un autre terminal.

## 2. DNS (manuel, espace client OVH)

Zone DNS `lvo-ing.com` (espace client OVH → Noms de domaine → Zone DNS → Ajouter une
entrée → **A**) : sous-domaine `crm`, cible = IP du VPS, TTL par défaut. Ne pas toucher
aux entrées existantes : `@` / `www` (site vitrine sur l'hébergement mutualisé) et
`MX` / `SPF` / `DKIM` / `DMARC` (messagerie). Attendre la propagation
(`nslookup crm.lvo-ing.com`) avant le premier démarrage, sinon Let's Encrypt échoue.

## 3. Images (GitHub Actions)

`.github/workflows/crm-images.yml` builde `crm-frontend`, `crm-server`, `crm-migrate` à
chaque push sur `main` touchant `frontend/` ou `server/` (ou à la main : onglet Actions → *Run workflow*)
et les publie sur `ghcr.io/milimohamed/…`. Le VPS ne builde rien.

Les paquets GHCR d'un dépôt privé sont privés : sur le VPS, une fois,
```sh
echo <PAT avec read:packages> | docker login ghcr.io -u MiliMohamed --password-stdin
```

## 4. Code, secrets et démarrage (sur le VPS, en `lvo`)

```sh
git clone git@github.com:MiliMohamed/lvo-crm.git /opt/lvo-crm && cd /opt/lvo-crm  # deploy key GitHub en lecture seule
./deploy/deploy.sh  # 1er lancement : crée .env avec des secrets aléatoires
nano deploy/.env  # CRM_DOMAIN, ACME_EMAIL, REGISTRY=ghcr.io/milimohamed
./deploy/deploy.sh  # pull des images, migrations, démarrage, vérif HTTPS
```

`crm-migrate` applique `prisma migrate deploy` puis s'arrête ; `crm-server` ne démarre
qu'après son succès. Mise à jour ultérieure : `./deploy/deploy.sh` (fait le
`git pull`). Sans registry, `REGISTRY=lvo` ou `deploy.sh --build` builde sur le VPS.

## 5. Vérifications

```sh
cd /opt/lvo-crm/deploy
docker compose -f docker-compose.prod.yml ps          # tout "healthy" / "running", crm-migrate "exited (0)"
docker compose -f docker-compose.prod.yml logs crm-server | head -30
```

Puis connexion réelle sur `https://crm.lvo-ing.com/login`.

## 6. Premier démarrage : comptes de démo ⚠️

Sur une base **vide**, l'API charge le jeu de démo de `server/src/store.ts` : comptes
`admin@`, `manager@`, `consultant@`, `viewer@lvo-ing.fr` avec le mot de passe **`lvo123`**,
plus clients, offres et factures fictifs. À régler **avant** d'ouvrir le DNS au public :
soit importer les vraies données, soit changer tous les mots de passe et purger la démo.

## 7. Sauvegardes (jour 1)

```sh
chmod +x backup.sh
crontab -e
# 30 2 * * * /opt/lvo-crm/deploy/backup.sh >> /var/log/lvo-backup.log 2>&1
```

Dump Postgres + archives des volumes `crm_data`, `crm_uploads`, `minio_data`, rétention
14 jours dans `/var/backups/lvo-crm`. Copier ce dossier hors du VPS (Backup Storage OVH,
Object Storage) : une sauvegarde sur la même machine ne protège pas d'une perte du VPS.

Restauration Postgres :
```sh
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U lvo_crm -d lvo_crm --clean --if-exists < lvo_crm.dump
```

## 8. Hors v1

- **ONLYOFFICE** (édition Word dans le navigateur) : ~4 Go de RAM, et il tourne aujourd'hui
  avec `JWT_ENABLED=false`, donc inexposable tel quel. Sans lui, le bouton d'édition en
  ligne affiche une erreur ; génération, téléchargement DOCX/PDF et versions fonctionnent.
  Pour l'ajouter : sous-domaine dédié, JWT activé côté serveur et côté API,
  `NEXT_PUBLIC_ONLYOFFICE_URL` fixé au build du front.
- **Extraction des bons de commande** (script Python du `mms-analyzer`) : absente de
  l'image, la fonction renvoie simplement « pas d'extraction ».
- **API interne `/internal`** (appels de l'ancien projet) : non exposée par Caddy.
