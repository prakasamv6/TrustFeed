FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npx ng build --configuration=production

# Stage 2: Serve with nginx
FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ai-content-social/browser /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

# Inject runtime config at container start (enable live mode via TRUSTFEED_LIVE env var)
CMD ["/bin/sh", "-c", "\
  echo \"window.__TRUSTFEED_LIVE__ = ${TRUSTFEED_LIVE:-false};\" > /usr/share/nginx/html/runtime-config.js && \
  echo \"window.__SURVEY_API_URL__ = '${SURVEY_API_URL:-}';\" >> /usr/share/nginx/html/runtime-config.js && \
  nginx -g 'daemon off;'"]
