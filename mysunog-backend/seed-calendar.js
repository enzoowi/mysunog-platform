const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: { rejectUnauthorized: false }
});

const today = new Date();
const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
const currentYear = today.getFullYear();

const mockEvents = [
  {
    title: 'Fire Safety Drill at Malvar National High School',
    date: `${currentYear}-${currentMonth}-15`,
    time: '08:00 AM',
    location: 'Malvar National High School Campus',
    type: 'drill'
  },
  {
    title: 'Basic Life Support & First Aid Training',
    date: `${currentYear}-${currentMonth}-20`,
    time: '09:00 AM',
    location: 'BFP Malvar Station',
    type: 'training'
  },
  {
    title: 'Annual Business Establishment Inspection',
    date: `${currentYear}-${currentMonth}-05`,
    time: '01:00 PM',
    location: 'Malvar Public Market',
    type: 'inspection'
  },
  {
    title: 'Community Fire Prevention Seminar',
    date: `${currentYear}-${currentMonth}-28`,
    time: '10:00 AM',
    location: 'Barangay San Fernando Covered Court',
    type: 'community'
  },
  {
    title: 'LPG Safety Awareness Campaign',
    date: `${currentYear}-${currentMonth}-10`,
    time: '02:30 PM',
    location: 'Barangay Poblacion',
    type: 'community'
  }
];

async function seed() {
  try {
    await client.connect();
    console.log('Connected to database');

    for (const event of mockEvents) {
      await client.query(
        'INSERT INTO "calendar_event" (id, title, date, time, location, type, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())',
        [event.title, event.date, event.time, event.location, event.type]
      );
    }
    console.log('Mock events inserted successfully!');
  } catch (err) {
    console.error('Error seeding data:', err);
  } finally {
    await client.end();
  }
}

seed();
