'use strict';

const { withdraw } = require('../controllers/finance');
const { toMinorUnits, fromMinorUnits, COMMISSION_PCT } = require('../utils/money');
const { ROLES } = require('../models/User');

async function handleWithdraw(ctx) {
	const user = ctx.state.user;
	if (!user.roles.includes(ROLES.EXECUTOR)) return ctx.reply('Доступно только исполнителям.');
	const amountStr = String(ctx.message.text || '').split(' ')[1];
	if (!amountStr) return ctx.reply('Формат: /withdraw <сумма>');
	const minorAmount = toMinorUnits(amountStr);
	try {
		const { net, fee, balance } = await withdraw(user, minorAmount);
		return ctx.reply(`Заявка на вывод: сумма ${fromMinorUnits(minorAmount)} ₽, комиссия ${fromMinorUnits(fee)} ₽ (${COMMISSION_PCT}%), к получению ${fromMinorUnits(net)} ₽. Остаток: ${fromMinorUnits(balance)} ₽`);
	} catch (e) {
		return ctx.reply('Ошибка: ' + e.message);
	}
}

module.exports = { handleWithdraw };




