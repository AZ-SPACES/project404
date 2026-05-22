#!/bin/bash
# Run once on the DigitalOcean server to get SSL for api.aza.systems.
# Prerequisites: DNS A record for api.aza.systems must point to this server's IP.

set -euo pipefail

EMAIL="caleb.dussey04@gmail.com"
COMPOSE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_CMD="docker compose -f $COMPOSE_DIR/docker-compose.yml -f $COMPOSE_DIR/docker-compose.backend.yml"

echo "==> Starting nginx (HTTP only) and certbot..."
$COMPOSE_CMD up -d nginx certbot

echo "==> Waiting for nginx..."
sleep 5

echo "==> Requesting SSL certificate for api.aza.systems..."
$COMPOSE_CMD run --rm --entrypoint certbot certbot \
  certonly --webroot -w /var/www/certbot \
  -d api.aza.systems \
  --email "$EMAIL" \
  --agree-tos --no-eff-email

echo "==> Activating SSL config..."
cp "$COMPOSE_DIR/nginx/backend-only/conf.d/default.ssl.conf.template" \
   "$COMPOSE_DIR/nginx/backend-only/conf.d/default.conf"

echo "==> Reloading nginx..."
$COMPOSE_CMD exec nginx nginx -s reload

echo ""
echo "Done! Now start all backend services:"
echo "  $COMPOSE_CMD up -d"
