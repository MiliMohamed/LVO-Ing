# syntax=docker/dockerfile:1.7
# API CRM (Express + Prisma). CONTEXTE DE BUILD : ce dossier (projet npm autonome).
#   docker build server
#
# Cibles :
#   build → contient la CLI prisma : sert aussi au service one-shot `crm-migrate`
#   run   → image d'exécution (deps de prod seulement, JS compilé)

FROM node:24-alpine AS build
WORKDIR /app
# Moteurs Prisma sur Alpine : linux-musl-openssl-3.0.x
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json

FROM node:24-alpine AS run
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production API_PORT=8081
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
# Client Prisma généré au build (node_modules/.prisma), sans la CLI.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
# Logo, cachet… lus par le générateur d'offres (dist/documents/../../assets).
COPY assets ./assets
# data/ (registres JSON annexes) et uploads/ (arborescence sites) : volumes Docker.
RUN mkdir -p data uploads && chown -R node:node data uploads
USER node
EXPOSE 8081
CMD ["node", "dist/index.js"]
