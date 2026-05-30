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

    if (data.users[userId].bank === undefined) {
        data.users[userId].bank = 0;
    }
}

// ================= ROLES =================

const roleIceCream = '1509868893840081048';
const roleSun = '1509868923204407399';
const roleSummer = '1509868980850921552';

// ================= CONFIG =================

const ADMIN_ROLE_ID = '1509988273429155861';

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
    console.log('🤖 БОТ ЗАПУЩЕНО');
});

client.on('messageCreate', async (message) => {

    if (message.author.bot) return;

    const data = loadData();
    const userId = message.author.id;

    ensureUser(data, userId);

    // ---------------- BALANCE ----------------
    if (message.content === '!balance') {
        return message.reply(
`💰 Монети: ${data.users[userId].coins}
🏦 Банк: ${data.users[userId].bank || 0}`
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
`📦 ІНВЕНТАР

🟢 Rare: ${u.cases.Rare}
🔵 Epic: ${u.cases.Epic}
🟣 Legendary: ${u.cases.Legendary}

💰 Монети: ${u.coins}`
        );
    }

    // ---------------- GIVE COINS ----------------
    if (message.content.startsWith('!givecoins')) {
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) return;

        const user = message.mentions.users.first();
        const amount = parseInt(message.content.split(' ')[2]);

        if (!user || !amount) return;

        ensureUser(data, user.id);
        data.users[user.id].coins += amount;

        saveData(data);

        return message.reply('💰 Готово');
    }

    // ---------------- PAY ----------------
    if (message.content.startsWith('!open')) {

    const type = getCaseType(message.content.split(' ')[1]);
    const amount = parseInt(message.content.split(' ')[2]) || 1;

    const userCases = data.users[userId].cases[type] || 0;

    if (!type) return message.reply('❌ неправильний кейс');
    if (userCases < amount) return message.reply('❌ немає кейсів');

    let total = 0;

    for (let i = 0; i < amount; i++) {

        const c = cases[type];

        // 💰 базові монети з кейса
        total += Math.floor(Math.random() * (c.max - c.min + 1)) + c.min;

        let roll = Math.random();
        let roleToGive = null;
        let compensation = 0;

        // 🎲 RARE
        if (type === 'Rare') {
            if (roll < 0.15) {
                roleToGive = roleIceCream;
                compensation = 500;
            }
            else if (roll < 0.20) {
                roleToGive = roleSun;
                compensation = 1100;
            }
        }

        // 🎲 EPIC
        else if (type === 'Epic') {
            if (roll < 0.25) {
                roleToGive = roleIceCream;
                compensation = 500;
            }
            else if (roll < 0.35) {
                roleToGive = roleSun;
                compensation = 1100;
            }
        }

        // 🎲 LEGENDARY
        else if (type === 'Legendary') {
            if (roll < 0.30) {
                roleToGive = roleIceCream;
                compensation = 500;
            }
            else if (roll < 0.45) {
                roleToGive = roleSun;
                compensation = 1100;
            }
            else if (roll < 0.47) {
                roleToGive = roleSummer;
                compensation = 2300;
            }
        }

        // 🎭 ВИДАЧА РОЛІ АБО КОМПЕНСАЦІЇ
        if (roleToGive) {
            try {
                const member = message.member;

                if (!member.roles.cache.has(roleToGive)) {
                    await member.roles.add(roleToGive);
                    message.channel.send(`🎭 Тобі випала роль <@&${roleToGive}>! +${compensation} монет`);
                } else {
                    data.users[userId].coins += compensation;
                    message.channel.send(`🎭 Роль вже є → +${compensation} монет`);
                }
            } catch (err) {
                console.log(err);
                message.channel.send('❌ не можу видати роль');
            }
        }
    }

    // 💰 запис результату
    data.users[userId].cases[type] -= amount;
    data.users[userId].coins += total;

    saveData(data);

    return message.reply(`🎉 ти отримав ${total} монет`);
}

    // ---------------- WORK ----------------
    if (message.content === '!work') {

        const now = Date.now();
        const last = cooldowns.work.get(userId) || 0;

        if (now - last < 60000)
            return message.reply('⏳ перезарядка');

        const earned = Math.floor(Math.random() * 351) + 250;

        data.users[userId].coins += earned;
        cooldowns.work.set(userId, now);

        saveData(data);

        return message.reply(`💼 +${earned} монет`);
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

        return message.reply(`🎁 ти отримав ${reward} монет`);
    }

    // ---------------- ROB ----------------
    if (message.content.startsWith('!rob')) {

        const target = message.mentions.users.first();
        if (!target) return message.reply('❌ !rob @user');

        if (target.id === userId)
            return message.reply('❌ не можна себе');

        ensureUser(data, target.id);

        if (!cooldowns.rob) cooldowns.rob = new Map();

        const now = Date.now();
        const last = cooldowns.rob.get(userId) || 0;

        const cooldownTime = 60 * 1000;

        if (now - last < cooldownTime) {
            const sec = Math.ceil((cooldownTime - (now - last)) / 1000);
            return message.reply(`⏳ почекай ${sec} сек`);
        }

        const targetMoney = data.users[target.id].coins || 0;

        if (targetMoney < 50)
            return message.reply('❌ у жертви мало монет');

        const success = Math.random() < 0.5;

        if (success) {

            const steal = Math.floor(Math.random() * 200) + 50;
            const realSteal = Math.min(steal, targetMoney);

            data.users[target.id].coins -= realSteal;
            data.users[userId].coins += realSteal;

            cooldowns.rob.set(userId, now);
            saveData(data);

            return message.reply(`🦹 ти вкрав ${realSteal} монет`);
        } else {

            const fine = Math.floor(Math.random() * 150) + 50;

            data.users[userId].coins -= fine;

            cooldowns.rob.set(userId, now);
            saveData(data);

            return message.reply(`🚨 провал! штраф -${fine}`);
        }
    }

    // ---------------- DEPOSIT ----------------
    if (message.content.startsWith('!dep') || message.content.startsWith('!deposit')) {

        const amount = parseInt(message.content.split(' ')[1]);
        if (!amount) return message.reply('❌ !dep 100');

        if (data.users[userId].coins < amount)
            return message.reply('❌ недостатньо монет');

        data.users[userId].coins -= amount;
        data.users[userId].bank += amount;

        saveData(data);

        return message.reply(`🏦 +${amount} в банк`);
    }

    // ---------------- WITHDRAW ----------------
    if (message.content.startsWith('!with') || message.content.startsWith('!withdraw')) {

        const amount = parseInt(message.content.split(' ')[1]);
        if (!amount) return message.reply('❌ !with 100');

        if (data.users[userId].bank < amount)
            return message.reply('❌ немає в банку');

        data.users[userId].bank -= amount;
        data.users[userId].coins += amount;

        saveData(data);

        return message.reply(`💰 -${amount} з банку`);
    }
});

client.login(process.env.TOKEN);