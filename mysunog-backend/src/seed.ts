import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { IncidentsService } from './incidents/incidents.service';
import { EducationService } from './education/education.service';
import { UserRole } from './users/user.entity';
import { EducationCategory } from './education/education.entity';
import { HotlinesService } from './hotlines/hotlines.service';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const usersService = app.get(UsersService);
  const incidentsService = app.get(IncidentsService);
  const educationService = app.get(EducationService);
  const hotlinesService = app.get(HotlinesService);

  // ─── 1. Seed BFP Admin User ───────────────────────────────────────────
  console.log('Seeding BFP Admin User...');
  const existingAdmin = await usersService.findByEmail('admin@bfp.gov.ph');
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await usersService.create({
      email: 'admin@bfp.gov.ph',
      password: hashedPassword,
      role: UserRole.ADMIN,
      firstName: 'BFP Chief',
      lastName: 'Administrator',
      isVerified: true, // Admin is always verified
    });
    console.log('Admin user created: admin@bfp.gov.ph / admin123');
  } else {
    // Ensure existing admin is always verified (handles migration case)
    if (!existingAdmin.isVerified) {
      existingAdmin.isVerified = true;
      await usersService.save(existingAdmin);
      console.log('Existing admin account marked as verified.');
    } else {
      console.log('Admin user already exists.');
    }
  }

  // ─── 2. Seed Second BFP Admin User ────────────────────────────────────
  console.log('Seeding Second BFP Admin User...');
  const existingAdmin2 = await usersService.findByEmail('admin2@bfp.gov.ph');
  if (!existingAdmin2) {
    const hashedPassword2 = await bcrypt.hash('admin1234', 10);
    await usersService.create({
      email: 'admin2@bfp.gov.ph',
      password: hashedPassword2,
      role: UserRole.ADMIN,
      firstName: 'BFP Deputy',
      lastName: 'Administrator',
      isVerified: true, // Admin is always verified
    });
    console.log('Second Admin user created: admin2@bfp.gov.ph / admin1234');
  } else {
    // Ensure existing second admin is always verified
    if (!existingAdmin2.isVerified) {
      existingAdmin2.isVerified = true;
      await usersService.save(existingAdmin2);
      console.log('Existing second admin account marked as verified.');
    } else {
      console.log('Second Admin user already exists.');
    }
  }

  // ─── 3. Seed 15 Fire Incidents ────────────────────────────────────────
  console.log('Seeding 15 Fire Incidents...');
  const mockIncidents = [
    {
      incidentDate: '2026-01-08',
      incidentTime: '02:30',
      barangay: 'Poblacion',
      cause: 'Electrical',
      latitude: 14.0477,
      longitude: 121.1541,
      estimatedDamage: 250000,
      casualties: 0,
      injuries: 2,
      propertyType: 'Residential',
      landmark: 'Near Malvar Municipal Hall',
      remarks:
        'Electrical short-circuit in the main breaker ignited curtains in the living room. Two occupants suffered minor burns.',
      alarmTime: '02:35',
      responseTime: '02:45',
      controlTime: '03:20',
      fireOutTime: '03:50',
      reporterName: 'Juan Dela Cruz',
      reporterContact: '09171234567',
    },
    {
      incidentDate: '2026-01-22',
      incidentTime: '11:45',
      barangay: 'San Juan',
      cause: 'Cooking',
      latitude: 14.0490,
      longitude: 121.1510,
      estimatedDamage: 85000,
      casualties: 0,
      injuries: 1,
      propertyType: 'Residential',
      landmark: 'Beside San Juan Chapel',
      remarks:
        'Unattended cooking oil on the stove caught fire and spread to nearby cabinets. One person sustained a minor arm burn.',
      alarmTime: '11:48',
      responseTime: '11:58',
      controlTime: '12:25',
      fireOutTime: '12:40',
      reporterName: 'Maria Santos',
      reporterContact: '09289876543',
    },
    {
      incidentDate: '2026-02-05',
      incidentTime: '19:15',
      barangay: 'Luta del Norte',
      cause: 'Cigarette Butt',
      latitude: 14.0401,
      longitude: 121.1549,
      estimatedDamage: 12000,
      casualties: 0,
      injuries: 0,
      propertyType: 'Vacant Lot',
      landmark: 'Along President Jose P. Laurel Highway',
      remarks:
        'Discarded cigarette butt ignited dry grass on a vacant lot. No structural damage; contained before spreading.',
      alarmTime: '19:20',
      responseTime: '19:30',
      controlTime: '19:50',
      fireOutTime: '20:05',
      reporterName: 'Pedro Reyes',
      reporterContact: '09351112233',
    },
    {
      incidentDate: '2026-02-14',
      incidentTime: '08:30',
      barangay: 'San Pioquinto',
      cause: 'Electrical',
      latitude: 14.0580,
      longitude: 121.1585,
      estimatedDamage: 1500000,
      casualties: 1,
      injuries: 5,
      propertyType: 'Industrial',
      landmark: 'Near Lima Technology Center (Malvar side)',
      remarks:
        'Faulty wiring in warehouse ignited stored chemicals. One worker died, five others hospitalized with smoke inhalation.',
      alarmTime: '08:33',
      responseTime: '08:42',
      controlTime: '10:15',
      fireOutTime: '11:30',
      reporterName: 'Carlos Mendoza',
      reporterContact: '09184445566',
    },
    {
      incidentDate: '2026-02-28',
      incidentTime: '15:00',
      barangay: 'San Fernando',
      cause: 'Open Flame',
      latitude: 14.0287,
      longitude: 121.1643,
      estimatedDamage: 45000,
      casualties: 0,
      injuries: 0,
      propertyType: 'Institutional',
      landmark: 'Near San Fernando Elementary School',
      remarks:
        'Candle left burning in the storage room ignited stacked papers. School was evacuated; no injuries reported.',
      alarmTime: '15:05',
      responseTime: '15:12',
      controlTime: '15:35',
      fireOutTime: '15:50',
      reporterName: 'Ana Villanueva',
      reporterContact: '09207778899',
    },
    {
      incidentDate: '2026-03-03',
      incidentTime: '22:10',
      barangay: 'Bagong Pook',
      cause: 'Arson',
      latitude: 14.0430,
      longitude: 121.1480,
      estimatedDamage: 620000,
      casualties: 0,
      injuries: 3,
      propertyType: 'Commercial',
      landmark: 'Near Bagong Pook Sari-Sari Store Cluster',
      remarks:
        'Suspected arson at a small commercial strip. Gasoline traces found at the scene. Three bystanders injured by debris.',
      alarmTime: '22:15',
      responseTime: '22:25',
      controlTime: '23:10',
      fireOutTime: '23:45',
      reporterName: 'Roberto Tan',
      reporterContact: '09163334455',
    },
    {
      incidentDate: '2026-03-11',
      incidentTime: '06:20',
      barangay: 'Bilucao',
      cause: 'Cooking',
      latitude: 14.0460,
      longitude: 121.1490,
      estimatedDamage: 55000,
      casualties: 0,
      injuries: 1,
      propertyType: 'Residential',
      landmark: 'Near Bilucao Barangay Hall',
      remarks:
        'LPG tank hose leaked while cooking breakfast. Flash fire damaged the kitchen area. Homeowner got first-degree burns.',
      alarmTime: '06:25',
      responseTime: '06:35',
      controlTime: '07:00',
      fireOutTime: '07:15',
      reporterName: 'Elena Garcia',
      reporterContact: '09275556677',
    },
    {
      incidentDate: '2026-03-18',
      incidentTime: '13:40',
      barangay: 'Bulihan',
      cause: 'Electrical',
      latitude: 14.0370,
      longitude: 121.1600,
      estimatedDamage: 320000,
      casualties: 0,
      injuries: 2,
      propertyType: 'Commercial',
      landmark: 'Beside Bulihan Public Market',
      remarks:
        'Overloaded extension cord in a market stall caused fire that spread to adjacent stalls. Two vendors suffered burns.',
      alarmTime: '13:43',
      responseTime: '13:52',
      controlTime: '14:30',
      fireOutTime: '14:55',
      reporterName: 'Ricardo Flores',
      reporterContact: '09198889900',
    },
    {
      incidentDate: '2026-03-25',
      incidentTime: '17:30',
      barangay: 'Luta del Sur',
      cause: 'Open Flame',
      latitude: 14.0345,
      longitude: 121.1569,
      estimatedDamage: 8000,
      casualties: 0,
      injuries: 0,
      propertyType: 'Agricultural',
      landmark: 'Near Luta del Sur Rice Fields',
      remarks:
        'Farmers burning rice straw lost control of the fire. Firefighters arrived and contained it before it reached nearby homes.',
      alarmTime: '17:35',
      responseTime: '17:48',
      controlTime: '18:10',
      fireOutTime: '18:25',
      reporterName: 'Andres Bautista',
      reporterContact: '09321110022',
    },
    {
      incidentDate: '2026-04-01',
      incidentTime: '10:00',
      barangay: 'San Andres',
      cause: 'Cigarette Butt',
      latitude: 14.0420,
      longitude: 121.1650,
      estimatedDamage: 95000,
      casualties: 0,
      injuries: 1,
      propertyType: 'Residential',
      landmark: 'Near San Andres Water Tower',
      remarks:
        'Cigarette butt thrown into a trash bin ignited waste materials. Fire spread to the porch. One resident inhaled smoke.',
      alarmTime: '10:05',
      responseTime: '10:15',
      controlTime: '10:40',
      fireOutTime: '10:55',
      reporterName: 'Lourdes Aquino',
      reporterContact: '09456667788',
    },
    {
      incidentDate: '2026-04-05',
      incidentTime: '03:50',
      barangay: 'San Isidro',
      cause: 'Electrical',
      latitude: 14.0440,
      longitude: 121.1700,
      estimatedDamage: 480000,
      casualties: 0,
      injuries: 3,
      propertyType: 'Mixed-Use',
      landmark: 'Near San Isidro Covered Court',
      remarks:
        'Old wiring in a mixed-use building (ground floor shop, upper floor residence) sparked a fire at dawn. Three people rescued.',
      alarmTime: '03:55',
      responseTime: '04:08',
      controlTime: '04:50',
      fireOutTime: '05:20',
      reporterName: 'Fernando Ramos',
      reporterContact: '09182223344',
    },
    {
      incidentDate: '2026-04-10',
      incidentTime: '14:20',
      barangay: 'San Pedro I',
      cause: 'Cooking',
      latitude: 14.0470,
      longitude: 121.1450,
      estimatedDamage: 35000,
      casualties: 0,
      injuries: 0,
      propertyType: 'Residential',
      landmark: 'Near San Pedro I Basketball Court',
      remarks:
        'Grease fire in the kitchen of a single-story home. Homeowner used a fire blanket before firefighters arrived. Minimal spread.',
      alarmTime: '14:25',
      responseTime: '14:35',
      controlTime: '14:50',
      fireOutTime: '15:00',
      reporterName: 'Gloria Manalo',
      reporterContact: '09334445566',
    },
    {
      incidentDate: '2026-04-14',
      incidentTime: '20:45',
      barangay: 'San Pedro II',
      cause: 'Arson',
      latitude: 14.0450,
      longitude: 121.1430,
      estimatedDamage: 750000,
      casualties: 0,
      injuries: 4,
      propertyType: 'Commercial',
      landmark: 'Along San Pedro II Main Road',
      remarks:
        'Deliberate fire set in a hardware store after closing hours. Four security guards from neighboring stores were injured.',
      alarmTime: '20:48',
      responseTime: '20:58',
      controlTime: '21:40',
      fireOutTime: '22:15',
      reporterName: 'Miguel Torres',
      reporterContact: '09267778899',
    },
    {
      incidentDate: '2026-04-18',
      incidentTime: '07:10',
      barangay: 'Santiago',
      cause: 'Electrical',
      latitude: 14.0169,
      longitude: 121.1653,
      estimatedDamage: 180000,
      casualties: 0,
      injuries: 1,
      propertyType: 'Government',
      landmark: 'Near Santiago Barangay Hall',
      remarks:
        'Power surge caused a fire in the barangay hall records room. One staff member suffered minor injuries evacuating documents.',
      alarmTime: '07:14',
      responseTime: '07:22',
      controlTime: '07:50',
      fireOutTime: '08:10',
      reporterName: 'Rosario Pangilinan',
      reporterContact: '09159990011',
    },
    {
      incidentDate: '2026-04-22',
      incidentTime: '16:55',
      barangay: 'Poblacion',
      cause: 'Open Flame',
      latitude: 14.0485,
      longitude: 121.1550,
      estimatedDamage: 28000,
      casualties: 0,
      injuries: 0,
      propertyType: 'Religious',
      landmark: 'Near Malvar Parish Church',
      remarks:
        'Votive candles fell on a cloth altar cover during afternoon service. Church volunteers extinguished the flames before major damage.',
      alarmTime: '16:58',
      responseTime: '17:08',
      controlTime: '17:20',
      fireOutTime: '17:30',
      reporterName: 'Teresita Lim',
      reporterContact: '09481112233',
    },
  ];

  for (const incident of mockIncidents) {
    await incidentsService.create(incident as any);
  }
  console.log('Seeded 15 fire incidents.');

  // ─── 4. Seed Education Hub Data ───────────────────────────────────────
  console.log('Seeding Education Hub Data...');

  const educationArticles = [
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

  for (const article of educationArticles) {
    await educationService.create(article);
  }
  console.log('Seeded 5 fire safety education articles.');

  // ─── 5. Seed Emergency Hotlines Data ───────────────────────────────────────
  console.log('Seeding Emergency Hotlines Data...');

  const mockHotlines = [
    { name: 'Malvar Fire Station', phone: '043-123-4567', category: 'bfp' },
    { name: 'BFP Malvar Mobile', phone: '0917-111-2222', category: 'bfp' },
    { name: 'Malvar MDRRMO Office', phone: '043-987-6543', category: 'mdrrmo' },
    { name: 'MDRRMO Rescue Team', phone: '0918-333-4444', category: 'mdrrmo' },
    { name: 'Barangay Poblacion Desk', phone: '043-777-8888', category: 'barangay' },
    { name: 'Barangay San Pioquinto Desk', phone: '043-777-9999', category: 'barangay' },
    { name: 'Malvar Community Hospital', phone: '043-444-5555', category: 'hospital' },
    { name: 'Malvar Police Station', phone: '043-555-6666', category: 'police' },
    { name: 'PNP Malvar Mobile', phone: '0919-555-6666', category: 'police' },
    { name: 'MERALCO Malvar (Power Outage)', phone: '16211', category: 'general' },
  ];

  for (const hotline of mockHotlines) {
    await hotlinesService.create(hotline);
  }
  console.log('Seeded 10 emergency hotlines.');

  await app.close();
}

bootstrap()
  .then(() => console.log('Seeding complete!'))
  .catch((err) => {
    console.error('Seeding failed!', err);
    process.exit(1);
  });
