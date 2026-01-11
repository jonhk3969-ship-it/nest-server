
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import * as http from 'http';
import * as https from 'https';

@Injectable()
export class GamesService {
    private readonly apiUrl: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
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
    async login(username: string, productId: string, gameCode: string, isMobileLogin: boolean = true, betLimit: any[] = []) {
        const agentUsername = this.configService.get<string>('AGENT_USERNAME');
        const xApiKey = this.configService.get<string>('X_API_KEY');

        if (!agentUsername || !xApiKey) {
            throw new HttpException(
                'Missing API configuration',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }

        const auth = Buffer.from(`${agentUsername}:${xApiKey}`).toString('base64');
        const url = `${this.apiUrl}/seamless/logIn`;

        // Generate a simple session token (UUID v4 like) or use timestamp + random
        // Using crypto.randomUUID() if available (Node 14.17+) or fallback
        const sessionToken = require('crypto').randomUUID();

        const payload = {
            username: username,
            productId: productId,
            gameCode: gameCode,
            isMobileLogin: isMobileLogin,
            limit: 1000,
            sessionToken: sessionToken,
            betLimit: betLimit
        };

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
