import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);


  app.setGlobalPrefix('api/v2');

  app.enableCors({
    origin: [
      // 'http://localhost:3000',

      'http://localhost:5173',
      'http://localhost:5174',
      'https://demo-fe.online',
      'https://goldspin888.com',
      'https://www.demo-fe.online',
      'https://www.goldspin888.com',
      // 'https://your-production-domain.com', // TODO: Add production domain
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Register Global Interceptor
  app.useGlobalInterceptors(new TransformInterceptor());

  // Register Global Filter
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
