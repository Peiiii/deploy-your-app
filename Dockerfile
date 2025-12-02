FROM node:20-alpine

# Working directory inside the container
WORKDIR /app

# Enable corepack so we can use pnpm
RUN corepack enable

# Copy root workspace manifests (needed for pnpm workspace)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy server package manifest
COPY server/package.json server/package.json

# Install dependencies for the server workspace only
RUN pnpm install --frozen-lockfile --filter deploy-your-app-server

# Copy server source code only
COPY server/ server/

# Build the backend server only
RUN pnpm --filter deploy-your-app-server build

# Default data directory inside the container (can be overridden by DATA_DIR)
ENV NODE_ENV=production \
    DATA_DIR=/data

# Prepare a volume-friendly data directory
RUN mkdir -p /data

# Expose the default server port (the actual port can be overridden by PORT/SERVER_PORT)
EXPOSE 4173

# Start the backend server
CMD ["node", "server/dist/index.js"]

