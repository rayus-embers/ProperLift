# Client web site: static files served by an unprivileged nginx (uid 101, port 8080).
# Build from the apps/ directory so the shared/ folder is in the build context:
#   docker build -f apps/frontend/Dockerfile -t properlift/frontend:1.0.0 apps
FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY shared/ /usr/share/nginx/html/shared/
COPY frontend/html/ /usr/share/nginx/html/
EXPOSE 8080
