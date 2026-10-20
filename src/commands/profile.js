'use strict';

const { profileSummary } = require('../controllers/users');
const { fromMinorUnits } = require('../utils/money');

async function handleProfile(ctx) {
	const summary = await profileSummary(ctx.state.user);
	
	// Генерируем реферальный код если его нет
	if (!summary.referralCode) {
		summary.referralCode = ctx.state.user.generateReferralCode();
		await ctx.state.user.save();
	}
	
	const text = [
		`👤 Профиль`,
		`ID: ${summary.telegramId}`,
		`Ник: @${summary.username || '—'}`,
		`Роли: ${summary.roles?.join(', ') || '—'}`,
		`Рейтинг: ${summary.rating} (${summary.ratingCount})`,
		``,
		`💰 Балансы:`,
		`Основной: ${fromMinorUnits(summary.balance)} ₽`,
		`Реферальный: ${fromMinorUnits(summary.referralBalance || 0)} ₽`,
		``,
		`📊 Статистика:`,
		`Отзывов: ${summary.reviewsCount}`,
		`Рефералов: ${summary.referralCount || 0}`,
		``,
		`🔗 Реферальный код:`,
		`\`${summary.referralCode}\``,
	].join('\n');
	
	const keyboard = {
		inline_keyboard: [
			[
				{ text: '💰 Пополнить', callback_data: 'deposit' },
				{ text: '💸 Вывести', callback_data: 'withdraw' }
			],
			[
				{ text: '💎 Вывести реферальный', callback_data: 'withdraw_referral' }
			]
		]
	};
	
	return ctx.reply(text, { 
		parse_mode: 'Markdown',
		reply_markup: keyboard 
	});
}

module.exports = { handleProfile };




