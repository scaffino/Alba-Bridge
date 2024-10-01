# Use an official Ubuntu base image
FROM ubuntu:22.04

# Install necessary dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    faketime \
    && apt-get clean

# Install Node.js (LTS version 18.x)
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

# Install Hardhat globally
RUN npm install -g hardhat

# Copy project files into the containerCOPY . .
COPY . . 

# Install dependencies
RUN npm install

# Pre-download the Solidity compiler without faking time
RUN npx hardhat compile

# Run tests with libfaketime, to simulate the Alba execution to November 2023
CMD ["faketime", "2023-11-11 12:00:00", "npx", "hardhat", "test"]
