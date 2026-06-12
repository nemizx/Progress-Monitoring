import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Client } = pg;

const host = process.env.PGHOST || 'localhost';
const port = parseInt(process.env.PGPORT || '5432');
const user = process.env.PGUSER || 'postgres';
const password = process.env.PGPASSWORD || 'password';
const database = process.env.PGDATABASE || 'progress_monitoring';

async function runSetup() {
  console.log('Starting PostgreSQL Database setup...');

  // Step 1: Connect to default 'postgres' database to ensure our target DB exists
  let defaultClient;
  let retries = 10;
  while (retries > 0) {
    defaultClient = new Client({
      host,
      port,
      user,
      password,
      database: 'postgres', // default DB
    });

    try {
      await defaultClient.connect();
      console.log("Connected to default 'postgres' database.");
      break;
    } catch (error) {
      retries -= 1;
      console.log(`Database not ready yet. Retrying in 3 seconds... (Retries left: ${retries})`);
      if (retries === 0) {
        console.error('Failed to verify/create target database on postgres root server:', error.message);
        console.log('Make sure PostgreSQL service is running and credentials in server/.env are correct.');
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  try {
    
    // Check if database exists
    const dbCheck = await defaultClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [database]
    );

    if (dbCheck.rows.length === 0) {
      console.log(`Database '${database}' does not exist. Creating database...`);
      await defaultClient.query(`CREATE DATABASE "${database}"`);
      console.log(`Database '${database}' created successfully.`);
    } else {
      console.log(`Database '${database}' already exists.`);
    }
  } catch (error) {
    console.error('Failed to verify/create target database on postgres root server:', error.message);
    console.log('Make sure PostgreSQL service is running and credentials in server/.env are correct.');
    process.exit(1);
  } finally {
    await defaultClient.end();
  }

  // Step 2: Connect to the target database and execute migrations
  console.log(`Connecting to target database '${database}'...`);
  const targetClient = new Client({
    host,
    port,
    user,
    password,
    database,
  });

  try {
    await targetClient.connect();
    console.log(`Connected to target database '${database}'.`);

    const sqlPath = path.join(__dirname, 'init.sql');
    console.log(`Reading schema definition from ${sqlPath}...`);
    const initSqlText = await fs.readFile(sqlPath, 'utf8');

    console.log('Executing database schema and seed values...');
    await targetClient.query(initSqlText);
    console.log('Database tables created and seeded successfully!');
  } catch (error) {
    console.error('Failed to run schema/seed SQL scripts:', error.message);
    process.exit(1);
  } finally {
    await targetClient.end();
    console.log('Database connection closed. Setup complete.');
  }
}

runSetup();
