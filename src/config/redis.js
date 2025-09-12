
import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redis = new Redis(process.env.UPSTASH_REDIS_REST_URL, {
	password: process.env.UPSTASH_REDIS_REST_TOKEN,
	tls: {},
});

redis.on('connect', () => {
	console.log('Connected to Upstash Redis!');
});

redis.on('error', (err) => {
	console.error('Redis connection error:', err);
});

export default redis;
