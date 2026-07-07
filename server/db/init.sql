-- Drop existing tables if they exist to allow clean reset
DROP TABLE IF EXISTS next_days_plans CASCADE;
DROP TABLE IF EXISTS critical_issues CASCADE;
DROP TABLE IF EXISTS special_site_visits CASCADE;
DROP TABLE IF EXISTS status_reports CASCADE;
DROP TABLE IF EXISTS days_reports CASCADE;
DROP TABLE IF EXISTS machinery_details CASCADE;
DROP TABLE IF EXISTS material_status CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS collaboration_posts CASCADE;
DROP TABLE IF EXISTS change_events CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS quality_inspections CASCADE;
DROP TABLE IF EXISTS attendance_entries CASCADE;
DROP TABLE IF EXISTS progress_entries CASCADE;
DROP TABLE IF EXISTS milestones CASCADE;
DROP TABLE IF EXISTS budget_items CASCADE;
DROP TABLE IF EXISTS schedule_activities CASCADE;
DROP TABLE IF EXISTS wbs_template_items CASCADE;
DROP TABLE IF EXISTS wbs_items CASCADE;
DROP TABLE IF EXISTS schedule_tasks CASCADE;
DROP TABLE IF EXISTS scheduling_rules CASCADE;
DROP TABLE IF EXISTS project_flats CASCADE;
DROP TABLE IF EXISTS sub_projects CASCADE;
DROP TABLE IF EXISTS mep_boqs CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users Table
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    password_hash VARCHAR(255) NOT NULL,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_id VARCHAR(50)
);

-- 2. Projects Table
CREATE TABLE projects (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    project_code VARCHAR(100),
    description TEXT,
    location VARCHAR(255),
    client VARCHAR(255),
    status VARCHAR(50) DEFAULT 'planning',
    start_date DATE,
    end_date DATE,
    budget NUMERIC(15, 2) DEFAULT 0,
    spent NUMERIC(15, 2) DEFAULT 0,
    progress NUMERIC(5, 2) DEFAULT 0,
    project_manager VARCHAR(255),
    priority VARCHAR(50) DEFAULT 'medium',
    project_type VARCHAR(100),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL
);

-- 2b. Sub-Projects Table
CREATE TABLE sub_projects (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    built_up_area NUMERIC(15, 2) DEFAULT 0,
    floors_count INTEGER DEFAULT 1,
    flats_per_floor INTEGER DEFAULT 0,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. WBS Items Table
CREATE TABLE wbs_items (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
    sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    activity_id VARCHAR(50),
    activity_code VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    level INTEGER NOT NULL,
    parent_id VARCHAR(50) REFERENCES wbs_items(id) ON DELETE CASCADE,
    planned_quantity NUMERIC(12, 2) DEFAULT 0,
    actual_quantity NUMERIC(12, 2) DEFAULT 0,
    unit VARCHAR(50),
    lumsum_rate NUMERIC(15, 2) DEFAULT 0,
    total_days NUMERIC(10, 2) DEFAULT 0,
    source_upload_type VARCHAR(30),
    level_label VARCHAR(50),
    progress NUMERIC(5, 2) DEFAULT 0,
    budget_amount NUMERIC(15, 2) DEFAULT 0,
    order_index INTEGER DEFAULT 0
);

-- 3b. Standard WBS Template (global format for all projects)
CREATE TABLE wbs_template_items (
    wbs_id VARCHAR(20) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    level INTEGER NOT NULL,
    parent_wbs_id VARCHAR(20) REFERENCES wbs_template_items(wbs_id) ON DELETE CASCADE,
    order_index INTEGER DEFAULT 0,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Schedule Activities Table
CREATE TABLE schedule_activities (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
    wbs_item_id VARCHAR(50) REFERENCES wbs_items(id) ON DELETE SET NULL,
    activity_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    phase VARCHAR(50),
    planned_start DATE,
    planned_end DATE,
    actual_start DATE,
    actual_end DATE,
    duration_days INTEGER DEFAULT 0,
    float_days INTEGER DEFAULT 0,
    progress NUMERIC(5, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'not_started',
    predecessors JSONB DEFAULT '[]',
    successors JSONB DEFAULT '[]',
    dependency_type VARCHAR(50) DEFAULT 'FS',
    is_critical_path BOOLEAN DEFAULT false,
    is_milestone BOOLEAN DEFAULT false,
    assigned_crew VARCHAR(255),
    resources_needed TEXT,
    labor_count INTEGER DEFAULT 0,
    order_index INTEGER DEFAULT 0,
    budget_item_id VARCHAR(50)
);

-- 5. Budget Items Table
CREATE TABLE budget_items (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
    wbs_item_id VARCHAR(50) REFERENCES wbs_items(id) ON DELETE SET NULL,
    code VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    level INTEGER NOT NULL,
    parent_id VARCHAR(50) REFERENCES budget_items(id) ON DELETE CASCADE,
    quantity NUMERIC(12, 2),
    cost_per_unit NUMERIC(12, 2),
    unit VARCHAR(50),
    original_budget NUMERIC(15, 2) DEFAULT 0,
    revised_budget NUMERIC(15, 2) DEFAULT 0,
    committed_cost NUMERIC(15, 2) DEFAULT 0,
    actual_cost NUMERIC(15, 2) DEFAULT 0,
    forecast_cost NUMERIC(15, 2) DEFAULT 0,
    revision_notes TEXT,
    revision_number INTEGER DEFAULT 0,
    sub_project VARCHAR(100),
    rate_per_sqft NUMERIC(12, 2) DEFAULT 0
);

-- 6. Milestones Table
CREATE TABLE milestones (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    phase VARCHAR(50),
    status VARCHAR(50) DEFAULT 'not_started',
    planned_start DATE,
    planned_end DATE,
    actual_start DATE,
    actual_end DATE,
    progress NUMERIC(5, 2) DEFAULT 0,
    dependencies JSONB DEFAULT '[]',
    assigned_to VARCHAR(255),
    priority VARCHAR(50) DEFAULT 'medium'
);

-- 7. Progress Entries Table
CREATE TABLE progress_entries (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
    budget_item_id VARCHAR(50) REFERENCES budget_items(id) ON DELETE SET NULL,
    wbs_item_id VARCHAR(50) REFERENCES wbs_items(id) ON DELETE SET NULL,
    milestone_id VARCHAR(50) REFERENCES milestones(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    report_type VARCHAR(50) DEFAULT 'daily',
    submitted_by VARCHAR(255),
    work_done_description TEXT,
    quantity_done NUMERIC(12, 2) DEFAULT 0,
    unit VARCHAR(50),
    labor_count INTEGER DEFAULT 0,
    photo_urls JSONB DEFAULT '[]',
    location_tag VARCHAR(255),
    issues_reported TEXT,
    weather_condition VARCHAR(100),
    status VARCHAR(50) DEFAULT 'submitted',
    value_of_work_done NUMERIC(15, 2) DEFAULT 0
);

-- 8. Attendance Entries Table
CREATE TABLE attendance_entries (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
    worker_name VARCHAR(255) NOT NULL,
    trade VARCHAR(255),
    date DATE NOT NULL,
    status VARCHAR(50) NOT NULL,
    shift VARCHAR(50) DEFAULT 'full',
    remarks TEXT
);

-- 9. Quality Inspections Table
CREATE TABLE quality_inspections (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
    milestone_id VARCHAR(50) REFERENCES milestones(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    inspection_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'scheduled',
    inspector_name VARCHAR(255),
    inspection_date DATE,
    findings TEXT,
    severity VARCHAR(50) DEFAULT 'minor',
    corrective_action TEXT,
    photos JSONB DEFAULT '[]',
    compliance_score NUMERIC(5, 2) DEFAULT 0
);

-- 10. Documents Table
CREATE TABLE documents (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    file_url VARCHAR(500),
    file_name VARCHAR(255),
    revision VARCHAR(50),
    revision_notes TEXT,
    uploaded_by VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    tags JSONB DEFAULT '[]'
);

-- 11. Change Events Table
CREATE TABLE change_events (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
    activity_id VARCHAR(50) REFERENCES schedule_activities(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    impact_days INTEGER DEFAULT 0,
    impact_cost NUMERIC(15, 2) DEFAULT 0,
    severity VARCHAR(50) DEFAULT 'minor',
    status VARCHAR(50) DEFAULT 'pending',
    raised_by VARCHAR(255),
    assigned_to VARCHAR(255),
    resolution TEXT,
    attachments JSONB DEFAULT '[]'
);

-- 12. Collaboration Posts Table
CREATE TABLE collaboration_posts (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
    author_name VARCHAR(255) NOT NULL,
    author_id VARCHAR(50),
    category VARCHAR(100) DEFAULT 'general',
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    priority VARCHAR(50) DEFAULT 'normal',
    tags JSONB DEFAULT '[]',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Notifications Table
CREATE TABLE notifications (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50),
    is_read BOOLEAN DEFAULT false,
    target_user_id VARCHAR(50),
    link VARCHAR(255),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. Schedule Tasks Table
CREATE TABLE schedule_tasks (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    phase VARCHAR(50),
    start_date DATE,
    end_date DATE,
    duration_days INTEGER DEFAULT 0,
    progress NUMERIC(5, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'not_started',
    dependencies JSONB DEFAULT '[]',
    assigned_crew VARCHAR(255),
    resources_needed TEXT,
    is_critical_path BOOLEAN DEFAULT false,
    order_index INTEGER DEFAULT 0
);

-- 15. Scheduling Rules Table
CREATE TABLE scheduling_rules (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    project_type VARCHAR(100),
    rule_type VARCHAR(50),
    condition VARCHAR(255),
    action VARCHAR(255),
    parameters TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by VARCHAR(255)
);

-- 17. Project Flats Table
CREATE TABLE project_flats (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
    sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE,
    floor_number INTEGER NOT NULL,
    flat_number VARCHAR(50) NOT NULL,
    area_sqft NUMERIC(12, 2) DEFAULT 0,
    cost_estimate NUMERIC(15, 2) DEFAULT 0,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 18. MEP BOQ Table
CREATE TABLE mep_boqs (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
    budget_head_code VARCHAR(50) NOT NULL,
    activity_name VARCHAR(255) NOT NULL,
    scope_type VARCHAR(50) NOT NULL DEFAULT 'flat',
    unit VARCHAR(50) DEFAULT 'Nos',
    rate_per_unit NUMERIC(15, 2) DEFAULT 0,
    quantity_per_scope NUMERIC(12, 2) DEFAULT 1,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- SEED DATA SEEDING ---

-- Seed Users
-- adminpassword -> bcrypt hash: $2a$10$j0XLi/qB/vLfSGfwzLZG3OnFsyoEcSz3rfHlC6//rFNfwgbOkGdVK
-- pmpassword -> bcrypt hash: $2a$10$0BvHq7WcYjLWYbezQR0Leu0kwU/v1P4bjgAl7vyEAD7Yfblkq2u3u
INSERT INTO users (id, email, role, password_hash) VALUES
('usr_admin', 'admin@planedge.co', 'admin', '$2a$10$j0XLi/qB/vLfSGfwzLZG3OnFsyoEcSz3rfHlC6//rFNfwgbOkGdVK'),
('usr_pm', 'pm@planedge.co', 'user', '$2a$10$0BvHq7WcYjLWYbezQR0Leu0kwU/v1P4bjgAl7vyEAD7Yfblkq2u3u');

-- Seed Projects
INSERT INTO projects (id, name, description, location, client, status, start_date, end_date, budget, spent, progress, project_manager, priority, project_type, created_by_id) VALUES
('prj_emerald', 'Ganga Residency', 'A 12-storey premium residential tower with glass facade, subterranean parking, and sustainable green rooftop design in Mumbai.', 'Worli Sea Face, Mumbai', 'Lodha Estates Private Limited', 'in_progress', '2026-01-01', '2027-06-30', 120000000.00, 78000000.00, 65.00, 'Suresh Sharma', 'high', 'residential', 'usr_admin'),
('prj_oceanic', 'Noida Commercial Galleria', 'Multi-level commercial retail mall featuring a cinema complex, food court, and central atrium plaza.', 'Sector 62, Noida, Uttar Pradesh', 'DLF Commercial Projects', 'planning', '2026-08-01', '2028-02-28', 280000000.00, 15000000.00, 12.00, 'Amit Patel', 'medium', 'commercial', 'usr_admin'),
('prj_highway', 'NH-8 Pune-Solapur Highway Extension', 'Widening of the existing 4-lane state highway to a 6-lane divided freeway, including structural upgrades to two overpasses.', 'Pune to Solapur Expressway, Km 45 to 58', 'National Highways Authority of India (NHAI)', 'delayed', '2025-10-01', '2026-11-30', 85000000.00, 48000000.00, 45.00, 'Rohan Mehta', 'critical', 'infrastructure', 'usr_admin');

-- Seed WBS Items
INSERT INTO wbs_items (id, project_id, code, title, description, level, parent_id, planned_quantity, actual_quantity, unit, progress, budget_amount, order_index) VALUES
-- Ganga Residency
('wbs_em_sub', 'prj_emerald', '1.0', 'Substructure & Foundation', 'Excavation, piling, and ground floor raft slab concrete works.', 1, NULL, 1.0, 1.0, 'LS', 100.00, 25000000.00, 0),
('wbs_em_exc', 'prj_emerald', '1.1', 'Excavation & Shoring', 'Deep excavation for two basement levels including sheet piling and shoring installation.', 2, 'wbs_em_sub', 45000.00, 45000.00, 'm3', 100.00, 15000000.00, 1),
('wbs_em_con', 'prj_emerald', '1.2', 'Concrete Footings & Slab', 'Pouring foundation concrete footings and the ground level slab.', 2, 'wbs_em_sub', 8000.00, 8000.00, 'm3', 100.00, 10000000.00, 2),

('wbs_em_sup', 'prj_emerald', '2.0', 'Superstructure & Core', 'Concrete column framing, shear walls, and floor slabs for all 12 storeys.', 1, NULL, 1.0, 0.75, 'LS', 75.00, 50000000.00, 3),
('wbs_em_frm1', 'prj_emerald', '2.1', 'Concrete Frame (Floors 1-6)', 'Reinforced concrete columns, beams, and slabs for levels 1 through 6.', 2, 'wbs_em_sup', 6.0, 6.0, 'floors', 100.00, 30000000.00, 4),
('wbs_em_frm2', 'prj_emerald', '2.2', 'Concrete Frame (Floors 7-12)', 'Reinforced concrete columns, beams, and slabs for levels 7 through 12.', 2, 'wbs_em_sup', 6.0, 3.0, 'floors', 50.00, 20000000.00, 5),

('wbs_em_mep', 'prj_emerald', '3.0', 'MEP & Rough-ins', 'Mechanical, electrical, HVAC, and plumbing piping installations app-wide.', 1, NULL, 1.0, 0.3, 'LS', 30.00, 25000000.00, 6),
('wbs_em_ele', 'prj_emerald', '3.1', 'Electrical Rough-ins', 'Laying cable conduits, cable trays, and pull boxes.', 2, 'wbs_em_mep', 12.0, 6.0, 'floors', 50.00, 12000000.00, 7),
('wbs_em_hvac', 'prj_emerald', '3.2', 'HVAC & Plumbing', 'Installing ductwork, water supply lines, and drainage piping.', 2, 'wbs_em_mep', 12.0, 1.2, 'floors', 10.00, 13000000.00, 8),

('wbs_em_fin', 'prj_emerald', '4.0', 'Interior Finishing & Facade', 'Exterior glazing panels, drywall partitions, flooring, painting, and fixtures.', 1, NULL, 1.0, 0.15, 'LS', 15.00, 20000000.00, 9),
('wbs_em_fac', 'prj_emerald', '4.1', 'Facade Cladding', 'Installation of outer framing and curtain glass cladding panels.', 2, 'wbs_em_fin', 4800.00, 1440.00, 'm2', 30.00, 10000000.00, 10),
('wbs_em_dry', 'prj_emerald', '4.2', 'Drywall & Painting', 'Metal wall framing, drywall hanging, skim coat, and primer/painting.', 2, 'wbs_em_fin', 12.0, 0.0, 'floors', 0.00, 10000000.00, 11);

-- Seed Schedule Activities
INSERT INTO schedule_activities (id, project_id, wbs_item_id, activity_id, name, description, phase, planned_start, planned_end, actual_start, actual_end, duration_days, float_days, progress, status, predecessors, successors, dependency_type, is_critical_path, is_milestone, assigned_crew, resources_needed, labor_count, order_index) VALUES
('act_em_mob', 'prj_emerald', 'wbs_em_sub', 'A1000', 'Mobilization & Site Setup', 'Move site offices, set up perimeter fencing, water, and power lines.', 'foundation', '2026-01-01', '2026-01-10', '2026-01-01', '2026-01-10', 10, 0, 100.00, 'completed', '[]', '["A1010"]', 'FS', true, false, 'Raj Civil Contractor', 'Portacabins, barricades', 8, 0),
('act_em_exc', 'prj_emerald', 'wbs_em_exc', 'A1010', 'Excavation & Shoring', 'Excavate basements, install structural shoring and sheet piles.', 'foundation', '2026-01-11', '2026-01-30', '2026-01-11', '2026-01-31', 20, 0, 100.00, 'completed', '["A1000"]', '["A1020"]', 'FS', true, false, 'Balaji Excavators', 'Excavators, dumper trucks', 12, 1),
('act_em_pil', 'prj_emerald', 'wbs_em_con', 'A1020', 'Foundation Piling & Concrete Pour', 'Bored piles, rebar cage install, and concrete pour for raft foundation.', 'foundation', '2026-02-01', '2026-02-25', '2026-02-01', '2026-02-25', 25, 0, 100.00, 'completed', '["A1010"]', '["A1030"]', 'FS', true, false, 'Indus Piling Crew', 'Drill rig, concrete transit mixers', 18, 2),
('act_em_col1', 'prj_emerald', 'wbs_em_frm1', 'A1030', 'Columns & Shear Walls (L1-L3)', 'Reinforced concrete framing for lower level structural vertical items.', 'structure', '2026-02-26', '2026-03-12', '2026-02-26', '2026-03-13', 15, 0, 100.00, 'completed', '["A1020"]', '["A1040"]', 'FS', true, false, 'Royal Shuttering Team', 'Formwork, TMT rebar', 16, 3),
('act_em_slb1', 'prj_emerald', 'wbs_em_frm1', 'A1040', 'Slab Casting (L1-L3)', 'Concrete casting and curing for floor levels 1, 2, and 3.', 'structure', '2026-03-13', '2026-03-27', '2026-03-14', '2026-03-28', 15, 0, 100.00, 'completed', '["A1030"]', '["A1050", "A1090"]', 'FS', true, false, 'L&T Concrete Sub', 'Scaffolding, RMC concrete', 22, 4),
('act_em_col2', 'prj_emerald', 'wbs_em_frm1', 'A1050', 'Columns & Shear Walls (L4-L6)', 'Reinforced concrete columns and shear walls for mid levels.', 'structure', '2026-03-28', '2026-04-11', '2026-03-29', '2026-04-12', 15, 0, 100.00, 'completed', '["A1040"]', '["A1060"]', 'FS', true, false, 'Royal Shuttering Team', 'Rebar, tower crane', 16, 5),
('act_em_slb2', 'prj_emerald', 'wbs_em_frm1', 'A1060', 'Slab Casting (L4-L6)', 'Concrete slab casting and curing for levels 4, 5, and 6.', 'structure', '2026-04-12', '2026-04-26', '2026-04-13', '2026-04-27', 15, 0, 100.00, 'completed', '["A1050"]', '["A1070", "A1100", "A1110", "A1120"]', 'FS', true, false, 'L&T Concrete Sub', 'Formwork, tower crane', 22, 6),
('act_em_col3', 'prj_emerald', 'wbs_em_frm2', 'A1070', 'Columns & Shear Walls (L7-L12)', 'Framing and structural concrete works for upper floor columns.', 'structure', '2026-04-27', '2026-05-21', '2026-04-28', NULL, 25, 0, 60.00, 'in_progress', '["A1060"]', '["A1080"]', 'FS', true, false, 'Royal Shuttering Team', 'RMC Concrete, metal scaffolding', 14, 7),
('act_em_slb3', 'prj_emerald', 'wbs_em_frm2', 'A1080', 'Slab Casting (L7-L12)', 'Casting and finishing upper suspended concrete floor slabs.', 'structure', '2026-05-22', '2026-06-15', NULL, NULL, 25, 0, 0.00, 'not_started', '["A1070"]', '["A1150"]', 'FS', true, false, 'L&T Concrete Sub', 'Pump mix, power float', 0, 8),
('act_em_conduit', 'prj_emerald', 'wbs_em_ele', 'A1090', 'Electrical Conduit Laying (L1-L6)', 'Running vertical conduit lines and embedded piping in floor slabs.', 'mep', '2026-03-28', '2026-04-11', '2026-03-29', '2026-04-12', 15, 15, 100.00, 'completed', '["A1040"]', '["A1130"]', 'FS', false, false, 'Patel Electricals', 'PVC conduits, junction boxes', 8, 9),
('act_em_hvac1', 'prj_emerald', 'wbs_em_hvac', 'A1100', 'HVAC Duct Installation (L1-L6)', 'Fabrication and hanging of air conditioning and ventilation sheet metal ducts.', 'mep', '2026-04-27', '2026-05-16', '2026-05-02', NULL, 20, 12, 40.00, 'in_progress', '["A1060"]', '["A1130"]', 'FS', false, false, 'Voltas MEP Team', 'GI sheets, hangers, dampers', 6, 10),
('act_em_plumb1', 'prj_emerald', 'wbs_em_hvac', 'A1110', 'Plumbing Piping & Drainage (L1-L6)', 'Installing supply lines, soil pipes, and bathroom risers for lower floors.', 'mep', '2026-04-27', '2026-05-14', '2026-05-05', NULL, 18, 14, 20.00, 'in_progress', '["A1060"]', '["A1130"]', 'FS', false, false, 'Aashirvad Pipes Team', 'UPVC pipes, fittings, valves', 5, 11),
('act_em_facade', 'prj_emerald', 'wbs_em_fac', 'A1120', 'Facade Cladding & Glazing', 'Mounting aluminum framing and curtain glass units on building exterior.', 'finishing', '2026-04-27', '2026-05-26', '2026-05-10', NULL, 30, 5, 30.00, 'delayed', '["A1060"]', '["A1140"]', 'FS', false, false, 'Saint-Gobain Glazing', 'Curtain wall panels, suspended cradle', 6, 12),
('act_em_drywall', 'prj_emerald', 'wbs_em_dry', 'A1130', 'Drywall Gypsum Board Panels', 'Metal studs layout, drywall hanging, and plaster sealing.', 'finishing', '2026-05-17', '2026-06-10', NULL, NULL, 25, 10, 0.00, 'not_started', '["A1100", "A1110"]', '["A1140"]', 'FS', false, false, 'Gyproc Drywall Crew', 'Gypsum boards, GI channels', 0, 13),
('act_em_paint', 'prj_emerald', 'wbs_em_dry', 'A1140', 'Painting & Tile Work (L1-L6)', 'Screeding, tile laying in wet areas, and wall paint primer & finishes.', 'finishing', '2026-06-11', '2026-07-10', NULL, NULL, 30, 5, 0.00, 'not_started', '["A1120", "A1130"]', '["A1150"]', 'FS', false, false, 'Asian Paints Sub', 'Acrylic emulsion, wall putty', 0, 14),
('act_em_test', 'prj_emerald', 'wbs_em_mep', 'A1150', 'Testing & Commissioning', 'Testing mechanical pumps, electrical load checks, and HVAC airflow tests.', 'handover', '2026-07-11', '2026-07-25', NULL, NULL, 15, 0, 0.00, 'not_started', '["A1080", "A1140"]', '["A1160"]', 'FS', true, false, 'Sterling & Wilson QC', 'Insulation testers, flow hoods', 0, 15),
('act_em_handover', 'prj_emerald', 'wbs_em_sub', 'A1160', 'Client Inspection & Handover', 'Joint site walkthrough with client, snag list resolution, and key handover.', 'handover', '2026-07-26', '2026-08-01', NULL, NULL, 7, 0, 0.00, 'not_started', '["A1150"]', '[]', 'FS', true, true, 'Ganga Project Management', 'O&M manuals, snag lists', 0, 16);

-- Seed Budget Items
-- The 21 new Budget heads
INSERT INTO budget_items (id, project_id, wbs_item_id, code, title, level, parent_id, quantity, cost_per_unit, unit, original_budget, revised_budget, committed_cost, actual_cost, forecast_cost, revision_notes, revision_number) VALUES
('bud_1', 'prj_emerald', NULL, '01-EAR', 'Earth Work', 1, NULL, NULL, NULL, NULL, 3000000.00, 3000000.00, 2800000.00, 2800000.00, 3000000.00, 'Initial L1 budget.', 0),
('bud_2', 'prj_emerald', NULL, '02-RCC', 'RCC Work', 1, NULL, NULL, NULL, NULL, 50000000.00, 50000000.00, 45000000.00, 42000000.00, 50000000.00, 'Initial L1 budget.', 0),
('bud_3', 'prj_emerald', NULL, '03-MAS', 'Masonry, Plaster Work', 1, NULL, NULL, NULL, NULL, 8000000.00, 8000000.00, 0.00, 0.00, 8000000.00, 'Initial L1 budget.', 0),
('bud_4', 'prj_emerald', NULL, '04-WPF', 'Waterproofing Work', 1, NULL, NULL, NULL, NULL, 4000000.00, 4000000.00, 0.00, 0.00, 4000000.00, 'Initial L1 budget.', 0),
('bud_5', 'prj_emerald', NULL, '05-DOO', 'Doors & Wooden Works', 1, NULL, NULL, NULL, NULL, 7000000.00, 7000000.00, 0.00, 0.00, 7000000.00, 'Initial L1 budget.', 0),
('bud_6', 'prj_emerald', NULL, '06-WIN', 'Windows & Sliding Doors', 1, NULL, NULL, NULL, NULL, 8000000.00, 8000000.00, 0.00, 0.00, 8000000.00, 'Initial L1 budget.', 0),
('bud_7', 'prj_emerald', NULL, '07-FLR', 'Flooring and Tiling works', 1, NULL, NULL, NULL, NULL, 9000000.00, 9000000.00, 0.00, 0.00, 9000000.00, 'Initial L1 budget.', 0),
('bud_8', 'prj_emerald', NULL, '08-MSS', 'MS & SS  Works- Grills & Railings', 1, NULL, NULL, NULL, NULL, 3000000.00, 3000000.00, 0.00, 0.00, 3000000.00, 'Initial L1 budget.', 0),
('bud_9', 'prj_emerald', NULL, '09-PNT', 'Painting & Polishing Works', 1, NULL, NULL, NULL, NULL, 4000000.00, 4000000.00, 0.00, 0.00, 4000000.00, 'Initial L1 budget.', 0),
('bud_10', 'prj_emerald', NULL, '10-PLU', 'Plumbing, Drainage Work', 1, NULL, NULL, NULL, NULL, 8000000.00, 8000000.00, 0.00, 0.00, 8000000.00, 'Initial L1 budget.', 0),
('bud_11', 'prj_emerald', NULL, '11-ELE', 'Electrical Work', 1, NULL, NULL, NULL, NULL, 12000000.00, 12000000.00, 0.00, 0.00, 12000000.00, 'Initial L1 budget.', 0),
('bud_12', 'prj_emerald', NULL, '12-LFT', 'Lift Work', 1, NULL, NULL, NULL, NULL, 5000000.00, 5000000.00, 0.00, 0.00, 5000000.00, 'Initial L1 budget.', 0),
('bud_13', 'prj_emerald', NULL, '13-FF', 'Buildings Fire Fighting Work', 1, NULL, NULL, NULL, NULL, 6000000.00, 6000000.00, 0.00, 0.00, 6000000.00, 'Initial L1 budget.', 0),
('bud_14', 'prj_emerald', NULL, '14-EGF', 'Elevation, Glazing, Facade Work', 1, NULL, NULL, NULL, NULL, 1000000.00, 1000000.00, 0.00, 0.00, 1000000.00, 'Initial L1 budget.', 0),
('bud_15', 'prj_emerald', NULL, '15-BAM', 'Bldg Amenities', 1, NULL, NULL, NULL, NULL, 4000000.00, 4000000.00, 0.00, 0.00, 4000000.00, 'Initial L1 budget.', 0),
('bud_16', 'prj_emerald', NULL, '16-MIS', 'Misc, Dep. Labour, Cleaning', 1, NULL, NULL, NULL, NULL, 2000000.00, 2000000.00, 0.00, 0.00, 2000000.00, 'Initial L1 budget.', 0),
('bud_17', 'prj_emerald', NULL, '17-CIN', 'Civil Infrastructure', 1, NULL, NULL, NULL, NULL, 10000000.00, 10000000.00, 0.00, 0.00, 10000000.00, 'Initial L1 budget.', 0),
('bud_18', 'prj_emerald', NULL, '18-SCI', 'Services Civil Infrastructure', 1, NULL, NULL, NULL, NULL, 8000000.00, 8000000.00, 0.00, 0.00, 8000000.00, 'Initial L1 budget.', 0),
('bud_19', 'prj_emerald', NULL, '19-PLS', 'Plumbing Services', 1, NULL, NULL, NULL, NULL, 5000000.00, 5000000.00, 0.00, 0.00, 5000000.00, 'Initial L1 budget.', 0),
('bud_20', 'prj_emerald', NULL, '20-ELS', 'Electrical Services', 1, NULL, NULL, NULL, NULL, 6000000.00, 6000000.00, 0.00, 0.00, 6000000.00, 'Initial L1 budget.', 0),
('bud_21', 'prj_emerald', NULL, '21-PAM', 'Project Amenities', 1, NULL, NULL, NULL, NULL, 8000000.00, 8000000.00, 0.00, 0.00, 8000000.00, 'Initial L1 budget.', 0),

-- Child items
('bud_em_exc', 'prj_emerald', 'wbs_em_exc', '01-EAR-01', 'Basement Excavation & Earthworks', 2, 'bud_1', 5000.00, 3000.00, 'm3', 15000000.00, 15000000.00, 14800000.00, 14800000.00, 15000000.00, 'Excavation child item.', 0),
('bud_em_con', 'prj_emerald', 'wbs_em_con', '02-RCC-01', 'Foundation Footing Concrete', 2, 'bud_2', 2000.00, 5000.00, 'm3', 10000000.00, 10000000.00, 9700000.00, 9700000.00, 10000000.00, 'Concrete child item.', 0),
('bud_em_frm', 'prj_emerald', 'wbs_em_frm1', '02-RCC-02', 'Columns and Floor Slab Structure', 2, 'bud_2', 10000.00, 3100.00, 'm3', 31000000.00, 31000000.00, 28000000.00, 26000000.00, 30500000.00, 'Frame structure child.', 0),
('bud_em_mas', 'prj_emerald', 'wbs_em_frm2', '03-MAS-01', 'Blockwork Masonry Partition Walls', 2, 'bud_3', 8400.00, 2500.00, 'sqm', 21000000.00, 21000000.00, 13000000.00, 12000000.00, 21000000.00, 'Masonry child.', 0),
('bud_em_ele', 'prj_emerald', 'wbs_em_ele', '11-ELE-01', 'PVC Conduit Laying & Wiring', 2, 'bud_11', 10000.00, 120.00, 'meters', 1200000.00, 1200000.00, 0.00, 0.00, 1200000.00, 'Electrical child', 0),
('bud_em_dw1', 'prj_emerald', 'wbs_em_fac', '06-WIN-01', 'Double Glazed Exterior Facade', 2, 'bud_6', 500.00, 10000.00, 'panels', 5000000.00, 5000000.00, 0.00, 0.00, 5000000.00, 'Facade glazing', 0);

-- Seed Milestones
INSERT INTO milestones (id, project_id, title, description, phase, status, planned_start, planned_end, actual_start, actual_end, progress, dependencies, assigned_to, priority) VALUES
('ms_em_sub', 'prj_emerald', 'Substructure Completion', 'Excavation completed and foundation raft slab concrete successfully cured.', 'foundation', 'completed', '2026-01-01', '2026-02-25', '2026-01-01', '2026-02-25', 100.00, '[]', 'Suresh Sharma', 'high'),
('ms_em_top', 'prj_emerald', 'Topping Out (L12 Concrete Frame)', 'Structural concrete pouring for all 12 storeys completed.', 'structure', 'in_progress', '2026-02-26', '2026-06-15', '2026-02-26', NULL, 85.00, '["ms_em_sub"]', 'Rohan Mehta', 'high'),
('ms_em_mep', 'prj_emerald', 'MEP Dry-in Approval', 'Verification of internal HVAC, piping, and wiring conduits for floors 1 to 6.', 'mep', 'in_progress', '2026-03-28', '2026-05-20', '2026-03-29', NULL, 40.00, '["ms_em_sub"]', 'Amit Patel', 'medium'),
('ms_em_facade', 'prj_emerald', 'Facade Completion', 'All glass curtain wall panels installed, rendering the tower weatherproof.', 'finishing', 'delayed', '2026-04-27', '2026-05-26', '2026-05-10', NULL, 30.00, '["ms_em_top"]', 'Suresh Sharma', 'high'),
('ms_em_handover', 'prj_emerald', 'Final Handover & Client Approval', 'Signoff of occupancy certificate and formal handover to client.', 'handover', 'not_started', '2026-07-26', '2026-08-01', NULL, NULL, 0.00, '["ms_em_facade", "ms_em_mep"]', 'Suresh Sharma', 'critical');

-- Seed Progress Entries
INSERT INTO progress_entries (id, project_id, budget_item_id, milestone_id, date, report_type, submitted_by, work_done_description, quantity_done, unit, labor_count, photo_urls, location_tag, issues_reported, weather_condition, status, value_of_work_done) VALUES
('prg_em_1', 'prj_emerald', 'bud_em_frm', 'ms_em_top', '2026-05-30', 'daily', 'Priya Sharma', 'Finished forming columns and shear walls for Floor 9. Pouring concrete in progress.', 500.00, 'm3', 14, '[]', 'Floor 9', 'Slight delay in pump arrival (30 mins).', 'Sunny, 28°C', 'approved', 1550000.00),
('prg_em_2', 'prj_emerald', 'bud_em_ele', 'ms_em_mep', '2026-06-01', 'daily', 'Vijay Yadav', 'Conduit laying for electrical panels on Floor 5 and 6 corridor lines.', 120.00, 'meters', 8, '[]', 'Floor 5', 'None.', 'Clear, 26°C', 'approved', 14400.00),
('prg_em_3', 'prj_emerald', 'bud_em_dw1', 'ms_em_facade', '2026-06-02', 'daily', 'Priya Sharma', 'Glazing panels mounted on East facade, Floor 4 section.', 18.00, 'panels', 6, '[]', 'East Facade Floor 4', 'High wind advisory halted works at 3 PM.', 'Windy, 22°C', 'submitted', 180000.00);

-- Seed Attendance Entries
INSERT INTO attendance_entries (id, project_id, worker_name, trade, date, status, shift, remarks) VALUES
('att_1', 'prj_emerald', 'Rajesh Kumar', 'carpenter', '2026-06-01', 'present', 'full', ''),
('att_2', 'prj_emerald', 'Vijay Yadav', 'mason', '2026-06-01', 'present', 'full', ''),
('att_3', 'prj_emerald', 'Ramesh Patel', 'electrician', '2026-06-02', 'present', 'morning', ''),
('att_4', 'prj_emerald', 'Sandeep Singh', 'laborer', '2026-06-02', 'absent', 'full', 'Sick'),
('att_5', 'prj_emerald', 'Priya Sharma', 'supervisor', '2026-06-03', 'present', 'full', '');

-- Seed Quality Inspections
INSERT INTO quality_inspections (id, project_id, milestone_id, title, inspection_type, status, inspector_name, inspection_date, findings, severity, corrective_action, photos, compliance_score) VALUES
('ins_1', 'prj_emerald', 'ms_em_sub', 'Foundation Reinforcement Steel Check', 'structural', 'passed', 'Priya Sharma', '2026-01-20', 'All rebar spacing, diameter, and lap lengths comply with structural drawing Rev C. Cleanout completed.', 'minor', '', '[]', 98.00),
('ins_2', 'prj_emerald', 'ms_em_top', 'L5 Concrete Core Compression Test', 'structural', 'passed', 'Priya Sharma', '2026-04-05', '28-day cylinder compressive strength met specified 35 MPa design limit.', 'minor', '', '[]', 100.00),
('ins_3', 'prj_emerald', 'ms_em_mep', 'Electrical Grounding Resistance Test L1-L3', 'electrical', 'requires_rework', 'Amit Patel', '2026-05-18', 'Grounding resistance measured high at L2 riser. Loose joints suspected.', 'moderate', 'Clean connection surfaces and re-tighten grounding terminal bolts.', '[]', 75.00);

-- Seed Documents
INSERT INTO documents (id, project_id, title, category, file_url, file_name, revision, revision_notes, uploaded_by, status, tags) VALUES
('doc_1', 'prj_emerald', 'Ganga Residency Structural Drawings', 'drawing', '', 'Structural_Design_RevD.pdf', 'D', 'Added wind load calculations for L10-L12 framing.', 'Structural Engineer Team', 'approved', '["structural", "drawings"]'),
('doc_2', 'prj_emerald', 'Method Statement for Excavation', 'method_statement', '', 'MS_Excavation_Shoring.pdf', '02', 'Incorporated design office comments.', 'Civil Designer Team', 'approved', '["excavation", "method_statement"]');

-- Seed Change Events
INSERT INTO change_events (id, project_id, activity_id, title, category, description, impact_days, impact_cost, severity, status, raised_by, assigned_to, resolution, attachments) VALUES
('chg_1', 'prj_emerald', 'act_em_exc', 'Additional Excavation Shoring', 'site_issue', 'Encountered soft clay pocket near East property line boundary. Required supplementary sheet piling and framing to prevent collapse.', 5, 450000.00, 'high', 'resolved', 'Suresh Sharma', 'Balaji Geotech Ltd', 'Added steel walers and tiebacks. Completed and inspected.', '[]'),
('chg_2', 'prj_emerald', 'act_em_col3', 'Client L8 Layout Revision Request', 'design_change', 'Modify interior partitions for units 802 and 803 to create combined penthouse layout per client instruction.', 8, 650000.00, 'medium', 'under_review', 'Lodha Estates', 'Vastu Interior Designers', '', '[]');

-- Seed Collaboration Posts
INSERT INTO collaboration_posts (id, project_id, author_name, author_id, category, title, content, attachments, priority, tags) VALUES
('post_1', 'prj_emerald', 'Priya Sharma', 'usr_sarah', 'general', 'L8 Reinforcement Steel Inspection Passed', 'Excited to report that structural inspection for L8 slab reinforcement has officially passed. Concrete pour is scheduled for tomorrow at 6:00 AM. Please ensure all other trades clear the slab area by 5:00 PM today.', '[]', 'normal', '["inspection", "concrete", "structure"]'),
('post_2', 'prj_emerald', 'Rohan Mehta', 'usr_david', 'safety', 'Weather Advisory - Heavy Rain Warning Mumbai', 'Met Department has issued a heavy rain advisory for Mumbai for the next 48 hours. Site supervisors: please check dewatering pump configurations in basement level 2, secure loose materials on all scaffolding decks, and disconnect exposed cables.', '[]', 'urgent', '["weather", "safety"]');

-- Seed Notifications
INSERT INTO notifications (id, project_id, title, message, type, is_read, target_user_id, link) VALUES
('not_1', 'prj_emerald', 'Inspection Failed', 'Electrical Grounding Resistance Test L1-L3 failed and requires rework.', 'quality', false, 'usr_admin', '/quality'),
('not_2', 'prj_emerald', 'Schedule Overdue Notice', 'Activity "Facade Cladding & Glazing" is currently delayed past planned baseline.', 'schedule', false, 'usr_admin', '/scheduler'),
('not_3', 'prj_emerald', 'New Layout Revision', 'Design change for Level 8 Layout Revision is under review.', 'info', true, 'usr_admin', '/collaboration');

-- Seed Schedule Tasks
INSERT INTO schedule_tasks (id, project_id, name, description, phase, start_date, end_date, duration_days, progress, status, dependencies, assigned_crew, resources_needed, is_critical_path, order_index) VALUES
('task_1', 'prj_emerald', 'Mobilization & Site Setup', 'Initial site offices erection and temporary services routing.', 'foundation', '2026-01-01', '2026-01-10', 10, 100.00, 'completed', '[]', 'Raj Civil Contractor', 'Portacabins, barricades', true, 0),
('task_2', 'prj_emerald', 'Excavation & Shoring', 'Deep excavation for foundation raft structures.', 'foundation', '2026-01-11', '2026-01-31', 20, 100.00, 'completed', '["task_1"]', 'Balaji Excavators', 'Excavators', true, 1),
('task_3', 'prj_emerald', 'Foundation Piling & Concrete Pour', 'Substructure columns and foundation pour.', 'foundation', '2026-02-01', '2026-02-25', 25, 100.00, 'completed', '["task_2"]', 'Indus Piling Crew', 'Transit mixers', true, 2),
('task_4', 'prj_emerald', 'Concrete Frame (L1-L6)', 'Structural slab and column framing for lower storeys.', 'structure', '2026-02-26', '2026-04-26', 60, 100.00, 'completed', '["task_3"]', 'Royal Shuttering Team', 'Scaffolding', true, 3),
('task_5', 'prj_emerald', 'Concrete Frame (L7-L12)', 'Structural slab and column framing for upper storeys.', 'structure', '2026-04-27', '2026-06-15', 50, 60.00, 'in_progress', '["task_4"]', 'Royal Shuttering Team', 'TMT rebar, RMC', true, 4),
('task_6', 'prj_emerald', 'HVAC Duct Installation (L1-L6)', 'Ductwork route assembly on levels 1 to 6.', 'mep', '2026-04-27', '2026-05-20', 24, 40.00, 'in_progress', '["task_4"]', 'Voltas MEP Team', 'Duct sheets', false, 5);

-- Seed Scheduling Rules
INSERT INTO scheduling_rules (id, name, description, project_type, rule_type, condition, action, parameters, is_active, created_by) VALUES
('rule_1', 'Concrete Curing Buffer', 'Ensure suspended concrete slab pours have a minimum 7-day curing buffer before structural framing columns can be formed above.', 'Residential Building', 'buffer', 'concrete_slab_to_columns', 'insert_delay', '{"days":7}', true, 'Suresh Sharma'),
('rule_2', 'Shoring Inspection Gate', 'Deep excavation works cannot proceed past 5m depth without geotechnical validation of shoring sheet piling deflection.', 'Commercial Tower', 'constraint', 'excavation_depth_limit', 'hold_works', '{"depth_meters":5}', true, 'Suresh Sharma');

-- 22. Machinery Details Table
CREATE TABLE machinery_details (
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
);

-- 22b. Material Status Table
CREATE TABLE material_status (
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
);

-- 23. Days Reports Table
CREATE TABLE days_reports (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
    sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    remark TEXT,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 24. Status Reports Table
CREATE TABLE status_reports (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
    sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    remark TEXT,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 25. Special Site Visits Table
CREATE TABLE special_site_visits (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
    sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    firm_name VARCHAR(255) NOT NULL,
    visitor_name VARCHAR(255) NOT NULL,
    purpose TEXT NOT NULL,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 26. Critical Issues Table
CREATE TABLE critical_issues (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
    sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 27. Next Day's Plan Table
CREATE TABLE next_days_plans (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
    sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    unit VARCHAR(50),
    quantity NUMERIC(12, 2),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
