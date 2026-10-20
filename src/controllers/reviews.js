'use strict';

const { Review } = require('../models/Review');
const { User } = require('../models/User');

async function addReview(fromUser, toUserId, taskId, score, comment) {
	const review = await Review.create({ fromUser: fromUser._id, toUser: toUserId, task: taskId, score, comment });
	const toUser = await User.findById(toUserId);
	if (toUser) await toUser.updateRating(score);
	return review;
}

module.exports = { addReview };




