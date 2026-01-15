import { Provider } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const RedisProvider: Provider = {
    provide: REDIS_CLIENT,
    useFactory: () => {
        const client = new Redis({
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined,
            // Connection settings
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: false,
            // Reconnect strategy
            retryStrategy: (times: number) => {
                if (times > 10) {
                    console.error('[Redis] Max reconnection attempts reached');
                    return null;
                }
                return Math.min(times * 100, 3000);
            },
        });

        client.on('connect', () => {
            console.log('[Redis] Connected to Redis');
        });

        client.on('error', (err) => {
            console.error('[Redis] Connection error:', err.message);
        });

        client.on('reconnecting', () => {
            console.log('[Redis] Reconnecting...');
        });

        return client;
    },
};

