'use strict';

const { addReview } = require('../controllers/reviews');
const { Task } = require('../models/Task');

// Format: /rate <taskId> <toUserTelegramId> <score 1-5> <комментарий>

async function handleRate(ctx) {
	const parts = String(ctx.message.text || '').split(' ');
	const taskId = parts[1];
	const toTelegramId = Number(parts[2]);
	const score = Number(parts[3]);
	const comment = parts.slice(4).join(' ');
	if (!taskId || !toTelegramId || !score) {
		return ctx.reply('Формат: /rate <taskId> <toUserTelegramId> <1-5> <комментарий>');
	}
	if (score < 1 || score > 5) return ctx.reply('Оценка 1-5');
	const task = await Task.findById(taskId).populate(['creator', 'executor']);
	if (!task) return ctx.reply('Задание не найдено');
	const toUser = task.creator.telegramId === toTelegramId ? task.creator : task.executor;
	if (!toUser) return ctx.reply('Пользователь не найден');
	await addReview(ctx.state.user, toUser._id, task._id, score, comment);
	return ctx.reply('Отзыв добавлен');
}

module.exports = { handleRate };




