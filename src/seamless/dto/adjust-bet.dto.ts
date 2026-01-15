// Adjust Bets DTO - For adjusting bet amounts
export class AdjustBetTxnDto {
    id: string;
    status: string;
    roundId: string;
    betAmount: number;
    gameCode: string;
    playInfo: string;
    txnId?: string;
}

export class AdjustBetDto {
    id: string;
    timestampMillis: number;
    productId: string;
    currency: string;
    username: string;
    txns: AdjustBetTxnDto[];
}
