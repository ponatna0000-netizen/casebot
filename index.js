require('dotenv').config();
const fs = require('fs');

const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ================= DATA =================

const DATA_FILE = './data.json';

function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({ users: {} }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function ensureUser(data, userId) {

    if (!data.users[userId]) {
        data.users[userId] = {
            coins: 0,
            bank: 0,
            cases: {
                Rare: 0,
                Epic: 0,
                Legendary: 0
            },
            stats: {
                openedCases: 0,
                earnedCoins: 0,
                maxWin: 0,
                rolesWon: 0
            }
        };
    }

    // 🔥 FIX OLD USERS
    if (data.users[userId].bank === undefined) {
        data.users[userId].bank = 0;
    }
}
// ================= CONFIG =================

const ADMIN_ROLE_ID = '1509988273429155861';

const role1 = '1509868893840081048';
const role2 = '1509868923204407399';
const role3 = '1509868980850921552';

const cooldowns = {
    work: new Map(),
    daily: new Map(),
    rob: new Map()
};

const blackjackGames = new Map();

const cases = {
    Rare: { price: 150, min: 1, max: 250 },
    Epic: { price: 400, min: 50, max: 650 },
    Legendary: { price: 1200, min: 250, max: 2000 }
};

function getCaseType(input) {
    if (!input) return null;
    input = input.toLowerCase();

    if (['rare','r','ra'].includes(input)) return 'Rare';
    if (['epic','e','ep'].includes(input)) return 'Epic';
    if (['legendary','l','leg','le'].includes(input)) return 'Legendary';

    return null;
}

// ================= BOT =================

client.once('ready', () => {
    console.log('BOT ONLINE');
});

client.on('messageCreate', async (message) => {

    if (message.author.bot) return;

    const data = loadData();
    const userId = message.author.id;

    ensureUser(data, userId);

    // ---------------- BALANCE ----------------
    if (message.content === '!balance') {
    return message.reply(
`💰 Coins: ${data.users[userId].coins}
🏦 Bank: ${data.users[userId].bank || 0}`
    );
}

    // ---------------- SHOP ----------------
    if (message.content === '!shop') {
        return message.reply(`🛒 Rare 150 | Epic 400 | Legendary 1200`);
    }

    // ---------------- INVENTORY ----------------
    if (message.content === '!inv' || message.content === '!inventory') {
        const u = data.users[userId];
        return message.reply(
`📦 INVENTORY

🟢 Rare: ${u.cases.Rare}
🔵 Epic: ${u.cases.Epic}
🟣 Legendary: ${u.cases.Legendary}

💰 Coins: ${u.coins}`
        );
    }

    // ---------------- GIVE COINS (ADMIN) ----------------
    if (message.content.startsWith('!givecoins')) {
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) return;

        const user = message.mentions.users.first();
        const amount = parseInt(message.content.split(' ')[2]);

        if (!user || !amount) return;

        ensureUser(data, user.id);
        data.users[user.id].coins += amount;

        saveData(data);

        return message.reply('💰 OK');
    }

    // ---------------- PAY ----------------
    if (message.content.startsWith('!pay')) {

        const target = message.mentions.users.first();
        const amount = parseInt(message.content.split(' ')[2]);

        if (!target || !amount) return message.reply('❌ !pay @user 100');
        if (target.id === userId) return message.reply('❌ self');

        ensureUser(data, target.id);

        if (data.users[userId].coins < amount)
            return message.reply('❌ no money');

        data.users[userId].coins -= amount;
        data.users[target.id].coins += amount;

        saveData(data);

        return message.reply(`💸 sent ${amount}`);
    }

    // ---------------- WORK ----------------
    if (message.content === '!work') {

        const now = Date.now();
        const last = cooldowns.work.get(userId) || 0;

        if (now - last < 60000)
            return message.reply('⏳ cooldown');

        const earned = Math.floor(Math.random() * 351) + 250;

        data.users[userId].coins += earned;
        cooldowns.work.set(userId, now);

        saveData(data);

        return message.reply(`💼 +${earned}`);
    }

    // ---------------- DAILY ----------------
    if (message.content === '!daily') {

    const now = Date.now();
    const last = cooldowns.daily.get(userId) || 0;

    const cooldownTime = 24 * 60 * 60 * 1000;

    if (now - last < cooldownTime) {

        const remaining = cooldownTime - (now - last);

        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

        return message.reply(
            `⏳ Daily вже забрано\nЗалишилось: ${hours}г ${minutes}хв ${seconds}с`
        );
    }

    const reward = 1500;

    data.users[userId].coins += reward;
    cooldowns.daily.set(userId, now);

    saveData(data);

    return message.reply(`🎁 Ти отримав ${reward} coins`);
}

    // ---------------- CASE BUY ----------------
    if (message.content.startsWith('!buy')) {

        const type = getCaseType(message.content.split(' ')[1]);
        const amount = parseInt(message.content.split(' ')[2]) || 1;

        if (!type) return message.reply('❌ case');

        const price = cases[type].price * amount;

        if (data.users[userId].coins < price)
            return message.reply('❌ no money');

        data.users[userId].coins -= price;
        data.users[userId].cases[type] += amount;

        saveData(data);

        return message.reply(`✅ bought ${amount} ${type}`);
    }
if (message.content.startsWith('!rob')) {

    const target = message.mentions.users.first();
    if (!target) return message.reply('❌ !rob @user');

    if (target.id === userId)
        return message.reply('❌ не можна себе');

    ensureUser(data, target.id);

    // ✅ FIX COOLDOWN (правильний)
    if (!cooldowns.rob) cooldowns.rob = new Map();

    const now = Date.now();
    const last = cooldowns.rob.get(userId) || 0;

    const cooldownTime = 60 * 1000; // 1 хв

    if (now - last < cooldownTime) {
        const sec = Math.ceil((cooldownTime - (now - last)) / 1000);
        return message.reply(`⏳ почекай ${sec} сек`);
    }

    const targetUser = data.users[target.id];

// 💰 крадемо тільки coins (bank не чіпаємо)
const targetMoney = targetUser.coins || 0;

    if (targetMoney < 50)
        return message.reply('❌ у жертви мало грошей');

    const success = Math.random() < 0.5;

    if (success) {

        const steal = Math.floor(Math.random() * 200) + 50;
        const realSteal = Math.min(steal, targetMoney);

        data.users[target.id].coins -= realSteal;
        data.users[userId].coins += realSteal;

        cooldowns.rob.set(userId, now);
        saveData(data);

        return message.reply(`🦹 вкрав ${realSteal} coins`);
    } else {

        const fine = Math.floor(Math.random() * 150) + 50;

        data.users[userId].coins -= fine;

        cooldowns.rob.set(userId, now);
        saveData(data);

        return message.reply(`🚨 провал! штраф -${fine}`);
    }
}

// ---------------- DEPOSIT ----------------
if (
    message.content.startsWith('!deposit') ||
    message.content.startsWith('!dep')
) {
    const args = message.content.split(' ');
    const amount = parseInt(args[1]);

    if (!amount || amount <= 0)
        return message.reply('❌ !dep 100');

    const data = loadData();
    const userId = message.author.id;

    ensureUser(data, userId);

    if (data.users[userId].coins < amount)
        return message.reply('❌ нема грошей');

    data.users[userId].coins -= amount;
    data.users[userId].bank += amount;

    saveData(data);

    return message.reply(`🏦 +${amount} в банк`);
}
if (
    message.content.startsWith('!withdraw') ||
    message.content.startsWith('!with')
) {
    const args = message.content.split(' ');
    const amount = parseInt(args[1]);

    if (!amount || amount <= 0)
        return message.reply('❌ !with 100');

    const data = loadData();
    const userId = message.author.id;

    ensureUser(data, userId);

    if (data.users[userId].bank < amount)
        return message.reply('❌ нема в банку');

    data.users[userId].bank -= amount;
    data.users[userId].coins += amount;

    saveData(data);

    return message.reply(`💰 -${amount} з банку`);
}

    // ---------------- OPEN CASE ----------------
    if (message.content.startsWith('!open')) {

        const type = getCaseType(message.content.split(' ')[1]);
        const amount = parseInt(message.content.split(' ')[2]) || 1;

        const userCases = data.users[userId].cases[type] || 0;

        if (userCases < amount)
            return message.reply('❌ no cases');

        let total = 0;

        for (let i = 0; i < amount; i++) {
            const c = cases[type];
            total += Math.floor(Math.random() * (c.max - c.min + 1)) + c.min;
        }

        data.users[userId].cases[type] -= amount;
        data.users[userId].coins += total;

        saveData(data);

        return message.reply(`🎉 +${total}`);
    }

    // ---------------- SLOTS ----------------
    if (message.content.startsWith('!slots')) {

        const bet = parseInt(message.content.split(' ')[1]);
        if (!bet) return;

        if (data.users[userId].coins < bet)
            return message.reply('❌ no money');

        const r = Math.random() * 100;

        let multi = 0;

        if (r < 55) multi = 0;
        else if (r < 80) multi = 2;
        else if (r < 92) multi = 3;
        else if (r < 98) multi = 5;
        else if (r < 99.8) multi = 10;
        else multi = 50;

        const win = bet * multi;

        data.users[userId].coins -= bet;
        if (multi > 0) data.users[userId].coins += win;

        saveData(data);

        return message.reply(`🎰 x${multi} (${win})`);
    }

    // ---------------- BJ START ----------------
    if (message.content.startsWith('!bj')) {

        const bet = parseInt(message.content.split(' ')[1]);
        if (!bet) return;

        if (data.users[userId].coins < bet)
            return message.reply('❌ no money');

        function card() {
            const c = [2,3,4,5,6,7,8,9,10,10,10,11];
            return c[Math.floor(Math.random() * c.length)];
        }

        const game = {
            player: card() + card(),
            dealer: card() + card(),
            bet,
            userId
        };

        blackjackGames.set(userId, game);

        data.users[userId].coins -= bet;
        saveData(data);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`hit_${userId}`)
                .setLabel('Hit')
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId(`stand_${userId}`)
                .setLabel('Stand')
                .setStyle(ButtonStyle.Danger)
        );

        return message.reply({
            content: `🃏 BJ\n\nYou: ${game.player}\nDealer: ${game.dealer}`,
            components: [row]
        });
    }

});

// ================= BUTTONS =================

client.on('interactionCreate', async (interaction) => {

    if (!interaction.isButton()) return;

    const userId = interaction.customId.split('_')[1];
    const game = blackjackGames.get(userId);

    if (!game)
        return interaction.reply({ content: '❌ no game', ephemeral: true });

    function card() {
        const c = [2,3,4,5,6,7,8,9,10,10,10,11];
        return c[Math.floor(Math.random() * c.length)];
    }

    if (interaction.customId.startsWith('hit_')) {

        game.player += card();

        if (game.player > 21) {
            blackjackGames.delete(userId);
            return interaction.update({
                content: `💀 lose\nYou: ${game.player}`,
                components: []
            });
        }

        return interaction.update({
            content: `🃏 You: ${game.player}\nDealer: ${game.dealer}`,
            components: interaction.message.components
        });
    }

    if (interaction.customId.startsWith('stand_')) {

        while (game.dealer < 17) game.dealer += card();

        let win = 0;

        if (game.dealer > 21 || game.player > game.dealer) win = game.bet * 2;
        else if (game.player === game.dealer) win = game.bet;

        data = loadData();
        ensureUser(data, userId);
        data.users[userId].coins += win;
        saveData(data);

        blackjackGames.delete(userId);

        return interaction.update({
            content: `🏁 RESULT\nYou: ${game.player}\nDealer: ${game.dealer}\n💰 +${win}`,
            components: []
        });
    }
});
console.log("TOKEN EXISTS:", !!process.env.TOKEN);
console.log("TOKEN LENGTH:", process.env.TOKEN?.length);
client.login(process.env.TOKEN);