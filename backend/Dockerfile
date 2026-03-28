FROM node:22-alpine AS development
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/. .
COPY frontend/public/icons/icon-512.png /app/frontend/public/icons/icon-512.png
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

FROM node:22-alpine AS build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/. .
COPY frontend/public/icons/icon-512.png /app/frontend/public/icons/icon-512.png
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app/backend
COPY --from=build /app/backend ./
COPY --from=build /app/frontend /app/frontend
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
