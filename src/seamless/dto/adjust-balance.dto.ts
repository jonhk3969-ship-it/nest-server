// Adjust Balance DTO - For DEBIT/CREDIT in fishing games
export class AdjustBalanceTxnDto {
    refId: string;
    status: string; // 'DEBIT' or 'CREDIT'
    amount: number;
}

export class AdjustBalanceDto {
    id: string;
    timestampMillis: number;
    productId: string;
    currency: string;
    username: string;
    txns: AdjustBalanceTxnDto[];
}
