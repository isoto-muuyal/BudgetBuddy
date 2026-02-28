# Stage 1: Build the React frontend
FROM node:20-alpine AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# This creates the /dist folder with your frontend build
RUN npm run build 

# Stage 2: Production environment
FROM node:20-alpine
WORKDIR /app
COPY --from=build-stage /app/package*.json ./
# Install production dependencies only
RUN npm ci --omit=dev
# Copy the built files and the server code
COPY --from=build-stage /app/dist ./dist
COPY --from=build-stage /app/server ./server
COPY --from=build-stage /app/shared ./shared
COPY --from=build-stage /app/drizzle.config.ts ./drizzle.config.ts
RUN mkdir -p /app/data
# Ensure your Express app listens on port 5003
ENV NODE_ENV=production
ENV PORT=5003
ENV AUTO_DB_PUSH=true
ENV ADMIN_VISITS_CSV_PATH=/app/data/visits.csv
EXPOSE 5003

# Command to start your Express server
CMD ["node", "dist/index.js"]
