# Use the official Node.js LTS image as the base
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json into the container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files into the container
COPY . .

# Expose a port (if you want to use Hardhat's local Ethereum network)
EXPOSE 8545

# Run the Hardhat network when the container starts (optional)
CMD ["npx", "hardhat", "test"]
