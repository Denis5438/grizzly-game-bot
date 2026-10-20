'use strict';

const { Schema, model, Types } = require('mongoose');

const ReviewSchema = new Schema(
	{
		fromUser: { type: Types.ObjectId, ref: 'User', required: true },
		toUser: { type: Types.ObjectId, ref: 'User', required: true, index: true },
		task: { type: Types.ObjectId, ref: 'Task', required: true },
		score: { type: Number, min: 1, max: 5, required: true },
		comment: { type: String },
		createdAt: { type: Date, default: Date.now },
	},
	{ versionKey: false }
);

module.exports = {
	Review: model('Review', ReviewSchema),
};




