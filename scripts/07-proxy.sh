#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"
need docker openssl
CERTS="$ROOT/proxy/certs"
OUT="$ROOT/proxy/generated"
mkdir -p "$CERTS" "$OUT"
if [[ ! -f "$CERTS/properlift.crt" || ! -f "$CERTS/properlift.key" ]]; then
  log "generating a self-signed certificate for $DOMAIN and $COACH_DOMAIN"
  openssl req -x509 -newkey rsa:2048 -sha256 -days 365 -nodes \
    -keyout "$CERTS/properlift.key" -out "$CERTS/properlift.crt" \
    -subj "/CN=$DOMAIN" \
    -addext "subjectAltName=DNS:$DOMAIN,DNS:$COACH_DOMAIN" 2>/dev/null
  chmod 600 "$CERTS/properlift.key"
  chmod 644 "$CERTS/properlift.crt"
fi
sed -e "s|__DOMAIN__|$DOMAIN|g" \
    -e "s|__COACH_DOMAIN__|$COACH_DOMAIN|g" \
    -e "s|__CLUSTER__|$CLUSTER|g" \
    "$ROOT/proxy/properlift.conf.template" > "$OUT/default.conf"
docker rm -f properlift-proxy >/dev/null 2>&1 || true
log "starting properlift-proxy"
docker run -d --name properlift-proxy --restart unless-stopped \
  --network kind \
  -p 80:80 -p 443:443 \
  -v "$OUT/default.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v "$CERTS:/etc/nginx/certs:ro" \
  nginx:1.28-alpine >/dev/null
sleep 2
docker exec properlift-proxy nginx -t
echo
echo "  Client site : https://$DOMAIN"
echo "  Coach admin : https://$COACH_DOMAIN"
echo
echo "Quick check:  curl -k https://$DOMAIN/api/whoami"
