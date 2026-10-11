# syntax=docker/dockerfile:1

# Matches .nvmrc; the Docker workflow passes it as a build argument.
ARG NODE_VERSION=24

# --- Build -----------------------------------------------------------------------------------------------------------
# Runs on the build machine's platform even for arm64 images: the output is JavaScript, and better-sqlite3 ships
# prebuilt binaries for every platform, which the bundle keeps (checked by the arm64 smoke test).
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-slim AS build
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    HUSKY=0
RUN corepack enable
WORKDIR /app

# Download dependencies first so this layer is cached until the lockfile changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch

COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --offline --frozen-lockfile \
    && pnpm build

# --- Development -----------------------------------------------------------------------------------------------------
# Used by compose.dev.yaml: the source is bind-mounted into /app and `nuxt dev` serves it with hot reload.
# node_modules and .nuxt are volumes owned by the node user, so Linux binaries never land in the host checkout.
FROM node:${NODE_VERSION}-slim AS dev
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    HUSKY=0 \
    HOST=0.0.0.0 \
    PORT=3000
RUN corepack enable \
    && mkdir -p /app/node_modules /app/.nuxt /pnpm \
    && chown -R node:node /app /pnpm
# The image's node user (numeric, so file ownership resolves the same on every host).
USER 1000:1000
WORKDIR /app
EXPOSE 3000
# Install first so the node_modules volume always matches the lockfile (fast when nothing changed).
CMD ["sh", "-c", "pnpm install --frozen-lockfile && pnpm dev --host 0.0.0.0"]

# --- Runtime ---------------------------------------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runtime

# tini forwards signals and reaps processes; gosu drops root privileges after the entrypoint prepared /data.
# npm and corepack are not needed at runtime and bring their own vulnerable dependencies: remove them.
# Debian packages are not pinned on purpose: every build picks up the latest security fixes.
# hadolint ignore=DL3008
RUN apt-get update \
    && apt-get upgrade --yes \
    && apt-get install --yes --no-install-recommends gosu tini \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
        /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/data \
    PUID=1000 \
    PGID=1000

WORKDIR /app
COPY --from=build /app/.output ./.output
COPY docker/entrypoint.sh /usr/local/bin/stackmap-entrypoint
RUN chmod 0755 /usr/local/bin/stackmap-entrypoint \
    && mkdir -p /data \
    && chown node:node /data

VOLUME /data
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

ENTRYPOINT ["tini", "--", "stackmap-entrypoint"]
CMD ["node", ".output/server/index.mjs"]
