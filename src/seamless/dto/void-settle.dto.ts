// Void Settled DTO - For voiding a completed round
export class VoidSettleTxnDto {
    id: string;
    status: string; // Always 'VOID'
    roundId: string;
    betAmount: number;
    payoutAmount: number;
    gameCode: string;
    playInfo: string;
    transactionType: string; // 'BY_TRANSACTION' or 'BY_ROUND'
}

export class VoidSettleDto {
    id: string;
    timestampMillis: number;
    productId: string;
    currency: string;
    username: string;
    txns: VoidSettleTxnDto[];
}
