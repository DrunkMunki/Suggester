#!/bin/bash

# This script sets up and runs the Discord Suggestion Bot on Ubuntu 23.10.
# Run it in the project directory after cloning the repo and creating .env.

# Exit on error
set -e

# Install project dependencies
echo "Installing npm dependencies..."
npm install

# Instructions for .env
echo "Ensure you have a .env file with:"
echo "DISCORD_TOKEN=your_token"
echo "CHANNEL_ID=your_channel_id"
echo "ADMIN_ROLES=role_id1,role_id2"
echo "DB_PATH=suggestions.db"

# Run the bot
echo "Starting the bot..."
node index.js
