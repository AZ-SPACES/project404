#!/bin/bash
# Run once on the DigitalOcean server to get SSL for api.aza.systems.
# Prerequisites: DNS for api.aza.systems must resolve to this server (directly, or via
# Cloudflare — Cloudflare passes /.well-known/acme-challenge/ through to the origin).
#
# Nothing here edits a tracked file. Earlier versions activated SSL by copying a template
# over nginx/conf.d/default.conf; because that file is tracked, any `git reset --hard` or
# conflict resolution on the server silently reverted HTTPS to the HTTP-only bootstrap
# config, and the API went dark behind a Cloudflare 521. The real config now lives in git
# in its final state, and bootstrap uses a separate mount instead.

set -euo pipefail

EMAIL="caleb.dussey04@gmail.com"
COMPOSE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

COMPOSE="docker compose --env-file $COMPOSE_DIR/backend/.env \
  -f $COMPOSE_DIR/docker-compose.yml \
  -f $COMPOSE_DIR/docker-compose.backend.yml"

# Same stack, but nginx serves the HTTP-only bootstrap config (no cert files needed).
COMPOSE_BOOTSTRAP="$COMPOSE -f $COMPOSE_DIR/docker-compose.ssl-bootstrap.yml"

# Safe to re-run: certbot leaves an existing, not-yet-due certificate untouched.
echo "==> Starting nginx on the HTTP-only bootstrap config..."
$COMPOSE_BOOTSTRAP up -d nginx certbot

echo "==> Waiting for nginx..."
sleep 5

echo "==> Requesting SSL certificate for api.aza.systems..."
# --webroot (not --standalone): the certbot container renews on a webroot schedule, and
# the method is recorded in the renewal config. Issuing standalone would break renewals.
$COMPOSE_BOOTSTRAP run --rm --entrypoint certbot certbot \
  certonly --webroot -w /var/www/certbot \
  -d api.aza.systems \
  --email "$EMAIL" \
  --agree-tos --no-eff-email

echo "==> Switching nginx back to the real config (HTTP + HTTPS)..."
$COMPOSE up -d --force-recreate nginx

echo "==> Verifying nginx is serving HTTPS..."
$COMPOSE exec -T nginx nginx -t
$COMPOSE exec -T nginx grep -q "listen 443" /etc/nginx/conf.d/default.conf

echo ""
echo "Done. Now start the rest of the stack:"
echo "  $COMPOSE up -d"
