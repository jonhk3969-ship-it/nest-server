// Place Tips DTO - For tipping dealer in live casino
export class PlaceTipTxnDto {
    id: string;
    status: string; // Always 'TIPS'
    roundId: string;
    betAmount: number;
}

export class PlaceTipDto {
    id: string;
    timestampMillis: number;
    productId: string;
    currency: string;
    username: string;
    txns: PlaceTipTxnDto[];
}
