'use strict';

const { User } = require('../models/User');
const { addReferralBonus } = require('../controllers/finance');
const { fromMinorUnits } = require('../utils/money');

// Обработка реферального кода при регистрации
async function handleReferralCode(ctx, referralCode) {
	if (!referralCode) return;

	const referrer = await User.findOne({ referralCode });
	if (!referrer) return;

	// Проверяем, что пользователь не приглашает сам себя
	if (referrer.telegramId === ctx.from.id) return;

	// Устанавливаем связь
	ctx.state.user.referredBy = referrer._id;
	await ctx.state.user.save();

	// Увеличиваем счетчик рефералов
	await referrer.addReferral();

	// Начисляем реферальный бонус (например, 50 рублей)
	const bonusAmount = 5000; // 50 рублей в копейках
	await addReferralBonus(referrer, bonusAmount, { 
		referredUser: ctx.state.user.telegramId,
		referralCode 
	});

	// Уведомляем реферера
	try {
		await ctx.telegram.sendMessage(
			referrer.telegramId,
			`🎉 У вас новый реферал!\nПользователь @${ctx.from.username || ctx.from.first_name} зарегистрировался по вашему коду.\nНачислен бонус: ${fromMinorUnits(bonusAmount)} ₽`
		);
	} catch (error) {
		// Игнорируем ошибки отправки сообщений
	}

	return true;
}

// Показать реферальную статистику
async function handleReferralStats(ctx) {
	const user = ctx.state.user;
	
	// Получаем список рефералов
	const referrals = await User.find({ referredBy: user._id })
		.select('telegramId username firstName createdAt')
		.sort({ createdAt: -1 });

	const text = [
		'👥 Реферальная статистика',
		'',
		`🔗 Ваш код: \`${user.referralCode}\``,
		`👥 Всего рефералов: ${user.referralCount}`,
		`💎 Реферальный баланс: ${fromMinorUnits(user.referralBalance)} ₽`,
		'',
		'📋 Ваши рефералы:'
	].join('\n');

	if (referrals.length === 0) {
		return ctx.reply(text + '\n\nПока нет рефералов', { parse_mode: 'Markdown' });
	}

	let referralsText = '';
	for (const ref of referrals.slice(0, 10)) { // Показываем только последних 10
		referralsText += `\n👤 @${ref.username || ref.firstName || ref.telegramId}`;
		referralsText += `\n📅 ${ref.createdAt.toLocaleDateString()}`;
	}

	if (referrals.length > 10) {
		referralsText += `\n\n... и еще ${referrals.length - 10} рефералов`;
	}

	const keyboard = {
		inline_keyboard: [
			[
				{ text: '💎 Вывести реферальный баланс', callback_data: 'withdraw_referral' }
			]
		]
	};

	return ctx.reply(text + referralsText, { 
		parse_mode: 'Markdown',
		reply_markup: keyboard 
	});
}

// Вывод реферального баланса
async function handleWithdrawReferral(ctx, amount) {
	const user = ctx.state.user;
	
	if (!amount || isNaN(amount) || amount <= 0) {
		return ctx.reply('❌ Укажите корректную сумму для вывода');
	}

	const minorAmount = Math.round(amount * 100); // Конвертируем в копейки

	if (user.referralBalance < minorAmount) {
		return ctx.reply(`❌ Недостаточно средств. Доступно: ${fromMinorUnits(user.referralBalance)} ₽`);
	}

	try {
		const { withdrawReferral } = require('../controllers/finance');
		const result = await withdrawReferral(user, minorAmount);
		
		const text = [
			'✅ Заявка на вывод реферального баланса создана',
			'',
			`💰 Сумма к выводу: ${fromMinorUnits(result.net)} ₽`,
			`💸 Комиссия (2%): ${fromMinorUnits(result.fee)} ₽`,
			`💎 Остаток реферального баланса: ${fromMinorUnits(result.referralBalance)} ₽`,
			'',
			'⏳ Ожидайте обработки модератором'
		].join('\n');

		return ctx.reply(text);
	} catch (error) {
		return ctx.reply(`❌ Ошибка: ${error.message}`);
	}
}

// Показать реферальную ссылку
async function handleReferralLink(ctx) {
	const user = ctx.state.user;
	
	// Генерируем реферальный код если его нет
	if (!user.referralCode) {
		user.referralCode = user.generateReferralCode();
		await user.save();
	}

	const text = [
		'🔗 Ваша реферальная ссылка:',
		'',
		`https://t.me/${ctx.botInfo.username}?start=${user.referralCode}`,
		'',
		'📋 Или просто поделитесь кодом:',
		`\`${user.referralCode}\``,
		'',
		'💰 За каждого реферала вы получаете 50 ₽ на реферальный баланс!'
	].join('\n');

	const keyboard = {
		inline_keyboard: [
			[
				{ text: '📤 Поделиться', url: `https://t.me/share/url?url=https://t.me/${ctx.botInfo.username}?start=${user.referralCode}&text=Присоединяйся%20к%20нашему%20боту!` }
			]
		]
	};

	return ctx.reply(text, { 
		parse_mode: 'Markdown',
		reply_markup: keyboard 
	});
}

module.exports = {
	handleReferralCode,
	handleReferralStats,
	handleWithdrawReferral,
	handleReferralLink
};
