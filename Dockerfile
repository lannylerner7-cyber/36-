FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY lib/api-spec/package.json lib/api-spec/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/db/package.json lib/db/package.json

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @workspace/api-server run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app

COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/api/healthz').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]