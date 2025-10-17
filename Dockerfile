# Use a specific, long-term support version of Node.js
FROM node:18.18.0-slim

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Use npm ci for a clean, reliable install from package-lock.json
RUN npm ci --production

# Copy the rest of the application source code
COPY . .

# Google Cloud Run expects the container to listen on port 8080
ENV PORT=8080
EXPOSE 8080

# Start the server
CMD [ "node", "server.js" ]