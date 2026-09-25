#!/bin/sh
# Déploiement / mise à jour du CRM sur le VPS (utilisateur de déploiement, dans le clone) :
#   ./deploy/deploy.sh            # images du registry (REGISTRY dans .env)
#   ./deploy/deploy.sh --build    # build local sur le VPS
#
# Au premier lancement, crée .env avec des secrets aléatoires ; il reste à renseigner
# CRM_DOMAIN / ACME_EMAIL si les valeurs par défaut ne conviennent pas.
set -eu

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
COMPOSE="docker compose -f docker-compose.prod.yml"

if [ ! -f .env ]; then
  echo "== Création de .env (secrets aléatoires)"
  cp .env.prod.example .env
  for k in POSTGRES_PASSWORD JWT_SECRET CRM_SERVICE_TOKEN MINIO_ROOT_PASSWORD; do
    sed -i "s|^$k=.*|$k=$(openssl rand -hex 32)|" .env
  done
  chmod 600 .env
  echo "   .env créé : vérifie CRM_DOMAIN, ACME_EMAIL et REGISTRY, puis relance."
  exit 0
fi

for k in POSTGRES_PASSWORD JWT_SECRET CRM_SERVICE_TOKEN MINIO_ROOT_PASSWORD CRM_DOMAIN ACME_EMAIL; do
  grep -q "^$k=." .env || { echo "$k vide dans .env"; exit 1; }
done

echo "== Code"
git -C "$DIR" pull --ff-only

REGISTRY="$(sed -n 's/^REGISTRY=//p' .env)"
if [ "${1:-}" = "--build" ] || [ -z "$REGISTRY" ] || [ "$REGISTRY" = "lvo" ]; then
  echo "== Build local"
  $COMPOSE build
else
  echo "== Pull des images"
  $COMPOSE pull crm-frontend crm-server crm-migrate
fi

echo "== Démarrage"
$COMPOSE up -d --remove-orphans
$COMPOSE ps

DOMAIN="$(sed -n 's/^CRM_DOMAIN=//p' .env)"
echo "== Vérification https://$DOMAIN"
i=0
until curl -fsS -o /dev/null "https://$DOMAIN/login"; do
  i=$((i + 1))
  [ "$i" -ge 30 ] && { echo "Le site ne répond pas : $COMPOSE logs caddy crm-server"; exit 1; }
  sleep 5
done
echo "OK : https://$DOMAIN"
docker image prune -f >/dev/null
