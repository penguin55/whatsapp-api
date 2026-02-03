# ---------- Stage 1: Build ----------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

# Install ALL deps (including devDependencies)
RUN npm install

# Copy source code
COPY . .

# Build TypeScript → dist/
RUN npm run build


# ---------- Stage 2: Production ----------
FROM node:20-alpine

WORKDIR /app

# Copy only production package files
COPY package*.json ./

# Install ONLY production deps
RUN npm install --omit=dev

# Copy built app from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app .

EXPOSE 3000

CMD ["npm", "start"]
# CMD ["node", "dist/index.js"]