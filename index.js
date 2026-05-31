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
let totalCompensation = 0;

let iceCreamWins = 0;
let sunWins = 0;
let summerWins = 0;

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
    if (roll < 0.05) {          // 5%
        roleToGive = roleIceCream;
        compensation = 500;
    }
    else if (roll < 0.06) {     // 1%
        roleToGive = roleSun;
        compensation = 1100;
    }
}

// 🎲 EPIC
else if (type === 'Epic') {
    if (roll < 0.08) {          // 8%
        roleToGive = roleIceCream;
        compensation = 500;
    }
    else if (roll < 0.13) {     // 5%
        roleToGive = roleSun;
        compensation = 1100;
    }
    else if (roll < 0.135) {    // 0.5%
        roleToGive = roleSummer;
        compensation = 2300;
    }
}

// 🎲 LEGENDARY
else if (type === 'Legendary') {
    if (roll < 0.10) {          // 10%
        roleToGive = roleSun;
        compensation = 1100;
    }
    else if (roll < 0.115) {    // 1.5%
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
totalCompensation += compensation;

if (roleToGive === roleIceCream) iceCreamWins++;
if (roleToGive === roleSun) sunWins++;
if (roleToGive === roleSummer) summerWins++;
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
let roleText = '';

if (iceCreamWins > 0)
    roleText += `🍦 Ice Cream: ${iceCreamWins}\n`;

if (sunWins > 0)
    roleText += `☀️ Sun: ${sunWins}\n`;

if (summerWins > 0)
    roleText += `🏖️ Summer: ${summerWins}\n`;

return message.reply(
`🎉 Ти отримав ${total} монет

🎭 Випало ролей:
${roleText || 'Немає'}

💰 Компенсація: ${totalCompensation}`
);

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
// ---------------- HELP ----------------
if (message.content === '!help') {

    return message.reply(
`📜 ДОСТУПНІ КОМАНДИ

💰 Економіка
!balance - переглянути баланс
!daily - щоденна нагорода
!work - заробити монети
!pay @user сума - переказати монети
!rob @user - пограбувати гравця

🏦 Банк
!dep сума - покласти гроші в банк
!with сума - зняти гроші з банку

📦 Кейси
!shop - магазин кейсів
!buy rare/epic/legendary кількість - купити кейси
!open rare/epic/legendary кількість - відкрити кейси
!inv - переглянути інвентар

🎰 Азартні ігри
!slots сума - слот-машина
!bj сума - Blackjack

ℹ️ Інше
!help - список команд`
    );
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
if (message.content.startsWith('!buy')) {

    const args = message.content.split(' ');
    const type = getCaseType(args[1]);
    const amount = parseInt(args[2]) || 1;

    if (!type) return message.reply('❌ неправильний кейс');

    if (amount <= 0) return message.reply('❌ неправильна кількість');

    const price = cases[type].price * amount;

    if (data.users[userId].coins < price)
        return message.reply(`❌ не вистачає монет. Потрібно ${price}`);

    data.users[userId].coins -= price;
    data.users[userId].cases[type] += amount;

    saveData(data);

    return message.reply(`🛒 куплено ${amount} ${type} кейс(ів) за ${price} coins`);
}
if (message.content.startsWith('!pay')) {

    const target = message.mentions.users.first();
    const amount = parseInt(message.content.split(' ')[2]);

    if (!target || !amount)
        return message.reply('❌ !pay @user 100');

    if (target.id === userId)
        return message.reply('❌ не можна переказати собі');

    ensureUser(data, target.id);

    if (data.users[userId].coins < amount)
        return message.reply('❌ недостатньо монет');

    data.users[userId].coins -= amount;
    data.users[target.id].coins += amount;

    saveData(data);

    return message.reply(`💸 переказано ${amount} монет`);
}
if (message.content.startsWith('!slots')) {

    const bet = parseInt(message.content.split(' ')[1]);

    if (!bet || bet <= 0)
        return message.reply('❌ !slots 100');

    if (data.users[userId].coins < bet)
        return message.reply('❌ недостатньо монет');

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

    if (multi > 0)
        data.users[userId].coins += win;

    saveData(data);

    return message.reply(
        `🎰 Множник: x${multi}\n💰 Виграш: ${win}`
    );
}
if (message.content.startsWith('!bj')) {

    const bet = parseInt(message.content.split(' ')[1]);

    if (!bet || bet <= 0)
        return message.reply('❌ !bj 100');

    if (data.users[userId].coins < bet)
        return message.reply('❌ недостатньо монет');

    function card() {
        const cards = [2,3,4,5,6,7,8,9,10,10,10,11];
        return cards[Math.floor(Math.random() * cards.length)];
    }

    const game = {
        player: card() + card(),
        dealer: card() + card(),
        bet
    };

    blackjackGames.set(userId, game);

    data.users[userId].coins -= bet;
    saveData(data);

    const row = new ActionRowBuilder()
        .addComponents(
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
        content:
`🃏 Blackjack

Ти: ${game.player}
Дилер: ${game.dealer}`,
        components: [row]
    });
}
});
client.on('interactionCreate', async (interaction) => {

    if (!interaction.isButton()) return;

    const userId = interaction.customId.split('_')[1];

    const game = blackjackGames.get(userId);

    if (!game)
        return interaction.reply({
            content: '❌ гра не знайдена',
            ephemeral: true
        });

    function card() {
        const cards = [2,3,4,5,6,7,8,9,10,10,10,11];
        return cards[Math.floor(Math.random() * cards.length)];
    }

    if (interaction.customId.startsWith('hit_')) {

        game.player += card();

        if (game.player > 21) {

            blackjackGames.delete(userId);

            return interaction.update({
                content: `💀 Перебір!\nТи: ${game.player}`,
                components: []
            });
        }

        return interaction.update({
            content:
`🃏 Blackjack

Ти: ${game.player}
Дилер: ${game.dealer}`,
            components: interaction.message.components
        });
    }

    if (interaction.customId.startsWith('stand_')) {

        while (game.dealer < 17)
            game.dealer += card();

        let win = 0;

        if (game.dealer > 21 || game.player > game.dealer)
            win = game.bet * 2;
        else if (game.player === game.dealer)
            win = game.bet;

        const data = loadData();

        ensureUser(data, userId);

        data.users[userId].coins += win;

        saveData(data);

        blackjackGames.delete(userId);

        return interaction.update({
            content:
`🏁 Результат

Ти: ${game.player}
Дилер: ${game.dealer}

💰 Виграш: ${win}`,
            components: []
        });
    }
});

client.on('ready', () => {
    console.log(`Увійшов як ${client.user.tag}`);
});

client.on('error', console.error);

client.on('shardError', console.error);

client.login(process.env.TOKEN);