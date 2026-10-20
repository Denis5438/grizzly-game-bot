'use strict';

const { depositWithFee } = require('../controllers/finance');
const { fromMinorUnits } = require('../utils/money');
const { ROLES } = require('../models/User');

// Пополнение баланса
async function handleDeposit(ctx) {
	const args = ctx.message.text.split(' ');
	if (args.length < 2) {
		return ctx.reply('❌ Использование: /deposit <сумма>');
	}

	const amount = parseFloat(args[1]);
	if (isNaN(amount) || amount <= 0) {
		return ctx.reply('❌ Укажите корректную сумму для пополнения');
	}

	const minorAmount = Math.round(amount * 100); // Конвертируем в копейки
	const user = ctx.state.user;

	// Проверяем, является ли пользователь селлером
	if (!user.roles.includes(ROLES.SELLER)) {
		return ctx.reply('❌ Пополнение доступно только для селлеров. Добавьте роль селлера через /start');
	}

	try {
		const result = await depositWithFee(user, minorAmount, { 
			depositMethod: 'manual',
			adminApproved: true 
		});

		const text = [
			'✅ Баланс успешно пополнен!',
			'',
			`💰 Пополнено: ${fromMinorUnits(result.netAmount)} ₽`,
			`💸 Комиссия (0.5%): ${fromMinorUnits(result.fee)} ₽`,
			`💵 Итого на балансе: ${fromMinorUnits(result.balance)} ₽`
		].join('\n');

		return ctx.reply(text);
	} catch (error) {
		return ctx.reply(`❌ Ошибка пополнения: ${error.message}`);
	}
}

// Пополнение с промокодом
async function handleDepositWithPromo(ctx) {
	const args = ctx.message.text.split(' ');
	if (args.length < 3) {
		return ctx.reply('❌ Использование: /deposit_promo <сумма> <промокод>');
	}

	const amount = parseFloat(args[1]);
	const promoCode = args[2];

	if (isNaN(amount) || amount <= 0) {
		return ctx.reply('❌ Укажите корректную сумму для пополнения');
	}

	const minorAmount = Math.round(amount * 100);
	const user = ctx.state.user;

	if (!user.roles.includes(ROLES.SELLER)) {
		return ctx.reply('❌ Пополнение доступно только для селлеров');
	}

	try {
		// Сначала пополняем с комиссией
		const depositResult = await depositWithFee(user, minorAmount, { 
			depositMethod: 'manual',
			adminApproved: true,
			promoCode 
		});

		// Затем применяем промокод
		const { usePromoCode } = require('../controllers/finance');
		const promoResult = await usePromoCode(user, promoCode, minorAmount);

		const text = [
			'✅ Баланс пополнен с применением промокода!',
			'',
			`💰 Пополнено: ${fromMinorUnits(depositResult.netAmount)} ₽`,
			`💸 Комиссия (0.5%): ${fromMinorUnits(depositResult.fee)} ₽`,
			`🎁 Бонус от промокода: ${fromMinorUnits(promoResult.bonusAmount)} ₽`,
			`💵 Итого на балансе: ${fromMinorUnits(promoResult.balance)} ₽`
		].join('\n');

		return ctx.reply(text);
	} catch (error) {
		return ctx.reply(`❌ Ошибка: ${error.message}`);
	}
}

module.exports = {
	handleDeposit,
	handleDepositWithPromo
};
