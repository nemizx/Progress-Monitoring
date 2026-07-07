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
  await client.query(`
    CREATE TABLE IF NOT EXISTS technical_staff (
      id VARCHAR(50) PRIMARY KEY,
      project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      designation VARCHAR(255) NOT NULL,
      remark TEXT,
      created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS technical_staff_attendance (
      id VARCHAR(50) PRIMARY KEY,
      project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
      sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE,
      technical_staff_id VARCHAR(50) REFERENCES technical_staff(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      status VARCHAR(50) DEFAULT 'present',
      created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (technical_staff_id, date, sub_project_id)
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS contractors (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      contact_person VARCHAR(255),
      phone VARCHAR(50),
      email VARCHAR(255),
      trade VARCHAR(100),
      gst_number VARCHAR(50),
      address TEXT,
      remark TEXT,
      vendor_code VARCHAR(50),
      type_of_work VARCHAR(255),
      vendor_category VARCHAR(100),
      created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`
    ALTER TABLE contractors
    DROP COLUMN IF EXISTS project_id,
    ADD COLUMN IF NOT EXISTS vendor_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS type_of_work VARCHAR(255),
    ADD COLUMN IF NOT EXISTS vendor_category VARCHAR(100)
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS machinery_details (
      id VARCHAR(50) PRIMARY KEY,
      project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
      sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      machinery_name VARCHAR(255) NOT NULL,
      nos NUMERIC(12, 2) DEFAULT 0,
      till_date_hours NUMERIC(12, 2) DEFAULT 0,
      todays_hours NUMERIC(12, 2) DEFAULT 0,
      cumulative_hours NUMERIC(12, 2) DEFAULT 0,
      rate NUMERIC(12, 2) DEFAULT 0,
      till_date_amount NUMERIC(12, 2) DEFAULT 0,
      todays_amount NUMERIC(12, 2) DEFAULT 0,
      cumulative_amount NUMERIC(12, 2) DEFAULT 0,
      created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS material_status (
      id VARCHAR(50) PRIMARY KEY,
      project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
      sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      description VARCHAR(255) NOT NULL,
      unit VARCHAR(50),
      till_date_rec NUMERIC(12, 2) DEFAULT 0,
      today_rec NUMERIC(12, 2) DEFAULT 0,
      total_received NUMERIC(12, 2) DEFAULT 0,
      till_date_consumed NUMERIC(12, 2) DEFAULT 0,
      today_consumed NUMERIC(12, 2) DEFAULT 0,
      total_consumed NUMERIC(12, 2) DEFAULT 0,
      balance NUMERIC(12, 2) DEFAULT 0,
      rate NUMERIC(12, 2) DEFAULT 0,
      till_date_amount NUMERIC(12, 2) DEFAULT 0,
      today_amount NUMERIC(12, 2) DEFAULT 0,
      cumulative_amount NUMERIC(12, 2) DEFAULT 0,
      remarks TEXT,
      created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS days_reports (
      id VARCHAR(50) PRIMARY KEY,
      project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
      sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      description TEXT NOT NULL,
      remark TEXT,
      created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS status_reports (
      id VARCHAR(50) PRIMARY KEY,
      project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
      sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      description TEXT NOT NULL,
      remark TEXT,
      created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS special_site_visits (
      id VARCHAR(50) PRIMARY KEY,
      project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
      sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      firm_name VARCHAR(255) NOT NULL,
      visitor_name VARCHAR(255) NOT NULL,
      purpose TEXT NOT NULL,
      created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS critical_issues (
      id VARCHAR(50) PRIMARY KEY,
      project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
      sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      description TEXT NOT NULL,
      created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS next_days_plans (
      id VARCHAR(50) PRIMARY KEY,
      project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
      sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      description TEXT NOT NULL,
      unit VARCHAR(50),
      quantity NUMERIC(12, 2),
      created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS contractor_labours (
      id VARCHAR(50) PRIMARY KEY,
      project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
      sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE,
      contractor_id VARCHAR(50) REFERENCES contractors(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      unit VARCHAR(50),
      carpenter NUMERIC(12, 2) DEFAULT 0,
      barbender NUMERIC(12, 2) DEFAULT 0,
      mason NUMERIC(12, 2) DEFAULT 0,
      carpenter_helper NUMERIC(12, 2) DEFAULT 0,
      barbender_helper NUMERIC(12, 2) DEFAULT 0,
      mc NUMERIC(12, 2) DEFAULT 0,
      fc NUMERIC(12, 2) DEFAULT 0,
      created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (contractor_id, date, sub_project_id)
    )
  `);

  // Migrate existing tables
  const targetTables = [
    'technical_staff_attendance',
    'machinery_details',
    'material_status',
    'days_reports',
    'status_reports',
    'special_site_visits',
    'critical_issues',
    'next_days_plans'
  ];

  for (const table of targetTables) {
    await client.query(`
      ALTER TABLE ${table}
      ADD COLUMN IF NOT EXISTS sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE
    `);
  }

  for (const table of targetTables) {
    await client.query(`
      UPDATE ${table} t
      SET sub_project_id = (SELECT id FROM sub_projects sp WHERE sp.project_id = t.project_id LIMIT 1)
      WHERE t.sub_project_id IS NULL
    `);
  }

  // Update unique constraint on technical_staff_attendance
  await client.query(`
    ALTER TABLE technical_staff_attendance
    DROP CONSTRAINT IF EXISTS technical_staff_attendance_technical_staff_id_date_key
  `);
  await client.query(`
    ALTER TABLE technical_staff_attendance
    DROP CONSTRAINT IF EXISTS technical_staff_attendance_staff_date_sub_project_key
  `);
  await client.query(`
    ALTER TABLE technical_staff_attendance
    ADD CONSTRAINT technical_staff_attendance_staff_date_sub_project_key UNIQUE (technical_staff_id, date, sub_project_id)
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
