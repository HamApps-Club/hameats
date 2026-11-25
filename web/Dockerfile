# HamEats as one container: Next.js's standalone server on Node 22. Build from the web/ folder:
#   docker build --build-arg BUILD_ID=$(git rev-parse --short=12 HEAD) -t hameats .
#   docker run -p 3000:3000 --env-file .env.local hameats
# HamEats itself runs on AWS Lambda (infra/aws/README.md); this image runs the same server anywhere containers run,
# which is handy for trying a production build locally.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The deploy's ID (the git commit): installed apps compare it with /api/version to pick up new versions.
ARG BUILD_ID
ENV BUILD_ID=$BUILD_ID
# NEXT_PUBLIC_* values are written into the browser code at build time, so they're build arguments, not just runtime settings.
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]
