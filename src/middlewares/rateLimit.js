'use strict';

// Simple in-memory rate limit: max N actions per window per user

const buckets = new Map(); // key: telegramId -> { count, windowStart }

function rateLimit(options) {
	const { windowMs = 3000, max = 5 } = options || {};
	return async (ctx, next) => {
		const key = ctx.from?.id || 'anon';
		const now = Date.now();
		const entry = buckets.get(key) || { count: 0, windowStart: now };
		if (now - entry.windowStart > windowMs) {
			entry.count = 0;
			entry.windowStart = now;
		}
		entry.count += 1;
		buckets.set(key, entry);
		if (entry.count > max) {
			return ctx.reply('Слишком часто. Попробуйте позже.');
		}
		return next();
	};
}

module.exports = { rateLimit };




