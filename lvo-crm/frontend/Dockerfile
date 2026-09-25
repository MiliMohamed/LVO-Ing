# syntax=docker/dockerfile:1.7
# Front CRM (Next.js). CONTEXTE DE BUILD : ce dossier (projet npm autonome).
#   docker build frontend

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
# Lu par le navigateur, donc figé au build. Doit être l'URL PUBLIQUE d'ONLYOFFICE
# (pas un nom de service Docker) ; laisser vide si ONLYOFFICE n'est pas déployé.
ARG NEXT_PUBLIC_ONLYOFFICE_URL=""
ENV NEXT_PUBLIC_ONLYOFFICE_URL=$NEXT_PUBLIC_ONLYOFFICE_URL
# rewrites() de next.config.ts est évalué au BUILD en mode standalone (sérialisé dans
# routes-manifest.json) : la cible du proxy /api/* se fixe donc ici, pas au runtime.
ARG API_BASE_URL="http://crm-server:8081"
ENV API_BASE_URL=$API_BASE_URL
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3100 HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3100
CMD ["node", "server.js"]
