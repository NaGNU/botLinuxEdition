const TelegramBot = require('node-telegram-bot-api');
const moment = require('moment');
const crypto = require('crypto');
const fs = require("fs");
require('dotenv').config();
const path = require("path");


const botToken = process.env.BOT_TOKEN;
const bot = new TelegramBot(botToken, { polling: true });

function loadAdmins() {
    try {
        const data = fs.readFileSync('admins.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Ошибка при загрузке списка администраторов:', error);
        return [];
    }
}

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


bot.onText(/\/python(?:\s+([\s\S]*))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const pythonCode = match[1]?.trim();

    if (!pythonCode) {
        bot.sendMessage(chatId, "Пожалуйста, укажите Python-код после команды /python");
        return;
    }

    if (pythonCode.length > 1000) {
        bot.sendMessage(chatId, "Ошибка: Код слишком длинный (максимум 1000 символов).");
        return;
    }

    const forbiddenPatterns = [
        /\bimport\s+os\b/,
        /\bimport\s+builtins\b/,
        /\bimport\s+pty\b/,
        /\bimport\s+shutil\b/,
        /\bimport\s+base64\b/,
        /\bimport\s+sys\b/,
        /\bimport\s+socket\b/,
        /\bimport\s+subprocess\b/,
        /\bimport\s+importlib\b/,
        /\bfrom\s+os\s+import\b/,
        /\bfrom\s+sys\s+import\b/,
        /\bfrom\s+subprocess\s+import\b/,
        /\bfrom\s+socket\s+import\b/,
        /\bfrom\s+shutil\s+import\b/,
        /\bfrom\s+base64\s+import\b/,
        /\bfrom\s+pty\s+import\b/,
        /\bfrom\s+builtins\s+import\b/,
        /\bfrom\s+importlib\s+import\b/,
        /\bexec\s*\(/,
        /\beval\s*\(/,
        /\bcompile\s*\(/,
        /\bopen\s*\(/,
        /\brmtree\s*\(/,
        /\bcopytree\s*\(/,
        /\bremove\s*\(/,
        /\bsystem\s*\(/,
        /\bpopen\s*\(/,
        /\b__import__\s*\(/,
        /\+.*['"]\s*import\s*['"]/,
        /['"]\s*\+\s*['"]/,
        /\b\$BOT_TOKEN\b/,
        /\.env\b/,
        /bot\.js\b/
    ];

    for (const pattern of forbiddenPatterns) {
        if (pattern.test(pythonCode)) {
            bot.sendMessage(chatId, "Ошибка: Обнаружен запрещенный код или ключевые слова.");
            return;
        }
    }

    const tempFilePath = path.join(__dirname, `temp_${Date.now()}.py`);
    const safePythonCode = `
try:
    __builtins__ = {}
    ${pythonCode}
except Exception as e:
    print("Ошибка выполнения:", str(e))
`.trim();

    fs.writeFileSync(tempFilePath, safePythonCode);

    const pythonCommand = `python3 "${tempFilePath}"`;

    const options = {
        timeout: 5000,
        maxBuffer: 1024 * 1024,
    };

    exec(pythonCommand, options, (error, stdout, stderr) => {
        fs.unlinkSync(tempFilePath); 

        if (error) {
            if (error.killed) {
                bot.sendMessage(chatId, "Ошибка: Выполнение кода превысило лимит времени (5 секунд).");
            } else {
                bot.sendMessage(chatId, `Ошибка выполнения: ${error.message}`);
            }
            return;
        }

        let output = (stdout + stderr).trim();

        if (!output) {
            bot.sendMessage(chatId, "Код выполнен, но вывода нет.");
            return;
        }

        const lines = output.split("\n");
        if (lines.length > 50) {
            output = lines.slice(0, 50).join("\n") + "\n... (вывод обрезан)";
        }

        bot.sendMessage(chatId, `\`\`\`\n${output}\n\`\`\``, { parse_mode: "Markdown" });
    });
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

bot.onText(/\/coinflip/, (msg) => {
  const result = Math.random() < 0.5 ? "🪙 Орёл" : "🪙 Решка";
  bot.sendMessage(msg.chat.id, result);
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
