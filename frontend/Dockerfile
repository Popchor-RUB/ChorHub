FROM node:22-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM node:22-alpine AS build
ARG BASE_PATH=/
ARG VITE_API_URL=https://localhost:3000
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN BASE_PATH=${BASE_PATH} VITE_API_URL=${VITE_API_URL} npm run build

FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
