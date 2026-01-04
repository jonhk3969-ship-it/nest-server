import { Injectable, CanActivate, ExecutionContext, ServiceUnavailableException } from '@nestjs/common';
import { SystemService } from '../../system/system.service';

@Injectable()
export class MaintenanceGuard implements CanActivate {
    constructor(private readonly systemService: SystemService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const { url } = request;

        // Check maintenance status
        const status = await this.systemService.getStatus();

        if (!status.maintenance) {
            return true;
        }

        // Whitelist Check
        // Allow Auth endpoints
        if (url.includes('/auth/')) {
            return true;
        }

        // Allow System Status endpoints (GET and POST for Admin update)
        if (url.includes('/system/status')) {
            return true;
        }

        throw new ServiceUnavailableException('System is under maintenance');
    }
}
