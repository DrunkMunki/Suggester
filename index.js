require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, REST, Routes } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Reaction],
});

const db = new sqlite3.Database(process.env.DB_PATH, (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.run(`CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      type TEXT,
      game_name TEXT,
      map_name TEXT,
      suggestion TEXT,
      reason TEXT,
      title TEXT,
      detail TEXT,
      status TEXT,
      notes TEXT,
      submission_date TEXT,
      upvotes INTEGER DEFAULT 0,
      downvotes INTEGER DEFAULT 0,
      message_id TEXT
    )`);
  }
});

async function buildEmbed(row) {
  let username = 'Unknown User';
  try {
    const user = await client.users.fetch(row.user_id);
    username = user.username;
  } catch (error) {
    console.error('Error fetching user:', error);
  }
  const embed = new EmbedBuilder()
    .setTitle(`Suggestion from ${username}`);

  // Set color based on status
  let color = 0x0099FF; // Blue for new/no status
  if (row.status) {
    switch (row.status.toLowerCase()) {
      case 'not happening':
        color = 0xFF0000; // Red
        break;
      case 'under consideration':
        color = 0xFFA500; // Orange
        break;
      case 'implemented':
        color = 0x00FF00; // Green
        break;
      default:
        color = 0x0099FF; // Default to blue
    }
  }
  embed.setColor(color);

  if (row.type === 'game') {
    embed.addFields(
      { name: 'Game Name', value: row.game_name || 'N/A', inline: true },
      { name: 'Map/Server Name', value: row.map_name || 'N/A', inline: false },
      { name: 'Suggestion', value: row.suggestion || 'N/A' },
      { name: 'Reason', value: row.reason || 'N/A' }
    );
  } else if (row.type === 'community') {
    embed.addFields(
      { name: 'Suggestion Title', value: row.title || 'N/A' },
      { name: 'Suggestion in Detail', value: row.detail || 'N/A' }
    );
  }

  if (row.status) {
    embed.addFields(
      { name: 'Public Status', value: row.status.charAt(0).toUpperCase() + row.status.slice(1) }
    );
    if (row.notes) {
      embed.addFields(
        { name: 'Comment', value: row.notes }
      );
    }
  }

  const total = row.upvotes + row.downvotes;
  const upPct = total > 0 ? (row.upvotes / total * 100).toFixed(2) : '0.00';
  const downPct = total > 0 ? (row.downvotes / total * 100).toFixed(2) : '0.00';
  let votesValue = `Upvotes: ${row.upvotes} ${upPct}%\nDownvotes: ${row.downvotes} ${downPct}%`;
  if (row.status) {
    const opinion = row.upvotes - row.downvotes;
    votesValue = `Opinion: ${opinion >= 0 ? '+' : ''}${opinion}\n` + votesValue;
  }
  embed.addFields({ name: 'Votes', value: votesValue });

  embed.setFooter({ text: `Suggestion ID: ${row.id} | Submitted at • ${row.submission_date}` });

  return embed;
}

async function updateEmbed(message, row) {
  const embed = await buildEmbed(row);
  await message.edit({ embeds: [embed] });
}

let upEmoji = '👍';
let downEmoji = '👎';

client.once('ready', async () => {
  console.log('Bot is ready!');

  // Fetch emojis if configured
  if (process.env.GUILD_ID && process.env.UPVOTE_EMOJI_NAME && process.env.DOWNVOTE_EMOJI_NAME) {
    try {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      const customUp = guild.emojis.cache.find(e => e.name === process.env.UPVOTE_EMOJI_NAME);
      const customDown = guild.emojis.cache.find(e => e.name === process.env.DOWNVOTE_EMOJI_NAME);
      if (customUp) upEmoji = customUp;
      if (customDown) downEmoji = customDown;
      console.log(`Using emojis: up=${upEmoji.toString()}, down=${downEmoji.toString()}`);
    } catch (err) {
      console.error('Error fetching custom emojis:', err);
    }
  }

  const commands = [
    {
      name: 'suggest',
      description: 'Suggestion commands',
      options: [
        {
          type: 1,
          name: 'create',
          description: 'Create a new suggestion',
          options: [
            {
              name: 'type',
              description: 'Type of suggestion',
              type: 3,
              required: true,
              choices: [
                { name: 'Game', value: 'game' },
                { name: 'Community', value: 'community' },
              ],
            },
          ],
        },
        {
          type: 1,
          name: 'manage',
          description: 'Manage a suggestion (admin only)',
          options: [
            {
              name: 'id',
              description: 'Suggestion ID',
              type: 4,
              required: true,
            },
            {
              name: 'status',
              description: 'Status to set',
              type: 3,
              required: true,
              choices: [
                { name: 'Under Consideration', value: 'under consideration' },
                { name: 'Implemented', value: 'implemented' },
                { name: 'Not Happening', value: 'not happening' },
                { name: 'Clear', value: 'clear' },
              ],
            },
            {
              name: 'notes',
              description: 'Admin notes',
              type: 3,
              required: false,
            },
          ],
        },
      ],
    },
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Successfully registered application commands.');
  } catch (error) {
    console.error(error);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    console.log(`Interaction received: type=${interaction.type}, id=${interaction.id}, commandName=${interaction.commandName || 'N/A'}, customId=${interaction.customId || 'N/A'}, user=${interaction.user.id}`);

    if (interaction.isModalSubmit()) {
      console.log(`Modal submit detected: customId=${interaction.customId}`);
    }

    if (!interaction.isCommand() && !interaction.isModalSubmit()) return;

    if (interaction.isCommand()) {
      const subcommand = interaction.options.getSubcommand();

      console.time('commandProcessing');

      if (subcommand === 'create') {
        console.time('buildAndShowModal');
        const type = interaction.options.getString('type');

        const modal = new ModalBuilder()
          .setCustomId(`suggest_modal_${type}`)
          .setTitle(`${type.charAt(0).toUpperCase() + type.slice(1)} Suggestion`);

        if (type === 'game') {
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('game_name').setLabel('Game Name').setStyle(TextInputStyle.Short)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('map_name').setLabel('Map/Server Name').setStyle(TextInputStyle.Short)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('suggestion').setLabel('Suggestion').setStyle(TextInputStyle.Paragraph)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('reason').setLabel('Reason').setStyle(TextInputStyle.Paragraph)
            )
          );
        } else if (type === 'community') {
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('title').setLabel('Suggestion Title').setStyle(TextInputStyle.Short)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('detail').setLabel('Suggestion in Detail').setStyle(TextInputStyle.Paragraph)
            )
          );
        }

        await interaction.showModal(modal);
        console.timeEnd('buildAndShowModal');
      } else if (subcommand === 'manage') {
        await interaction.deferReply({ flags: 64 });

        const adminRoles = process.env.ADMIN_ROLES ? process.env.ADMIN_ROLES.split(',') : [];
        if (!interaction.member.roles.cache.some(r => adminRoles.includes(r.id))) {
          return interaction.editReply({ content: 'You do not have permission to use this command.' });
        }

        const id = interaction.options.getInteger('id');
        const status = interaction.options.getString('status');
        const notes = interaction.options.getString('notes') ?? '';

        db.get('SELECT * FROM suggestions WHERE id = ?', [id], async (err, row) => {
          if (err) {
            console.error(err);
            return interaction.editReply({ content: 'Error fetching suggestion.' });
          }
          if (!row) {
            return interaction.editReply({ content: 'Suggestion not found.' });
          }

          let newStatus = status;
          let newNotes = row.notes; // preserve if clear
          if (status === 'clear') {
            newStatus = null;
            newNotes = null;
          } else {
            const noteDate = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });
            newNotes = `${noteDate}\n${interaction.user.username} response:\n${notes}`;
          }

          db.run('UPDATE suggestions SET status = ?, notes = ? WHERE id = ?', [newStatus, newNotes, row.id], async (updateErr) => {
            if (updateErr) {
              console.error(updateErr);
              return interaction.editReply({ content: 'Error updating suggestion.' });
            }

            const channel = client.channels.cache.get(process.env.CHANNEL_ID);
            if (channel) {
              try {
                const message = await channel.messages.fetch(row.message_id);
                if (message) {
                  if (newStatus && newStatus !== 'clear') {
                    await message.reactions.removeAll();
                  } else {
                    if (!message.reactions.cache.has(upEmoji)) await message.react(upEmoji);
                    if (!message.reactions.cache.has(downEmoji)) await message.react(downEmoji);
                  }
                  await updateEmbed(message, { ...row, status: newStatus, notes: newNotes });
                }
              } catch (fetchErr) {
                console.error('Error fetching message:', fetchErr);
              }
            }

            interaction.editReply({ content: 'Suggestion updated successfully.' });
          });
        });
      }

      console.timeEnd('commandProcessing');
    }

    // Handle modal submit
    if (interaction.isModalSubmit() && interaction.customId.startsWith('suggest_modal_')) {
      console.log(`Processing suggest modal: customId=${interaction.customId}`);
      console.log('Deferring reply...');
      await interaction.deferReply({ ephemeral: true });
      console.log('Reply deferred successfully.');

      const type = interaction.customId.split('_')[2];
      console.log(`Suggestion type: ${type}`);

      let game_name = null, map_name = null, suggestion = null, title = null, detail = null, reason = null;

      if (type === 'game') {
        game_name = interaction.fields.getTextInputValue('game_name');
        map_name = interaction.fields.getTextInputValue('map_name');
        suggestion = interaction.fields.getTextInputValue('suggestion');
        reason = interaction.fields.getTextInputValue('reason');
        console.log(`Game fields: game_name=${game_name}, map_name=${map_name}, suggestion=${suggestion}, reason=${reason}`);
      } else if (type === 'community') {
        title = interaction.fields.getTextInputValue('title');
        detail = interaction.fields.getTextInputValue('detail');
        console.log(`Community fields: title=${title}, detail=${detail}`);
      }

      const submission_date = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/,/g, '');
      console.log(`Submission date: ${submission_date}`);

      console.log('Inserting into DB...');
      db.run(
        'INSERT INTO suggestions (user_id, type, game_name, map_name, suggestion, reason, title, detail, submission_date, upvotes, downvotes, message_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, null)',
        [interaction.user.id, type, game_name, map_name, suggestion, reason, title, detail, submission_date],
        async function (err) {
          if (err) {
            console.error('DB insert error:', err.stack);
            return interaction.editReply({ content: 'Error submitting suggestion to database.' });
          }
          console.log('DB insert successful.');

          const id = this.lastID;
          console.log(`New suggestion ID: ${id}`);

          const tempRow = {
            id,
            user_id: interaction.user.id,
            type,
            game_name,
            map_name,
            suggestion,
            reason,
            title,
            detail,
            status: null,
            notes: null,
            submission_date,
            upvotes: 0,
            downvotes: 0,
            message_id: null,
          };

          let embed;
          try {
            console.log('Building embed...');
            embed = await buildEmbed(tempRow);
            console.log('Embed built successfully.');
          } catch (embedErr) {
            console.error('Error building embed:', embedErr.stack);
            return interaction.editReply({ content: 'Error building suggestion embed.' });
          }

          console.log(`Fetching channel: ${process.env.CHANNEL_ID}`);
          const channel = client.channels.cache.get(process.env.CHANNEL_ID);
          if (!channel) {
            console.error(`Channel not found: ${process.env.CHANNEL_ID}`);
            return interaction.editReply({ content: 'Suggestion channel not found. Check CHANNEL_ID in .env.' });
          }
          console.log(`Channel fetched: ${channel.name} (${channel.id})`);

          try {
            console.log('Sending message to channel...');
            const message = await channel.send({ embeds: [embed] });
            console.log(`Message sent: ${message.id}`);

            console.log('Adding reactions...');
            await message.react(upEmoji);
            await message.react(downEmoji);
            console.log('Reactions added.');

            console.log('Updating message_id in DB...');
            db.run('UPDATE suggestions SET message_id = ? WHERE id = ?', [message.id, id], (updateErr) => {
              if (updateErr) {
                console.error('DB update message_id error:', updateErr.stack);
              } else {
                console.log('DB update successful.');
              }
            });

            interaction.editReply({ content: 'Your suggestion has been submitted!' });
          } catch (sendErr) {
            console.error('Error sending message or adding reactions:', sendErr.stack);
            interaction.editReply({ content: 'Error posting suggestion to channel. Check bot permissions and channel access.' });
          }
        }
      );
    }

    // Catch-all for unhandled interactions
    // if (!interaction.replied && !interaction.deferred) {
    //   try {
    //     await interaction.reply({ content: 'Interaction acknowledged, but no handler found.', ephemeral: true });
    //   } catch (ackErr) {
    //     console.error('Error acknowledging unhandled interaction:', ackErr.stack);
    //   }
    // }
  } catch (error) {
    console.error('Error handling interaction:', error.stack);
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
      } catch (replyErr) {
        console.error('Error sending error reply:', replyErr.stack);
      }
    } else if (interaction.deferred) {
      await interaction.editReply({ content: 'An error occurred while processing your request.' });
    }
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  let message = reaction.message;
  if (message.partial) {
    try {
      message = await message.fetch();
    } catch (error) {
      console.error('Error fetching message:', error);
      return;
    }
  }
  db.get('SELECT * FROM suggestions WHERE message_id = ?', [message.id], async (err, row) => {
    if (err) {
      console.error(err);
      return;
    }
    if (!row) return;

    const emoji = reaction.emoji;
    if (emoji.id ? (emoji.id !== upEmoji.id && emoji.id !== downEmoji.id) : (emoji.name !== upEmoji && emoji.name !== downEmoji)) return;

    if (row.status && row.status !== 'clear') {
      try {
        await reaction.users.remove(user.id);
      } catch (error) {
        console.error('Error removing reaction:', error);
      }
      return;
    }

    const opposite = emoji === upEmoji ? downEmoji : upEmoji;
    const oppReaction = message.reactions.resolve(opposite);
    if (oppReaction) {
      try {
        const users = await oppReaction.users.fetch();
        if (users.has(user.id)) {
          await oppReaction.users.remove(user.id);
        }
      } catch (error) {
        console.error('Error handling opposite reaction:', error);
      }
    }

    const upCount = message.reactions.resolve(upEmoji)?.count ?? 0;
    const downCount = message.reactions.resolve(downEmoji)?.count ?? 0;

    db.run('UPDATE suggestions SET upvotes = ?, downvotes = ? WHERE id = ?', [upCount, downCount, row.id], async (updateErr) => {
      if (updateErr) {
        console.error(updateErr);
        return;
      }
      await updateEmbed(message, { ...row, upvotes: upCount, downvotes: downCount });
    });
  });
});

client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;
  let message = reaction.message;
  if (message.partial) {
    try {
      message = await message.fetch();
    } catch (error) {
      console.error('Error fetching message:', error);
      return;
    }
  }
  db.get('SELECT * FROM suggestions WHERE message_id = ?', [message.id], async (err, row) => {
    if (err) {
      console.error(err);
      return;
    }
    if (!row) return;

    const emoji = reaction.emoji;
    if (emoji.id ? (emoji.id !== upEmoji.id && emoji.id !== downEmoji.id) : (emoji.name !== upEmoji && emoji.name !== downEmoji)) return;

    if (row.status && row.status !== 'clear') return;

    const upCount = message.reactions.resolve(upEmoji)?.count ?? 0;
    const downCount = message.reactions.resolve(downEmoji)?.count ?? 0;

    db.run('UPDATE suggestions SET upvotes = ?, downvotes = ? WHERE id = ?', [upCount, downCount, row.id], async (updateErr) => {
      if (updateErr) {
        console.error(updateErr);
        return;
      }
      await updateEmbed(message, { ...row, upvotes: upCount, downvotes: downCount });
    });
  });
});

client.login(process.env.DISCORD_TOKEN);
