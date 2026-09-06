FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV FFMPEG_PATH=/usr/bin/ffmpeg
RUN apk add --no-cache ffmpeg

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

RUN mkdir -p /app/data && chown -R node:node /app

USER node
CMD ["node", "dist/index.js"]
