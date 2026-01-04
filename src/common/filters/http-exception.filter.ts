import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        let message = 'Internal server error';
        let data = null;

        if (exception instanceof HttpException) {
            const exceptionResponse = exception.getResponse();
            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else if (
                typeof exceptionResponse === 'object' &&
                exceptionResponse !== null
            ) {
                // NestJS standard error response is { statusCode, message, error }
                // We want to extract 'message'. It can remain an array (validation errors) or string.
                const res = exceptionResponse as any;
                if (res.message) {
                    message = Array.isArray(res.message)
                        ? res.message.join(', ') // Join array messages for simplicity or keep as array? User asked for "a brief description".
                        : res.message;
                }
            }
        } else {
            console.error(exception); // Log internal errors
        }

        response.status(status).json({
            status: 'error',
            code: status,
            message: message,
            data: null,
        });
    }
}
