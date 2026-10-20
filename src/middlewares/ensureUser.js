'use strict';

const { User } = require('../models/User');

async function ensureUser(ctx, next) {
	if (!ctx.from) return next();
	const telegramId = Number(ctx.from.id);
	let user = await User.findOne({ telegramId });
	if (!user) {
		user = await User.create({
			telegramId,
			username: ctx.from.username,
			firstName: ctx.from.first_name,
			lastName: ctx.from.last_name,
		});
	}
	ctx.state.user = user;
	return next();
}

module.exports = { ensureUser };




