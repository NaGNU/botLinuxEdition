const TelegramBot = require('node-telegram-bot-api');
const moment = require('moment');
const crypto = require('crypto');
const fs = require("fs");
require('dotenv').config();
const path = require("path");
const { InlineKeyboard } = require('telegram-keyboard');

const botToken = process.env.BOT_TOKEN;
const bot = new TelegramBot(botToken, { polling: true });

const axios = require('axios');
const NodeCache = require('node-cache');

const weatherCache = new NodeCache({ stdTTL: 600 });

const formatTemp = (temp) => `${Math.round(temp)}°C`;

const getWeather = async (city) => {
    const apiKey = 'UR API KEY';
    const cacheKey = `weather_${city.toLowerCase()}`;
    
    const cachedWeather = weatherCache.get(cacheKey);
    if (cachedWeather) {
        return cachedWeather;
    }

    try {
        const response = await axios.get(
            `http://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(city)}&lang=ru`
        );
        
        const data = response.data;
        const weatherData = {
            temp: data.current.temp_c,
            feelsLike: data.current.feelslike_c,
            description: data.current.condition.text,
            humidity: data.current.humidity,
            windSpeed: data.current.wind_kph / 3.6, 
            pressure: data.current.pressure_mb * 0.750062,
            city: data.location.name,
            country: data.location.country,
            timestamp: new Date(data.current.last_updated)
        };
        
        weatherCache.set(cacheKey, weatherData);
        return weatherData;
    } catch (error) {
        if (error.response?.status === 400) {
            throw new Error('Город не найден!');
        }
        throw new Error('Ошибка получения погоды. Попробуйте позже.');
    }
};

bot.onText(/^Бот погода (.+)/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const city = match[1].trim();

    try {
        const weather = await getWeather(city);
        
        const response = `
🌤️ Погода в ${weather.city}, ${weather.country}:
Температура: ${formatTemp(weather.temp)}
Ощущается как: ${formatTemp(weather.feelsLike)}
Описание: ${weather.description}
Влажность: ${weather.humidity}%
Ветер: ${weather.windSpeed.toFixed(1)} м/с
Давление: ${Math.round(weather.pressure)} мм рт. ст.
Обновлено: ${moment(weather.timestamp).format('HH:mm DD.MM.YYYY')}
        `.trim();

        bot.sendMessage(chatId, response);
    } catch (error) {
        bot.sendMessage(chatId, error.message);
    }
});

bot.onText(/^Бот погода$/i, (msg) => {
    bot.sendMessage(msg.chat.id, 'Укажите город после "Бот погода", например: "Бот погода Киев"');
});

function loadAdmins() {
    try {
        const data = fs.readFileSync('admins.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Ошибка при загрузке списка администраторов:', error);
        return [];
    }
}

// Pogoda SVO

const admins = loadAdmins();

const warns = {};
const muted = {};
const banned = {};

function isAdmin(userId) {
    return admins.includes(userId);
}

function generateAccessCode() {
    return crypto.randomBytes(4).toString('hex');
}


function warnUser(username, chatId) {
    warns[username] = (warns[username] || 0) + 1;
    bot.sendMessage(chatId, `Пользователю ${username} выдан варн. Всего варнов: ${warns[username]}`);
    if (warns[username] >= 3) {
        bot.sendMessage(chatId, `Пользователь ${username} был забанен за 3 варна.`);
        banned[username] = true;
        bot.banChatMember(chatId, username);
    }
}


function unwarnUser(username, chatId) {
    if (warns[username]) {
        warns[username] -= 1;
        bot.sendMessage(chatId, `Варн пользователя ${username} был снят. Осталось варнов: ${warns[username]}`);
        if (warns[username] < 3 && banned[username]) {
            banned[username] = false;
            bot.unbanChatMember(chatId, username);
            bot.sendMessage(chatId, `Пользователь ${username} был разбанен.`);
        }
    } else {
        bot.sendMessage(chatId, `У пользователя ${username} нет варнов.`);
    }
}

function showWarns(chatId) {
    let message = "Список варнов:\n";
    for (const [username, count] of Object.entries(warns)) {
        message += `${username}: ${count}\n`;
    }
    bot.sendMessage(chatId, message || "Нет варнов.");
}

function showMutes(chatId) {
    let message = "Список мутов:\n";
    for (const [userId, until] of Object.entries(muted)) {
        message += `ID ${userId}: до ${moment(until).format('LLL')}\n`;
    }
    bot.sendMessage(chatId, message || "Нет мутов.");
}

function showBans(chatId) {
    let message = "Список банов:\n";
    for (const [username, until] of Object.entries(banned)) {
        message += `${username}: до ${moment(until).format('LLL')}\n`;
    }
    bot.sendMessage(chatId, message || "Нет банов.");
}

function muteUser(userId, chatId, durationMoment) {
    const until = moment().add(durationMoment).toDate();
    muted[userId] = until;
    bot.restrictChatMember(chatId, userId, {
        until_date: Math.floor(until.getTime() / 1000),
        can_send_messages: false
    });
    bot.sendMessage(chatId, `Пользователь с ID ${userId} был замьючен на ${durationMoment.humanize()}.`);
}

function unmuteUser(userId, chatId) {
    bot.restrictChatMember(chatId, userId, {
        can_send_messages: true
    });
    bot.sendMessage(chatId, `Пользователь с ID ${userId} был размьючен.`);
    delete muted[userId];
}

function banUser(userId, chatId, durationMoment) {
    const until = moment().add(durationMoment).toDate();
    banned[userId] = until;
    bot.banChatMember(chatId, userId, {
        until_date: Math.floor(until.getTime() / 1000)
    });
    bot.sendMessage(chatId, `Пользователь с ID ${userId} был забанен на ${durationMoment.humanize()}.`);
}

function unbanUser(userId, chatId) {
    bot.unbanChatMember(chatId, userId);
    bot.sendMessage(chatId, `Пользователь с ID ${userId} был разбанен.`);
    delete banned[userId];
}

function tellRandomFact(chatId) {
    const facts = [
        "Около 60% тела человека состоит из воды.",
        "Пчелы могут распознавать лица.",
        "В Японии есть остров, на котором живут только кролики.",
        "Средняя температура тела человека составляет 37°C.",
        "Собаки могут чувствовать запахи до 100 000 раз лучше, чем люди.",
        "Человеческие глаза могут различать около 10 миллионов цветов.",
        "В 1969 году человек впервые ступил на Луну.",
        "Дельфины спят с одним открытым глазом.",
        "Молния может быть горячее, чем поверхность Солнца.",
        "Самый длинный период, который человек провел без сна, составил 11 дней.",
        "Осьминоги имеют три сердца и голубую кровь.",
        "В Австралии обитает пингвин, который не живет на льду, а на суше.",
        "Самая старая живущая рыба - это акулка, которая может дожить до 400 лет.",
        "В Китае есть деревня, где все жители живут до 100 лет.",
        "Луна отдаляется от Земли на 3,8 см каждый год.",
        "Жирафы могут спать только 30 минут в день.",
        "Жизнь банана длится от 3 до 5 дней после его полного созревания.",
        "В Канаде находится озеро, которое меняет цвет в зависимости от времени года.",
        "Слон — единственное животное, которое не может прыгать.",
        "Альпийские горы продолжают расти на 1 см в год.",
        "Самая длинная река в мире — это река Амазонка.",
        "Зебры имеют уникальные полоски, как отпечатки пальцев у людей.",
        "В мире существует более 2 тысяч языков, которые вымерли.",
        "Медузы не имеют мозга.",
        "Древние египтяне использовали косметику не только для красоты, но и для защиты от солнца.",
        "Человеческие ногти растут быстрее, чем волосы.",
        "Яблоки на 25% состоят из воздуха, поэтому они могут плавать.",
        "Только 2% океанов были исследованы человеком.",
        "На Земле есть место, где не падает дождь в течение десятилетий.",
        "Самое большое живое существо на Земле — гриб в Орегоне.",
        "У страусов самые большие глаза среди наземных животных.",
        "Там, где растут кактусы, осадки могут не выпадать в течение нескольких лет."
    ];
    const randomFact = facts[Math.floor(Math.random() * facts.length)];
    bot.sendMessage(chatId, randomFact);
}

bot.onText(/\/fact/, (msg) => {
    tellRandomFact(msg.chat.id);
});

function tellQuote(chatId) {
    const quotes = [
        "«Будь собой, все остальные роли уже заняты.» — Оскар Уайльд",
        "«Не важно, сколько раз ты упал, важно, сколько раз ты поднялся.» — Мэрилин Монро",
        "«Жизнь не в том, чтобы найти себя. Жизнь в том, чтобы создать себя.» — Джордж Бернард Шоу",
        "«Я не хочу, чтобы Linux был простым. Я хочу, чтобы он был мощным.» — Линус Торвальдс",
        "«Linux — это для пользователей, которые могут думать.» — Линус Торвальдс",
        "«Свобода не означает свободу от работы, свобода — это свобода работать без ограничений.» — Ричард Столлман",
        "«Я не считаю, что технологии должны быть закрытыми. Мы должны делиться ими, чтобы люди могли изучать и улучшать их.» — Ричард Столлман",
        "«Linux — это не для тех, кто хочет, чтобы все было просто. Это для тех, кто хочет, чтобы все работало, как нужно.» — Линус Торвальдс",
        "«Linux — юзер френдли, но не долбоеб френдли» — Линус Торвальдс",
        "«Свобода программного обеспечения — это не просто абстракция, это обязательство.» — Ричард Столлман",
        "«Я всегда предпочитал Linux. Он быстрее, безопаснее и просто работает.» — Линус Торвальдс",
        "«Если вы не можете понять код, вы не можете понять, что делает программа.» — Ричард Столлман"
    ];
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    bot.sendMessage(chatId, randomQuote);
}

bot.onText(/\/quote/, (msg) => {
    tellQuote(msg.chat.id);
});

function daysUntilNewYear(chatId) {
    const now = moment();
    const nextYear = moment().year() + 1;
    const newYear = moment(`${nextYear}-01-01`);
    const daysLeft = newYear.diff(now, 'days');
    bot.sendMessage(chatId, `До нового года осталось ${daysLeft} дней.`);
}

bot.onText(/\/newyear/, (msg) => {
    daysUntilNewYear(msg.chat.id);
});

// fetch
const { exec } = require("child_process");

bot.onText(/\/fetch(?:\s*(-neofetch))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const command = match[1] ? "neofetch --stdout" : "cat /etc/os-release";

  exec(command, (error, stdout, stderr) => {
    if (error) {
      bot.sendMessage(chatId, `Ошибка: ${error.message}`);
      return;
    }
    if (stderr) {
      bot.sendMessage(chatId, `Ошибка выполнения: ${stderr}`);
      return;
    }
    bot.sendMessage(chatId, stdout);
  });
});

// GB

bot.onText(/\/gb/, async (msg) => {
  const chatId = msg.chat.id;
  const replyTo = msg.reply_to_message;

  if (!replyTo) {
    bot.sendMessage(chatId, "⛔ Ответьте на сообщение пользователя для голосования!");
    return;
  }

  const admins = await bot.getChatAdministrators(chatId);
  const isAdmin = admins.some(admin => admin.user.id === msg.from.id);

  if (!isAdmin) {
    bot.sendMessage(chatId, "🚫 Только администраторы могут запускать голосование за бан!");
    return;
  }

  const targetUser = replyTo.from;
  const mention = `@${targetUser.username || targetUser.first_name}`;
  const pollMessage = `⚖️ Голосование: Забанить ${mention}?\n⏳ Время: 5 минут`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "✅ За", callback_data: `ban_yes_${targetUser.id}` },
        { text: "❌ Против", callback_data: `ban_no_${targetUser.id}` }
      ]
    ]
  };

  bot.sendMessage(chatId, pollMessage, {
    reply_to_message_id: replyTo.message_id,
    reply_markup: keyboard
  });

  const votes = { yes: 0, no: 0, voters: new Set() };
  const timeout = setTimeout(async () => {
    const result = votes.yes > votes.no 
      ? `🔨 ${mention} будет забанен! (За: ${votes.yes}, Против: ${votes.no})`
      : `🕊️ ${mention} остаётся! (За: ${votes.yes}, Против: ${votes.no})`;
    
    bot.sendMessage(chatId, result);
    if (votes.yes > votes.no) {
      await bot.banChatMember(chatId, targetUser.id);
    }
  }, 5 * 60 * 1000);

  bot.on('callback_query', (query) => {
    const voterId = query.from.id;
    const [action, userId] = query.data.split('_').slice(1);

    if (parseInt(userId) !== targetUser.id || votes.voters.has(voterId)) {
      bot.answerCallbackQuery(query.id, { text: "Вы уже проголосовали или это не то голосование!" });
      return;
    }

    votes.voters.add(voterId);
    if (action === 'yes') votes.yes++;
    else votes.no++;

    bot.answerCallbackQuery(query.id, { text: `Вы проголосовали ${action === 'yes' ? 'За' : 'Против'}!` });
  });
});

// GB SVO

bot.onText(/\/rate (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const item = match[1];
  const rating = Math.floor(Math.random() * 11);
  bot.sendMessage(chatId, `⭐ Я оцениваю "${item}" на ${rating}/10!`);
});

// RPS

const games = new Map(); 

bot.onText(/\/rps/, async (msg) => {
  const chatId = msg.chat.id;
  const initiatorId = msg.from.id;
  const replyTo = msg.reply_to_message;

  if (!replyTo) {
    bot.sendMessage(chatId, "⛔ Ответьте на сообщение пользователя, чтобы пригласить его в игру!");
    return;
  }

  const opponentId = replyTo.from.id;
  if (initiatorId === opponentId) {
    bot.sendMessage(chatId, "😂 Нельзя играть с самим собой!");
    return;
  }

  if (games.has(chatId)) {
    bot.sendMessage(chatId, "⏳ В этом чате уже идёт игра, подождите!");
    return;
  }

  const initiatorName = msg.from.first_name || 'Игрок 1';
  const opponentName = replyTo.from.first_name || 'Игрок 2';
  const game = {
    initiator: { id: initiatorId, name: initiatorName, choice: null },
    opponent: { id: opponentId, name: opponentName, choice: null },
    round: 1,
    score: { initiator: 0, opponent: 0 }
  };
  games.set(chatId, game);

  const keyboard = {
    inline_keyboard: [
      [
        { text: "✅ Да", callback_data: `rps_${chatId}_accept` },
        { text: "❌ Нет", callback_data: `rps_${chatId}_decline` }
      ]
    ]
  };

  bot.sendMessage(chatId, `🎮 ${initiatorName} приглашает ${opponentName} сыграть в Камень-Ножницы-Бумага!\n${opponentName}, согласны?`, {
    reply_to_message_id: replyTo.message_id,
    reply_markup: keyboard
  });
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const [prefix, gameChatId, action] = query.data.split('_');

  if (prefix !== 'rps' || parseInt(gameChatId) !== chatId) return;
  if (!games.has(chatId)) {
    bot.answerCallbackQuery(query.id, { text: "Игра не найдена!" });
    return;
  }

  const game = games.get(chatId);
  const choiceMap = { rock: "✊ Камень", scissors: "✂️ Ножницы", paper: "📜 Бумага" };
  const winConditions = { rock: "scissors", scissors: "paper", paper: "rock" };

  if (action === 'accept' || action === 'decline') {
    if (userId !== game.opponent.id) {
      bot.answerCallbackQuery(query.id, { text: "Это приглашение не для вас!" });
      return;
    }

    if (action === 'decline') {
      bot.editMessageText(`🚫 ${game.opponent.name} отказался играть с ${game.initiator.name}!`, {
        chat_id: chatId,
        message_id: query.message.message_id
      });
      games.delete(chatId);
      bot.answerCallbackQuery(query.id, { text: "Вы отказались от игры!" });
      return;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: "✊ Камень", callback_data: `rps_${chatId}_rock` },
          { text: "✂️ Ножницы", callback_data: `rps_${chatId}_scissors` },
          { text: "📜 Бумага", callback_data: `rps_${chatId}_paper` }
        ]
      ]
    };

    bot.editMessageText(
      `🎮 Раунд ${game.round}\n${game.initiator.name} vs ${game.opponent.name}\nСчёт: ${game.score.initiator} - ${game.score.opponent}\nВыберите свой ход (тайно):`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: keyboard
      }
    );
    bot.answerCallbackQuery(query.id, { text: "Вы приняли приглашение! Выберите ход." });
    return;
  }

  if (["rock", "scissors", "paper"].includes(action)) {
    if (userId !== game.initiator.id && userId !== game.opponent.id) {
      bot.answerCallbackQuery(query.id, { text: "Вы не участвуете в этой игре!" });
      return;
    }

    const player = userId === game.initiator.id ? game.initiator : game.opponent;
    if (player.choice) {
      bot.answerCallbackQuery(query.id, { text: "Вы уже сделали выбор!" });
      return;
    }

    player.choice = action;
    bot.answerCallbackQuery(query.id, { text: `Вы выбрали: ${choiceMap[action]}` });

    if (game.initiator.choice && game.opponent.choice) {
      const initChoice = game.initiator.choice;
      const oppChoice = game.opponent.choice;
      let result;

      if (initChoice === oppChoice) {
        result = "🤝 Ничья!";
      } else if (winConditions[initChoice] === oppChoice) {
        result = `🏆 ${game.initiator.name} победил!`;
        game.score.initiator++;
      } else {
        result = `🏆 ${game.opponent.name} победил!`;
        game.score.opponent++;
      }

      game.round++;
      game.initiator.choice = null;
      game.opponent.choice = null;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "✊ Камень", callback_data: `rps_${chatId}_rock` },
            { text: "✂️ Ножницы", callback_data: `rps_${chatId}_scissors` },
            { text: "📜 Бумага", callback_data: `rps_${chatId}_paper` }
          ],
          [
            { text: "🏁 Завершить игру", callback_data: `rps_${chatId}_end` }
          ]
        ]
      };

      bot.editMessageText(
        `🎮 Раунд ${game.round - 1}\n${game.initiator.name}: ${choiceMap[initChoice]}\n${game.opponent.name}: ${choiceMap[oppChoice]}\n${result}\n\nСчёт: ${game.score.initiator} - ${game.score.opponent}\nРаунд ${game.round}\nВыберите следующий ход:`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: keyboard
        }
      );
    }
    return;
  }

  if (action === 'end') {
    const finalResult = game.score.initiator > game.score.opponent
      ? `🎉 ${game.initiator.name} выиграл матч!`
      : game.score.initiator < game.score.opponent
      ? `🎉 ${game.opponent.name} выиграл матч!`
      : "🎲 Ничья в матче!";

    bot.editMessageText(
      `🏁 Игра завершена!\n${game.initiator.name}: ${game.score.initiator}\n${game.opponent.name}: ${game.score.opponent}\n${finalResult}`,
      {
        chat_id: chatId,
        message_id: query.message.message_id
      }
    );
    games.delete(chatId);
    bot.answerCallbackQuery(query.id, { text: "Игра завершена!" });
  }
});

// RPS SVO

const QRCode = require('qrcode');

bot.onText(/\/qr (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const text = match[1];
  try {
    const qrImage = await QRCode.toBuffer(text);
    bot.sendPhoto(chatId, qrImage, { caption: `📷 QR` });
  } catch (error) {
    bot.sendMessage(chatId, "❌ Ошибка при создании QR-кода!");
  }
});

bot.onText(/\/wish (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const wish = match[1];
  const msgWish = await bot.sendMessage(chatId, `🌟 ${wish}... Загадываю!`);
  await new Promise(r => setTimeout(r, 1000));
  await bot.editMessageText(`✨ Исполняю: ${wish}!`, { chat_id: chatId, message_id: msgWish.message_id });
  await new Promise(r => setTimeout(r, 1000));
  bot.editMessageText(`🎉 ${wish} исполнено !`, { chat_id: chatId, message_id: msgWish.message_id });
});

const symbols = ['🍒', '🍋', '🍊', '💎', '🔔', '7️⃣'];

bot.onText(/\/slot/, async (msg) => {
  const chatId = msg.chat.id;
  const player = msg.from.first_name;
  const spin = () => symbols[Math.floor(Math.random() * symbols.length)];
  let result = [spin(), spin(), spin()];
  const slotMsg = await bot.sendMessage(chatId, `🎰 ${player} крутит слот...\n${result.join(' ')}`);
  
  for (let i = 0; i < 3; i++) {
    await new Promise(r => setTimeout(r, 500));
    result = [spin(), spin(), spin()];
    await bot.editMessageText(`🎰 ${player} крутит слот...\n${result.join(' ')}`, { chat_id: chatId, message_id: slotMsg.message_id });
  }

  const win = result[0] === result[1] && result[1] === result[2];
  bot.editMessageText(
    win ? `🎰 Джекпот! ${player} выиграл с ${result.join(' ')}!` : `🎰 ${player}, не повезло: ${result.join(' ')}`,
    { chat_id: chatId, message_id: slotMsg.message_id }
  );
});

bot.onText(/\/bomb/, async (msg) => {
  const chatId = msg.chat.id;
  const player = msg.from.first_name;
  const correctWire = Math.floor(Math.random() * 3);
  const wires = ['🔴 Красный', '🟢 Зелёный', '🔵 Синий'];

  const keyboard = {
    inline_keyboard: wires.map((w, i) => [{ text: w, callback_data: `bomb_${chatId}_${i}` }])
  };

  const bombMsg = await bot.sendMessage(chatId, `💣 ${player}, у тебя 10 секунд, чтобы разминировать бомбу!\nВыбери провод:`, { reply_markup: keyboard });
  let timeLeft = 10;

  const timer = setInterval(async () => {
    timeLeft--;
    if (timeLeft > 0) {
      await bot.editMessageText(`💣 ${player}, осталось ${timeLeft} сек!\nВыбери провод:`, { chat_id: chatId, message_id: bombMsg.message_id, reply_markup: keyboard });
    }
  }, 1000);

  bot.on('callback_query', async (query) => {
    const [_, cId, wire] = query.data.split('_');
    if (parseInt(cId) !== chatId) return;

    clearInterval(timer);
    if (parseInt(wire) === correctWire) {
      await bot.editMessageText(`🎉 ${player} разминировал бомбу! Правильный провод: ${wires[correctWire]}`, { chat_id: chatId, message_id: bombMsg.message_id });
    } else {
      await bot.editMessageText(`💥 БУМ! ${player}, ты выбрал ${wires[wire]}, а надо было ${wires[correctWire]}!`, { chat_id: chatId, message_id: bombMsg.message_id });
    }
    bot.answerCallbackQuery(query.id);
  });

  setTimeout(() => {
    if (timeLeft > 0) return;
    clearInterval(timer);
    bot.editMessageText(`💥 ВРЕМЯ ВЫШЛО! ${player}, бомба взорвалась!`, { chat_id: chatId, message_id: bombMsg.message_id });
  }, 10000);
});

bot.onText(/\/duel/, async (msg) => {
  const chatId = msg.chat.id;
  const replyTo = msg.reply_to_message;
  if (!replyTo) {
    bot.sendMessage(chatId, "⛔ Ответь на сообщение соперника!");
    return;
  }

  const p1 = msg.from.first_name;
  const p2 = replyTo.from.first_name;
  const p1Id = msg.from.id;
  const p2Id = replyTo.from.id;

  const keyboard = {
    inline_keyboard: [[{ text: "🤠 Готов", callback_data: `duel_${chatId}_${p1Id}_${p2Id}_ready` }]]
  };

  const duelMsg = await bot.sendMessage(chatId, `⚔️ ${p1} вызывает ${p2} на дуэль!\n${p2}, готов?`, { reply_markup: keyboard });

  let ready = false;
  bot.on('callback_query', async (query) => {
    const [_, cId, p1IdQ, p2IdQ, action] = query.data.split('_');
    if (parseInt(cId) !== chatId || action !== 'ready' || parseInt(p2IdQ) !== query.from.id) return;

    if (!ready) {
      ready = true;
      await bot.editMessageText(`⚔️ ${p2} готов! Ждите сигнала...`, { chat_id: chatId, message_id: duelMsg.message_id });
      const wait = Math.floor(Math.random() * 5000) + 2000;
      setTimeout(async () => {
        const shootKeyboard = {
          inline_keyboard: [[{ text: "🔫 Выстрелить!", callback_data: `duel_${chatId}_${p1Id}_${p2Id}_shoot` }]]
        };
        await bot.editMessageText(`🔥 СЕЙЧАС!`, { chat_id: chatId, message_id: duelMsg.message_id, reply_markup: shootKeyboard });

        let winner = null;
        bot.on('callback_query', async (q) => {
          if (q.data !== `duel_${chatId}_${p1Id}_${p2Id}_shoot` || winner) return;
          winner = q.from.id === p1Id ? p1 : p2;
          await bot.editMessageText(`🏆 ${winner} выстрелил первым и победил!`, { chat_id: chatId, message_id: duelMsg.message_id });
          bot.answerCallbackQuery(q.id, { text: "Ты победил!" });
        });
      }, wait);
    }
  });
});

bot.onText(/\/reminder (\d+)(m|h|d) (.+)/, (msg, match) => {
    const duration = parseInt(match[1]);
    const unit = match[2];
    const reminderText = match[3];
    const durationMoment = moment.duration(duration, unit);

    bot.sendMessage(msg.chat.id, `Напоминание установлено: ${reminderText}`);

    setTimeout(() => {
        bot.sendMessage(msg.chat.id, `⏰ Напоминаю: ${reminderText}`);
    }, durationMoment.asMilliseconds());
});

function tellJoke(chatId) {
    const jokes = [
        "Муси-пуси линукс-сусе джага-джага, виндоус — шняга.",
        "Некоторые игры запускать на Линуксе интереснее, чем играть в них.",
        "Билл Гейтс застукал жену с Линуксом.",
        "Я понял, чем Линукс от Винды отличается! В нём можно биться головой о клавиатуру, и у тебя не откроются десятки программ, которые ты видишь первый раз в жизни!",
        "Главный инструмент любого линуксоида — это огромный, мозолистый мозг.",
        "У слові ебілд буква д явно не на своєму місці.",
        "Сын подходит с флешкой к папе-линуксоиду и говорит:\n– Пап, а проиграй-ка мне этот .wav-ик…\n– Ща, сынок, только в ядро поддержку саунда вкомпилю…",
        "«Linux. Карманный справочник (основные команды)» — 4409 страниц.",
        "Объявлено об объединении Microsoft и Linux. Эмблемой новой системы выбран пингвин, выпадающий в окно.",
        "sudo apt-search girl | grep beautiful",
        "Линукс создан для удобства, как птица пингвин — для полёта.",
        "- Правда ли, что в дистрибутиве Linux есть фраза 'при изготовлении этого продукта ни один пингвин не пострадал?'\n- Правда. Зато при его установке пострадало много дятлов.",
        "Сколько программистов нужно, чтобы поменять лампочку? Ни одного, это аппаратная проблема.",
        "Почему программисты путают Рождество и Хэллоуин? Потому что 31 октября — это 25 декабря в шестнадцатеричной системе.",
        "Программист — это машина, преобразующая кофе в код.",
        "Если бы строители строили дома так, как программисты пишут код, первый же дятел разрушил бы цивилизацию.",
        "Программист — это человек, который решает проблему, о которой вы не знали, способом, который вы не понимаете.",
        "Почему программисты не любят природу? Слишком много багов.",
        "Почему программисты предпочитают тёмную тему? Потому что свет привлекает багов.",
        "Программистов можно сравнить с богами: они создают свои собственные миры, но потом не знают, как их исправить.",
        "Программист — это единственный человек, который может попросить у шефа 200$ на память.",
        "Программист всегда смотрит и направо, и налево, прежде чем перейти улицу с односторонним движением.",
        "Не волнуйся, если не работает. Если бы всё всегда работало, у тебя бы не было работы.",
        "Большинство программного обеспечения сегодня похоже на египетские пирамиды: миллионы кирпичей, построенных без целостности конструкции, но посредством грубой силы тысяч рабов.",
        "Всегда пиши код так, как будто человек, который будет его сопровождать — психопат-убийца, который знает, где ты живёшь.",
        "Если в Линуксе что-то не работает, открой исходный код и исправь. Если в Windows что-то не работает, переплачивай за поддержку.",
        "Линуксоид не теряется в сложных ситуациях, он просто пишет новый скрипт.",
        "В Линуксе всё файл. Даже устройство — это файл. Даже файл — это файл.",
        "Линукс — это не операционная система, а способ мышления.",
        "Линуксоид может сделать всё. Вопрос только во времени и количестве консольных команд.",
        "Линукс — это свобода. Свобода тратить часы на настройку того, что в других системах работает из коробки.",
        "Линуксоид никогда не теряет данные. Он просто забывает, куда их сохранил.",
        "Линукс — это система, где каждый может почувствовать себя разработчиком ядра.",
        "Линуксоид не боится вирусов. Вирусы боятся линуксоидов.",
        "Линукс — это когда ты знаешь, что такое grep, awk и sed, но не помнишь дни рождения родственников.",
        "Линуксоид не ищет лёгких путей. Он их компилирует.",
        "Линукс — это система, где даже ошибки — это фичи.",
        "Линуксоид не использует графический интерфейс. Он пишет скрипт, который рисует окна в консоли.",
        "Линукс — это когда ты можешь настроить всё, но не знаешь, зачем.",
        "Линуксоид не удаляет файлы. Он их архивирует в /dev/null.",
        "Линукс — это система, где каждый может почувствовать себя администратором, даже если не хочет.",
        "Линуксоид не использует мышь. Он использует клавиатуру и силу мысли.",
        "Линукс — это когда ты знаешь, как работает система, но не можешь объяснить это другим.",
        "Линуксоид не боится синего экрана смерти. У него просто нет экрана.",
        "Линукс — это когда ты можешь собрать свою систему из исходников, но не можешь собрать шкаф из ИКЕА.",
        "Линуксоид не использует антивирус. Он использует бэкапы.",
        "Линукс — это когда ты можешь настроить всё, но ничего не работает.",
        "Линуксоид не жалуется на проблемы. Он пишет баг-репорты.",
        "Линукс — это когда ты знаешь, что такое ядро, но не знаешь, что на обед."
    ];
    const randomIndex = Math.floor(Math.random() * jokes.length);
    bot.sendMessage(chatId, jokes[randomIndex]);
}

function runQuiz(chatId) {
    const quizzes = [
        { question: 'Какой оператор используется для сравнения в C++?', answer: '==' },
        { question: 'Какой командой в bash можно вывести список файлов в директории?', answer: 'ls' },
        { question: 'Что такое pamac?', answer: 'Говно' },
        { question: 'Что такое AUR в Arch Linux/Arch based distributions?', answer: 'Arch User Repository' },
        { question: 'Какой самый простой способ установить LFS на реальное железо?', answer: 'Руками' },
        { question: 'Какой язык программирования используется для разработки на платформе Android?', answer: 'Java' },
        { question: 'Какой символ используется для обозначения указателя в C++?', answer: '*' },
        { question: 'Как называется процесс поиска и устранения ошибок в коде?', answer: 'Отладка' },
        { question: 'Какой протокол используется для безопасной передачи данных в интернете?', answer: 'HTTPS' },
        { question: 'Какой метод массива JavaScript используется для добавления элемента в конец массива?', answer: 'push' },
        { question: 'Какой язык программирования чаще всего используется для веб-разработки на стороне сервера?', answer: 'PHP' },
        { question: 'Какой тег используется для создания гиперссылки в HTML?', answer: '<a>' },
        { question: 'Какой командой в Git можно создать новую ветку?', answer: 'git branch' },
        { question: 'Как называется основной файл конфигурации в большинстве дистрибутивов Linux?', answer: 'fstab' },
        { question: 'Какой символ используется для обозначения комментария в Python?', answer: '#' },
        { question: 'Какой метод строки в JavaScript используется для преобразования всех символов в нижний регистр?', answer: 'toLowerCase' },
        { question: 'Какой оператор используется для получения остатка от деления в C++?', answer: '%' },
        { question: 'Как называется процесс преобразования исходного кода в исполняемый файл?', answer: 'Компиляция' },
        { question: 'Какой командой в SQL можно выбрать все записи из таблицы?', answer: 'SELECT *' },
        { question: 'Как называется структура данных, работающая по принципу LIFO?', answer: 'Стек' },
        { question: 'Какой язык программирования используется для стилизации веб-страниц?', answer: 'CSS' },
        { question: 'Какой командой в Linux можно изменить права доступа к файлу?', answer: 'chmod' },
        { question: 'Как называется ошибка, возникающая во время выполнения программы?', answer: 'Исключение' },
        { question: 'Какой метод массива в JavaScript используется для удаления последнего элемента?', answer: 'pop' },
        { question: 'Как называется цикл с предусловием в Python?', answer: 'while' },
        { question: 'Какой командой в Docker можно запустить новый контейнер?', answer: 'docker run' },
        { question: 'Как называется процесс автоматического управления памятью в языках программирования?', answer: 'Сборка мусора' },
        { question: 'Какой символ используется для обозначения комментария в SQL?', answer: '--' },
        { question: 'Какой метод строки в JavaScript используется для удаления пробелов с обоих концов строки?', answer: 'trim' },
        { question: 'Как называется ошибка, возникающая при обращении к несуществующему индексу массива?', answer: 'IndexError' },
        { question: 'Какой командой в Linux можно просмотреть содержимое файла?', answer: 'cat' },
        { question: 'Как называется процесс проверки кода на соответствие стандартам и выявление потенциальных ошибок?', answer: 'Линтинг' },
        { question: 'Какой оператор используется для объединения строк в Python?', answer: '+' },
        { question: 'Как называется структура данных, работающая по принципу FIFO?', answer: 'Очередь' },
        { question: 'Какой командой в Git можно загрузить изменения на удалённый репозиторий?', answer: 'git push' },
        { question: 'Как называется минимальная единица информации в компьютере?', answer: 'Бит' },
        { question: 'Какой метод массива в JavaScript используется для добавления элемента в начало массива?', answer: 'unshift' },
        { question: 'Как называется ошибка, возникающая при делении на ноль?', answer: 'ZeroDivisionError' },
        { question: 'Какой командой в Linux можно создать новую директорию?', answer: 'mkdir' },
        { question: 'Как называется процесс преобразования данных из одного типа в другой?', answer: 'Кастинг' },
        { question: 'Какой оператор используется для логического "И" в C++?', answer: '&&' },
        { question: 'Как называется область памяти, используемая для динамического распределения памяти во время выполнения программы?', answer: 'Куча' },
        { question: 'Какой командой в SQL можно удалить таблицу?', answer: 'DROP TABLE' },
        { question: 'Как называется процесс сохранения состояния объекта для последующего восстановления?', answer: 'Сериализация' },
        { question: 'Какой метод строки в JavaScript используется для замены части строки другой строкой?', answer: 'replace' },
        { question: 'Как называется ошибка, возникающая при попытке обратиться к объекту, который не был инициализирован?', answer: 'NullPointerException' },
        { question: 'Какой командой в Linux можно вывести текущий каталог?', answer: 'pwd' },
        { question: 'Как называется процесс оптимизации кода для повышения производительности?', answer: 'Рефакторинг' },
        { question: 'Какой оператор используется для логического "ИЛИ" в Python?', answer: 'or' },
        { question: 'Как называется структура данных, представляющая собой коллекцию пар "ключ-значение"?', answer: 'Словарь' },
        { question: 'Какой командой в Git можно просмотреть историю коммитов?', answer: 'git log' },
        { question: 'Как называется процесс преобразования исполняемого кода в более низкоуровневый язык?', answer: 'Декомпиляция' },
        { question: 'Какой метод массива в JavaScript используется для сортировки элементов?', answer: 'sort' },
        { question: 'Как называется ошибка, возникающая при выходе за пределы допустимого диапазона значений?', answer: 'OverflowError' },
        { question: 'Какой командой в Linux можно удалить файл?', answer: 'rm' },
        { question: 'Как называется процесс объединения нескольких строк кода в одну?', answer: 'Конкатенация' },
        { question: 'Какой оператор используется для побитового "И" в C++?', answer: '&' }
		];
    const randomIndex = Math.floor(Math.random() * quizzes.length);
    const quiz = quizzes[randomIndex];
    bot.sendMessage(chatId, `Вопрос: ${quiz.question}`);
    bot.once('message', (msg) => {
        if (msg.chat.id === chatId) {
            if (msg.text.trim().toLowerCase() === quiz.answer.toLowerCase()) {
                bot.sendMessage(chatId, "Правильно!");
            } else {
                bot.sendMessage(chatId, "Неправильно.");
            }
        }
    });
}

// /myid
bot.onText(/\/myid/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    bot.sendMessage(chatId, `Твой ID: ${userId}`);
});

bot.onText(/\/startx/, (msg) => {
    bot.sendMessage(msg.chat.id, "xinit: unable to run server");
});


bot.onText(/\/joke/, (msg) => {
    tellJoke(msg.chat.id);
});

bot.onText(/\/quiz/, (msg) => {
    runQuiz(msg.chat.id);
});

bot.onText(/\/warn (.+)/, (msg, match) => {
    const userId = msg.from.id;
    if (isAdmin(userId)) {
        const username = match[1];
        warnUser(username, msg.chat.id);
    } else {
        bot.sendMessage(msg.chat.id, "Permission Denied!");
    }
});

bot.onText(/\/unwarn (.+)/, (msg, match) => {
    const userId = msg.from.id;
    if (isAdmin(userId)) {
        const username = match[1];
        unwarnUser(username, msg.chat.id);
    } else {
        bot.sendMessage(msg.chat.id, "Permission Denied!");
    }
});

bot.onText(/\/warns/, (msg) => {
    const userId = msg.from.id;
    if (isAdmin(userId)) {
        showWarns(msg.chat.id);
    } else {
        bot.sendMessage(msg.chat.id, "Permission Denied!");
    }
});

bot.onText(/\/bans/, (msg) => {
    const userId = msg.from.id;
    if (isAdmin(userId)) {
        showBans(msg.chat.id);
    } else {
        bot.sendMessage(msg.chat.id, "Permission Denied!");
    }
});

bot.onText(/\/mutes/, (msg) => {
    const userId = msg.from.id;
    if (isAdmin(userId)) {
        showMutes(msg.chat.id);
    } else {
        bot.sendMessage(msg.chat.id, "Permission Denied!");
    }
});

bot.onText(/\/mute (\d+)(m|h|d)/ , (msg, match) => {
    const userId = msg.from.id;
    if (isAdmin(userId)) {
        const muteUserId = msg.reply_to_message.from.id;
        const duration = parseInt(match[1]);
        const unit = match[2];
        let durationMoment = moment.duration(duration, unit);
        muteUser(muteUserId, msg.chat.id, durationMoment);
    } else {
        bot.sendMessage(msg.chat.id, "Permission Denied!");
    }
});

bot.onText(/\/unmute/, (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    if (isAdmin(userId)) {
        const targetUserId = msg.reply_to_message.from.id;

        if (muted[targetUserId]) {
            bot.restrictChatMember(chatId, targetUserId, {
                can_send_messages: true,
                can_send_media_messages: true,
                can_send_polls: true,
                can_send_other_messages: true,
                can_add_web_page_previews: true
            });
            delete muted[targetUserId];
            bot.sendMessage(chatId, `Пользователь с ID ${targetUserId} был размьючен.`);
        } else {
            bot.sendMessage(chatId, `Пользователь с ID ${targetUserId} не был замьючен.`);
        }
    } else {
        bot.sendMessage(chatId, "Permission Denied!");
    }
});


bot.onText(/\/ban (\d+)(m|h|d|y)/, (msg, match) => {
    const userId = msg.from.id;
    if (isAdmin(userId)) {
        const banUserId = msg.reply_to_message.from.id;
        const duration = parseInt(match[1]);
        const unit = match[2];
        let durationMoment = moment.duration(duration, unit);
        banUser(banUserId, msg.chat.id, durationMoment);
    } else {
        bot.sendMessage(msg.chat.id, "Permission Denied!");
    }
});

bot.onText(/\/unban/, (msg) => {
    const userId = msg.from.id;
    if (isAdmin(userId)) {
        const unbanUserId = msg.reply_to_message.from.id;
        unbanUser(unbanUserId, msg.chat.id);
    } else {
        bot.sendMessage(msg.chat.id, "Permission Denied!");
    }
});

bot.onText(/\/echo (.+)/, (msg, match) => {
    bot.sendMessage(msg.chat.id, match[1]);
});

bot.onText(/\/date/, (msg) => {
    bot.sendMessage(msg.chat.id, `date: ${moment().format('LL')}`);
});

bot.onText(/\/grub/, (msg) => {
    bot.sendMessage(msg.chat.id, "error: no such partition\nEntering rescue mode...");
});

bot.onText(/\/ls/, (msg) => {
    bot.sendMessage(msg.chat.id, "bot.js");
});

bot.onText(/\/cat/, (msg) => {
    bot.sendMessage(msg.chat.id, "sh: cat: command not found");
});

bot.onText(/\/uptime/, (msg) => {
  const exec = require('child_process').exec;
  exec('uptime -p', (error, stdout) => {
    bot.sendMessage(msg.chat.id, `🕒 Uptime: ${stdout.trim()}`);
  });
});

bot.onText(/\/kernel/, (msg) => {
  const exec = require('child_process').exec;
  exec("uname -r", (error, stdout) => {
    bot.sendMessage(msg.chat.id, `🖥 Версия ядра: ${stdout.trim()}`);
  });
});

bot.onText(/\/arch/, (msg) => {
  const exec = require('child_process').exec;
  exec("uname -m", (error, stdout) => {
    bot.sendMessage(msg.chat.id, `💾 Архитектура CPU: ${stdout.trim()}`);
  });
});

// Execute code

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!msg.text || typeof msg.text !== 'string') return; 
  const text = msg.text.toLowerCase();
  if (text !== 'русская рулетка') return;

  if (games.has(chatId)) {
    bot.sendMessage(chatId, "⏳ В этом чате уже идёт рулетка!");
    return;
  }

  const player = msg.from.first_name || 'Стрелок';
  const bullets = Array(6).fill('◯'); 
  const bulletPosition = Math.floor(Math.random() * 6); 
  bullets[bulletPosition] = '💥';
  let currentPosition = 0;   const game = {
    player,
    userId,
    bullets,
    bulletPosition,
    currentPosition,
    spins: 0
  };
  games.set(chatId, game);

  const keyboard = {
    inline_keyboard: [
      [
        { text: "⬅️ Влево", callback_data: `rr_${chatId}_left` },
        { text: "➡️ Вправо", callback_data: `rr_${chatId}_right` },
      ],
      [
        { text: "🔫 Выстрелить", callback_data: `rr_${chatId}_shoot` }
      ]
    ]
  };

  try {
    await bot.sendMessage(chatId, `🔫 ${player} начал Русскую рулетку!\nБарабан: ${bullets.join(' ')}\nТекущая позиция: ${game.currentPosition + 1} (${bullets[currentPosition]})\nКрути или стреляй!`, {
      reply_markup: keyboard
    });
  } catch (error) {
    console.error('Ошибка отправки сообщения:', error);
    bot.sendMessage(chatId, "⚠️ Не смог начать рулетку, попробуй ещё раз!");
    games.delete(chatId);
  }
});

bot.on('callback_query', async (query) => {
  const chatId = query.message?.chat.id;
  const userId = query.from.id;
  const data = query.data?.split('_');

  if (!chatId || !data || data[0] !== 'rr' || parseInt(data[1]) !== chatId) {
    bot.answerCallbackQuery(query.id, { text: "Что-то пошло не так!" });
    return;
  }

  if (!games.has(chatId)) {
    bot.answerCallbackQuery(query.id, { text: "Рулетка не найдена!" });
    return;
  }

  const game = games.get(chatId);
  if (userId !== game.userId) {
    bot.answerCallbackQuery(query.id, { text: "Это не твоя рулетка!" });
    return;
  }

  const action = data[2];

  const updateKeyboard = () => ({
    inline_keyboard: [
      [
        { text: "⬅️ Влево", callback_data: `rr_${chatId}_left` },
        { text: "➡️ Вправо", callback_data: `rr_${chatId}_right` },
      ],
      [
        { text: "🔫 Выстрелить", callback_data: `rr_${chatId}_shoot` }
      ]
    ]
  });

  if (action === 'left' || action === 'right') {
    game.spins++;
    if (action === 'left') {
      game.currentPosition = (game.currentPosition - 1 + 6) % 6;
    } else {
      game.currentPosition = (game.currentPosition + 1) % 6;
    }

    const displayBullets = game.bullets.map((b, i) => i === game.currentPosition ? `➡️${b}` : b).join(' ');
    try {
      await bot.editMessageText(
        `🔫 ${game.player}, ты крутишь барабан (${game.spins} вращений)\nБарабан: ${displayBullets}\nТекущая позиция: ${game.currentPosition + 1}`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: updateKeyboard()
        }
      );
      bot.answerCallbackQuery(query.id, { text: `Барабан крутится ${action === 'left' ? 'влево' : 'вправо'}!` });
    } catch (error) {
      console.error('Ошибка редактирования сообщения:', error);
      bot.sendMessage(chatId, "⚠️ Ошибка интерфейса, рулетка сломалась!");
      games.delete(chatId);
    }
    return;
  }

  if (action === 'shoot') {
    const isBullet = game.currentPosition === game.bulletPosition;
    try {
      if (isBullet) {
        await bot.editMessageText(
          `💥 БАХ! ${game.player}, ты проиграл!\nБарабан: ${game.bullets.join(' ')}\nПатрон был в позиции ${game.bulletPosition + 1}.\n🔇 Пытаюсь дать мут на 1 час...`,
          {
            chat_id: chatId,
            message_id: query.message.message_id
          }
        );
        try {
          await bot.restrictChatMember(chatId, game.userId, {
            until_date: Math.floor(Date.now() / 1000) + 3600, // 1 час
            can_send_messages: false,
            can_send_media: false,
            can_send_polls: false,
            can_send_other_messages: false,
            can_add_web_page_previews: false
          });
          await bot.sendMessage(chatId, `🔇 ${game.player} замучен на 1 час!`);
        } catch (muteError) {
          console.error('Ошибка мута:', muteError);
          await bot.sendMessage(chatId, `⚠️ Не смог замутить ${game.player}! Убедись, что у меня есть права администратора.`);
        }
      } else {
        await bot.editMessageText(
          `🔫 ЩЁЛК! ${game.player}, повезло, патрона нет!\nБарабан: ${game.bullets.join(' ')}\nТекущая позиция: ${game.currentPosition + 1}\nКрути дальше или стреляй снова!`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: updateKeyboard()
          }
        );
      }
      bot.answerCallbackQuery(query.id, { text: isBullet ? "💀 Ты мёртв!" : "🍀 Ты жив!" });
    } catch (error) {
      console.error('Ошибка при выстреле:', error);
      bot.sendMessage(chatId, "⚠️ Ошибка в игре, рулетка сломалась!");
    }

    if (isBullet) {
      games.delete(chatId);     }
  }
});

// SVO

let secretNumber = Math.floor(Math.random() * 100) + 1;

bot.onText(/\/guess (\d+)/, (msg, match) => {
  const guess = parseInt(match[1]);
  if (guess === secretNumber) {
    bot.sendMessage(msg.chat.id, "🎉 Поздравляю! Ты угадал число!");
    secretNumber = Math.floor(Math.random() * 100) + 1;
  } else {
    bot.sendMessage(msg.chat.id, guess > secretNumber ? "📉 Меньше!" : "📈 Больше!");
  }
});

bot.onText(/\/coinflip/, async (msg) => {
  const chatId = msg.chat.id;
  const message = await bot.sendMessage(chatId, "🪙 Кручу...");
  await new Promise(r => setTimeout(r, 500));
  await bot.editMessageText("🪙 Орёл или Решка?", { chat_id: chatId, message_id: message.message_id });
  await new Promise(r => setTimeout(r, 500));
  const result = Math.random() < 0.5 ? "🪙 Орёл" : "🪙 Решка";
  bot.editMessageText(result, { chat_id: chatId, message_id: message.message_id });
});

const answers = ["Да", "Нет", "Возможно", "Спроси позже", "Определенно!", "Сомневаюсь", "Конечно нет!"];

bot.onText(/\/8ball (.+)/, (msg) => {
  bot.sendMessage(msg.chat.id, `🎱 Ответ: ${answers[Math.floor(Math.random() * answers.length)]}`);
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name || 'there';
    const text = msg.text.toLowerCase();

    if (text === 'sudo rm -rf /*') {
      const mention = `@${msg.from.username || userName}`;
      const replyMessage = `${mention} Ну ты и шутник!`;

      bot.sendMessage(chatId, replyMessage, {
        parse_mode: 'Markdown'
      });
    }
  });

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name || 'there';
    const text = msg.text.toLowerCase();

    if (text === 'Ты еблан') {
      const mention = `@${msg.from.username || userName}`;
      const replyMessage = `${mention} Без оскорблений!`;

      bot.sendMessage(chatId, replyMessage, {
        parse_mode: 'Markdown'
      });
    }
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name || 'there';
    const text = msg.text.toLowerCase();

    if (text === 'Ты тупой') {
      const mention = `@${msg.from.username || userName}`;
      const replyMessage = `${mention} Ну ты и шутник!`;

      bot.sendMessage(chatId, replyMessage, {
        parse_mode: 'Markdown'
      });
    }
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name || 'there';
    const text = msg.text.toLowerCase();

    if (text === 'sudo rm -rf /* --no-preserve-root') {
      const mention = `@${msg.from.username || userName}`;
      const replyMessage = `${mention} Ну ты и шутник!`;

      bot.sendMessage(chatId, replyMessage, {
        parse_mode: 'Markdown'
      });
    }
});

  bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name || 'there';
    const text = msg.text.toLowerCase();

    if (text === 'rm -rf /*') {
      const mention = `@${msg.from.username || userName}`;
      const replyMessage = `${mention} Permission Denied!`;

      bot.sendMessage(chatId, replyMessage, {
        parse_mode: 'Markdown'
      });
    }
});



bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name || 'there';
    const text = msg.text.toLowerCase();

  if (text === 'doas /warn @makefilesystem') {
    const mention = `@${msg.from.username || userName}`;
    const replyMessage = `${mention} Сука`;

    bot.sendMessage(chatId, replyMessage, {
      parse_mode: 'Markdown'
    });
  }
});

// /help
bot.onText(/\/help/, (msg) => {
    const helpMessage = `
📘 *Мануал по командам бота*

*Основные команды*:
/startx — Проверить работу бота.
/joke — Рассказать шутку.
/quiz — Запустить викторину.
/echo [текст] — Повторить сообщение.
/date — Показать текущую дату
/fetch — проверить ОС сервера.
/help — Показать список команд.
/myid - Вывести ID пользователя
Брак - ( в ответ на сообщение ) - вступить в брак с пользователем , Развод , чтобы развестись
Русская рулетка - запустить русскую рулетку

*Модерационные команды* _(доступны только администраторам)_:
/warn [username] — Выдать варн пользователю. Три варна — автоматический бан.
/unwarn [username] — Убрать варн у пользователя.
/warns — Показать список всех пользователей с варнами.
/mute [время][m|h|d] — Замьютить пользователя на определённое время. Пример: /mute 5m.
/unmute — Размьютить пользователя.
/mutes — Показать список всех замьюченных пользователей.
/ban [время][m|h|d|y] — Забанить пользователя на время или навсегда. Пример: /ban 1h.
/unban — Разбанить пользователя.
/bans — Показать список всех забаненных пользователей.

*Дополнительные команды*:
Бот кто <>
/newyear - Показать сколько дней до нового года
/reminder <очемнапомнить> d|m|h
/quote - Цитата
/fact - Рандомный факт
/grub
/uptime - Время работы сервера
/coinflip - Бросить монетку
/guess - Угадать число
/8ball - Узнать ответ
/arch - Архитектура процессора сервера
/kernel - Версия ядра сервера
/rand - Выбрать на рандом
/qr <текст или ссылка> - Создать qr
/rate - Оценить от 1 до 10
/rps - Камень-ножницы-бумага
/wish - Исполнить любое желание
/slot - Игровой автомат
/bomb - Разминирование бомбы
/duel - Дуэль с участниками
    `;
    bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/timer (\d+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const timeInSeconds = parseInt(match[1]);

    if (isNaN(timeInSeconds) || timeInSeconds <= 0) {
        bot.sendMessage(chatId, 'Укажи корректное время в секундах.');
        return;
    }

    bot.sendMessage(chatId, `Таймер установлен на ${timeInSeconds} секунд.`);

    setTimeout(() => {
        bot.sendMessage(chatId, `@${msg.from.username} Подъем, страна великая!`);
    }, timeInSeconds * 1000);
});

const chatUsers = {};

async function updateChatMembers(chatId) {
    try {

        const members = await bot.getChatAdministrators(chatId);

        chatUsers[chatId] = members.map(member => member.user);
    } catch (error) {
        console.error(`[Error while updating members in chat ${chatId}]`, error);
    }
}


function getRandomUser(users) {
    return users[Math.floor(Math.random() * users.length)];
}

// "Бот кто"
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.toLowerCase();

    if (text.startsWith('бот кто')) {
        const userText = text.slice(8).trim();

        if (!chatUsers[chatId] || chatUsers[chatId].length === 0) {
            await updateChatMembers(chatId);
        }

        const users = chatUsers[chatId] || [];

        if (users.length === 0) {
            bot.sendMessage(chatId, 'Ошибка, уничтожение сервера через 674 секунды');
            return;
        }

        const randomUser = getRandomUser(users);
        const chosenName = randomUser.first_name || 'Аноним'; // Используем имя или "Аноним"

        const response = `${chosenName} ${userText || 'крутой'}`;
        bot.sendMessage(chatId, response);
    }
});

setInterval(async () => {
    for (const chatId in chatUsers) {
        await updateChatMembers(chatId);
    }
}, 60000);

bot.on('polling_error', (error) => {
	console.log("Polling_error:", error.code, error.response ? error.response.body : error);
});

// rand
bot.onText(/\/rand (.+)/, (msg, match) => {
	    const chatId = msg.chat.id;
	    const input = match[1].trim();

	    if (input.includes('==')) {
		            const [start, end] = input.split('==').map(Number);
		            if (isNaN(start) || isNaN(end) || start >= end) {
				                bot.sendMessage(chatId, 'Укажи корректный диапазон чисел в формате: /rand число1==число2');
				            } else {
						                const randomNum = Math.floor(Math.random() * (end - start + 1)) + start;
						                bot.sendMessage(chatId, `[${start}, ${end}]: ${randomNum}`);
						            }
		        } else {
				        const options = input.split(/\s+/);
				        if (options.length < 2) {
						            bot.sendMessage(chatId, 'Usage: /rand gta rdr skyrim mafia');
						        } else {
								            const randomChoice = options[Math.floor(Math.random() * options.length)];
								            bot.sendMessage(chatId, `${randomChoice}`);
								        }
				    }
});


// BRUCKS

const marriageProposals = new Map();

const getMarriageFilePath = (chatId) => `marriages_${chatId}.txt`;

const readMarriages = (chatId) => {
    const filePath = getMarriageFilePath(chatId);
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data) || [];
    } catch (e) {
        return [];
    }
};

const writeMarriages = (chatId, marriages) => {
    const filePath = getMarriageFilePath(chatId);
    fs.writeFileSync(filePath, JSON.stringify(marriages, null, 2));
};

const getDisplayName = (user) => user.username ? `@${user.username}` : user.first_name;

const getMarriageLevel = (days) => {
    if (days <= 30) return 'Молодожены';
    if (days <= 90) return 'Зеленая свадьба';
    if (days <= 180) return 'Розовая свадьба';
    if (days <= 365) return 'Бумажная свадьба';
    if (days <= 730) return 'Деревянная свадьба';
    return 'Долгосрочный брак';
};

function animateMessage(chatId, messageId, texts, delay, index = 0) {
    if (index >= texts.length) return;
    try {
        bot.editMessageText(texts[index], { chat_id: chatId, message_id: messageId });
        setTimeout(() => animateMessage(chatId, messageId, texts, delay, index + 1), delay);
    } catch (e) {
        console.error('Ошибка анимации:', e);
    }
}

bot.onText(/Брак/, (msg) => {
    if (!msg.reply_to_message) {
        bot.sendMessage(msg.chat.id, "Ответьте на сообщение пользователя, которому хотите предложить брак!");
        return;
    }

    const proposerId = msg.from.id;
    const proposedId = msg.reply_to_message.from.id;
    const chatId = msg.chat.id;

    if (proposerId === proposedId) {
        bot.sendMessage(chatId, "Нельзя вступить в брак с самим собой!");
        return;
    }

    const marriages = readMarriages(chatId);
    if (marriages.some(m => (m.user1 === proposerId || m.user2 === proposerId) && m.status !== 'divorced')) {
        bot.sendMessage(chatId, "Вы уже состоите в браке!");
        return;
    }
    if (marriages.some(m => (m.user1 === proposedId || m.user2 === proposedId) && m.status !== 'divorced')) {
        bot.sendMessage(chatId, "Этот пользователь уже состоит в браке!");
        return;
    }

    const proposerName = getDisplayName(msg.from);
    const proposedName = getDisplayName(msg.reply_to_message.from);
    const proposalKey = `${chatId}_${proposedId}`;

    marriageProposals.set(proposalKey, { proposerId, proposedId, proposerName, proposedName });

    const keyboard = {
        inline_keyboard: [
            [{ text: 'Да', callback_data: 'marriage_yes' }],
            [{ text: 'Нет', callback_data: 'marriage_no' }]
        ]
    };

    bot.sendMessage(chatId,
        `${proposerName} предложил брак ${proposedName}! Согласны?`,
        { reply_markup: JSON.stringify(keyboard) }
    );
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const proposalKey = `${chatId}_${userId}`;
    const proposal = marriageProposals.get(proposalKey);

    if (!proposal || proposal.proposedId !== userId) {
        bot.answerCallbackQuery(query.id, { text: "Это предложение не для вас!" });
        return;
    }

    const marriages = readMarriages(chatId);

    if (query.data === 'marriage_yes') {
        const marriage = {
            user1: proposal.proposerId,
            user2: proposal.proposedId,
            name1: proposal.proposerName,
            name2: proposal.proposedName,
            status: 'green',
            date: new Date().toISOString()
        };
        marriages.push(marriage);
        writeMarriages(chatId, marriages);

        bot.sendMessage(chatId, "Свадьба начинается... 💍").then((sentMsg) => {
            const messageId = sentMsg.message_id;
            const texts = [
                "Свадьба в разгаре... 💍💍",
                "Свадьба состоялась! 💍💍💍 Поздравляем!"
            ];
            animateMessage(chatId, messageId, texts, 1000);
        });
    } else {
        // Анимация отказа
        bot.sendMessage(chatId, "Отказ... 💔").then((sentMsg) => {
            const messageId = sentMsg.message_id;
            const texts = [
                "Отказ принят... 💔💔",
                "Предложение отклонено! 💔💔💔"
            ];
            animateMessage(chatId, messageId, texts, 1000);
        });
    }

    marriageProposals.delete(proposalKey);
    bot.deleteMessage(chatId, query.message.message_id);
    bot.answerCallbackQuery(query.id);
});

bot.onText(/Развод/, (msg) => {
    if (!msg.reply_to_message) {
        bot.sendMessage(msg.chat.id, "Ответьте на сообщение супруга для развода!");
        return;
    }

    const userId = msg.from.id;
    const spouseId = msg.reply_to_message.from.id;
    const chatId = msg.chat.id;

    const marriages = readMarriages(chatId);
    const marriage = marriages.find(m =>
        (m.user1 === userId && m.user2 === spouseId) ||
        (m.user1 === spouseId && m.user2 === userId)
    );

    if (!marriage || marriage.status === 'divorced') {
        bot.sendMessage(chatId, "Вы не состоите в браке с этим пользователем!");
        return;
    }

    marriage.status = 'divorced';
    marriage.divorceDate = new Date().toISOString();
    writeMarriages(chatId, marriages);

    bot.sendMessage(chatId, "Развод... 👋").then((sentMsg) => {
        const messageId = sentMsg.message_id;
        const texts = [
            "Развод в процессе... 👋👋",
            "Развод завершен! 👋👋👋"
        ];
        animateMessage(chatId, messageId, texts, 1000);
    });
});

bot.onText(/Браки/, (msg) => {
    const chatId = msg.chat.id;
    const marriages = readMarriages(chatId);

    if (!marriages.length) {
        bot.sendMessage(chatId, "В этой группе пока нет браков!");
        return;
    }

    const statusNames = {
        'green': 'Зеленая свадьба',
        'divorced': 'Расторгнут'
    };

    let response = "💞 Список браков:\n\n";
    marriages.forEach((m, i) => {
        const status = statusNames[m.status] || m.status;
        response += `${i + 1}. ${m.name1} и ${m.name2} - ${status}\n`;
        response += `   Дата: ${moment(m.date).format('DD.MM.YYYY')}\n`;
        if (m.divorceDate) {
            response += `   Развод: ${moment(m.divorceDate).format('DD.MM.YYYY')}\n`;
        }
    });

    bot.sendMessage(chatId, response);
});

bot.onText(/Мой брак/, (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const marriages = readMarriages(chatId);

    const marriage = marriages.find(m => (m.user1 === userId || m.user2 === userId) && m.status !== 'divorced');
    if (!marriage) {
        bot.sendMessage(chatId, "Вы не состоите в браке.");
        return;
    }

    const spouseName = marriage.user1 === userId ? marriage.name2 : marriage.name1;
    const marriageDate = new Date(marriage.date);
    const now = new Date();
    const daysMarried = Math.floor((now - marriageDate) / (1000 * 60 * 60 * 24));
    const level = getMarriageLevel(daysMarried);

    let response = `Ваш брак с ${spouseName}:\n`;
    response += `Дата свадьбы: ${moment(marriageDate).format('DD.MM.YYYY')}\n`;
    response += `Дней в браке: ${daysMarried}\n`;
    response += `Уровень: ${level}\n`;

    bot.sendMessage(chatId, response);
});

// BRUCKS SVO

bot.on('message', (msg) => {
	    const chatId = msg.chat.id;
	    const userWhoActed = msg.from.username || msg.from.first_name || 'Аноним';
	    const replyTo = msg.reply_to_message;

	    if (!replyTo) return;

	    const targetUser = replyTo.from.username;

	    if (!replyTo) return;
	    const actionText = msg.text.toLowerCase();

	    if (actionText.includes('обнять')) {
		            bot.sendMessage(chatId, `🤗 ${userWhoActed} обнял ${targetUser}!`);
		        } else if (actionText.includes('поцеловать')) {
				        bot.sendMessage(chatId, `😘 ${userWhoActed} поцеловал ${targetUser}!`);
				    } else if (actionText.includes('пожать руку')) {
					            bot.sendMessage(chatId, `🤝 ${userWhoActed} пожал руку ${targetUser}!`);
					        } else if (actionText.includes('покормить')) {
							        bot.sendMessage(chatId, `🍽️ ${userWhoActed} покормил ${targetUser}!`);
							    } else if (actionText.includes('потеребить волосы')) {
								            bot.sendMessage(chatId, `💆‍♂️ ${userWhoActed} потеребил волосы ${targetUser}!`);
								        } else if (actionText.includes('приласкать')) {
										        bot.sendMessage(chatId, `😊 ${userWhoActed} приласкал ${targetUser}!`);
										    } else if (actionText.includes('успокоить')) {
											            bot.sendMessage(chatId, `🫂 ${userWhoActed} успокоил ${targetUser}!`);
											        } else if (actionText.includes('погладить')) {
													        bot.sendMessage(chatId, `🤗 ${userWhoActed} погладил ${targetUser}!`);
													    } else if (actionText.includes('поцеловать в лоб')) {
														            bot.sendMessage(chatId, `💋 ${userWhoActed} поцеловал ${targetUser} в лоб!`);
														        } else if (actionText.includes('поцеловать в щёку')) {
																        bot.sendMessage(chatId, `😘 ${userWhoActed} поцеловал ${targetUser} в щёку!`);
																    } else if (actionText.includes('погонять')) {
																	            bot.sendMessage(chatId, `🏃‍♂️ ${userWhoActed} погнал ${targetUser}!`);
																	        } else if (actionText.includes('позвать')) {
																			        bot.sendMessage(chatId, `📞 ${userWhoActed} позвал ${targetUser}!`);
																			    } else if (actionText.includes('сделать комплимент')) {
																				            bot.sendMessage(chatId, `💖 ${userWhoActed} сделал комплимент ${targetUser}!`);
																				        } else if (actionText.includes('подарить цветы')) {
																						        bot.sendMessage(chatId, `💐 ${userWhoActed} подарил цветы ${targetUser}!`);
																						    } else if (actionText.includes('погладить по голове')) {
																							            bot.sendMessage(chatId, `🧠 ${userWhoActed} погладил ${targetUser} по голове!`);
																							        } else if (actionText.includes('накормить')) {
																									        bot.sendMessage(chatId, `🍽️ ${userWhoActed} накормил ${targetUser}!`);
																									    } else if (actionText.includes('погладить спину')) {
																										            bot.sendMessage(chatId, `💆‍♀️ ${userWhoActed} погладил спину ${targetUser}!`);
																										        } else if (actionText.includes('обнять сзади')) {
																												        bot.sendMessage(chatId, `🙆‍♂️ ${userWhoActed} обнял ${targetUser} сзади!`);
																												    } else if (actionText.includes('поцеловать в шею')) {
																													            bot.sendMessage(chatId, `💋 ${userWhoActed} поцеловал ${targetUser} в шею!`);
																													        } else if (actionText.includes('прикоснуться к щеке')) {
																														      bot.sendMessage(chatId, `🥰 ${userWhoActed} прикоснулся к щеке ${targetUser}!`);
																														  } else if (actionText.includes('встряхнуть')) {
																														          bot.sendMessage(chatId, `👐 ${userWhoActed} встряхнул ${targetUser}!`);
																														      } else if (actionText.includes('позаботиться')) {
																														      bot.sendMessage(chatId, `💝 ${userWhoActed} позаботился о ${targetUser}!`);
																														  } else if (actionText.includes('обнять за талию')) {
																														          bot.sendMessage(chatId, `💃 ${userWhoActed} обнял ${targetUser} за талию!`);
																														      } else if (actionText.includes('покачать на руках')) {
																														      bot.sendMessage(chatId, `💪 ${userWhoActed} покачал ${targetUser} на руках!`);
																														  } else if (actionText.includes('сделать массаж')) {
																														          bot.sendMessage(chatId, `💆‍♂️ ${userWhoActed} сделал массаж ${targetUser}!`);
																														      } else if (actionText.includes('поцеловать в лобик')) {
																														      bot.sendMessage(chatId, `💋 ${userWhoActed} поцеловал ${targetUser} в лобик!`);
																														  } else if (actionText.includes('пожать плечо')) {
																														          bot.sendMessage(chatId, `💪 ${userWhoActed} пожал плечо ${targetUser}!`);
																														      }
});
