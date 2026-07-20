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
    ALTER TABLE wbs_items
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS assigned_reviewer VARCHAR(255),
    ADD COLUMN IF NOT EXISTS return_reason TEXT,
    ADD COLUMN IF NOT EXISTS returned_by VARCHAR(255)
  `);
  await client.query(`
    ALTER TABLE wbs_items
    ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255),
    ADD COLUMN IF NOT EXISTS approved_date TIMESTAMP,
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS remarks TEXT,
    ADD COLUMN IF NOT EXISTS returned_date TIMESTAMP
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
      type_of_work VARCHAR(255),
      date DATE NOT NULL,
      unit VARCHAR(50),
      carpenter NUMERIC(12, 2) DEFAULT 0,
      barbender NUMERIC(12, 2) DEFAULT 0,
      mason NUMERIC(12, 2) DEFAULT 0,
      skilled_other NUMERIC(12, 2) DEFAULT 0,
      carpenter_helper NUMERIC(12, 2) DEFAULT 0,
      barbender_helper NUMERIC(12, 2) DEFAULT 0,
      semi_skilled_other NUMERIC(12, 2) DEFAULT 0,
      mc NUMERIC(12, 2) DEFAULT 0,
      fc NUMERIC(12, 2) DEFAULT 0,
      created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (contractor_id, date, sub_project_id, type_of_work)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS wpr_reports (
      id VARCHAR(50) PRIMARY KEY,
      project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
      sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE,
      week_id VARCHAR(100) NOT NULL,
      week_start DATE NOT NULL,
      week_end DATE NOT NULL,
      status VARCHAR(50) DEFAULT 'draft',
      form_data TEXT,
      submitted_by VARCHAR(255),
      submitted_at TIMESTAMP,
      created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (project_id, sub_project_id, week_id)
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

  // Contractor Labours migrations for Contractor + Type of Work mapping
  await client.query(`
    ALTER TABLE contractor_labours
    ADD COLUMN IF NOT EXISTS type_of_work VARCHAR(255)
  `);
  await client.query(`
    ALTER TABLE contractor_labours
    DROP CONSTRAINT IF EXISTS contractor_labours_contractor_id_date_sub_project_id_key
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS contractor_labours_contractor_date_sub_work_key
    ON contractor_labours (contractor_id, date, sub_project_id, type_of_work)
    WHERE sub_project_id IS NOT NULL
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS contractor_labours_contractor_date_null_sub_work_key
    ON contractor_labours (contractor_id, date, type_of_work)
    WHERE sub_project_id IS NULL
  `);

  // Seed dummy contractors if empty
  const contractorsCheck = await client.query("SELECT COUNT(*) FROM contractors");
  if (parseInt(contractorsCheck.rows[0].count) === 0) {
    console.log("Seeding dummy contractors...");
    await client.query(`
      INSERT INTO contractors (id, name, contact_person, phone, email, trade, gst_number, address, remark, vendor_code, type_of_work, vendor_category) VALUES
      ('c1', 'Apex RCC Structures', 'Rajesh Kumar', '9876543210', 'apex@example.com', 'RCC Work', '27AAAAA0000A1Z1', 'Mumbai', 'Primary RCC contractor', 'V-001', 'RCC Concrete Work', 'Class A'),
      ('c2', 'Deluxe Masonry & Plastering', 'Vijay Yadav', '9876543211', 'deluxe@example.com', 'Masonry, Plaster Work', '27BBBBB1111B1Z2', 'Thane', 'Masonry contractor', 'V-002', 'Brickwork and internal plastering', 'Class B'),
      ('c3', 'Star Electricals & Wiring', 'Ramesh Patel', '9876543212', 'star@example.com', 'Electrical Work', '27CCCCC2222C1Z3', 'Navi Mumbai', 'Electrical conduit and wiring contractor', 'V-003', 'Electrical wiring and fixtures', 'Class A'),
      ('c4', 'Sterling & Wilson Plumbing', 'Amit Patel', '9876543213', 'sterling@example.com', 'Plumbing, Drainage Work', '27DDDDD3333D1Z4', 'Pune', 'Plumbing and MEP contractor', 'V-004', 'Sanitary routing and drainage pipes', 'Class A')
    `);
  }

  // Seed dummy technical staff if empty
  const staffCheck = await client.query("SELECT COUNT(*) FROM technical_staff");
  if (parseInt(staffCheck.rows[0].count) === 0) {
    console.log("Seeding dummy technical staff...");
    await client.query(`
      INSERT INTO technical_staff (id, project_id, name, designation, remark) VALUES
      ('s1', 'prj_emerald', 'Suresh Sharma', 'Project Manager', 'Lead project manager'),
      ('s2', 'prj_emerald', 'Rohan Mehta', 'Site Engineer', 'R.C.C. block supervision'),
      ('s3', 'prj_emerald', 'Priya Sharma', 'QC Auditor', 'Quality control and structural checks'),
      ('s4', 'prj_emerald', 'Vijay Yadav', 'Safety Officer', 'Health and safety coordinator')
    `);
  }

  // Users table enhancements (company_access, project_access_id, mobile, status)
  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS company_access VARCHAR(255),
    ADD COLUMN IF NOT EXISTS project_access_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS mobile VARCHAR(50),
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'
  `);
  await client.query(`
    ALTER TABLE users
    ALTER COLUMN project_access_id TYPE TEXT
  `);

  // New RBAC tables
  await client.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL
    )
  `);

  const rolesCount = await client.query('SELECT COUNT(*) FROM roles');
  if (parseInt(rolesCount.rows[0].count) === 0) {
    console.log('Seeding default roles...');
    await client.query(`
      INSERT INTO roles (id, name) VALUES
      ('admin', 'Admin'),
      ('planning_team', 'Planning Team'),
      ('project_manager', 'Project Manager'),
      ('site_engineer', 'Site Engineer'),
      ('department_head', 'Department Head'),
      ('management', 'Management')
    `);
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS modules (
      id VARCHAR(50) PRIMARY KEY,
      parent_module_id VARCHAR(50) REFERENCES modules(id) ON DELETE CASCADE,
      module_name VARCHAR(255) NOT NULL,
      route VARCHAR(255),
      display_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE
    )
  `);

  const modulesCount = await client.query('SELECT COUNT(*) FROM modules');
  if (parseInt(modulesCount.rows[0].count) === 0) {
    console.log('Seeding default modules...');
    await client.query(`
      INSERT INTO modules (id, parent_module_id, module_name, route, display_order) VALUES
      ('dashboard', NULL, 'Dashboard', '/', 1),
      ('dpr_group', NULL, 'Progress', NULL, 2),
      ('technical_staff', NULL, 'Technical Staff', '/technical-staff', 3),
      ('contractor_master', NULL, 'Contractors', '/contractors', 4),
      ('schedule_group', NULL, 'Schedule', NULL, 5),
      ('analytics_group', NULL, 'Analytics', NULL, 6),
      ('wbs_group', NULL, 'WBS', NULL, 7),
      ('admin_group', NULL, 'Admin', NULL, 8),
      ('collaboration', NULL, 'Collaboration', '/collaboration', 9),
      
      -- Progress children
      ('dpr_entry', 'dpr_group', 'DPR', '/progress?tab=dpr', 1),
      ('wpr_entry', 'dpr_group', 'WPR', '/progress?tab=wpr', 2),
      ('mpr_entry', 'dpr_group', 'MPR', '/progress?tab=mpr', 3),
      
      -- Schedule children
      ('wbs_management', 'schedule_group', 'Schedule Builder', '/scheduler', 1),
      ('schedule_monitor', 'schedule_group', 'Schedule Monitor', '/schedule-monitor', 2),
      
      -- Analytics children
      ('dpr_reports', 'analytics_group', 'Reports', '/reports', 1),
      ('labour_productivity', 'analytics_group', 'Labour Productivity', '/analytics/labour-productivity', 2),
      
      -- WBS children
      ('budget', 'wbs_group', 'Budget', '/budget', 2),
      ('cost_controls', 'wbs_group', 'Cost Controls', '/cost', 3),
      
      -- Admin children
      ('admin_panel', 'admin_group', 'Administration', '/admin', 1),
      ('project_master', 'admin_group', 'Projects', '/projects', 2)
    `);
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id VARCHAR(50) REFERENCES roles(id) ON DELETE CASCADE,
      module_id VARCHAR(50) REFERENCES modules(id) ON DELETE CASCADE,
      can_view BOOLEAN DEFAULT FALSE,
      can_add BOOLEAN DEFAULT FALSE,
      can_edit BOOLEAN DEFAULT FALSE,
      can_delete BOOLEAN DEFAULT FALSE,
      can_approve BOOLEAN DEFAULT FALSE,
      can_export BOOLEAN DEFAULT FALSE,
      can_print BOOLEAN DEFAULT FALSE,
      can_admin BOOLEAN DEFAULT FALSE,
      PRIMARY KEY (role_id, module_id)
    )
  `);

  const permissionsCount = await client.query('SELECT COUNT(*) FROM role_permissions');
  if (parseInt(permissionsCount.rows[0].count) === 0) {
    console.log('Seeding default role permissions...');
    await client.query(`
      INSERT INTO role_permissions (role_id, module_id, can_view, can_add, can_edit, can_delete, can_approve, can_export, can_print, can_admin)
      SELECT r.id, m.id, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE
      FROM roles r, modules m
      WHERE r.id = 'admin'
    `);

    await client.query(`
      INSERT INTO role_permissions (role_id, module_id, can_view)
      SELECT r.id, 'dashboard', TRUE
      FROM roles r
      WHERE r.id <> 'admin'
    `);

    await client.query(`
      INSERT INTO role_permissions (role_id, module_id, can_view) VALUES
      ('planning_team', 'projects_mgt', TRUE),
      ('planning_team', 'project_master', TRUE),
      ('planning_team', 'sub_project', TRUE),
      ('planning_team', 'wbs_group', TRUE),
      ('planning_team', 'wbs_management', TRUE),
      ('planning_team', 'wbs_import', TRUE),
      ('planning_team', 'collaboration', TRUE),
      ('project_manager', 'projects_mgt', TRUE),
      ('project_manager', 'project_master', TRUE),
      ('project_manager', 'sub_project', TRUE),
      ('project_manager', 'wbs_group', TRUE),
      ('project_manager', 'budget', TRUE),
      ('project_manager', 'cost_controls', TRUE),
      ('project_manager', 'dpr_group', TRUE),
      ('project_manager', 'dpr_entry', TRUE),
      ('project_manager', 'analytics_group', TRUE),
      ('project_manager', 'labour_productivity', TRUE),
      ('project_manager', 'dpr_reports', TRUE),
      ('project_manager', 'collaboration', TRUE),
      ('site_engineer', 'dpr_group', TRUE),
      ('site_engineer', 'dpr_entry', TRUE),
      ('site_engineer', 'labour_details', TRUE),
      ('site_engineer', 'technical_staff', TRUE),
      ('site_engineer', 'material_status', TRUE),
      ('site_engineer', 'machinery_details', TRUE),
      ('site_engineer', 'day_report', TRUE),
      ('site_engineer', 'collaboration', TRUE),
      ('department_head', 'analytics_group', TRUE),
      ('department_head', 'dpr_reports', TRUE),
      ('department_head', 'collaboration', TRUE),
      ('management', 'analytics_group', TRUE),
      ('management', 'dpr_reports', TRUE),
      ('management', 'collaboration', TRUE)
    `);
  }

  // Create dprs table
  await client.query(`
    CREATE TABLE IF NOT EXISTS dprs (
      id VARCHAR(50) PRIMARY KEY,
      project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
      sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      status VARCHAR(50) DEFAULT 'draft',
      created_by VARCHAR(255),
      created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      submitted_by VARCHAR(255),
      submitted_date TIMESTAMP,
      approved_by VARCHAR(255),
      approved_date TIMESTAMP,
      reopened_by VARCHAR(255),
      reopened_date TIMESTAMP,
      last_updated_by VARCHAR(255),
      last_updated_date TIMESTAMP,
      reopen_reason TEXT,
      UNIQUE (project_id, sub_project_id, date)
    )
  `);

  // Create wbs_headers table
  await client.query(`
    CREATE TABLE IF NOT EXISTS wbs_headers (
      id VARCHAR(50) PRIMARY KEY,
      project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
      sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE,
      status VARCHAR(50) DEFAULT 'draft',
      version_no INTEGER DEFAULT 1,
      submitted_by VARCHAR(255),
      submitted_date TIMESTAMP,
      approved_by VARCHAR(255),
      approved_date TIMESTAMP,
      returned_by VARCHAR(255),
      returned_date TIMESTAMP,
      return_reason TEXT,
      last_uploaded_by VARCHAR(255),
      last_uploaded_date TIMESTAMP,
      reviewers JSONB DEFAULT '[]',
      approved_reviewers JSONB DEFAULT '[]',
      UNIQUE (project_id, sub_project_id)
    )
  `);

  // Create wbs_approval_history table
  await client.query(`
    CREATE TABLE IF NOT EXISTS wbs_approval_history (
      id VARCHAR(50) PRIMARY KEY,
      project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
      sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE,
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      user_email VARCHAR(255),
      action VARCHAR(255),
      remarks TEXT,
      version_no INTEGER
    )
  `);

  // Seed Department Head Users
  console.log('Seeding default department head users...');
  await client.query(`
    INSERT INTO users (id, email, role, password_hash, status) VALUES
    ('usr_civil_head', 'civil.head@planedge.co', 'department_head', '$2a$10$0BvHq7WcYjLWYbezQR0Leu0kwU/v1P4bjgAl7vyEAD7Yfblkq2u3u', 'active'),
    ('usr_mep_head', 'mep.head@planedge.co', 'department_head', '$2a$10$0BvHq7WcYjLWYbezQR0Leu0kwU/v1P4bjgAl7vyEAD7Yfblkq2u3u', 'active'),
    ('usr_planning_head', 'planning.head@planedge.co', 'department_head', '$2a$10$0BvHq7WcYjLWYbezQR0Leu0kwU/v1P4bjgAl7vyEAD7Yfblkq2u3u', 'active'),
    ('usr_qaqc_head', 'qaqc.head@planedge.co', 'department_head', '$2a$10$0BvHq7WcYjLWYbezQR0Leu0kwU/v1P4bjgAl7vyEAD7Yfblkq2u3u', 'active'),
    ('usr_safety_head', 'safety.head@planedge.co', 'department_head', '$2a$10$0BvHq7WcYjLWYbezQR0Leu0kwU/v1P4bjgAl7vyEAD7Yfblkq2u3u', 'active'),
    ('usr_commercial_head', 'commercial.head@planedge.co', 'department_head', '$2a$10$0BvHq7WcYjLWYbezQR0Leu0kwU/v1P4bjgAl7vyEAD7Yfblkq2u3u', 'active'),
    ('usr_finishing_head', 'finishing.head@planedge.co', 'department_head', '$2a$10$0BvHq7WcYjLWYbezQR0Leu0kwU/v1P4bjgAl7vyEAD7Yfblkq2u3u', 'active'),
    ('usr_electrical_head', 'electrical.head@planedge.co', 'department_head', '$2a$10$0BvHq7WcYjLWYbezQR0Leu0kwU/v1P4bjgAl7vyEAD7Yfblkq2u3u', 'active')
    ON CONFLICT (id) DO NOTHING
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
