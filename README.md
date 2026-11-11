# Proper Lift: an online coaching platform on Kubernetes (kind)

**By:** Rayan Hannachi

Proper Lift is a small "online coaching" SaaS: clients browse **workout programs** and
**meal plans**, enrol, and get a dashboard telling them what to train and eat *today*,
with weight and session tracking. Coaches use a separate **admin site** to create
programs and meal plans, upload exercise videos and meal photos, and follow their clients.

It reproduces the architecture of the Ginflix project, but **every service is self-hosted**.
Nothing depends on the course registry, the course S3 or the course Keycloak.

| Ginflix (course)             | Proper Lift (this project)                                     |
|------------------------------|-------------------------------------------------------------|
| frontend (nginx)             | `frontend`: client site, nginx-unprivileged                 |
| frontend-admin (nginx)       | `coach`: coach dashboard, nginx-unprivileged                |
| backend (gRPC)               | `backend`: Node.js REST API                                 |
| database (MongoDB)           | `mongo`: **3-member MongoDB replica set**                   |
| streamer (nginx → S3)        | `media`: nginx serving videos/photos from object storage    |
| S3 (Garage, external)        | `garage`: **3-node Garage cluster inside the cluster**      |
| IAM (Keycloak, external)     | built into the backend: scrypt password hashes + JWT roles  |
| private registry + regcred   | `kind load docker-image` (images pre-loaded on the nodes)   |
| VM nginx reverse proxy       | `properlift-proxy` container on the `kind` Docker network     |

```
 browser ──HTTPS──> properlift-proxy (VM :443) ──> NodePort on ALL 3 workers
   properlift.<ip>.nip.io        /  -> frontend:30080     /api -> backend:30082   /media -> media:30083
   coach.properlift.<ip>.nip.io  /  -> coach:30081        /api -> backend:30082   /media -> media:30083

 backend ──> mongo-0/1/2 (replica set rs0, ClusterIP only)
 backend ──S3 API──> garage-0/1/2 (:3900)      media ──read-only web──> garage (:3902)
```

## Run it

Prerequisites on the VM: Docker, `kind` ≥ 0.24, `kubectl`, `make`, `openssl`, `curl`.

```bash
make            # cluster → images → secrets → deploy → metrics-server → HTTPS proxy
make status     # nodes, pods, services, PDBs, HPAs, volumes
```

The coach login is printed by `make secrets` (also in `.secrets/properlift.env`).
Default URLs are `https://properlift.<VM-IP>.nip.io` and `https://coach.properlift.<VM-IP>.nip.io`
(nip.io resolves to the VM IP, so no DNS setup). Override with `DOMAIN=… make proxy`, and put a
real certificate in `proxy/certs/properlift.{crt,key}` to avoid the self-signed warning.

## Reliability (a node can die without human intervention)

- **Stateless tiers** (frontend, coach, backend, media): ≥ 2 replicas (backend 3), spread across
  nodes/zones (`topologySpreadConstraints`), `maxUnavailable: 0` rolling updates,
  PodDisruptionBudgets, startup/liveness/readiness probes, graceful shutdown (`preStop` + SIGTERM handling).
  Pods on a dead node are evicted after **30 s** instead of the default 300 s (`tolerationSeconds`).
- **Database**: a kind volume lives on one node and cannot follow a pod, so a single Mongo pod
  would be a single point of failure. A **3-member replica set** (one per node, hard anti-affinity)
  elects a new primary in ~10-15 s; the backend's replica-set URI follows it automatically.
- **Object storage**: Garage with `replication_factor = 3` and quorum 2/3 keeps serving reads
  and writes with one node down.
- **Entry point**: the proxy lists every worker in each upstream and retries the next node
  (`proxy_next_upstream`, 2 s connect timeout), so a dead node is skipped.
- **Proof**: `make chaos` stops the node hosting the Mongo primary for 2 minutes while sending one
  API request per second, then prints the number of failed requests and the longest outage.

## Security

- Namespace enforces Pod Security Admission **restricted**: every pod is non-root, read-only root
  filesystem, no privilege escalation, all capabilities dropped, seccomp `RuntimeDefault`.
- **NetworkPolicies**: default deny (ingress + egress), then only the needed flows. The database is
  reachable only from the backend, and Garage only from the backend (S3) and media (read-only).
- **Secrets** are random, generated on the VM, never in git; least-privilege Mongo user
  (`readWrite` on one database); internal Mongo auth via keyfile; Garage admin API token-protected.
- Dedicated ServiceAccounts with `automountServiceAccountToken: false`; CPU/memory limits everywhere.
- App: scrypt passwords, JWT roles checked server-side, whitelisted input, no `innerHTML` (XSS-safe
  DOM building), strict Content-Security-Policy, HSTS, login rate limits (proxy + app).
- `make security` checks that the NetworkPolicies are enforced and runs **kubescape** if installed.

## Extra features

HPA on backend/media/frontend (`make load` to watch it scale), multi-zone node labels, chaos test
script, HTTPS with HTTP→HTTPS redirect, kustomize with a hashed ConfigMap (editing `garage.toml`
triggers a rolling restart), idempotent bootstrap Jobs/scripts.

## Design

Fonts (Inter, Inter Display and a renamed Lora Italic) are subset and **self-hosted**
in `apps/shared/fonts/` under the SIL Open Font License (see `LICENSE-OFL.txt`), so the
strict Content-Security-Policy stays `'self'`-only: no Google Fonts or CDN calls.

## Repository layout

```
apps/        backend (Node.js), frontend + coach (static SPAs), shared JS/CSS + fonts
cluster/     kind-config.yaml (1 control plane + 3 workers, one zone each)
k8s/         kustomize root: namespace, config, database, storage, backend, media,
             frontend, coach, security (NetworkPolicies)
proxy/       reverse proxy template (certs/ and generated/ are git-ignored)
scripts/     01..07 setup steps, chaos test, load test, security check
docs/        LEARNING-GUIDE.md: every concept explained, experiments, Q&A
```
