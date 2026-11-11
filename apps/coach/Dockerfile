# Coach dashboard (frontend-admin): static files served by an unprivileged nginx (uid 101, port 8080).
# Build from the apps/ directory so the shared/ folder is in the build context:
#   docker build -f apps/coach/Dockerfile -t properlift/coach:1.0.0 apps
FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY coach/nginx.conf /etc/nginx/conf.d/default.conf
COPY shared/ /usr/share/nginx/html/shared/
COPY coach/html/ /usr/share/nginx/html/
EXPOSE 8080
