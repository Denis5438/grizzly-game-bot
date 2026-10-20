'use strict';

const COMMISSION_PCT = 4; // percent

function toMinorUnits(amount) {
	// Accepts number in major units (e.g. RUB) and converts to minor (kopecks)
	return Math.round(Number(amount) * 100);
}

function fromMinorUnits(minor) {
	return Math.round(Number(minor)) / 100;
}

function calcWithdrawalNet(minorAmount) {
	const fee = Math.round((Number(minorAmount) * COMMISSION_PCT) / 100);
	const net = Math.max(0, Number(minorAmount) - fee);
	return { net, fee };
}

module.exports = { toMinorUnits, fromMinorUnits, calcWithdrawalNet, COMMISSION_PCT };




