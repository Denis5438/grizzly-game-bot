'use strict';

require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const { config, connectMongo } = require('./config');
const { logInfo, logError } = require('./utils/logger');
const { rateLimit } = require('./middlewares/rateLimit');
const { ensureUser } = require('./middlewares/ensureUser');

// Commands
const { handleStart, attachRoleHandlers } = require('./commands/start');
const { handleProfile } = require('./commands/profile');
const { handleCreateTask, handleCreateTaskMessage } = require('./commands/createTask');
const { handleTasks, handleAccept, handleSubmit, handleConfirm } = require('./commands/tasks');
const { handleWithdraw } = require('./commands/withdraw');
const { handleRate } = require('./commands/rate');
const { handleAdmin, handleAdminUsers, handleAdminTasks, handleAdminBalances, handleAdminBlocks, handleAdminPromos, handleAdminStats } = require('./commands/admin');
const { handleUsePromo, handleCreatePromo, handleListPromos, handleTogglePromo } = require('./commands/promo');
const { handleReferralStats, handleWithdrawReferral, handleReferralLink } = require('./commands/referral');
const { handleDeposit, handleDepositWithPromo } = require('./commands/deposit');
const { handleWithdrawReferralCommand } = require('./commands/withdrawReferral');
const { reward, depositWithFee, withdrawReferral } = require('./controllers/finance');
const { Task, TASK_STATUS } = require('./models/Task');

async function main() {
	if (!config.botToken) throw new Error('BOT_TOKEN is not set');
	await connectMongo();
	logInfo('MongoDB connected');

	const bot = new Telegraf(config.botToken);
	bot.use(session());
	bot.use(rateLimit({ windowMs: 2000, max: 6 }));
	bot.use(ensureUser);

	// Commands
	bot.start(handleStart);
	attachRoleHandlers(bot);
	bot.command('profile', handleProfile);
	bot.command('create_task', handleCreateTask);
	bot.on('text', handleCreateTaskMessage);
	bot.command('tasks', handleTasks);
	bot.command('accept', handleAccept);
	bot.command('submit', handleSubmit);
	bot.command('confirm', async (ctx) => {
		// On confirm, auto-credit reward to executor
		await handleConfirm(ctx);
		try {
			const taskId = String(ctx.message.text || '').split(' ')[1];
			const task = await Task.findById(taskId).populate('executor');
			if (task && task.status === TASK_STATUS.CONFIRMED && task.executor) {
				await reward(task.executor, task.rewardAmount, { taskId: task._id });
				await ctx.reply('Вознаграждение начислено исполнителю.');
			}
		} catch (e) {
			logError('Reward on confirm failed', e);
		}
	});
	bot.command('withdraw', handleWithdraw);
	bot.command('rate', handleRate);
	
	// Админ команды
	bot.command('admin', handleAdmin);
	
	// Промокоды
	bot.command('promo', handleUsePromo);
	bot.command('create_promo', handleCreatePromo);
	bot.command('list_promos', handleListPromos);
	bot.command('toggle_promo', handleTogglePromo);
	
	// Реферальная система
	bot.command('referral', handleReferralStats);
	bot.command('referral_link', handleReferralLink);
	
	// Пополнение баланса
	bot.command('deposit', handleDeposit);
	bot.command('deposit_promo', handleDepositWithPromo);
	
	// Вывод реферального баланса
	bot.command('withdraw_referral', handleWithdrawReferralCommand);
	
	// Обработчики inline кнопок
	bot.action('deposit', async (ctx) => {
		await ctx.answerCbQuery();
		return ctx.reply('💰 Для пополнения баланса обратитесь к администратору или используйте команду /deposit <сумма>');
	});
	
	bot.action('withdraw', async (ctx) => {
		await ctx.answerCbQuery();
		return ctx.reply('💸 Для вывода средств используйте команду /withdraw <сумма>');
	});
	
	bot.action('withdraw_referral', async (ctx) => {
		await ctx.answerCbQuery();
		return ctx.reply('💎 Для вывода реферального баланса используйте команду /withdraw_referral <сумма>');
	});
	
	// Админ панель
	bot.action('admin_users', handleAdminUsers);
	bot.action('admin_tasks', handleAdminTasks);
	bot.action('admin_balances', handleAdminBalances);
	bot.action('admin_blocks', handleAdminBlocks);
	bot.action('admin_promos', handleAdminPromos);
	bot.action('admin_stats', handleAdminStats);
	bot.action('admin_back', handleAdmin);

	// Launch
	if (config.webhookDomain) {
		const secretPath = `/telegraf/${bot.secretPathComponent()}`;
		await bot.telegram.setWebhook(`${config.webhookDomain}${secretPath}`);
		await bot.launch({ webhook: { domain: config.webhookDomain, hookPath: secretPath, port: config.port } });
		logInfo(`Bot webhook launched at ${config.webhookDomain}${secretPath}`);
	} else {
		await bot.launch();
		logInfo('Bot polling launched');
	}

	process.once('SIGINT', () => bot.stop('SIGINT'));
	process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((e) => {
	logError('Fatal', e);
	process.exit(1);
});




