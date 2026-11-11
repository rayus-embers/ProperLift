#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"
need docker kind
cd "$ROOT/apps"
log "building properlift/backend:$VERSION"
docker build -t "properlift/backend:$VERSION" backend
log "building properlift/frontend:$VERSION"
docker build -f frontend/Dockerfile -t "properlift/frontend:$VERSION" .
log "building properlift/coach:$VERSION"
docker build -f coach/Dockerfile -t "properlift/coach:$VERSION" .
for img in "${THIRD_PARTY_IMAGES[@]}"; do
  docker image inspect "$img" >/dev/null 2>&1 || { log "pulling $img"; docker pull "$img"; }
done
log "loading images into kind nodes"
kind load docker-image --name "$CLUSTER" \
  "properlift/backend:$VERSION" "properlift/frontend:$VERSION" "properlift/coach:$VERSION" \
  "${THIRD_PARTY_IMAGES[@]}"
log "done"
