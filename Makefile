# Proper Lift - one command per step. Run "make" for the full setup.
SHELL := /bin/bash
S := scripts

.PHONY: all cluster images secrets deploy garage metrics proxy status chaos load security clean urls

all: cluster images secrets deploy metrics proxy   ## everything, from zero to a running site

cluster:   ## create the kind cluster (1 control plane + 3 workers)
	$(S)/01-create-cluster.sh

images:    ## build app images and load all images into the nodes
	$(S)/02-build-images.sh

secrets:   ## generate credentials and create the Kubernetes Secrets
	$(S)/03-create-secrets.sh

deploy:    ## apply manifests, bootstrap MongoDB + Garage, wait for health
	$(S)/04-deploy.sh

garage:    ## (re)run the idempotent Garage bootstrap only
	$(S)/05-bootstrap-garage.sh

metrics:   ## install metrics-server (needed by the HPAs)
	$(S)/06-install-metrics-server.sh

proxy:     ## start the HTTPS reverse proxy container on ports 80/443
	$(S)/07-proxy.sh

status:    ## show everything at a glance
	kubectl get nodes -L topology.kubernetes.io/zone
	kubectl -n properlift get pods,svc,pdb,hpa,pvc -o wide

chaos:     ## kill the node hosting the MongoDB primary and measure the impact
	$(S)/chaos-node-failure.sh

load:      ## load-test the backend to watch the HPA scale out
	$(S)/load-test.sh

security:  ## network-policy test + kubescape scan
	$(S)/security-check.sh

clean:     ## delete the proxy and the whole cluster (data is lost)
	-docker rm -f properlift-proxy
	kind delete cluster --name properlift

help:
	@grep -E '^[a-z]+:.*## ' Makefile | sed 's/:.*## /\t/'
