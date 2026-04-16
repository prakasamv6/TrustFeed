FROM cgr.dev/chainguard/node:latest-dev AS build

WORKDIR /app
ENV NODE_ENV=production

COPY SurveyApp/server/package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

COPY SurveyApp/server/index.js SurveyApp/server/content-fetcher.js ./
COPY SurveyApp/server/ca-certificate.crt ./
COPY AugmentedDoing/dataset ./dataset

FROM cgr.dev/chainguard/node:latest

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app /app

USER 65532

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD ["node", "-e", "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["index.js"]
