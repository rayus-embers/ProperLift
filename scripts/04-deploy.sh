#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"
need kubectl
[[ -f "$SECRETS_FILE" ]] || die "run scripts/03-create-secrets.sh first"
log "applying manifests (kubectl apply -k k8s/)"
kubectl apply -k "$ROOT/k8s"
log "waiting for MongoDB members"
k rollout status statefulset/mongo --timeout=600s
log "waiting for the replica-set bootstrap Job"
if k get job mongo-init >/dev/null 2>&1; then
  k wait --for=condition=complete job/mongo-init --timeout=600s \
    || { k logs job/mongo-init --tail=50; die "mongo-init did not complete"; }
  k logs job/mongo-init --tail=5
else
  log "mongo-init already ran and was cleaned up (TTL)"
fi
"$ROOT/scripts/05-bootstrap-garage.sh"
for d in backend media frontend coach; do
  log "waiting for deployment/$d"
  k rollout status "deployment/$d" --timeout=300s
done
echo
k get pods -o wide
echo
log "deployed. Next: 'make proxy' to publish https://$DOMAIN and https://$COACH_DOMAIN"
