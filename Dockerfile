FROM node:20-bookworm-slim

# Only need fonts for PDFKit (no Chromium!)
RUN apt-get update && apt-get install -y \
    fonts-liberation \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for layer caching
COPY app/package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm install

# Copy all app source
COPY app/ .

# Build the React frontend
RUN npm run build

# Create data directories
RUN mkdir -p /app/data/images /app/data/credentials /app/data/invoices

EXPOSE 3001

CMD ["node", "index.js"]
