'use strict';

const { Schema, model, Types } = require('mongoose');

const ROLES = {
	SELLER: 'seller',
	EXECUTOR: 'executor',
};

const UserSchema = new Schema(
	{
		telegramId: { type: Number, index: true, unique: true, required: true },
		username: { type: String },
		firstName: { type: String },
		lastName: { type: String },
		roles: { type: [String], enum: Object.values(ROLES), default: [] },
		isBlocked: { type: Boolean, default: false },
		rating: { type: Number, default: 0 },
		ratingCount: { type: Number, default: 0 },
		balance: { type: Number, default: 0 }, // in minor units (cents/kopecks)
		referralBalance: { type: Number, default: 0 }, // реферальный баланс
		referralCode: { type: String, unique: true, sparse: true }, // уникальный реферальный код пользователя
		referredBy: { type: Types.ObjectId, ref: 'User' }, // кто привел этого пользователя
		referralCount: { type: Number, default: 0 }, // количество приглашенных
		createdAt: { type: Date, default: Date.now },
	},
	{ versionKey: false }
);

UserSchema.methods.addRole = function addRole(role) {
	if (!this.roles.includes(role)) this.roles.push(role);
	return this.save();
};

UserSchema.methods.updateRating = function updateRating(newScore) {
	const total = this.rating * this.ratingCount + newScore;
	this.ratingCount += 1;
	this.rating = Math.round((total / this.ratingCount) * 100) / 100;
	return this.save();
};

UserSchema.methods.generateReferralCode = function generateReferralCode() {
	if (!this.referralCode) {
		this.referralCode = `REF${this.telegramId}${Date.now().toString().slice(-4)}`;
	}
	return this.referralCode;
};

UserSchema.methods.addReferral = function addReferral() {
	this.referralCount += 1;
	return this.save();
};

module.exports = {
	User: model('User', UserSchema),
	ROLES,
};




