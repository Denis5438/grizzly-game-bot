'use strict';

const { Schema, model, Types } = require('mongoose');

const PROMO_TYPE = {
	BONUS: 'bonus', // бонус при пополнении
	DISCOUNT: 'discount', // скидка
};

const PromoCodeSchema = new Schema(
	{
		code: { type: String, required: true, unique: true, index: true },
		type: { type: String, enum: Object.values(PROMO_TYPE), required: true },
		value: { type: Number, required: true }, // сумма бонуса или процент скидки
		maxUses: { type: Number, default: 1 }, // максимальное количество использований
		usedCount: { type: Number, default: 0 }, // количество использований
		usedBy: [{ type: Types.ObjectId, ref: 'User' }], // кто использовал
		createdBy: { type: Types.ObjectId, ref: 'User', required: true }, // кто создал
		expiresAt: { type: Date }, // дата истечения
		isActive: { type: Boolean, default: true },
		createdAt: { type: Date, default: Date.now },
	},
	{ versionKey: false }
);

PromoCodeSchema.methods.canBeUsed = function canBeUsed(userId) {
	if (!this.isActive) return false;
	if (this.expiresAt && this.expiresAt < new Date()) return false;
	if (this.usedCount >= this.maxUses) return false;
	if (this.usedBy.includes(userId)) return false;
	return true;
};

PromoCodeSchema.methods.use = function use(userId) {
	if (!this.canBeUsed(userId)) return false;
	this.usedCount += 1;
	this.usedBy.push(userId);
	return this.save();
};

module.exports = {
	PromoCode: model('PromoCode', PromoCodeSchema),
	PROMO_TYPE,
};
