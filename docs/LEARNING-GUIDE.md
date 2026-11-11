# Proper Lift learning guide

This guide explains **why** each piece of this project exists, using the Ginflix project as the
reference point. Read it next to the YAML files. Every section says where to look.

---

## 1. The big picture

A user's request travels like this:

```
Browser
  │  https://properlift.10.0.0.5.nip.io/api/programs
  ▼
properlift-proxy (nginx in Docker on the VM, ports 80/443)        proxy/properlift.conf.template
  │  TLS ends here. "/api/" → upstream fc_backend = the 3 workers on port 30082
  ▼
any worker node :30082 (NodePort)                                k8s/backend/backend.yaml (Service)
  │  kube-proxy picks one READY backend pod, on any node
  ▼
backend pod :8080                                                apps/backend/src/
  │  MONGO_URI lists the 3 members + replicaSet=rs0
  ▼
MongoDB primary (mongo-0, -1 or -2)                              k8s/database/mongo.yaml
```

**Why a reverse proxy at all?** kind's "servers" are Docker containers on a private Docker network
(`172.18.x.x`). Your laptop cannot reach them; only the VM can. The proxy runs on the VM, so it is
the bridge between the outside world and the cluster. In a real cloud a LoadBalancer Service or an
Ingress controller would do this job.

**Why does the proxy list all 3 workers?** A NodePort Service listens on *every* node and forwards
to a ready pod *anywhere*. If the proxy only knew one node, that node would become the single
point of failure. Listing all three, with `proxy_next_upstream`, means a dead node is skipped.

---

## 2. Concepts, one by one

### Namespace + Pod Security Admission: `k8s/00-namespace.yaml`
A namespace groups the app's resources. The `pod-security.kubernetes.io/enforce: restricted` label
makes the **API server refuse** any pod that runs as root, keeps Linux capabilities, can escalate
privileges or has no seccomp profile. Try it: `kubectl run test -n properlift --image=nginx` is
rejected, because the stock nginx image runs as root.

### Deployment vs StatefulSet
- **Deployment** (frontend, coach, backend, media): interchangeable pods with random names. If one
  dies, a new one starts anywhere. This works because they keep no data.
- **StatefulSet** (mongo, garage): pods have **stable names** (`mongo-0`, `mongo-1`, `mongo-2`), stable
  DNS names (`mongo-0.mongo-hl.properlift.svc.cluster.local`) and **their own volume each**
  (`volumeClaimTemplates`). The database members need to address each other by name, and each keeps
  its own copy of the data.

### Services: ClusterIP, headless, NodePort
| Type | Used for | Reachable from |
|---|---|---|
| `ClusterIP` (`garage`) | one virtual IP load-balancing to pods | inside the cluster only |
| headless `clusterIP: None` (`mongo-hl`, `garage-hl`) | one DNS record **per pod**, no load balancing | inside the cluster only |
| `NodePort` (`frontend` 30080, `coach` 30081, `backend` 30082, `media` 30083) | a port opened on every node | the VM (and so the proxy) |

The database has **no** NodePort: that is the "must not be exposed" requirement. NetworkPolicies
(below) go further and block other pods from reaching it too.

`publishNotReadyAddresses: true` on the headless services: Mongo members must find each other
*before* they are ready, otherwise the replica set could never form.

### ConfigMap vs Secret: `k8s/config/app-config.yaml`, `scripts/03-create-secrets.sh`
- ConfigMap = non-sensitive settings (bucket name, S3 endpoint, `config.js` for the browser).
- Secret = passwords, keys, tokens. They are generated randomly **on the VM** and never written in
  the repository (`k8s/secrets.example.yaml` only shows their shape).
- Two ways to consume them: as **environment variables** (`envFrom`, `secretKeyRef`) or as
  **files** (`config.js` is mounted as a file over the one baked in the image, and the Mongo keyfile
  is a mounted file too).

### The 3 probes
| Probe | Question | Failure means | Where |
|---|---|---|---|
| startup | "has it finished starting?" | keep waiting (other probes paused) | backend, mongo |
| liveness | "is the process stuck/dead?" | **restart** the container | all |
| readiness | "can it serve traffic now?" | **remove from the Service** (no restart) | all |

Important design choice in `apps/backend/src/server.js`: **liveness does not check MongoDB**.
If it did, a database outage would make Kubernetes restart every backend pod in a loop, which makes
things worse. Readiness *does* check MongoDB, so a backend that lost its database simply stops
receiving traffic until it reconnects.

### Rolling updates without dropped requests
`maxUnavailable: 0, maxSurge: 1`: Kubernetes starts a new pod, waits until it is *ready*, and only
then stops an old one. Stopping cleanly has three parts:
1. the pod is removed from the Service endpoints,
2. `preStop: sleep 5` keeps it serving while every node's kube-proxy catches up,
3. SIGTERM → the backend stops accepting connections, finishes in-flight requests, closes MongoDB, exits.

Try it: `kubectl -n properlift rollout restart deploy/backend` while running
`while true; do curl -sk -o /dev/null -w '%{http_code}\n' https://$DOMAIN/api/programs; sleep .2; done`.

### PodDisruptionBudget
Protects against **voluntary** disruptions (`kubectl drain`, cluster upgrades). `mongo` has
`minAvailable: 2`, so a drain can never take 2 of the 3 members at once and break the majority.
Try: `kubectl drain properlift-worker --ignore-daemonsets --delete-emptydir-data`, then
`kubectl uncordon properlift-worker`.

### Spreading pods: anti-affinity and topology spread
- `mongo` and `garage` use **required** pod anti-affinity: never two members on one node.
  Otherwise one node failure could take 2 of 3 copies.
- Stateless apps use `topologySpreadConstraints` with `ScheduleAnyway`: spread if possible, but
  still allow scheduling when a node is down (a hard rule would block the replacement pods).
- `cluster/kind-config.yaml` gives each worker a zone label (`zone-a/b/c`), the way cloud nodes are
  labelled. Garage also uses these zones to place its 3 copies.

### What really happens when a node dies
| Time | Event |
|---|---|
| t = 0 | node stops (`docker stop properlift-worker2`) |
| 0-2 s | the proxy's connections to that node fail and it retries another node |
| ~10-15 s | if the Mongo primary was there, the 2 survivors elect a new primary; the driver follows it (`retryWrites`) |
| ~40-50 s | the control plane marks the node `NotReady`; its pods become not-ready and leave the Service endpoints |
| +30 s | our `tolerationSeconds: 30` expires → those pods are evicted → Deployments create replacements on healthy nodes |
| later | node comes back → kubelet restarts its pods → Mongo/Garage members resync automatically |

Note that **StatefulSet pods are not moved**: their volume is on the dead node's disk (kind's
local-path storage), and Kubernetes will not start a second `mongo-1` while it cannot confirm the
first is gone. That is exactly why the data layer is replicated *by the application* (Mongo
replica set, Garage replication) rather than by Kubernetes.

Run `make chaos` to measure it yourself.

### HorizontalPodAutoscaler: `k8s/*/…yaml`, `scripts/06-install-metrics-server.sh`
The HPA compares the pods' CPU usage with their CPU **request** (`averageUtilization: 70` = 70 %
of 100m for the backend) and adds or removes replicas between min and max. It needs
**metrics-server** to read usage. Watch it: `make load` in one terminal,
`kubectl get hpa -n properlift -w` in another.

### NetworkPolicies: `k8s/security/network-policies.yaml`
By default every pod can talk to every pod. The policies follow a zero-trust pattern:
1. `default-deny-all` blocks all ingress **and egress** for every pod in the namespace,
2. `allow-dns-egress` lets pods resolve names,
3. one policy per flow that the architecture diagram actually needs.

`make security` starts a pod in another namespace and checks that MongoDB and Garage are
**BLOCKED** while the backend port is **OPEN**. kind's default CNI enforces NetworkPolicy since
kind v0.24. On older versions the policies would be silently ignored, which is why the test exists.

### securityContext: every workload
```yaml
securityContext:              # pod level
  runAsNonRoot: true
  runAsUser: 1000
  seccompProfile: { type: RuntimeDefault }
containers[].securityContext: # container level
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities: { drop: ["ALL"] }
```
A read-only root filesystem means an attacker who gets code execution cannot modify the binaries.
The few places that need writing get an `emptyDir` (`/tmp`) or a volume (`/data/db`).
That is also why the images are `nginx-unprivileged` (port 8080, uid 101) instead of `nginx`.

### Kustomize: `k8s/kustomization.yaml`
`kubectl apply -k k8s/` applies everything in one command, puts it in the namespace and adds a
common label. `configMapGenerator` turns `garage.toml` into a ConfigMap whose **name contains a hash
of its content**: change the file, the name changes, the StatefulSet's pod template changes, and
Kubernetes performs a rolling restart by itself.

### Replacing the course services
- **Registry**: `kind load docker-image` copies images straight into each node's container runtime,
  so no registry and no `imagePullSecrets` are needed (`imagePullPolicy: IfNotPresent`).
- **S3 (Garage)**: same software as the course. Its one-time setup (layout, key, bucket) is what
  "another team" did for you in Ginflix. Here it is `scripts/05-bootstrap-garage.sh`.
  MinIO was not used: it stopped publishing Docker images in October 2025.
- **IAM (Keycloak)**: the backend issues its own JWTs. The role (`client`/`coach`) is inside the
  signed token and checked on every `/api/coach/*` route. Keycloak would add SSO, MFA and password
  reset, at the cost of ~1 GB of RAM. Adding it is a good extension.

---

## 3. Experiments to run (and what to observe)

| Command | What you learn |
|---|---|
| `kubectl -n properlift delete pod -l app=backend --wait=false` | Deployments recreate pods within seconds |
| `kubectl -n properlift delete pod mongo-1` | same name, same volume comes back; data intact |
| `kubectl -n properlift exec mongo-0 -- mongosh --quiet --eval 'db.hello().primary'` | which member is PRIMARY right now (run again after `make chaos`) |
| `make chaos` | full node failure, measured |
| `kubectl -n properlift scale deploy/backend --replicas=1` | the HPA brings it back to 3 (minReplicas) |
| `kubectl -n properlift rollout restart deploy/backend` + curl loop | zero-downtime rolling update |
| `kubectl -n properlift set image deploy/backend backend=properlift/backend:broken` | new pods fail, old ones keep serving (`maxUnavailable: 0`); undo with `kubectl rollout undo` |
| `kubectl run test -n properlift --image=nginx` | rejected by Pod Security Admission |
| `make security` | NetworkPolicies enforced + kubescape score |
| `curl -sk https://$DOMAIN/api/whoami` (repeat) | different pods answer: load balancing |

---

## 4. Questions you may be asked at the demo

**Why not just one MongoDB pod with a PersistentVolume?** On kind (and any local storage) the
volume is tied to one node. If that node dies, the pod cannot be rescheduled elsewhere with its
data. Replication at the database level is the only way to survive the loss of a node.

**Why 3 members and not 2?** Elections need a strict majority. With 2, losing one leaves 1 of 2,
which is not a majority, so there would be no primary and no writes.

**What is the difference between liveness and readiness?** Liveness failure restarts the
container. Readiness failure only stops sending it traffic.

**What does the PDB protect against that replicas don't?** Voluntary evictions (drain, upgrade)
that would otherwise be allowed to remove several pods at once.

**Why is the database still reachable by the backend if it has no external exposure?** It has a
ClusterIP/headless service, which only exists inside the cluster's network, and the NetworkPolicy
only lets the backend (and its own members) connect.

**Where is TLS terminated?** At the reverse proxy. Inside the cluster traffic is plain HTTP, which
is a known limitation; a service mesh (Istio, Linkerd) or Cilium's encryption would fix it.

**What is still a single point of failure?** The VM itself, the proxy container on it, and the
kind control plane (if it dies, running pods keep serving but nothing gets rescheduled). In
production these become a cloud load balancer and a multi-master control plane.

---

## 5. Troubleshooting

These manifests and scripts were syntax-checked and the web apps were tested against a mock API,
but the full stack was written without access to a live cluster. If a step fails, these are the
usual suspects:

```bash
kubectl -n properlift get pods -o wide                 # what is not Running/Ready?
kubectl -n properlift describe pod <pod>               # events: scheduling, probes, PSA rejections
kubectl -n properlift logs <pod> [--previous]          # application logs
kubectl -n properlift logs job/mongo-init              # replica set bootstrap
kubectl -n properlift exec garage-0 -- /garage status  # Garage cluster view
```

- **`mongo-init` keeps retrying**: check `kubectl logs job/mongo-init`. If the replica set refuses
  to initiate on a cluster that ran before, start clean: `make clean && make`.
- **Garage bootstrap step fails**: the Garage CLI changes between major versions. Run the failing
  command by hand (`kubectl -n properlift exec garage-0 -- /garage help`, then `… key help`,
  `… layout help`) and adjust `scripts/05-bootstrap-garage.sh`.
- **Backend not ready**: `kubectl logs deploy/backend`. "connection attempt failed" means MongoDB or
  the `properlift` user is not ready yet (it retries by itself).
- **Uploads fail**: the bucket or key is missing (re-run `make garage`), or the file is over 50 MB.
- **Browser cannot reach the site**: `docker logs properlift-proxy`, and check that ports 80/443 are
  open on the VM's firewall.
- **Pods Pending with "didn't match pod anti-affinity"**: mongo and garage need 3 worker nodes.
