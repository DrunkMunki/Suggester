# Discord Suggestion Bot

A Discord bot (Node.js + discord.js v14) for collecting, displaying, and managing community suggestions. Users submit ideas via modals; suggestions are posted as embeds with voting. Admins can manage statuses and notes.

## Known Issues
When Submitting a form or running a command you may get timeout errors, re-trying fixes it, still troubleshooting

## Features
- **Dropdown panel (no typing needed)**: Admins can post a panel with a dropdown; users select Game or Community to open the form instantly.
- **Slash commands**: `/suggest create` and `/suggest manage` for creation and admin management.
- **Dynamic modals**: Fields adapt based on suggestion type.
- **Embeds + reactions**: Suggestions are posted with 👍/👎 reactions; votes and percentages update in real time.
- **Voting lock on status**: When status is set (not clear), reactions are removed and voting is disabled.
- **Configurable locale/timezone**: `LOCALE` and `TIMEZONE` control all displayed dates/times.
- **Custom emojis**: Optional custom up/down emojis by name via guild config.
- **SQLite storage**: Persistent local DB (simple, no external server).
- **Docker support**: Build and run easily in containers.

## Prerequisites
- Node.js v16+ (tested with v20).
- A Discord Application + Bot with token and required intents.
- Bot permissions in your server: **Send Messages**, **Embed Links**, **Add Reactions**, **Read Message History**.

## Create and Invite Your Discord Bot
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create an Application.
2. Add a Bot (Bot tab), then copy the bot token for your `.env` as `DISCORD_TOKEN`.
3. Under Bot settings, enable Privileged Gateway Intents:
   - Presence Intent: optional
   - Server Members Intent: optional
   - Message Content Intent: optional
   - Required intents for this bot: Guilds, Guild Messages, Guild Message Reactions (enabled by default at the Application level)
4. Invite the bot to your server using an OAuth2 URL with scopes `bot` and `applications.commands`.
   - Example template (replace `YOUR_CLIENT_ID`):
     - [Invite the bot](https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot%20applications.commands&permissions=274877975616)
     - The `permissions` value grants Send Messages, Embed Links, Add Reactions, and Read Message History.

## Linux Setup (local)
1. Clone and install:
   ```bash
   git clone https://github.com/drunkmunki/suggester.git
   cd suggester
   npm install
   ```
2. Create `.env` in the project root:
   ```env
   DISCORD_TOKEN=your_discord_bot_token
   CHANNEL_ID=your_suggestion_channel_id
   ADMIN_ROLES=role_id1,role_id2
   DB_PATH=suggestions.db
   # Optional emoji customization (requires GUILD_ID)
   GUILD_ID=your_guild_id
   UPVOTE_EMOJI_NAME=upvote_emoji_name
   DOWNVOTE_EMOJI_NAME=downvote_emoji_name
   # Locale/Timezone config
   LOCALE=en-US
   TIMEZONE=UTC
   ```
3. Start the bot:
   ```bash
   node index.js
   ```
4. (Optional) Run as a systemd service:
   ```ini
   [Unit]
   Description=Suggester Bot
   After=network.target

   [Service]
   WorkingDirectory=/path/to/suggester
   ExecStart=/usr/bin/node index.js
   Restart=always
   Environment=NODE_ENV=production
   EnvironmentFile=/path/to/suggester/.env

   [Install]
   WantedBy=multi-user.target
   ```
   Then:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable suggester
   sudo systemctl start suggester
   ```

## Docker Setup
### Build image
```bash
docker build -t suggestion-bot .
```

### Run with docker run
```bash
docker run -d \
  --name suggestion-bot \
  -e DISCORD_TOKEN=your_discord_bot_token \
  -e CHANNEL_ID=your_suggestion_channel_id \
  -e ADMIN_ROLES=role_id1,role_id2 \
  -e DB_PATH=/app/suggestions.db \
  -e LOCALE=en-US \
  -e TIMEZONE=UTC \
  -e GUILD_ID=your_guild_id \  # optional
  -e UPVOTE_EMOJI_NAME=upvote_emoji_name \  # optional
  -e DOWNVOTE_EMOJI_NAME=downvote_emoji_name \  # optional
  -v /host/path/to/db:/app \
  suggestion-bot
```

### Run with docker-compose
```yaml
services:
  suggester:
    image: suggestion-bot:latest
    container_name: suggestion-bot
    restart: unless-stopped
    environment:
      DISCORD_TOKEN: your_discord_bot_token
      CHANNEL_ID: your_suggestion_channel_id
      ADMIN_ROLES: role_id1,role_id2
      DB_PATH: /app/suggestions.db
      LOCALE: en-US
      TIMEZONE: UTC
      # GUILD_ID: your_guild_id
      # UPVOTE_EMOJI_NAME: upvote_emoji_name
      # DOWNVOTE_EMOJI_NAME: downvote_emoji_name
    volumes:
      - /host/path/to/db:/app
```

For Portainer, create a container from the image and set env vars/volumes via the UI.

## Configuration (.env)
- **DISCORD_TOKEN**: Required. Bot token from the Developer Portal.
- **CHANNEL_ID**: Required. Channel ID where suggestions are posted.
- **ADMIN_ROLES**: Optional. Comma-separated role IDs permitted to use admin commands (`/suggest manage`, `/suggest panel`).
- **DB_PATH**: Optional. Path to SQLite DB file. Defaults to `suggestions.db` in the working directory.
- **GUILD_ID**: Optional. Guild ID used to fetch custom emojis by name.
- **UPVOTE_EMOJI_NAME**: Optional. Custom upvote emoji name. Requires `GUILD_ID`.
- **DOWNVOTE_EMOJI_NAME**: Optional. Custom downvote emoji name. Requires `GUILD_ID`.
- **LOCALE**: Optional. Locale for date formatting (e.g., `en-GB`, `de-DE`). Default `en-US`.
- **TIMEZONE**: Optional. IANA timezone (e.g., `Europe/London`, `America/New_York`). Default `UTC`.

The bot auto-creates the SQLite table on startup.

## Commands and UI
- **/suggest panel** (admin-only):
  - Posts a message with a dropdown to open suggestion forms without typing.
  - Options:
    - **Game Suggestion**: Opens the Game modal.
    - **Community Suggestion**: Opens the Community modal.
  - The dropdown resets after selection so users can pick the same option again later.

- **/suggest create type:<game|community>**:
  - Opens the corresponding modal via slash command.
  - Game modal fields: **Game Name**, **Map/Server Name**, **Suggestion**, **Reason**.
  - Community modal fields: **Suggestion Title**, **Suggestion in Detail**.

- **/suggest manage id:<number> status:<under consideration|implemented|not happening|clear> [notes:<text>]** (admin-only):
  - Sets the public status and optional notes for a suggestion.
  - When a non-`clear` status is set: voting reactions are removed and voting is disabled; the embed adds status and comment.
  - When `clear` is set: status/notes are removed and voting is re-enabled (reactions are restored if absent).
  - The success confirmation is ephemeral and auto-clears after ~5 seconds.
  - Admin notes are timestamped using your configured `LOCALE`/`TIMEZONE`.

### Voting behavior
- Users can vote with 👍 or 👎 (one active vote at a time; picking the other removes the first).
- The embed tracks counts and percentages; when a status is set (not clear), votes are frozen for that suggestion.

### Custom emojis
- If `GUILD_ID` and emoji names are provided, the bot will use those custom emojis for voting.

## Database
- SQLite database with table `suggestions` storing ID, user, type, details, status, notes, submission date, votes, and message ID.
- To use another DB, adapt the queries in `index.js` accordingly.

## Contributing
PRs are welcome. For issues or feature requests, open a GitHub issue.

## License
MIT License
