FROM oven/bun:1-alpine AS base
WORKDIR /usr/src/app

FROM base AS install
RUN mkdir -p /temp/dev /temp/prod

COPY package.json bun.lock turbo.json bunfig.toml /temp/dev/
COPY packages /temp/dev/packages
WORKDIR /temp/dev
RUN bun install --frozen-lockfile

COPY package.json bun.lock turbo.json bunfig.toml /temp/prod/
COPY packages /temp/prod/packages
WORKDIR /temp/prod
RUN bun install --frozen-lockfile --production

FROM base AS prerelease
COPY --from=install /temp/dev/node_modules ./node_modules
COPY --from=install /temp/dev/packages/catatan_frontend/node_modules ./packages/catatan_frontend/node_modules
COPY . .

WORKDIR /usr/src/app/packages/catatan_frontend
RUN --mount=type=secret,id=VITE_API_URL \
  VITE_API_URL="$(cat /run/secrets/VITE_API_URL)" bun --bun run build

FROM base AS release
WORKDIR /usr/src/app

COPY --from=install /temp/prod/node_modules ./node_modules
COPY --from=prerelease /usr/src/app/packages/catatan_frontend ./packages/catatan_frontend

WORKDIR /usr/src/app/packages/catatan_frontend
ENV NODE_ENV=production
ENV PORT=3000

USER bun
EXPOSE 3000/tcp
ENTRYPOINT ["bun", "run", ".output/server/index.mjs"]
