#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"
need kubectl
WORKERS="${WORKERS:-30}"
DURATION="${DURATION:-180}"
log "running $WORKERS parallel request loops for ${DURATION}s (Ctrl+C to stop early)"
kubectl run properlift-load --rm -i --restart=Never -n default \
  --image=busybox:1.36 \
  --overrides='{"spec":{"securityContext":{"runAsNonRoot":true,"runAsUser":65534,"seccompProfile":{"type":"RuntimeDefault"}},"containers":[{"name":"properlift-load","image":"busybox:1.36","securityContext":{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]}},"command":["sh","-c","for i in $(seq '"$WORKERS"'); do (while true; do wget -q -O /dev/null http://backend.'"$NS"'.svc.cluster.local:8080/api/programs; done) & done; sleep '"$DURATION"'"]}]}}'
