import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { EducationService } from './education/education.service';
import { EducationCategory } from './education/education.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const educationService = app.get(EducationService);

  console.log('Clearing existing education articles...');
  const existing = await educationService.findAll();
  for (const article of existing) {
    await educationService.remove(article.id);
  }

  console.log('Seeding updated concise education articles...');
  const shortArticles = [
    {
      title: 'Understanding the Fire Triangle',
      category: EducationCategory.GENERAL,
      content:
        'Fire requires Heat, Fuel, and Oxygen to burn. Removing any one stops the fire.\n\n🔥 Heat: Sparks or flames.\n🪵 Fuel: Combustible materials like wood or paper.\n💨 Oxygen: Required to sustain burning.\n\nMitigate these elements to ensure safety.',
    },
    {
      title: 'Top 5 Causes of Electrical Fires',
      category: EducationCategory.PREVENTION,
      content:
        "Avoid these top causes of electrical fires:\n\n🔌 Overloaded Outlets: Don't overload extension cords.\n⚡ Frayed Cords: Replace damaged wires immediately.\n🏚️ Outdated Wiring: Upgrade older home electrical systems.\n🔥 Space Heaters: Keep 3 feet away from combustibles.\n🐙 Octopus Connections: Avoid multiple adapters on a single socket.",
    },
    {
      title: 'How to Handle Your LPG Cylinders Safely',
      category: EducationCategory.LPG,
      content:
        'LPG is highly flammable. Follow these rules:\n\n🌬️ Storage: Keep outside in well-ventilated areas.\n⬆️ Upright: Always store tanks vertically.\n🧼 Leak Checks: Use soapy water on valves; bubbles indicate leaks.\n🚨 If you smell gas: DO NOT touch electrical switches. Open windows and turn off the main valve.',
    },
    {
      title: 'Emergency: What to do when trapped by fire',
      category: EducationCategory.EMERGENCY,
      content:
        'Act fast in a fire emergency:\n\n💨 Crawl Low: Stay low where the air is cleanest.\n🚪 Feel Doors: Do not open hot doors.\n🛑 Stop, Drop, & Roll: Smother flames if clothes catch fire.\n🚫 Never Go Back Inside: Stay out and wait for firefighters.',
    },
    {
      title: 'Why Every Home Needs a Smoke Alarm',
      category: EducationCategory.HOME_SAFETY,
      content:
        'Smoke alarms halve the risk of dying in a fire.\n\n📍 Placement: Install inside and outside all sleeping areas.\n⏱️ Testing: Test alarms monthly.\n🔋 Batteries: Replace yearly or when chirping starts.\n🧯 Fire Extinguishers: Keep an ABC extinguisher in the kitchen and garage.',
    },
  ];

  for (const article of shortArticles) {
    await educationService.create(article);
  }

  console.log('Updated education articles successfully!');
  await app.close();
}

bootstrap().catch(console.error);
