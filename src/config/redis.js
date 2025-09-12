import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redis = new Redis(process.env.REDIS_URL, {
  tls: {}, // Required for Upstash TLS connection
});

redis.on('connect', () => {
  console.log('Connected to Upstash Redis!');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

export default redis;
