# Discord Suggestion Bot

This is a Discord bot built with Node.js and Discord.js that allows users to submit suggestions via slash commands and modals. Suggestions are posted as embeds in a specified channel, where users can vote using reactions. Admins can manage suggestions by setting statuses and adding notes.

## Features
- Slash command `/suggest create` with type (Game or Community) to open a modal form.
- Conditional form fields based on suggestion type.
- Posts formatted embeds to a specific channel with voting reactions (👍 and 👎).
- Real-time vote counting and percentage updates in the embed.
- Admin command `/suggest manage` to set status (under consideration, implemented, not happening, clear) and add notes.
- Voting disabled when a status is set (except after clearing).
- Uses SQLite for storing suggestions and votes (persistent).
- Configurable via environment variables.
- Docker support for easy deployment.

## Prerequisites
- Node.js v16+ (tested with v20).
- A Discord bot token from the [Discord Developer Portal](https://discord.com/developers/applications). Enable necessary intents (Guilds, GuildMessages, GuildMessageReactions).
- Invite the bot to your server with permissions: Send Messages, Embed Links, Add Reactions, Read Message History.

## Installation

### Local Installation
1. Clone the repository:
   ```
   git clone https://github.com/drunkmunki/suggester.git
   cd suggester
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   DISCORD_TOKEN=your_discord_bot_token
   CHANNEL_ID=your_suggestion_channel_id  # e.g., 680337687676321793
   ADMIN_ROLES=role_id1,role_id2  # Comma-separated Discord role IDs for admins
   DB_PATH=suggestions.db  # Path to SQLite database file
   ```

4. Run the bot:
   ```
   node index.js
   ```

### Docker Installation
1. Build the Docker image:
   ```
   docker build -t suggestion-bot .
   ```

2. Run the container, passing environment variables:
   ```
   docker run -d \
     --name suggestion-bot \
     -e DISCORD_TOKEN=your_discord_bot_token \
     -e CHANNEL_ID=your_suggestion_channel_id \
     -e ADMIN_ROLES=role_id1,role_id2 \
     -e DB_PATH=/app/suggestions.db \
     -v /host/path/to/db:/app  # Optional: persist DB on host
     suggestion-bot
   ```

   For Portainer: Create a new container from the image and set the env vars and volumes via the UI.

### Ubuntu 23.10 Installation (Temporary Setup)
If you're facing issues with Docker/Alpine, use this script to set up on Ubuntu 23.10 for testing:

1. Ensure you have Ubuntu 23.10 installed (e.g., in a VM).
2. Clone the repository:
   ```
   git clone https://github.com/drunkmunki/suggester.git
   cd suggester
   ```
3. Make the script executable:
   ```
   chmod +x setup.sh
   ```
4. Run the script:
   ```
   ./setup.sh
   ```
5. The script will install everything and start the bot. Stop with Ctrl+C and restart as needed.

## Configuration
All configuration is done via environment variables in `.env` or Docker env:
- `DISCORD_TOKEN`: Required. Your bot's token.
- `CHANNEL_ID`: Required. The ID of the channel where suggestions are posted.
- `ADMIN_ROLES`: Optional. Comma-separated role IDs that can use the manage command.
- `DB_PATH`: Path to the SQLite DB file (defaults to `suggestions.db` in the working directory).
- `GUILD_ID`: Optional. The ID of the guild (server) to fetch custom emojis from.
- `UPVOTE_EMOJI_NAME`: Optional. Name of the custom upvote emoji (e.g., 'yes'). Requires GUILD_ID.
- `DOWNVOTE_EMOJI_NAME`: Optional. Name of the custom downvote emoji (e.g., 'no'). Requires GUILD_ID.

The bot auto-creates the SQLite table on startup.

## Usage
1. In Discord, type `/suggest create type:game` or `/suggest create type:community` to open the modal.
   - For Game: Fill Game Name, Map Name, Suggestion.
   - For Community: Fill Title, Detail.
2. Submit the modal – the suggestion posts as an embed with 👍/👎 reactions.
3. Users vote by reacting; votes update in real-time (one vote per user, can't up and down simultaneously).
4. Admins use `/suggest manage id:<suggestion_id> status:<status> notes:<optional_notes>` to update.
   - Statuses: under consideration, implemented, not happening, clear.
   - Clear resets status/notes and re-enables voting.
5. When status is set (not clear), reactions are removed, and voting is disabled. Embed updates with final votes and opinion score.

## Database
- Uses SQLite for simplicity (no external DB server needed).
- Table: `suggestions` with fields for ID, user, type, details, status, notes, date, votes, message ID.
- If you prefer MongoDB or MariaDB, modify the code in `index.js` to use those drivers.

## Contributing
Feel free to fork and submit pull requests. For issues, open a GitHub issue.

## License
MIT License
