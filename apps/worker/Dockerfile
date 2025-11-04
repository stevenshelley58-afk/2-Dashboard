FROM node:20-alpine

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/worker ./apps/worker

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Build shared config
RUN cd packages/config && pnpm build

# Build worker
RUN cd apps/worker && pnpm build

WORKDIR /app/apps/worker

CMD ["node", "dist/index.js"]
