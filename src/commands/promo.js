'use strict';

const { PromoCode, PROMO_TYPE } = require('../models/PromoCode');
const { usePromoCode } = require('../controllers/finance');
const { isAdmin } = require('./admin');

// Использование промокода
async function handleUsePromo(ctx) {
	const args = ctx.message.text.split(' ');
	if (args.length < 2) {
		return ctx.reply('❌ Использование: /promo <код>');
	}

	const promoCode = args[1];
	
	try {
		const result = await usePromoCode(ctx.state.user, promoCode);
		
		if (result.bonusAmount > 0) {
			return ctx.reply(`✅ Промокод применен! Начислено: ${result.bonusAmount / 100} ₽`);
		} else {
			return ctx.reply('✅ Промокод применен, но бонус не начислен');
		}
	} catch (error) {
		return ctx.reply(`❌ Ошибка: ${error.message}`);
	}
}

// Создание промокода (только для админов)
async function handleCreatePromo(ctx) {
	if (!isAdmin(ctx.from.id)) {
		return ctx.reply('❌ У вас нет прав для создания промокодов');
	}

	const args = ctx.message.text.split(' ');
	if (args.length < 4) {
		return ctx.reply('❌ Использование: /create_promo <код> <тип> <значение> [макс_использований]');
	}

	const code = args[1];
	const type = args[2];
	const value = parseInt(args[3]);
	const maxUses = args[4] ? parseInt(args[4]) : 1;

	if (!Object.values(PROMO_TYPE).includes(type)) {
		return ctx.reply('❌ Неверный тип промокода. Доступные: bonus, discount');
	}

	if (isNaN(value) || value <= 0) {
		return ctx.reply('❌ Неверное значение промокода');
	}

	try {
		const promo = await PromoCode.create({
			code,
			type,
			value,
			maxUses,
			createdBy: ctx.state.user._id
		});

		return ctx.reply(`✅ Промокод создан:\nКод: ${promo.code}\nТип: ${promo.type}\nЗначение: ${promo.value}\nМакс. использований: ${promo.maxUses}`);
	} catch (error) {
		if (error.code === 11000) {
			return ctx.reply('❌ Промокод с таким кодом уже существует');
		}
		return ctx.reply(`❌ Ошибка создания промокода: ${error.message}`);
	}
}

// Список промокодов (только для админов)
async function handleListPromos(ctx) {
	if (!isAdmin(ctx.from.id)) {
		return ctx.reply('❌ У вас нет прав для просмотра промокодов');
	}

	const promos = await PromoCode.find().sort({ createdAt: -1 }).limit(20);
	
	if (promos.length === 0) {
		return ctx.reply('📝 Промокодов не найдено');
	}

	let text = '🎫 Последние промокоды:\n\n';
	
	for (const promo of promos) {
		const status = promo.isActive ? '🟢' : '🔴';
		const expires = promo.expiresAt ? `\nИстекает: ${promo.expiresAt.toLocaleDateString()}` : '';
		
		text += `${status} ${promo.code}\n`;
		text += `Тип: ${promo.type}\n`;
		text += `Значение: ${promo.value}\n`;
		text += `Использований: ${promo.usedCount}/${promo.maxUses}${expires}\n\n`;
	}

	return ctx.reply(text);
}

// Активация/деактивация промокода (только для админов)
async function handleTogglePromo(ctx) {
	if (!isAdmin(ctx.from.id)) {
		return ctx.reply('❌ У вас нет прав для управления промокодами');
	}

	const args = ctx.message.text.split(' ');
	if (args.length < 2) {
		return ctx.reply('❌ Использование: /toggle_promo <код>');
	}

	const code = args[1];
	
	try {
		const promo = await PromoCode.findOne({ code });
		if (!promo) {
			return ctx.reply('❌ Промокод не найден');
		}

		promo.isActive = !promo.isActive;
		await promo.save();

		const status = promo.isActive ? 'активирован' : 'деактивирован';
		return ctx.reply(`✅ Промокод ${promo.code} ${status}`);
	} catch (error) {
		return ctx.reply(`❌ Ошибка: ${error.message}`);
	}
}

module.exports = {
	handleUsePromo,
	handleCreatePromo,
	handleListPromos,
	handleTogglePromo
};
