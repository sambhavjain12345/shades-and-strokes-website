FROM node:20-alpine AS builder

WORKDIR /app
COPY mern/package*.json ./
RUN npm ci
COPY mern/ ./
RUN npm run build

FROM nginx:alpine
COPY backend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1
