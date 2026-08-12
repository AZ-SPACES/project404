#!/bin/bash
# Run once on the DigitalOcean server to get the wildcard SSL certificate that
# Aza-hosted mini apps are served under: *.miniapps.aza.systems
#
# Why this is a separate script from init-api-ssl.sh
# --------------------------------------------------
# api.aza.systems uses an HTTP-01 challenge over the certbot webroot. Let's Encrypt does
# NOT issue wildcard certificates over HTTP-01 — a wildcard requires DNS-01, proving
# control of the zone by writing a TXT record. So this needs Cloudflare API credentials
# and cannot reuse the webroot flow, however convenient that would be.
#
# Why a wildcard at all
# ---------------------
# Every mini app gets its own origin (<app>-mini.aza.systems) so that one third-party app
# cannot read another's localStorage, cookies or service workers. Apps are approved
# continuously, so a per-app certificate would put a Let's Encrypt round trip in the middle
# of every approval — and hit issuance rate limits. One wildcard covers all of them.
#
# Why *.aza.systems and not *.miniapps.aza.systems
# ------------------------------------------------
# Mini apps sit ONE label deep so that Cloudflare's Universal SSL (which covers a single
# level of subdomain) can serve them proxied. A two-level host would have forced either
# Advanced Certificate Manager or a grey-clouded record pointing at the origin — and this
# droplet's firewall admits Cloudflare IP ranges only, so direct traffic never arrives.
# Traffic therefore reaches nginx already proxied, and this certificate secures the
# Cloudflare→origin leg (SSL mode Full / Full strict).
#
# Prerequisites
# -------------
#  1. The existing proxied wildcard record already covers this — no new DNS needed:
#         *.aza.systems   A   <droplet ip>   (Proxied)
#  2. A Cloudflare API token with Zone:DNS:Edit on aza.systems, in backend/.env as
#         CLOUDFLARE_DNS_API_TOKEN=...
#     Scope it to that one zone: it can rewrite DNS for the whole domain.
#
# DNS-01 is still required: Let's Encrypt does not issue wildcards over HTTP-01, and the
# TXT record it validates is unaffected by proxy status.
#
# Safe to re-run: certbot leaves a valid, not-yet-due certificate untouched.

set -euo pipefail

EMAIL="caleb.dussey04@gmail.com"
DOMAIN="aza.systems"
COMPOSE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$COMPOSE_DIR/backend/.env"
SECRETS_DIR="$COMPOSE_DIR/secrets"
CREDS_FILE="$SECRETS_DIR/cloudflare.ini"

COMPOSE="docker compose --env-file $ENV_FILE \
  -f $COMPOSE_DIR/docker-compose.yml \
  -f $COMPOSE_DIR/docker-compose.backend.yml"

if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: $ENV_FILE not found." >&2
    exit 1
fi

TOKEN="$(grep -E '^CLOUDFLARE_DNS_API_TOKEN=' "$ENV_FILE" | cut -d= -f2- || true)"
if [ -z "$TOKEN" ]; then
    echo "ERROR: CLOUDFLARE_DNS_API_TOKEN is not set in $ENV_FILE." >&2
    echo "       Create a token with Zone:DNS:Edit on aza.systems and add it there." >&2
    exit 1
fi

# The credentials file has to survive this script: DNS-01 re-authenticates on every renewal,
# so the certbot container reads it again every 90 days. It is mounted read-only at
# /etc/aza-secrets and gitignored. certbot refuses to use a world-readable credentials file.
echo "==> Writing Cloudflare credentials to $CREDS_FILE..."
mkdir -p "$SECRETS_DIR"
printf 'dns_cloudflare_api_token = %s\n' "$TOKEN" > "$CREDS_FILE"
chmod 600 "$CREDS_FILE"

echo "==> Requesting wildcard certificate for *.$DOMAIN via DNS-01..."
# Run inside the compose-managed certbot service so the certificate lands in the same
# certbot_certs volume nginx reads, and so the renewal loop inherits it automatically.
# --propagation-seconds 30 gives Cloudflare time to publish the TXT record before
# Let's Encrypt looks for it; too low and issuance fails intermittently.
$COMPOSE run --rm --entrypoint certbot certbot \
    certonly \
    --dns-cloudflare \
    --dns-cloudflare-credentials /etc/aza-secrets/cloudflare.ini \
    --dns-cloudflare-propagation-seconds 30 \
    -d "$DOMAIN" \
    -d "*.$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos --no-eff-email \
    --non-interactive

echo "==> Validating and reloading nginx..."
$COMPOSE exec nginx nginx -t
$COMPOSE exec nginx nginx -s reload

echo
echo "Done."
echo "  Live mini apps:    https://<app>-mini.$DOMAIN/"
echo "  Staged for review: https://<app>-mini-preview.$DOMAIN/"
echo
echo "Renewal is automatic: the certbot service runs on the certbot/dns-cloudflare image and"
echo "replays the DNS-01 method recorded for this certificate, reading the same credentials"
echo "file. Verify at any time with:"
echo "  $COMPOSE run --rm --entrypoint certbot certbot renew --dry-run"
