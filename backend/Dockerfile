FROM node:20-slim

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/src ./src
COPY data /app/data

ENV PORT=8000
ENV DATA_DIR=/app/data
ENV MONGODB_URI=mongodb://mongo:27017/store_intelligence

EXPOSE 8000

CMD ["node", "src/index.js"]
