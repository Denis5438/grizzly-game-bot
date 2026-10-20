'use strict';

const { Schema, model, Types } = require('mongoose');

const TASK_STATUS = {
	OPEN: 'open',
	ASSIGNED: 'assigned',
	SUBMITTED: 'submitted',
	CONFIRMED: 'confirmed',
	CANCELLED: 'cancelled',
};

const AttachmentSchema = new Schema(
	{
		fileId: String, // Telegram file_id
		fileUniqueId: String,
		fileType: { type: String, enum: ['photo', 'document'], default: 'photo' },
	},
	{ _id: false }
);

const TaskSchema = new Schema(
	{
		creator: { type: Types.ObjectId, ref: 'User', required: true },
		executor: { type: Types.ObjectId, ref: 'User' },
		description: { type: String, required: true },
		productUrl: { type: String, required: true },
		purchaseAmount: { type: Number, required: true }, // minor units
		rewardAmount: { type: Number, required: true }, // minor units
		deadlineAt: { type: Date },
		attachments: { type: [AttachmentSchema], default: [] },
		status: { type: String, enum: Object.values(TASK_STATUS), default: TASK_STATUS.OPEN, index: true },
		executorSubmission: {
			orderNumber: { type: String },
			attachments: { type: [AttachmentSchema], default: [] },
			submittedAt: { type: Date },
		},
		confirmedAt: { type: Date },
		createdAt: { type: Date, default: Date.now },
	},
	{ versionKey: false }
);

module.exports = {
	Task: model('Task', TaskSchema),
	TASK_STATUS,
};




