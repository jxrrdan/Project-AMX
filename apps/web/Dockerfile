# Multi-stage build for the Angular SPA, served by nginx — the local stand-in for the
# S3 + CloudFront hosting in production. Build context is the repository root:
#   docker build -f apps/web/Dockerfile -t ams-web .

# --- Build stage -----------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Prisma client is generated so the shared lib / types resolve during the Nx build.
RUN npx prisma generate --schema apps/api/prisma/schema.prisma \
 && npx nx build web --configuration=production

# --- Runtime stage ---------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runner
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist/apps/web/browser /usr/share/nginx/html
EXPOSE 80
