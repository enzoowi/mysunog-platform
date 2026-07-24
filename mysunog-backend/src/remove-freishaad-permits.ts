import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { PermitsService } from './permits/permits.service';
import { InspectionsService } from './inspections/inspections.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const usersService = app.get(UsersService);
  const permitsService = app.get(PermitsService);
  const inspectionsService = app.get(InspectionsService);

  console.log('Finding freishaad@gmail.com...');
  const user = await usersService.findByEmail('freishaad@gmail.com');

  if (!user) {
    console.log('User not found.');
    await app.close();
    return;
  }

  console.log('Removing FSIC permits...');
  const userPermits = await permitsService.listForUser(user.id);
  for (const permit of userPermits) {
    await permitsService['repo'].remove(permit); // Access repo to force remove
  }
  console.log(`Removed ${userPermits.length} FSIC permits.`);

  console.log('Removing FSEC inspections...');
  const userInspections = await inspectionsService.listForUser(user.id);
  for (const insp of userInspections) {
    await inspectionsService['repo'].remove(insp); // Access repo to force remove
  }
  console.log(`Removed ${userInspections.length} FSEC inspections.`);

  await app.close();
}

bootstrap()
  .then(() => console.log('Removal complete!'))
  .catch((err) => {
    console.error('Removal failed!', err);
    process.exit(1);
  });
