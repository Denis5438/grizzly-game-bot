'use strict';

const { createTask } = require('../controllers/tasks');
const { ROLES } = require('../models/User');
const { toMinorUnits } = require('../utils/money');

// Minimal text-based flow via one message with semicolon-separated fields
// Format: описание; ссылка; сумма_покупки; вознаграждение; дедлайн(YYYY-MM-DD)

async function handleCreateTask(ctx) {
	const user = ctx.state.user;
	if (!user.roles.includes(ROLES.SELLER)) return ctx.reply('Доступно только селлерам. Добавьте роль через /start');
	await ctx.reply('Отправьте одним сообщением поля через ";":\nописание; ссылка; сумма_покупки; вознаграждение; дедлайн(YYYY-MM-DD или пусто)');
	ctx.session ??= {};
	ctx.session.awaitingCreateTask = true;
}

async function handleCreateTaskMessage(ctx) {
	if (!ctx.session?.awaitingCreateTask) return false;
	ctx.session.awaitingCreateTask = false;
	const parts = String(ctx.message.text || '').split(';').map((s) => s.trim());
	if (parts.length < 4) return ctx.reply('Неверный формат. Попробуйте снова: описание; ссылка; сумма; вознаграждение; дедлайн');
	const [description, productUrl, purchaseStr, rewardStr, deadlineStr] = parts;
	const purchaseAmount = toMinorUnits(purchaseStr);
	const rewardAmount = toMinorUnits(rewardStr);
	const deadlineAt = deadlineStr ? new Date(deadlineStr) : undefined;
	try {
		const task = await createTask(ctx.state.user, { description, productUrl, purchaseAmount, rewardAmount, deadlineAt });
		return ctx.reply(`Задание создано: ${task._id}`);
	} catch (e) {
		return ctx.reply('Ошибка создания задания. Проверьте данные.');
	}
}

module.exports = { handleCreateTask, handleCreateTaskMessage };




