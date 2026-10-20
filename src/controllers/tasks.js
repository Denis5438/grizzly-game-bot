'use strict';

const { Task, TASK_STATUS } = require('../models/Task');

async function createTask(creator, payload) {
	const task = await Task.create({
		creator: creator._id,
		description: payload.description,
		productUrl: payload.productUrl,
		purchaseAmount: payload.purchaseAmount,
		rewardAmount: payload.rewardAmount,
		deadlineAt: payload.deadlineAt,
		attachments: payload.attachments || [],
	});
	return task;
}

async function listOpenTasks() {
	return Task.find({ status: TASK_STATUS.OPEN }).sort({ createdAt: -1 }).limit(50);
}

async function assignExecutor(taskId, executor) {
	const task = await Task.findById(taskId);
	if (!task || task.status !== TASK_STATUS.OPEN) throw new Error('Задание недоступно');
	task.executor = executor._id;
	task.status = TASK_STATUS.ASSIGNED;
	await task.save();
	return task;
}

async function submitWork(taskId, executor, submission) {
	const task = await Task.findById(taskId);
	if (!task || String(task.executor) !== String(executor._id)) throw new Error('Нет доступа');
	task.executorSubmission = {
		orderNumber: submission.orderNumber,
		attachments: submission.attachments || [],
		submittedAt: new Date(),
	};
	task.status = TASK_STATUS.SUBMITTED;
	await task.save();
	return task;
}

async function confirmTask(taskId, seller) {
	const task = await Task.findById(taskId);
	if (!task || String(task.creator) !== String(seller._id)) throw new Error('Нет доступа');
	task.status = TASK_STATUS.CONFIRMED;
	task.confirmedAt = new Date();
	await task.save();
	return task;
}

module.exports = { createTask, listOpenTasks, assignExecutor, submitWork, confirmTask };




