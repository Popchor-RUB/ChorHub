FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /workspace

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json package-lock.json ./
RUN npm ci

COPY playwright.config.ts tsconfig.json ./
COPY e2e ./e2e

ENTRYPOINT ["npx", "playwright", "test"]
