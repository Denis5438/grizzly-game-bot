'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const config = {
	botToken: process.env.BOT_TOKEN,
	mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/market-platform',
	adminUserId: process.env.ADMIN_USER_ID ? Number(process.env.ADMIN_USER_ID) : undefined,
	port: process.env.PORT ? Number(process.env.PORT) : 3000,
	webhookDomain: process.env.WEBHOOK_DOMAIN || '',
};

async function connectMongo() {
	if (!config.mongoUri) {
		throw new Error('MONGODB_URI is not set');
	}
	mongoose.set('strictQuery', true);
	await mongoose.connect(config.mongoUri, { autoIndex: true });
	return mongoose.connection;
}

module.exports = { config, connectMongo };




