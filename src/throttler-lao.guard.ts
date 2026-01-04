
import {
    ThrottlerGuard,
    ThrottlerException,
    ThrottlerLimitDetail,
} from '@nestjs/throttler';
import { Injectable, ExecutionContext } from '@nestjs/common';

@Injectable()
export class ThrottlerLaoGuard extends ThrottlerGuard {
    protected async throwThrottlingException(
        context: ExecutionContext,
        throttlerLimitDetail: ThrottlerLimitDetail,
    ): Promise<void> {
        throw new ThrottlerException(
            'Login ຫຼາຍເກີນໄປ ກະລຸນາລອງໃໝ່ພາຍຫຼັງອີກ 1 ນາທີ'
        );
    }
}
