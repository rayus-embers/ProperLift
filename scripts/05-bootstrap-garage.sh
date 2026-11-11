#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"
need kubectl
[[ -f "$SECRETS_FILE" ]] || die "run scripts/03-create-secrets.sh first"
source "$SECRETS_FILE"
BUCKET="properlift-media"
KEY_NAME="properlift-app"
CAPACITY="${GARAGE_CAPACITY:-5G}"
g() { local pod="$1"; shift; k exec "$pod" -c garage -- /garage "$@"; }
log "waiting for the 3 Garage pods"
k rollout status statefulset/garage --timeout=300s
declare -a IDS IPS
for i in 0 1 2; do
  IDS[$i]="$(g "garage-$i" node id -q 2>/dev/null | grep -oE '^[0-9a-f]{64}' | head -1)"
  IPS[$i]="$(k get pod "garage-$i" -o jsonpath='{.status.podIP}')"
  [[ -n "${IDS[$i]}" ]] || die "could not read the node id of garage-$i"
  log "garage-$i  id=${IDS[$i]:0:16}...  ip=${IPS[$i]}"
done
log "connecting nodes"
for i in 1 2; do
  g garage-0 node connect "${IDS[$i]}@${IPS[$i]}:3901" || warn "connect to garage-$i failed (already connected?)"
done
sleep 3
g garage-0 status
layout_version() {
  g garage-0 layout show 2>/dev/null | grep -oiE 'layout version: *[0-9]+' | grep -oE '[0-9]+' | head -1
}
CURRENT="$(layout_version || true)"
CURRENT="${CURRENT:-0}"
if [[ "$CURRENT" == "0" ]]; then
  log "assigning roles (one zone per Kubernetes node, capacity $CAPACITY each)"
  for i in 0 1 2; do
    node="$(k get pod "garage-$i" -o jsonpath='{.spec.nodeName}')"
    zone="$(kubectl get node "$node" -o jsonpath='{.metadata.labels.topology\.kubernetes\.io/zone}')"
    zone="${zone:-dc1}"
    g garage-0 layout assign -z "$zone" -c "$CAPACITY" "${IDS[$i]}"
  done
  g garage-0 layout show
  g garage-0 layout apply --version 1
else
  log "layout already applied (version $CURRENT)"
fi
log "importing access key '$KEY_NAME'"
if g garage-0 key info "$KEY_NAME" >/dev/null 2>&1; then
  log "key already exists"
else
  g garage-0 key import --yes -n "$KEY_NAME" "$S3_ACCESS_KEY" "$S3_SECRET_KEY"
fi
log "creating bucket '$BUCKET'"
if g garage-0 bucket info "$BUCKET" >/dev/null 2>&1; then
  log "bucket already exists"
else
  g garage-0 bucket create "$BUCKET"
fi
g garage-0 bucket allow --read --write --owner "$BUCKET" --key "$KEY_NAME"
g garage-0 bucket website --allow "$BUCKET"
log "recording bootstrap_peers in k8s/storage/garage.toml"
PEERS=""
for i in 0 1 2; do
  PEERS+="\"${IDS[$i]}@garage-$i.garage-hl.${NS}.svc.cluster.local:3901\", "
done
NEW_LINE="bootstrap_peers = [ ${PEERS%, } ]"
TOML="$ROOT/k8s/storage/garage.toml"
if grep -qF "$NEW_LINE" "$TOML"; then
  log "bootstrap_peers already up to date"
else
  sed -i "s|^bootstrap_peers = .*|$NEW_LINE|" "$TOML"
  log "config changed: re-applying (Garage restarts one pod at a time)"
  kubectl apply -k "$ROOT/k8s" >/dev/null
  k rollout status statefulset/garage --timeout=300s
fi
log "Garage is ready"
g garage-0 bucket info "$BUCKET" | head -20
