FROM node:18-alpine

WORKDIR /app

COPY SurveyApp/server/package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

COPY SurveyApp/server/index.js SurveyApp/server/content-fetcher.js ./
COPY SurveyApp/server/ca-certificate.crt ./

# Copy dataset into container for content serving
COPY AugmentedDoing/dataset ./dataset

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "index.js"]
