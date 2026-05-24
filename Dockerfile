# Development image for the NestJS Booking System API.
# Small Alpine base, cached dependency layer, runs as non-root.

FROM node:20-alpine

WORKDIR /app

# Install only what package.json declares; copy lockfile first for layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source (src is bind-mounted in compose for hot reload).
COPY . .

# Drop privileges: official node image ships a non-root "node" user (uid 1000).
USER node

# Must match PORT in .env (defaults to 3000 in this project).
EXPOSE 3000

CMD ["npm", "run", "dev"]
