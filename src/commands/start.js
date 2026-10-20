'use strict';

const { Markup } = require('telegraf');
const { setRole } = require('../controllers/users');
const { ROLES } = require('../models/User');
const { handleReferralCode } = require('./referral');

async function handleStart(ctx) {
	const user = ctx.state.user;
	
	// Обрабатываем реферальный код если он есть
	const startPayload = ctx.message.text.split(' ')[1];
	if (startPayload) {
		await handleReferralCode(ctx, startPayload);
	}
	
	const buttons = [
		[Markup.button.callback('Я Селлер', 'role:seller'), Markup.button.callback('Я Исполнитель', 'role:executor')],
	];
	
	const welcomeText = [
		'👋 Добро пожаловать в наш бот!',
		'',
		'Выберите роль или добавьте ещё одну роль в дальнейшем:',
		'',
		'🛒 Селлер - создает задания и платит за их выполнение',
		'⚡ Исполнитель - выполняет задания и получает оплату'
	].join('\n');
	
	await ctx.reply(welcomeText, Markup.inlineKeyboard(buttons));
}

async function attachRoleHandlers(bot) {
	bot.action(/role:(seller|executor)/, async (ctx) => {
		await ctx.answerCbQuery();
		const role = ctx.match[1] === 'seller' ? ROLES.SELLER : ROLES.EXECUTOR;
		await setRole(ctx.state.user, role);
		return ctx.reply(`Роль «${role}» добавлена. Используйте /profile, /create_task, /tasks, /withdraw, /rate.`);
	});
}

module.exports = { handleStart, attachRoleHandlers };




