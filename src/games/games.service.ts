
import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import * as http from 'http';
import * as https from 'https';
import { REDIS_CLIENT } from '../common/redis/redis.provider';
import type Redis from 'ioredis';

@Injectable()
export class GamesService {
    private readonly apiUrl: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        @Inject(REDIS_CLIENT) private readonly redisClient: Redis
    ) {
        const url = this.configService.get<string>('API_URL_GAMES');
        if (!url) {
            throw new Error('FATAL: API_URL_GAMES is not defined in config');
        }
        this.apiUrl = url;
    }

    async getGames(productId: string) {
        const agentUsername = this.configService.get<string>('AGENT_USERNAME');
        const xApiKey = this.configService.get<string>('X_API_KEY');

        if (!agentUsername || !xApiKey) {
            throw new HttpException(
                'Missing API configuration',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }

        const auth = Buffer.from(`${agentUsername}:${xApiKey}`).toString('base64');
        const url = `${this.apiUrl}/seamless/games`;

        try {
            const response = await firstValueFrom(
                this.httpService.get(url, {
                    params: { productId },
                    headers: {
                        Authorization: `Basic ${auth}`,
                    },
                    httpAgent: new http.Agent({ family: 4 }),
                    httpsAgent: new https.Agent({ family: 4 }),
                }),
            );
            return response.data;
        } catch (error) {
            const axiosError = error as AxiosError;
            if (axiosError.response) {
                throw new HttpException(
                    axiosError.response.data as any,
                    axiosError.response.status,
                );
            }
            throw new HttpException(
                'Failed to fetch games',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
    async login(username: string, productId: string, gameCode: string, isMobileLogin: boolean = true, betLimit: any[] = [], gameName?: string, limit?: number) {
        const agentUsername = this.configService.get<string>('AGENT_USERNAME');
        const xApiKey = this.configService.get<string>('X_API_KEY');

        // Normalize username (Important for Seamless Wallet consistency)
        const normalizedUsername = username.toLowerCase();

        // Cache gameName mapping if provided
        if (gameName) {
            try {
                // Key format: game_name:{productId}:{gameCode}
                // TTL: 7 days (games don't change names often)
                await this.redisClient.setex(`game_name:${productId}:${gameCode}`, 604800, gameName);
            } catch (e) {
                console.error('Failed to cache gameName', e);
            }
        }

        if (!agentUsername || !xApiKey) {
            throw new HttpException(
                'Missing API configuration',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }

        const auth = Buffer.from(`${agentUsername}:${xApiKey}`).toString('base64');
        const url = `${this.apiUrl}/seamless/logIn`;

        // Generate sessionToken as UUID (matching doc example: "d4be70d1-349f-4fc1-a955-35d2a4bff244")
        const sessionToken = require('crypto').randomUUID();

        // Build payload exactly as per API documentation example
        const payload: any = {
            username: normalizedUsername,
            productId: productId,
            gameCode: gameCode,
            isMobileLogin: isMobileLogin,
            sessionToken: sessionToken,
            betLimit: betLimit || [], // Always include betLimit (empty array if not provided)
        };

        // Optional: limit - only add if provided
        if (typeof limit === 'number') {
            payload.limit = limit;
        }

        try {
            const response = await firstValueFrom(
                this.httpService.post(url, payload, {
                    headers: {
                        Authorization: `Basic ${auth}`,
                        'Content-Type': 'application/json',
                    },
                    httpAgent: new http.Agent({ family: 4 }),
                    httpsAgent: new https.Agent({ family: 4 }),
                }),
            );
            return response.data;
        } catch (error) {
            const axiosError = error as AxiosError;
            if (axiosError.response) {
                throw new HttpException(
                    axiosError.response.data as any,
                    axiosError.response.status,
                );
            }
            throw new HttpException(
                'Failed to login to game',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }


    async getBetTransactions(query: any) {
        const agentUsername = this.configService.get<string>('AGENT_USERNAME');
        const xApiKey = this.configService.get<string>('X_API_KEY');

        if (!agentUsername || !xApiKey) throw new HttpException('Missing API config', HttpStatus.INTERNAL_SERVER_ERROR);

        const auth = Buffer.from(`${agentUsername}:${xApiKey}`).toString('base64');
        const url = `${this.apiUrl}/seamless/betTransactionsV2`;

        try {
            const response = await firstValueFrom(
                this.httpService.get(url, {
                    params: query,
                    headers: { Authorization: `Basic ${auth}` },
                    httpAgent: new http.Agent({ family: 4 }),
                    httpsAgent: new https.Agent({ family: 4 }),
                }),
            );
            return response.data;
        } catch (error) {
            const axiosError = error as AxiosError;
            if (axiosError.response) throw new HttpException(axiosError.response.data as any, axiosError.response.status);
            throw new HttpException('Failed to fetch bet transactions', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getReplay(query: any) {
        const agentUsername = this.configService.get<string>('AGENT_USERNAME');
        const xApiKey = this.configService.get<string>('X_API_KEY');

        if (!agentUsername || !xApiKey) throw new HttpException('Missing API config', HttpStatus.INTERNAL_SERVER_ERROR);

        const auth = Buffer.from(`${agentUsername}:${xApiKey}`).toString('base64');
        const url = `${this.apiUrl}/seamless/betTransactionReplay`;

        try {
            const response = await firstValueFrom(
                this.httpService.get(url, {
                    params: query,
                    headers: { Authorization: `Basic ${auth}` },
                    httpAgent: new http.Agent({ family: 4 }),
                    httpsAgent: new https.Agent({ family: 4 }),
                }),
            );
            return response.data;
        } catch (error) {
            const axiosError = error as AxiosError;
            if (axiosError.response) throw new HttpException(axiosError.response.data as any, axiosError.response.status);
            throw new HttpException('Failed to fetch replay', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
