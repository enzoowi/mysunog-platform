import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Ensure upload subdirectories exist
  const uploadsDir = join(__dirname, '..', 'uploads');
  for (const sub of ['detections', 'videos']) {
    const dir = join(uploadsDir, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  // Serve the uploads folder at /uploads URL
  app.useStaticAssets(uploadsDir, {
    prefix: '/uploads/',
  });

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips unknown fields
      forbidNonWhitelisted: true, // rejects extra fields
      transform: true,
    }),
  );

  await app.listen(3000, '0.0.0.0');
}
void bootstrap();
