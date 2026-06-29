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
const forceReset = process.argv.includes('--reset') || process.env.DB_FORCE_RESET === 'true';
const SCHEMA_CHECK_TABLES = ['users', 'projects', 'sub_projects', 'wbs_items'];

async function runNonDestructiveMigrations(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS sub_projects (
      id VARCHAR(50) PRIMARY KEY,
      project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      built_up_area NUMERIC(15, 2) DEFAULT 0,
      floors_count INTEGER DEFAULT 1,
      flats_per_floor INTEGER DEFAULT 0,
      created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS project_flats (
      id VARCHAR(50) PRIMARY KEY,
      project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
      sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE,
      floor_number INTEGER NOT NULL,
      flat_number VARCHAR(50) NOT NULL,
      area_sqft NUMERIC(12, 2) DEFAULT 0,
      cost_estimate NUMERIC(15, 2) DEFAULT 0,
      created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    ALTER TABLE wbs_items
    ADD COLUMN IF NOT EXISTS sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE
  `);
  await client.query(`
    ALTER TABLE wbs_items
    ADD COLUMN IF NOT EXISTS activity_id VARCHAR(50)
  `);
  await client.query(`
    ALTER TABLE wbs_items
    ADD COLUMN IF NOT EXISTS activity_code VARCHAR(255)
  `);
  await client.query(`
    ALTER TABLE wbs_items
    ADD COLUMN IF NOT EXISTS lumsum_rate NUMERIC(15, 2) DEFAULT 0
  `);
  await client.query(`
    ALTER TABLE wbs_items
    ADD COLUMN IF NOT EXISTS total_days NUMERIC(10, 2) DEFAULT 0
  `);
  await client.query(`
    ALTER TABLE wbs_items
    ADD COLUMN IF NOT EXISTS source_upload_type VARCHAR(30)
  `);
  await client.query(`
    ALTER TABLE wbs_items
    ADD COLUMN IF NOT EXISTS level_label VARCHAR(50)
  `);
  await client.query(`
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS project_type VARCHAR(100)
  `);
  await client.query(`
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS project_code VARCHAR(100)
  `);
  await client.query(`
    ALTER TABLE progress_entries
    ADD COLUMN IF NOT EXISTS wbs_item_id VARCHAR(50) REFERENCES wbs_items(id) ON DELETE SET NULL
  `);
}

async function getExistingSchemaTables(client) {
  const result = await client.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `,
    [SCHEMA_CHECK_TABLES]
  );
  return new Set(result.rows.map((row) => row.table_name));
}

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

    const existingTables = await getExistingSchemaTables(targetClient);
    if (existingTables.size > 0 && !forceReset) {
      const tableList = Array.from(existingTables).sort().join(', ');
      console.log(`Existing schema detected (${tableList}). Skipping destructive init.sql reset.`);
      console.log('Use "npm run db:setup -- --reset" only when you intentionally want a full database reset.');
      console.log('Applying non-destructive migrations...');
      await runNonDestructiveMigrations(targetClient);
      console.log('Non-destructive migrations completed.');
      return;
    }

    if (forceReset) {
      console.log('Force reset enabled. Running init.sql and recreating all tables/data...');
    }

    const sqlPath = path.join(__dirname, 'init.sql');
    console.log(`Reading schema definition from ${sqlPath}...`);
    const initSqlText = await fs.readFile(sqlPath, 'utf8');

    console.log('Executing database schema and seed values...');
    await targetClient.query(initSqlText);
    await runNonDestructiveMigrations(targetClient);
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
