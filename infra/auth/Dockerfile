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
COPY . .

FROM base AS release
WORKDIR /usr/src/app

COPY --from=install /temp/prod/node_modules ./node_modules
COPY --from=install /temp/prod/packages/auth/node_modules ./packages/auth/node_modules

COPY --from=prerelease /usr/src/app/packages/auth ./packages/auth

WORKDIR /usr/src/app/packages/auth
ENV NODE_ENV=production
ENV PORT=8000

USER bun
EXPOSE 8000/tcp
ENTRYPOINT ["bun", "run", "src/index.ts"]
