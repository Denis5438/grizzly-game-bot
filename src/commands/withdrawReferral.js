'use strict';

const { withdrawReferral } = require('../controllers/finance');
const { fromMinorUnits } = require('../utils/money');

// Вывод реферального баланса
async function handleWithdrawReferralCommand(ctx) {
	const args = ctx.message.text.split(' ');
	if (args.length < 2) {
		return ctx.reply('❌ Использование: /withdraw_referral <сумма>');
	}

	const amount = parseFloat(args[1]);
	if (isNaN(amount) || amount <= 0) {
		return ctx.reply('❌ Укажите корректную сумму для вывода');
	}

	const minorAmount = Math.round(amount * 100); // Конвертируем в копейки
	const user = ctx.state.user;

	if (user.referralBalance < minorAmount) {
		return ctx.reply(`❌ Недостаточно реферальных средств. Доступно: ${fromMinorUnits(user.referralBalance)} ₽`);
	}

	try {
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

module.exports = {
	handleWithdrawReferralCommand
};
