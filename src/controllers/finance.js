'use strict';

const { Transaction, TX_TYPE } = require('../models/Transaction');
const { User } = require('../models/User');
const { PromoCode } = require('../models/PromoCode');
const { calcWithdrawalNet } = require('../utils/money');

async function deposit(user, minorAmount, meta) {
	user.balance += Number(minorAmount);
	await user.save();
	await Transaction.create({ user: user._id, type: TX_TYPE.DEPOSIT, amount: minorAmount, meta: meta || {} });
	return user.balance;
}

async function reward(executor, minorAmount, meta) {
	executor.balance += Number(minorAmount);
	await executor.save();
	await Transaction.create({ user: executor._id, type: TX_TYPE.REWARD, amount: minorAmount, meta: meta || {} });
	return executor.balance;
}

async function withdraw(user, minorAmount) {
	minorAmount = Number(minorAmount);
	if (user.balance < minorAmount) throw new Error('Недостаточно средств');
	const { net, fee } = calcWithdrawalNet(minorAmount);
	user.balance -= minorAmount;
	await user.save();
	await Transaction.create({ user: user._id, type: TX_TYPE.WITHDRAWAL, amount: net, meta: { fee } });
	if (fee > 0) await Transaction.create({ user: user._id, type: TX_TYPE.FEE, amount: fee, meta: { of: 'withdrawal' } });
	return { net, fee, balance: user.balance };
}

// Пополнение с комиссией для селлеров (0.5%)
async function depositWithFee(user, minorAmount, meta) {
	minorAmount = Number(minorAmount);
	const fee = Math.round(minorAmount * 0.005); // 0.5% комиссия
	const netAmount = minorAmount - fee;
	
	user.balance += netAmount;
	await user.save();
	
	await Transaction.create({ user: user._id, type: TX_TYPE.DEPOSIT, amount: netAmount, meta: { ...meta, fee, originalAmount: minorAmount } });
	if (fee > 0) {
		await Transaction.create({ user: user._id, type: TX_TYPE.FEE, amount: fee, meta: { of: 'deposit' } });
	}
	
	return { netAmount, fee, balance: user.balance };
}

// Вывод реферального баланса
async function withdrawReferral(user, minorAmount) {
	minorAmount = Number(minorAmount);
	if (user.referralBalance < minorAmount) throw new Error('Недостаточно реферальных средств');
	
	const { net, fee } = calcWithdrawalNet(minorAmount);
	user.referralBalance -= minorAmount;
	await user.save();
	
	await Transaction.create({ user: user._id, type: TX_TYPE.REFERRAL_WITHDRAWAL, amount: net, meta: { fee } });
	if (fee > 0) {
		await Transaction.create({ user: user._id, type: TX_TYPE.FEE, amount: fee, meta: { of: 'referral_withdrawal' } });
	}
	
	return { net, fee, referralBalance: user.referralBalance };
}

// Начисление реферального бонуса
async function addReferralBonus(user, minorAmount, meta) {
	user.referralBalance += Number(minorAmount);
	await user.save();
	await Transaction.create({ user: user._id, type: TX_TYPE.REFERRAL_BONUS, amount: minorAmount, meta: meta || {} });
	return user.referralBalance;
}

// Использование промокода
async function usePromoCode(user, promoCode, depositAmount = 0) {
	const promo = await PromoCode.findOne({ code: promoCode });
	if (!promo) throw new Error('Промокод не найден');
	if (!promo.canBeUsed(user._id)) throw new Error('Промокод не может быть использован');
	
	let bonusAmount = 0;
	if (promo.type === 'bonus') {
		bonusAmount = promo.value;
	} else if (promo.type === 'discount' && depositAmount > 0) {
		bonusAmount = Math.round(depositAmount * (promo.value / 100));
	}
	
	if (bonusAmount > 0) {
		user.balance += bonusAmount;
		await user.save();
		await Transaction.create({ 
			user: user._id, 
			type: TX_TYPE.PROMO_BONUS, 
			amount: bonusAmount, 
			meta: { promoCode: promo.code, promoType: promo.type } 
		});
	}
	
	await promo.use(user._id);
	return { bonusAmount, balance: user.balance };
}

module.exports = { 
	deposit, 
	reward, 
	withdraw, 
	depositWithFee, 
	withdrawReferral, 
	addReferralBonus, 
	usePromoCode 
};




