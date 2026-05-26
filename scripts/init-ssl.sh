#!/bin/bash
# Run once on the server after DNS A records point to this machine.
# Gets Let's Encrypt certs for all AZA domains and activates the SSL nginx config.

set -euo pipefail

DOMAIN="aza.systems"
EMAIL="caleb.dussey04@gmail.com"
COMPOSE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Starting services with HTTP-only nginx config..."
docker compose --env-file "$COMPOSE_DIR/backend/.env" -f "$COMPOSE_DIR/docker-compose.yml" up -d nginx certbot

echo "==> Waiting for nginx to be ready..."
sleep 5

echo "==> Requesting SSL certificate for all domains..."
docker compose --env-file "$COMPOSE_DIR/backend/.env" -f "$COMPOSE_DIR/docker-compose.yml" run --rm --entrypoint certbot certbot \
  certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" -d "www.$DOMAIN" \
  -d "api.$DOMAIN" -d "admin.$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos --no-eff-email

echo "==> Activating SSL nginx config..."
cp "$COMPOSE_DIR/nginx/conf.d/default.ssl.conf.template" \
   "$COMPOSE_DIR/nginx/conf.d/default.conf"

echo "==> Reloading nginx..."
docker compose --env-file "$COMPOSE_DIR/backend/.env" -f "$COMPOSE_DIR/docker-compose.yml" exec nginx nginx -s reload

echo ""
echo "SSL setup complete. Now bring up all services:"
echo "  docker compose -f $COMPOSE_DIR/docker-compose.yml up -d"
