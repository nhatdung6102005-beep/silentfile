import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent]
});

const DATA_FILE = './data.json';

let data = {};
if (fs.existsSync(DATA_FILE)) {
  data = JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const commands = [
  new SlashCommandBuilder()
    .setName('save')
    .setDescription('Lưu file hoặc link')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Tên lưu')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('download')
    .setDescription('Tải file đã lưu')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Chọn file')
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

client.on('interactionCreate', async interaction => {
  if (interaction.isAutocomplete()) {
    const focused = interaction.options.getFocused();
    const choices = Object.keys(data);
    const filtered = choices.filter(choice => choice.startsWith(focused));

    await interaction.respond(
      filtered.map(choice => ({ name: choice, value: choice }))
    );
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const name = interaction.options.getString('name');

  if (interaction.commandName === 'save') {
    const msg = await interaction.channel.messages.fetch({ limit: 1 });
    const lastMsg = msg.first();

    let content = null;

    if (lastMsg.attachments.size > 0) {
      content = lastMsg.attachments.first().url;
    } else if (lastMsg.content.includes('http')) {
      content = lastMsg.content;
    }

    if (!content) {
      return interaction.reply('❌ Không tìm thấy file hoặc link');
    }

    data[name] = content;
    saveData();

    await interaction.reply(`✅ Đã lưu: ${name}`);
  }

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

client.login(process.env.TOKEN);
