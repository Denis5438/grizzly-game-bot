'use strict';

const { listOpenTasks, assignExecutor, submitWork, confirmTask } = require('../controllers/tasks');
const { ROLES } = require('../models/User');

async function handleTasks(ctx) {
	const user = ctx.state.user;
	if (user.roles.includes(ROLES.EXECUTOR)) {
		const tasks = await listOpenTasks();
		if (!tasks.length) return ctx.reply('Пока нет открытых заданий.');
		const lines = tasks.map((t) => `${t._id} | ${t.description} | возн: ${t.rewardAmount / 100} ₽`);
		return ctx.reply('Доступные задания:\n' + lines.join('\n') + '\n\nОтклик: /accept <taskId>');
	}
	if (user.roles.includes(ROLES.SELLER)) {
		return ctx.reply('Как селлер, вы можете подтверждать: /confirm <taskId>');
	}
	return ctx.reply('Добавьте роль через /start');
}

async function handleAccept(ctx) {
	const taskId = String(ctx.message.text || '').split(' ')[1];
	if (!taskId) return ctx.reply('Укажите: /accept <taskId>');
	try {
		await assignExecutor(taskId, ctx.state.user);
		return ctx.reply('Задание принято. Отправьте отчёт: /submit <taskId> <orderNumber>');
	} catch (e) {
		return ctx.reply('Не удалось принять задание: ' + e.message);
	}
}

async function handleSubmit(ctx) {
	const parts = String(ctx.message.text || '').split(' ');
	const taskId = parts[1];
	const orderNumber = parts.slice(2).join(' ');
	if (!taskId || !orderNumber) return ctx.reply('Формат: /submit <taskId> <orderNumber>');
	try {
		await submitWork(taskId, ctx.state.user, { orderNumber });
		return ctx.reply('Отчёт отправлен. Ожидайте подтверждения.');
	} catch (e) {
		return ctx.reply('Ошибка: ' + e.message);
	}
}

async function handleConfirm(ctx) {
	const taskId = String(ctx.message.text || '').split(' ')[1];
	if (!taskId) return ctx.reply('Укажите: /confirm <taskId>');
	try {
		await confirmTask(taskId, ctx.state.user);
		return ctx.reply('Выполнение подтверждено. Вознаграждение будет зачислено.');
	} catch (e) {
		return ctx.reply('Ошибка подтверждения: ' + e.message);
	}
}

module.exports = { handleTasks, handleAccept, handleSubmit, handleConfirm };




