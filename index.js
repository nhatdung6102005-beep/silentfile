import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} from 'discord.js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const DATA_FILE = './data.json';

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing TOKEN or CLIENT_ID in .env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ]
});

let data = {};
if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    console.error('Failed to read data.json:', error);
    data = {};
  }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const commands = [
  new SlashCommandBuilder()
    .setName('save')
    .setDescription('Lưu file hoặc link')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Tên lưu')
        .setRequired(true)
    )
    .addAttachmentOption(option =>
      option
        .setName('file')
        .setDescription('Chọn file trực tiếp nếu muốn')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('link')
        .setDescription('Nhập link trực tiếp nếu muốn')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('download')
    .setDescription('Gửi file hoặc link đã lưu vào DM')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Tên file đã lưu')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  new SlashCommandBuilder()
    .setName('list')
    .setDescription('Xem danh sách tên đã lưu'),

  new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Xóa 1 mục đã lưu')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Tên cần xóa')
        .setRequired(true)
        .setAutocomplete(true)
    )
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands.map(cmd => cmd.toJSON()) }
  );
  console.log('Slash commands registered.');
}

function extractFirstUrl(text) {
  if (!text) return null;
  const match = text.match(/https?:\/\/\S+/i);
  return match ? match[0] : null;
}

async function findRecentUserContent(interaction) {
  const messages = await interaction.channel.messages.fetch({ limit: 15 });

  for (const [, msg] of messages) {
    if (msg.author.id !== interaction.user.id) continue;
    if (msg.id === interaction.id) continue;

    if (msg.attachments.size > 0) {
      const attachment = msg.attachments.first();
      return {
        type: 'file',
        url: attachment.url,
        originalName: attachment.name || 'unknown-file'
      };
    }

    const foundUrl = extractFirstUrl(msg.content);
    if (foundUrl) {
      return {
        type: 'link',
        url: foundUrl,
        originalName: foundUrl
      };
    }
  }

  return null;
}

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isAutocomplete()) {
      const focused = interaction.options.getFocused().toLowerCase();
      const choices = Object.keys(data).sort((a, b) => a.localeCompare(b));
      const filtered = choices
        .filter(name => name.toLowerCase().includes(focused))
        .slice(0, 25)
        .map(name => ({ name, value: name }));

      await interaction.respond(filtered);
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'save') {
      const name = interaction.options.getString('name');
      const file = interaction.options.getAttachment('file');
      const link = interaction.options.getString('link');

      let saved = null;

      if (file) {
        saved = {
          url: file.url,
          kind: 'file',
          sourceName: file.name || 'uploaded-file'
        };
      } else if (link) {
        saved = {
          url: link,
          kind: 'link',
          sourceName: link
        };
      } else {
        const recent = await findRecentUserContent(interaction);
        if (recent) {
          saved = {
            url: recent.url,
            kind: recent.type,
            sourceName: recent.originalName
          };
        }
      }

      if (!saved) {
        await interaction.reply({
          content: '❌ Không tìm thấy file hoặc link.\n\nCách dùng:\n- `/save name:tên file:(chọn file)`\n- hoặc gửi file/link trước rồi chạy `/save name:tên`',
          ephemeral: true
        });
        return;
      }

      data[name] = {
        url: saved.url,
        kind: saved.kind,
        sourceName: saved.sourceName,
        savedBy: interaction.user.id,
        savedAt: new Date().toISOString()
      };
      saveData();

      await interaction.reply(`✅ Đã lưu **${name}** (${saved.kind === 'file' ? 'file' : 'link'})`);
      return;
    }

    if (interaction.commandName === 'download') {
      const name = interaction.options.getString('name');
      const item = data[name];

      if (!item) {
        await interaction.reply({ content: '❌ Không tìm thấy mục đã lưu.', ephemeral: true });
        return;
      }

      try {
        await interaction.user.send(`📁 **${name}**\n${item.url}`);
        await interaction.reply({ content: '📩 Đã gửi qua DM.', ephemeral: true });
      } catch (error) {
        await interaction.reply({ content: '❌ Không gửi được DM. Hãy mở tin nhắn riêng với bot rồi thử lại.', ephemeral: true });
      }
      return;
    }

    if (interaction.commandName === 'list') {
      const names = Object.keys(data).sort((a, b) => a.localeCompare(b));

      if (names.length === 0) {
        await interaction.reply({ content: '📂 Chưa có mục nào được lưu.', ephemeral: true });
        return;
      }

      await interaction.reply({
        content: `📂 Danh sách đã lưu (${names.length}):\n- ${names.join('\n- ')}`,
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === 'delete') {
      const name = interaction.options.getString('name');

      if (!data[name]) {
        await interaction.reply({ content: '❌ Không tìm thấy mục để xóa.', ephemeral: true });
        return;
      }

      delete data[name];
      saveData();

      await interaction.reply({ content: `🗑️ Đã xóa **${name}**`, ephemeral: true });
    }
  } catch (error) {
    console.error('Interaction error:', error);

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Bot gặp lỗi khi xử lý lệnh.', ephemeral: true });
    }
  }
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

registerCommands()
  .then(() => client.login(TOKEN))
  .catch(error => {
    console.error('Startup error:', error);
    process.exit(1);
  });
