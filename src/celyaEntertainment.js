const { Markup } = require('telegraf');

// 12 знаков зодиака
const ZODIAC_SIGNS = {
  'овен': { name: 'Овен', emoji: '♈', dates: '21 марта — 19 апреля' },
  'телец': { name: 'Телец', emoji: '♉', dates: '20 апреля — 20 мая' },
  'близнецы': { name: 'Близнецы', emoji: '♊', dates: '21 мая — 20 июня' },
  'рак': { name: 'Рак', emoji: '♋', dates: '21 июня — 22 июля' },
  'лев': { name: 'Лев', emoji: '♌', dates: '23 июля — 22 августа' },
  'дева': { name: 'Дева', emoji: '♍', dates: '23 августа — 22 сентября' },
  'весы': { name: 'Весы', emoji: '♎', dates: '23 сентября — 22 октября' },
  'скорпион': { name: 'Скорпион', emoji: '♏', dates: '23 октября — 21 ноября' },
  'стрелец': { name: 'Стрелец', emoji: '♐', dates: '22 ноября — 21 декабря' },
  'козерог': { name: 'Козерог', emoji: '♑', dates: '22 декабря — 19 января' },
  'водолей': { name: 'Водолей', emoji: '♒', dates: '20 января — 18 февраля' },
  'рыбы': { name: 'Рыбы', emoji: '♓', dates: '19 февраля — 20 марта' }
};

const HOROSCOPE_PHRASES = [
  'Звёзды сулят вам потрясающую ясность мысли и неожиданные приятные сюрпризы.',
  'Отличный день, чтобы проявить инициативу в любви или совместных начинаниях.',
  'Энергетический фон спокоен и гармоничен. Уделите внимание близким людям.',
  'Космические потоки благоволят финансовым делам и смелым решениям.',
  'Интуиция сегодня на максимуме — доверяйте внутреннему голосу и зову сердца.',
  'Сегодня прекрасный момент сделать шаг навстречу тому, о ком вы постоянно думаете.',
  'Будьте готовы к приятным новостям издалека или неожиданному подарку судьбы.',
  'День полон вдохновения и романтических искр. Не бойтесь открыться чувствам.'
];

const LOVE_ADVICES = [
  'Проявите заботу к вашей половинке — даже чашка чая или комплимент сотворят чудо.',
  'Время для глубокого разговора по душам, который сблизит вас еще сильнее.',
  'Ваша романтическая аура сегодня притягивает искренние симпатии и улыбки.',
  'Отправьте теплое сообщение любимому человеку — это поднимет настроение обоим.',
  'Идеальный вечер для романтического свидания или совместного отдыха.'
];

function getDailyHoroscope(signKey) {
  const sign = ZODIAC_SIGNS[signKey.toLowerCase()];
  if (!sign) return null;

  // Детерминированный псевдорандом от текущей даты и знака
  const today = new Date().toISOString().slice(0, 10);
  let hash = 0;
  const seed = today + signKey;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash);

  const phrase = HOROSCOPE_PHRASES[absHash % HOROSCOPE_PHRASES.length];
  const love = LOVE_ADVICES[(absHash >> 3) % LOVE_ADVICES.length];
  const luck = 70 + (absHash % 30);
  const luckyNum = (absHash % 28) + 1;
  const signsList = Object.keys(ZODIAC_SIGNS);
  const compatibleSign = ZODIAC_SIGNS[signsList[(absHash >> 5) % signsList.length]];

  return {
    ...sign,
    phrase,
    love,
    luck,
    luckyNum,
    compatibleSign: `${compatibleSign.emoji} ${compatibleSign.name}`
  };
}

// Магический шар ответов
const MAGIC_BALL_ANSWERS = [
  'Бесспорно ✨',
  'Это предрешено 🔮',
  'Знаки говорят «да» 💫',
  'Определенно да 🌟',
  'Можешь быть уверен в этом 🍀',
  'Мне кажется — да 💖',
  'Вероятнее всего 🕊️',
  'Хорошие перспективы 🌈',
  'Звёзды пока туманны 🌫️',
  'Спроси позже, вселенная колеблется ⏳',
  'Лучше не рассказывать сейчас 🤫',
  'Сконцентрируйся и спроси опять 🌀',
  'Даже не думай ⛔',
  'Мой ответ — нет ❌',
  'По моим данным — нет 🌘',
  'Перспективы не очень 🌧️',
  'Весьма сомнительно 🥀'
];

function getMagicBallAnswer() {
  return MAGIC_BALL_ANSWERS[Math.floor(Math.random() * MAGIC_BALL_ANSWERS.length)];
}

// Рандомайзер вероятностей
function getProbability(text) {
  let hash = 0;
  const clean = (text || '').trim().toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  const percent = Math.abs(hash) % 101;
  let comment = '';
  if (percent === 100) comment = 'Абсолютная точность, 100%! 💯';
  else if (percent >= 80) comment = 'Практически наверняка! 🚀';
  else if (percent >= 50) comment = 'Шансы весьма высоки! ✨';
  else if (percent >= 25) comment = 'Маловероятно, но шанс есть 🎲';
  else if (percent > 0) comment = 'Крайне сомнительно... 🤷';
  else comment = 'Шансов нет от слова совсем! ❌';

  return { percent, comment };
}

// Меню Помощи
function getHelpMainMenu() {
  const text =
    `✨ <b>ГЛАВНОЕ МЕНЮ ПОМОЩИ GRIZZLY BOT</b> ✨\n\n` +
    `Добро пожаловать в центр управления Grizzly Bot в стиле <b>Celestiana</b>!\n` +
    `Выберите интересующую вас категорию команд:`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('💖 Отношения и Семья', 'help_cat_relations')],
    [
      Markup.button.callback('🎲 Казино и Игры', 'help_cat_games'),
      Markup.button.callback('💰 Экономика', 'help_cat_economy')
    ],
    [
      Markup.button.callback('🎨 Canvas и Фото', 'help_cat_photo'),
      Markup.button.callback('🛡️ Модерация', 'help_cat_admin')
    ],
    [Markup.button.callback('🔮 Развлечения', 'help_cat_fun')]
  ]);

  return { text, keyboard };
}

function getHelpCategoryContent(category) {
  let text = '';

  switch (category) {
    case 'relations':
      text =
        `💖 <b>СИСТЕМА ОТНОШЕНИЙ И БРАКОВ (CELYA STYLE)</b>\n\n` +
        `<blockquote>` +
        `• <code>.отн запрос @ник</code> — Предложить вступить в отношения\n` +
        `• <code>.отн да</code> / <code>.отн нет</code> — Принять или отклонить предложение\n` +
        `• <code>.отн я</code> / <code>.отн профиль</code> — Визитка вашей пары и статистика\n` +
        `• <code>.отн действия</code> — Меню действий (30 уровней + Премиум)\n` +
        `• <code>.отн <действие></code> — Выполнить романтическое действие\n` +
        `• <code>.постель</code> — Уединиться для страсти и зачатия малыша\n` +
        `• <code>.узи</code> — Карточка УЗИ обследования беременности\n` +
        `• <code>.рб</code> — Меню детей и ухода за ребенком\n` +
        `• <code>.отн дом</code> — Совместное жилье пары и сейф\n` +
        `• <code>.отн банк</code> — Совместный банк пары\n` +
        `• <code>.отн топ</code> — Топ лучших пар сервера\n` +
        `• <code>.отн развод</code> — Расторгнуть брак\n` +
        `</blockquote>`;
      break;

    case 'games':
      text =
        `🎲 <b>КАЗИНО И ИНТЕРАКТИВНЫЕ ДУЭЛИ</b>\n\n` +
        `<blockquote>` +
        `• <code>.кости <ставка></code> — Бросок костей (2d6 против бота)\n` +
        `• <code>.монетка <о/р> <ставка></code> — Орел или решка\n` +
        `• <code>.блэкджек <ставка></code> (или <code>.бк</code>) — Игра в 21 с инлайн-кнопками\n` +
        `• <code>.кн @ник</code> — Дуэль в Крестики-Нолики 3х3\n` +
        `• <code>.аз слот <ставка></code> — Классические слоты 777\n` +
        `• <code>.аз рулетка <цвет> <ставка></code> — Европейская рулетка\n` +
        `</blockquote>\n` +
        `💡 <i>В качестве ставки можно писать: 100, 5к, 1м или «всё».</i>`;
      break;

    case 'economy':
      text =
        `💰 <b>ЭКОНОМИКА И ФИНАНСЫ</b>\n\n` +
        `<blockquote>` +
        `• <code>.аз баланс</code> / <code>.аз я</code> — Ваш профиль и печеньки 🍪\n` +
        `• <code>.аз банк</code> — Банковский счет и сейф\n` +
        `• <code>.аз банк с/п <сумма></code> — Снять или положить печеньки в банк\n` +
        `• <code>.аз перевод @ник <сумма></code> — Перевести печеньки игроку\n` +
        `• <code>.аз бонус</code> — Ежедневный бесплатный бонус\n` +
        `• <code>.аз топ</code> — Лидерборд богатейших игроков\n` +
        `</blockquote>`;
      break;

    case 'photo':
      text =
        `🎨 <b>CANVAS ГРАФИКА И ОБРАБОТКА ФОТО</b>\n\n` +
        `<blockquote>` +
        `• <code>.цитата</code> (в ответ на сообщение) — Генератор стильных карточек цитат\n` +
        `• <code>.демотиватор <текст> [/ <подтекст>]</code> (в ответ на фото) — Демотиватор\n` +
        `• <code>.чб</code> (в ответ на фото) — Черно-белый фильтр\n` +
        `• <code>.негатив</code> (в ответ на фото) — Инверсия цветов\n` +
        `• <code>.пиксель</code> (в ответ на фото) — Пиксель-арт эффект\n` +
        `• <code>.зерк</code> (в ответ на фото) — Зеркальное отражение фото\n` +
        `• <code>.блюр</code> (в ответ на фото) — Мягкое кинематографичное размытие\n` +
        `</blockquote>`;
      break;

    case 'admin':
      text =
        `🛡️ <b>МОДЕРАЦИЯ И АДМИНИСТРИРОВАНИЕ</b>\n\n` +
        `<blockquote>` +
        `• <code>.mute <время></code> (в ответ) — Временный мут нарушителя\n` +
        `• <code>.unmute</code> (в ответ) — Снять ограничение чата\n` +
        `• <code>.ban <время></code> (в ответ) — Блокировка пользователя в боте\n` +
        `• <code>.unban</code> (в ответ) — Разблокировать игрока\n` +
        `• <code>.пинг</code> — Проверка скорости отклика бота\n` +
        `</blockquote>`;
      break;

    case 'fun':
      text =
        `🔮 <b>РАЗВЛЕЧЕНИЯ И УТИЛИТЫ</b>\n\n` +
        `<blockquote>` +
        `• <code>.гороскоп <знак></code> — Точный ежедневный астропрогноз для 12 знаков\n` +
        `• <code>.шар <вопрос></code> — Мистический шар предсказаний\n` +
        `• <code>.инфа <текст></code> — Рассчитать вероятность любого события в %\n` +
        `• <code>.выбери <вар 1> или <вар 2></code> — Помощь бота в трудном выборе\n` +
        `• <code>.мойпол м/ж</code> — Установить свой пол для системы браков\n` +
        `</blockquote>`;
      break;

    default:
      return getHelpMainMenu();
  }

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('« Назад в главное меню', 'help_main')]
  ]);

  return { text, keyboard };
}

module.exports = {
  ZODIAC_SIGNS,
  getDailyHoroscope,
  getMagicBallAnswer,
  getProbability,
  getHelpMainMenu,
  getHelpCategoryContent
};
