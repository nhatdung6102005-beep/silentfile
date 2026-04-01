import {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder
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
    GatewayIntentBits.MessageContent
  ]
});

let data = {};
if (fs.existsSync(DATA_FILE)) {
  try { data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { data = {}; }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function sanitizeName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}

function uniqueName(base) {
  let name = base;
  let i = 1;
  while (data[name]) {
    name = `${base}_${i++}`;
  }
  return name;
}

function nameFromUrl(url) {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    return last ? last : 'link';
  } catch {
    return 'link';
  }
}

async function findRecentUserContent(interaction) {
  const msgs = await interaction.channel.messages.fetch({ limit: 15 });
  for (const [, m] of msgs) {
    if (m.author.id !== interaction.user.id) continue;
    if (m.attachments.size > 0) {
      const a = m.attachments.first();
      return { type: 'file', url: a.url, name: a.name || 'file' };
    }
    const match = m.content.match(/https?:\/\/\S+/i);
    if (match) {
      return { type: 'link', url: match[0], name: nameFromUrl(match[0]) };
    }
  }
  return null;
}

const commands = [
  new SlashCommandBuilder()
    .setName('save')
    .setDescription('Lưu file hoặc link (name không bắt buộc)')
    .addStringOption(o => o.setName('name').setDescription('Tên lưu (optional)').setRequired(false))
    .addAttachmentOption(o => o.setName('file').setDescription('Chọn file').setRequired(false))
    .addStringOption(o => o.setName('link').setDescription('Nhập link').setRequired(false)),

  new SlashCommandBuilder()
    .setName('download')
    .setDescription('Gửi lại file/link vào DM')
    .addStringOption(o => o.setName('name').setDescription('Tên').setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder()
    .setName('list')
    .setDescription('Xem danh sách'),

  new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Xóa mục')
    .addStringOption(o => o.setName('name').setDescription('Tên').setRequired(true).setAutocomplete(true))
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands.map(c => c.toJSON()) });
  console.log('Commands registered');
}

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isAutocomplete()) {
      const f = interaction.options.getFocused().toLowerCase();
      const list = Object.keys(data)
        .filter(n => n.toLowerCase().includes(f))
        .slice(0, 25)
        .map(n => ({ name: n, value: n }));
      return interaction.respond(list);
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'save') {
      let name = interaction.options.getString('name');
      const file = interaction.options.getAttachment('file');
      const link = interaction.options.getString('link');

      let url = null;
      let baseName = null;

      if (file) {
        url = file.url;
        baseName = file.name || 'file';
      } else if (link) {
        url = link;
        baseName = nameFromUrl(link);
      } else {
        const recent = await findRecentUserContent(interaction);
        if (recent) {
          url = recent.url;
          baseName = recent.name;
        }
      }

      if (!url) {
        return interaction.reply({ content: '❌ Không tìm thấy file/link.\nGửi file trước hoặc dùng option file/link.', ephemeral: true });
      }

      if (!name) {
        name = sanitizeName(baseName);
      }
      name = uniqueName(name);

      data[name] = { url, savedAt: new Date().toISOString(), by: interaction.user.id };
      saveData();

      return interaction.reply(`✅ Đã lưu: **${name}**`);
    }

    if (interaction.commandName === 'download') {
      const name = interaction.options.getString('name');
      const item = data[name];
      if (!item) return interaction.reply({ content: '❌ Không thấy', ephemeral: true });

      try {
        await interaction.user.send(`📁 **${name}**\n${item.url}`);
        return interaction.reply({ content: '📩 Đã gửi DM', ephemeral: true });
      } catch {
        return interaction.reply({ content: '❌ Không gửi được DM', ephemeral: true });
      }
    }

    if (interaction.commandName === 'list') {
      const names = Object.keys(data);
      if (!names.length) return interaction.reply({ content: '📂 Trống', ephemeral: true });
      return interaction.reply({ content: `📂 (${names.length})\n- ` + names.join('\n- '), ephemeral: true });
    }

    if (interaction.commandName === 'delete') {
      const name = interaction.options.getString('name');
      if (!data[name]) return interaction.reply({ content: '❌ Không thấy', ephemeral: true });
      delete data[name];
      saveData();
      return interaction.reply({ content: `🗑️ Đã xóa **${name}**`, ephemeral: true });
    }
  } catch (e) {
    console.error(e);
    if (interaction.isRepliable() && !interaction.replied) {
      await interaction.reply({ content: '❌ Lỗi xử lý', ephemeral: true });
    }
  }
});

client.once('ready', () => console.log(`Logged in as ${client.user.tag}`));

registerCommands().then(() => client.login(TOKEN));
