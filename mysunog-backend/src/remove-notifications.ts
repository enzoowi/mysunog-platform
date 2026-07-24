import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { NotificationsService } from './notifications/notifications.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const usersService = app.get(UsersService);
  const notificationsService = app.get(NotificationsService);

  // Note: Handling both 'gmial' (user typo) and 'gmail' just to be safe
  console.log('Finding user...');
  let user = await usersService.findByEmail('freishaad@gmail.com');
  if (!user) {
    user = await usersService.findByEmail('freishaad@gmial.com');
  }

  if (!user) {
    console.log('User not found.');
    await app.close();
    return;
  }

  console.log(`Found user: ${user.email} (ID: ${user.id})`);

  console.log('Fetching notifications...');
  const notifications = await notificationsService.getMyNotifications(user.id);

  if (notifications.length === 0) {
    console.log('No notifications to remove.');
  } else {
    console.log(`Removing ${notifications.length} notifications...`);
    for (const notif of notifications) {
      await notificationsService['notificationsRepository'].remove(notif);
    }
    console.log('Removed all notifications.');
  }

  await app.close();
}

bootstrap()
  .then(() => console.log('Process complete!'))
  .catch((err) => {
    console.error('Process failed!', err);
    process.exit(1);
  });
