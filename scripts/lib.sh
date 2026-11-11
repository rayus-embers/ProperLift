#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLUSTER="${CLUSTER:-properlift}"
NS="${NS:-properlift}"
VERSION="${VERSION:-1.0.0}"
SECRETS_DIR="$ROOT/.secrets"
SECRETS_FILE="$SECRETS_DIR/properlift.env"
default_ip() {
  hostname -I 2>/dev/null | awk '{print $1}' || true
}
VM_IP="${VM_IP:-$(default_ip)}"
VM_IP="${VM_IP:-127.0.0.1}"
DOMAIN="${DOMAIN:-properlift.${VM_IP}.nip.io}"
COACH_DOMAIN="${COACH_DOMAIN:-coach.${DOMAIN}}"
THIRD_PARTY_IMAGES=(
  "mongo:7.0"
  "dxflrs/garage:v2.2.0"
  "nginxinc/nginx-unprivileged:1.28-alpine"
)
log()  { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }
need() {
  for cmd in "$@"; do
    command -v "$cmd" >/dev/null 2>&1 || die "'$cmd' is required but not installed"
  done
}
k() { kubectl -n "$NS" "$@"; }
worker_nodes() {
  kind get nodes --name "$CLUSTER" | grep -v control-plane | sort
}
