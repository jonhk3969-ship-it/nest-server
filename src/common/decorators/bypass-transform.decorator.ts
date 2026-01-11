
import { SetMetadata } from '@nestjs/common';

export const BypassTransform = () => SetMetadata('bypass_transform', true);
