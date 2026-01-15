// Win Rewards DTO - For jackpot/bonus rewards
export class WinRewardTxnDto {
    id: string;
    status: string;
    roundId: string;
    payoutAmount: number;
    gameCode: string;
    playInfo: string;
    betAmount?: number;
}

export class WinRewardDto {
    id: string;
    timestampMillis: number;
    productId: string;
    currency: string;
    username: string;
    txns: WinRewardTxnDto[];
}
