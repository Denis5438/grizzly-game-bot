'use strict';

const { Schema, model, Types } = require('mongoose');

const TX_TYPE = {
	DEPOSIT: 'deposit',
	WITHDRAWAL: 'withdrawal',
	REWARD: 'reward',
	FEE: 'fee',
	REFERRAL_BONUS: 'referral_bonus',
	PROMO_BONUS: 'promo_bonus',
	REFERRAL_WITHDRAWAL: 'referral_withdrawal',
};

const TransactionSchema = new Schema(
	{
		user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
		type: { type: String, enum: Object.values(TX_TYPE), required: true },
		amount: { type: Number, required: true }, // minor units, positive numbers
		meta: { type: Object, default: {} },
		createdAt: { type: Date, default: Date.now },
	},
	{ versionKey: false }
);

module.exports = {
	Transaction: model('Transaction', TransactionSchema),
	TX_TYPE,
};




