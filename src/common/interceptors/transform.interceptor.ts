import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
    status: string;
    code: number;
    message: string;
    data: T;
}

@Injectable()
export class TransformInterceptor<T>
    implements NestInterceptor<T, Response<T>> {
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<any> {
        const reflector = new Reflector();
        const bypass = reflector.get<boolean>('bypass_transform', context.getHandler());

        if (bypass) {
            return next.handle();
        }

        return next.handle().pipe(
            map((data) => {
                const ctx = context.switchToHttp();
                const response = ctx.getResponse();
                const statusCode = response.statusCode;

                let status = 'ok';
                let message = 'Success';
                let responseData = data;
                let meta = undefined;

                // Check if data is already partially formatted (from Service)
                if (data && typeof data === 'object' && !Array.isArray(data)) {
                    // Check for explicitly returned status/message
                    if (data.status) status = data.status;
                    if (data.message) message = data.message;

                    // Check if 'data' property exists. 
                    // If it does, we assume the service wrapped the result in { status, data, ... }
                    if (data.data !== undefined) {
                        responseData = data.data;
                        if (data.meta) {
                            meta = data.meta;
                        }
                    } else if (data.status && (data.message || data.msg)) {
                        // If we have status/message but NO data property, implies the result IS null/void
                        // e.g. { status: 'ok', message: 'Deleted' }
                        responseData = null;
                    }
                    // If none of the above matches (e.g. just a regular object User { id: 1, ... }),
                    // we treat the whole object as data.
                }

                return {
                    status: status,
                    code: statusCode,
                    message: message,
                    data: responseData,
                    meta: meta,
                };
            }),
        );
    }
}
