FROM mcr.microsoft.com/playwright:v1.60.0-noble

WORKDIR /app

COPY package.json package.json
RUN npm install --omit=dev

COPY server.js server.js

ENV NODE_ENV=production
ENV PORT=8787
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

EXPOSE 8787

CMD ["npm", "start"]
