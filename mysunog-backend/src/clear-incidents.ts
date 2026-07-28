import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FireIncident } from './incidents/fire-incident.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const repo = app.get(getRepositoryToken(FireIncident));
  
  await repo.clear();
  console.log('Cleared all Fire Incidents');
  await app.close();
}

bootstrap();
