
import { Injectable, Logger } from '@nestjs/common';
import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';

/**
 * Service to handle S3 file uploads and deletions
 */
@Injectable()
export class S3Service {
    private readonly s3Client: S3Client;
    private readonly bucketName: string;
    private readonly logger = new Logger(S3Service.name);

    constructor(private configService: ConfigService) {
        this.s3Client = new S3Client({
            region: this.configService.get<string>('AWS_REGION') || '',
            credentials: {
                accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
                secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
            },
        });
        this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || '';
    }

    /**
     * Uploads a file to S3
     * @param file - The file to upload (Multer file object)
     * @param folder - Optional folder path within the bucket
     * @returns The public URL of the uploaded file
     */
    async uploadFile(file: Express.Multer.File, folder: string = 'others'): Promise<string> {
        const fileExt = extname(file.originalname);
        const fileName = `${uuidv4()}${fileExt}`;
        const key = `${folder}/${fileName}`;

        await this.s3Client.send(
            new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype,
                // ACL: 'public-read', // Deprecated in favor of bucket policy, but keeping in mind if needed
            }),
        );

        // Construct the URL manually or use a specific region URL format
        const region = this.configService.get<string>('AWS_REGION');
        return `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
    }

    /**
     * Deletes a file from S3 using the file URL
     * @param fileUrl - The full URL of the file
     */
    async deleteFile(fileUrl: string): Promise<void> {
        if (!fileUrl) return;

        try {
            const urlParts = fileUrl.split('.com/');
            if (urlParts.length < 2) return;

            const key = urlParts[1]; // Get the key after the domain

            await this.s3Client.send(
                new DeleteObjectCommand({
                    Bucket: this.bucketName,
                    Key: key,
                }),
            );
        } catch (error) {
            this.logger.error(`Failed to delete file from S3: ${fileUrl}`, error);
            // Don't throw error to prevent blocking main flow, just log it
        }
    }
}
