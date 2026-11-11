#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"
need kubectl
log "network policy test from a throwaway pod in the 'default' namespace"
kubectl run np-test --rm -i --restart=Never -n default --image=busybox:1.36 \
  --overrides='{"spec":{"securityContext":{"runAsNonRoot":true,"runAsUser":65534,"seccompProfile":{"type":"RuntimeDefault"}},"containers":[{"name":"np-test","image":"busybox:1.36","securityContext":{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]}},"command":["sh","-c","for t in mongo-0.mongo-hl.'"$NS"'.svc.cluster.local:27017 garage.'"$NS"'.svc.cluster.local:3900 backend.'"$NS"'.svc.cluster.local:8080; do h=${t%:*}; p=${t##*:}; if nc -z -w 3 $h $p; then echo \"OPEN     $t\"; else echo \"BLOCKED  $t\"; fi; done"]}]}}' \
  || true
echo "Expected: mongo and garage BLOCKED, backend OPEN."
echo "If mongo shows OPEN, your CNI does not enforce NetworkPolicy (see README)."
if command -v kubescape >/dev/null 2>&1; then
  log "kubescape: scanning manifests (NSA + MITRE frameworks)"
  kubectl kustomize "$ROOT/k8s" > /tmp/properlift-rendered.yaml
  kubescape scan framework nsa,mitre /tmp/properlift-rendered.yaml || true
  log "kubescape: scanning the live namespace"
  kubescape scan --include-namespaces "$NS" || true
else
  warn "kubescape not installed, skipping posture scan"
fi
