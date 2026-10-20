'use strict';

const { User, ROLES } = require('../models/User');
const { Review } = require('../models/Review');

async function setRole(user, role) {
	if (!Object.values(ROLES).includes(role)) throw new Error('Invalid role');
	await user.addRole(role);
	return user;
}

async function profileSummary(user) {
	const reviewsCount = await Review.countDocuments({ toUser: user._id });
	return {
		telegramId: user.telegramId,
		username: user.username,
		roles: user.roles,
		rating: user.rating,
		ratingCount: user.ratingCount,
		balance: user.balance,
		reviewsCount,
	};
}

module.exports = { setRole, profileSummary };




