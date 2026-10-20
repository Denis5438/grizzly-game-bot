'use strict';

const { User } = require('../models/User');
const { Task, TASK_STATUS } = require('../models/Task');
const { Transaction } = require('../models/Transaction');
const { PromoCode } = require('../models/PromoCode');
const { fromMinorUnits } = require('../utils/money');
const { config } = require('../config');

// Проверка админ прав
function isAdmin(userId) {
	return config.adminUserId && userId === config.adminUserId;
}

// Главное меню админ панели
async function handleAdmin(ctx) {
	if (!isAdmin(ctx.from.id)) {
		return ctx.reply('❌ У вас нет прав администратора');
	}

	const text = [
		'🔧 Админ панель',
		'',
		'Выберите действие:'
	].join('\n');

	const keyboard = {
		inline_keyboard: [
			[
				{ text: '👥 Пользователи', callback_data: 'admin_users' },
				{ text: '📋 Задания', callback_data: 'admin_tasks' }
			],
			[
				{ text: '💰 Балансы', callback_data: 'admin_balances' },
				{ text: '🔒 Блокировки', callback_data: 'admin_blocks' }
			],
			[
				{ text: '🎫 Промокоды', callback_data: 'admin_promos' },
				{ text: '📊 Статистика', callback_data: 'admin_stats' }
			]
		]
	};

	return ctx.reply(text, { reply_markup: keyboard });
}

// Список пользователей
async function handleAdminUsers(ctx) {
	if (!isAdmin(ctx.from.id)) return;

	const users = await User.find().sort({ createdAt: -1 }).limit(20);
	
	let text = '👥 Последние 20 пользователей:\n\n';
	
	for (const user of users) {
		const status = user.isBlocked ? '🔴' : '🟢';
		text += `${status} ID: ${user.telegramId}\n`;
		text += `Ник: @${user.username || '—'}\n`;
		text += `Роли: ${user.roles.join(', ') || '—'}\n`;
		text += `Баланс: ${fromMinorUnits(user.balance)} ₽\n`;
		text += `Рефералов: ${user.referralCount}\n`;
		text += `Создан: ${user.createdAt.toLocaleDateString()}\n\n`;
	}

	const keyboard = {
		inline_keyboard: [
			[{ text: '◀️ Назад', callback_data: 'admin_back' }]
		]
	};

	return ctx.reply(text, { reply_markup: keyboard });
}

// Список заданий
async function handleAdminTasks(ctx) {
	if (!isAdmin(ctx.from.id)) return;

	const tasks = await Task.find()
		.populate('creator', 'telegramId username')
		.populate('executor', 'telegramId username')
		.sort({ createdAt: -1 })
		.limit(10);

	let text = '📋 Последние 10 заданий:\n\n';

	for (const task of tasks) {
		const statusEmoji = {
			[TASK_STATUS.OPEN]: '🟡',
			[TASK_STATUS.ASSIGNED]: '🔵',
			[TASK_STATUS.SUBMITTED]: '🟠',
			[TASK_STATUS.CONFIRMED]: '🟢',
			[TASK_STATUS.CANCELLED]: '🔴'
		};

		text += `${statusEmoji[task.status]} ID: ${task._id}\n`;
		text += `Создатель: @${task.creator.username || task.creator.telegramId}\n`;
		text += `Исполнитель: ${task.executor ? `@${task.executor.username || task.executor.telegramId}` : '—'}\n`;
		text += `Награда: ${fromMinorUnits(task.rewardAmount)} ₽\n`;
		text += `Статус: ${task.status}\n\n`;
	}

	const keyboard = {
		inline_keyboard: [
			[{ text: '◀️ Назад', callback_data: 'admin_back' }]
		]
	};

	return ctx.reply(text, { reply_markup: keyboard });
}

// Балансы пользователей
async function handleAdminBalances(ctx) {
	if (!isAdmin(ctx.from.id)) return;

	const users = await User.find().sort({ balance: -1 }).limit(10);
	
	let text = '💰 Топ-10 по балансу:\n\n';
	
	for (const user of users) {
		text += `👤 @${user.username || user.telegramId}\n`;
		text += `Основной: ${fromMinorUnits(user.balance)} ₽\n`;
		text += `Реферальный: ${fromMinorUnits(user.referralBalance)} ₽\n\n`;
	}

	const keyboard = {
		inline_keyboard: [
			[{ text: '◀️ Назад', callback_data: 'admin_back' }]
		]
	};

	return ctx.reply(text, { reply_markup: keyboard });
}

// Управление блокировками
async function handleAdminBlocks(ctx) {
	if (!isAdmin(ctx.from.id)) return;

	const blockedUsers = await User.find({ isBlocked: true });
	
	let text = '🔒 Заблокированные пользователи:\n\n';
	
	if (blockedUsers.length === 0) {
		text += 'Нет заблокированных пользователей';
	} else {
		for (const user of blockedUsers) {
			text += `👤 @${user.username || user.telegramId}\n`;
			text += `ID: ${user.telegramId}\n\n`;
		}
	}

	const keyboard = {
		inline_keyboard: [
			[{ text: '◀️ Назад', callback_data: 'admin_back' }]
		]
	};

	return ctx.reply(text, { reply_markup: keyboard });
}

// Управление промокодами
async function handleAdminPromos(ctx) {
	if (!isAdmin(ctx.from.id)) return;

	const promos = await PromoCode.find().sort({ createdAt: -1 }).limit(10);
	
	let text = '🎫 Последние 10 промокодов:\n\n';
	
	for (const promo of promos) {
		const status = promo.isActive ? '🟢' : '🔴';
		text += `${status} ${promo.code}\n`;
		text += `Тип: ${promo.type}\n`;
		text += `Значение: ${promo.value}\n`;
		text += `Использований: ${promo.usedCount}/${promo.maxUses}\n`;
		text += `Создан: ${promo.createdAt.toLocaleDateString()}\n\n`;
	}

	const keyboard = {
		inline_keyboard: [
			[
				{ text: '➕ Создать промокод', callback_data: 'admin_create_promo' }
			],
			[
				{ text: '◀️ Назад', callback_data: 'admin_back' }
			]
		]
	};

	return ctx.reply(text, { reply_markup: keyboard });
}

// Статистика
async function handleAdminStats(ctx) {
	if (!isAdmin(ctx.from.id)) return;

	const totalUsers = await User.countDocuments();
	const totalTasks = await Task.countDocuments();
	const totalTransactions = await Transaction.countDocuments();
	const totalPromos = await PromoCode.countDocuments();
	
	const totalBalance = await User.aggregate([
		{ $group: { _id: null, total: { $sum: '$balance' } } }
	]);
	
	const totalReferralBalance = await User.aggregate([
		{ $group: { _id: null, total: { $sum: '$referralBalance' } } }
	]);

	const text = [
		'📊 Статистика системы:',
		'',
		`👥 Всего пользователей: ${totalUsers}`,
		`📋 Всего заданий: ${totalTasks}`,
		`💰 Всего транзакций: ${totalTransactions}`,
		`🎫 Всего промокодов: ${totalPromos}`,
		'',
		`💵 Общий баланс: ${fromMinorUnits(totalBalance[0]?.total || 0)} ₽`,
		`💎 Общий реферальный баланс: ${fromMinorUnits(totalReferralBalance[0]?.total || 0)} ₽`
	].join('\n');

	const keyboard = {
		inline_keyboard: [
			[{ text: '◀️ Назад', callback_data: 'admin_back' }]
		]
	};

	return ctx.reply(text, { reply_markup: keyboard });
}

// Блокировка/разблокировка пользователя
async function handleBlockUser(ctx, userId, action) {
	if (!isAdmin(ctx.from.id)) return;

	const user = await User.findOne({ telegramId: userId });
	if (!user) {
		return ctx.reply('❌ Пользователь не найден');
	}

	user.isBlocked = action === 'block';
	await user.save();

	const actionText = action === 'block' ? 'заблокирован' : 'разблокирован';
	return ctx.reply(`✅ Пользователь @${user.username || user.telegramId} ${actionText}`);
}

module.exports = {
	handleAdmin,
	handleAdminUsers,
	handleAdminTasks,
	handleAdminBalances,
	handleAdminBlocks,
	handleAdminPromos,
	handleAdminStats,
	handleBlockUser,
	isAdmin
};
