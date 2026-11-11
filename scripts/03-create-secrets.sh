#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"
need kubectl openssl
mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"
if [[ ! -f "$SECRETS_FILE" ]]; then
  log "generating new credentials in $SECRETS_FILE"
  umask 077
  cat > "$SECRETS_FILE" <<EOF
MONGO_ROOT_PASSWORD=$(openssl rand -hex 24)
MONGO_APP_PASSWORD=$(openssl rand -hex 24)
MONGO_KEYFILE=$(openssl rand -base64 600 | tr -d '\n')
GARAGE_RPC_SECRET=$(openssl rand -hex 32)
GARAGE_ADMIN_TOKEN=$(openssl rand -hex 32)
GARAGE_METRICS_TOKEN=$(openssl rand -hex 32)
S3_ACCESS_KEY=GK$(openssl rand -hex 12)
S3_SECRET_KEY=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 48)
COACH_EMAIL=${COACH_EMAIL:-coach@properlift.local}
COACH_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)
EOF
else
  log "reusing existing credentials from $SECRETS_FILE"
fi
source "$SECRETS_FILE"
kubectl apply -f "$ROOT/k8s/00-namespace.yaml" >/dev/null
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
chmod 700 "$TMP"
MONGO_HOSTS="mongo-0.mongo-hl.${NS}.svc.cluster.local:27017,mongo-1.mongo-hl.${NS}.svc.cluster.local:27017,mongo-2.mongo-hl.${NS}.svc.cluster.local:27017"
cat > "$TMP/mongo.env" <<EOF
root-username=root
root-password=$MONGO_ROOT_PASSWORD
app-password=$MONGO_APP_PASSWORD
keyfile=$MONGO_KEYFILE
EOF
cat > "$TMP/garage.env" <<EOF
rpc-secret=$GARAGE_RPC_SECRET
admin-token=$GARAGE_ADMIN_TOKEN
metrics-token=$GARAGE_METRICS_TOKEN
EOF
cat > "$TMP/backend.env" <<EOF
MONGO_URI=mongodb://properlift:${MONGO_APP_PASSWORD}@${MONGO_HOSTS}/properlift?replicaSet=rs0&authSource=properlift
JWT_SECRET=$JWT_SECRET
S3_ACCESS_KEY=$S3_ACCESS_KEY
S3_SECRET_KEY=$S3_SECRET_KEY
SEED_COACH_EMAIL=$COACH_EMAIL
SEED_COACH_PASSWORD=$COACH_PASSWORD
EOF
apply_secret() {
  kubectl -n "$NS" create secret generic "$1" --from-env-file="$2" --dry-run=client -o yaml \
    | kubectl apply -f - >/dev/null
  log "secret $1 applied"
}
apply_secret mongo-credentials "$TMP/mongo.env"
apply_secret garage-secrets "$TMP/garage.env"
apply_secret backend-secrets "$TMP/backend.env"
echo
echo "Coach login for the admin site:  $COACH_EMAIL  /  $COACH_PASSWORD"
echo "(stored in $SECRETS_FILE)"
