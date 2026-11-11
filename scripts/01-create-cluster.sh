#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"
need kind kubectl docker
if kind get clusters 2>/dev/null | grep -qx "$CLUSTER"; then
  log "cluster '$CLUSTER' already exists"
else
  log "creating kind cluster '$CLUSTER'"
  kind create cluster --config "$ROOT/cluster/kind-config.yaml" --wait 120s
fi
kubectl cluster-info --context "kind-$CLUSTER"
kubectl get nodes -L topology.kubernetes.io/zone
