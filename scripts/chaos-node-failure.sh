#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"
need docker kubectl curl
DOWN_SECONDS="${DOWN_SECONDS:-120}"
URL="https://$DOMAIN/api/programs"
NODE="${1:-}"
if [[ -z "$NODE" ]]; then
  primary="$(k exec mongo-0 -c mongo -- mongosh --quiet --norc --eval 'db.hello().primary' 2>/dev/null | tail -1 || true)"
  pod="${primary%%.*}"
  if [[ "$pod" == mongo-* ]]; then
    NODE="$(k get pod "$pod" -o jsonpath='{.spec.nodeName}')"
    log "MongoDB primary is $pod on $NODE"
  else
    NODE="$(worker_nodes | head -1)"
  fi
fi
log "victim node: $NODE (will be stopped for ${DOWN_SECONDS}s)"
echo "Pods on it:"
k get pods -o wide --field-selector "spec.nodeName=$NODE"
LOG="$(mktemp)"
probe() {
  while true; do
    code="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 3 --resolve "$DOMAIN:443:127.0.0.1" "$URL" || echo 000)"
    echo "$(date +%s) $code" >> "$LOG"
    sleep 1
  done
}
probe &
PROBE_PID=$!
trap 'kill $PROBE_PID 2>/dev/null || true; docker start "$NODE" >/dev/null 2>&1 || true' EXIT
sleep 5
log "docker stop $NODE   (simulated server crash)"
STOP_AT=$(date +%s)
docker stop "$NODE" >/dev/null
end=$((STOP_AT + DOWN_SECONDS))
while [[ $(date +%s) -lt $end ]]; do
  sleep 15
  elapsed=$(( $(date +%s) - STOP_AT ))
  fails=$(awk -v t="$STOP_AT" '$1>=t && $2!="200"' "$LOG" | wc -l)
  echo "--- t+${elapsed}s  failed requests so far: $fails"
  kubectl get nodes --no-headers | sed 's/^/    /'
  k get pods -o wide | sed 's/^/    /'
done
log "docker start $NODE   (server back)"
docker start "$NODE" >/dev/null
sleep 10
kill $PROBE_PID 2>/dev/null || true
total=$(awk -v t="$STOP_AT" '$1>=t' "$LOG" | wc -l)
failed=$(awk -v t="$STOP_AT" '$1>=t && $2!="200"' "$LOG" | wc -l)
longest=$(awk -v t="$STOP_AT" '$1>=t { if ($2!="200") { if (!s) s=$1; cur=$1-s+1; if (cur>m) m=cur } else s=0 } END { print m+0 }' "$LOG")
echo
log "RESULT: $failed failed out of $total requests; longest continuous outage ~${longest}s"
echo "Raw log (timestamp http_code): $LOG"
echo "The node rejoins by itself; check with: kubectl get nodes && kubectl get pods -n $NS -o wide"
