
import { Module, Global } from '@nestjs/common';
import { S3Service } from './s3.service';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [S3Service],
    exports: [S3Service],
})
export class CommonModule { }

