import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const DATA_FILE = './data.json';

let data = {};
if (fs.existsSync(DATA_FILE)) {
  data = JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// commands
const commands = [
  new SlashCommandBuilder()
    .setName('save')
    .setDescription('Lưu file hoặc link')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Tên lưu')
        .setRequired(true)
    )
    .addAttachmentOption(option =>
      option.setName('file')
        .setDescription('File cần lưu')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('link')
        .setDescription('Link cần lưu')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('download')
    .setDescription('Tải file đã lưu')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Tên file')
        .setRequired(true)
        .setAutocomplete(true)
    )
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );
  console.log('Commands registered');
})();

// autocomplete
client.on('interactionCreate', async interaction => {
  if (interaction.isAutocomplete()) {
    const focused = interaction.options.getFocused();
    const choices = Object.keys(data);

    const filtered = choices.filter(choice =>
      choice.toLowerCase().includes(focused.toLowerCase())
    );

    await interaction.respond(
      filtered.slice(0, 25).map(choice => ({ name: choice, value: choice }))
    );
  }
});

// commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const name = interaction.options.getString('name');

  // SAVE
  if (interaction.commandName === 'save') {

    const file = interaction.options.getAttachment('file');
    const link = interaction.options.getString('link');

    let content = null;

    if (file) {
      content = file.url;
    } else if (link) {
      content = link;
    }

    if (!content) {
      return interaction.reply('❌ Bạn phải gửi file hoặc link');
    }

    data[name] = content;
    saveData();

    await interaction.reply(`✅ Đã lưu: ${name}`);
  }

  // DOWNLOAD
  if (interaction.commandName === 'download') {
    if (!data[name]) {
      return interaction.reply('❌ Không tìm thấy file');
    }

    try {
      await interaction.user.send(`📁 File của bạn (${name}):\n${data[name]}`);
      await interaction.reply('📩 Đã gửi qua DM!');
    } catch (err) {
      await interaction.reply('❌ Không thể gửi DM (mở DM đi)');
    }
  }
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.TOKEN);
