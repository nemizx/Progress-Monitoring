// Local storage-based database client and mock SDK for Planedge_Monitors.
// Completely replaces the `@base44/sdk` integration.

import { generateSchedule, finalizeSchedule, getModelParameters } from '@/lib/scheduleModel';

const DB_PREFIX = 'Planedge_Monitors_db_';

// Unique ID generator
const generateId = (prefix = 'id') => `${prefix}_${Math.random().toString(36).substring(2, 11)}`;

// Get a collection from localStorage
const getCollection = (name) => {
  const data = localStorage.getItem(DB_PREFIX + name);
  return data ? JSON.parse(data) : [];
};

// Save a collection to localStorage
const saveCollection = (name, data) => {
  localStorage.setItem(DB_PREFIX + name, JSON.stringify(data));
};

// Seed initial data if the database is empty
const seedDatabase = () => {
  const isIndianSeeded = localStorage.getItem(DB_PREFIX + 'Project') && localStorage.getItem(DB_PREFIX + 'Project').includes('Ganga');
  if (isIndianSeeded) {
    return; // Already seeded with Indian data
  }

  // Clear existing databases to force localized re-seed
  localStorage.removeItem(DB_PREFIX + 'Project');
  localStorage.removeItem(DB_PREFIX + 'WBSItem');
  localStorage.removeItem(DB_PREFIX + 'ScheduleActivity');
  localStorage.removeItem(DB_PREFIX + 'BudgetItem');
  localStorage.removeItem(DB_PREFIX + 'Milestone');
  localStorage.removeItem(DB_PREFIX + 'ProgressEntry');
  localStorage.removeItem(DB_PREFIX + 'AttendanceEntry');
  localStorage.removeItem(DB_PREFIX + 'QualityInspection');
  localStorage.removeItem(DB_PREFIX + 'Document');
  localStorage.removeItem(DB_PREFIX + 'ChangeEvent');
  localStorage.removeItem(DB_PREFIX + 'CollaborationPost');
  localStorage.removeItem(DB_PREFIX + 'Notification');
  localStorage.removeItem(DB_PREFIX + 'ScheduleTask');
  localStorage.removeItem(DB_PREFIX + 'SchedulingRule');
  localStorage.removeItem(DB_PREFIX + 'User');

  // --- 1. Projects ---
  const projects = [
    {
      id: 'prj_emerald',
      name: 'Ganga Residency',
      description: 'A 12-storey premium residential tower with glass facade, subterranean parking, and sustainable green rooftop design in Mumbai.',
      location: 'Worli Sea Face, Mumbai',
      client: 'Lodha Estates Private Limited',
      status: 'in_progress',
      start_date: '2026-01-01',
      end_date: '2027-06-30',
      budget: 120000000, // ₹ 12 Crore
      spent: 78000000,    // ₹ 7.8 Crore
      progress: 65,
      project_manager: 'Suresh Sharma',
      priority: 'high',
      created_date: new Date('2025-11-15T08:00:00Z').toISOString(),
      updated_date: new Date('2026-06-01T12:00:00Z').toISOString(),
      created_by_id: 'usr_admin'
    },
    {
      id: 'prj_oceanic',
      name: 'Noida Commercial Galleria',
      description: 'Multi-level commercial retail mall featuring a cinema complex, food court, and central atrium plaza.',
      location: 'Sector 62, Noida, Uttar Pradesh',
      client: 'DLF Commercial Projects',
      status: 'planning',
      start_date: '2026-08-01',
      end_date: '2028-02-28',
      budget: 280000000, // ₹ 28 Crore
      spent: 15000000,   // ₹ 1.5 Crore
      progress: 12,
      project_manager: 'Amit Patel',
      priority: 'medium',
      created_date: new Date('2026-02-10T10:00:00Z').toISOString(),
      updated_date: new Date('2026-05-20T14:30:00Z').toISOString(),
      created_by_id: 'usr_admin'
    },
    {
      id: 'prj_highway',
      name: 'NH-8 Pune-Solapur Highway Extension',
      description: 'Widening of the existing 4-lane state highway to a 6-lane divided freeway, including structural upgrades to two overpasses.',
      location: 'Pune to Solapur Expressway, Km 45 to 58',
      client: 'National Highways Authority of India (NHAI)',
      status: 'delayed',
      start_date: '2025-10-01',
      end_date: '2026-11-30',
      budget: 85000000, // ₹ 8.5 Crore
      spent: 48000000,  // ₹ 4.8 Crore
      progress: 45,
      project_manager: 'Rohan Mehta',
      priority: 'critical',
      created_date: new Date('2025-08-01T09:00:00Z').toISOString(),
      updated_date: new Date('2026-06-03T16:45:00Z').toISOString(),
      created_by_id: 'usr_admin'
    }
  ];

  // --- 2. WBS Items ---
  const wbsItems = [
    // Ganga Residency
    { id: 'wbs_em_sub', project_id: 'prj_emerald', code: '1.0', title: 'Substructure & Foundation', description: 'Excavation, piling, and ground floor raft slab concrete works.', level: 1, parent_id: null, planned_quantity: 1, actual_quantity: 1, unit: 'LS', progress: 100, budget_amount: 25000000, order_index: 0 },
    { id: 'wbs_em_exc', project_id: 'prj_emerald', code: '1.1', title: 'Excavation & Shoring', description: 'Deep excavation for two basement levels including sheet piling and shoring installation.', level: 2, parent_id: 'wbs_em_sub', planned_quantity: 45000, actual_quantity: 45000, unit: 'm3', progress: 100, budget_amount: 15000000, order_index: 1 },
    { id: 'wbs_em_con', project_id: 'prj_emerald', code: '1.2', title: 'Concrete Footings & Slab', description: 'Pouring foundation concrete footings and the ground level slab.', level: 2, parent_id: 'wbs_em_sub', planned_quantity: 8000, actual_quantity: 8000, unit: 'm3', progress: 100, budget_amount: 10000000, order_index: 2 },

    { id: 'wbs_em_sup', project_id: 'prj_emerald', code: '2.0', title: 'Superstructure & Core', description: 'Concrete column framing, shear walls, and floor slabs for all 12 storeys.', level: 1, parent_id: null, planned_quantity: 1, actual_quantity: 0.75, unit: 'LS', progress: 75, budget_amount: 50000000, order_index: 3 },
    { id: 'wbs_em_frm1', project_id: 'prj_emerald', code: '2.1', title: 'Concrete Frame (Floors 1-6)', description: 'Reinforced concrete columns, beams, and slabs for levels 1 through 6.', level: 2, parent_id: 'wbs_em_sup', planned_quantity: 6, actual_quantity: 6, unit: 'floors', progress: 100, budget_amount: 30000000, order_index: 4 },
    { id: 'wbs_em_frm2', project_id: 'prj_emerald', code: '2.2', title: 'Concrete Frame (Floors 7-12)', description: 'Reinforced concrete columns, beams, and slabs for levels 7 through 12.', level: 2, parent_id: 'wbs_em_sup', planned_quantity: 6, actual_quantity: 3, unit: 'floors', progress: 50, budget_amount: 20000000, order_index: 5 },

    { id: 'wbs_em_mep', project_id: 'prj_emerald', code: '3.0', title: 'MEP & Rough-ins', description: 'Mechanical, electrical, HVAC, and plumbing piping installations app-wide.', level: 1, parent_id: null, planned_quantity: 1, actual_quantity: 0.3, unit: 'LS', progress: 30, budget_amount: 25000000, order_index: 6 },
    { id: 'wbs_em_ele', project_id: 'prj_emerald', code: '3.1', title: 'Electrical Rough-ins', description: 'Laying cable conduits, cable trays, and pull boxes.', level: 2, parent_id: 'wbs_em_mep', planned_quantity: 12, actual_quantity: 6, unit: 'floors', progress: 50, budget_amount: 12000000, order_index: 7 },
    { id: 'wbs_em_hvac', project_id: 'prj_emerald', code: '3.2', title: 'HVAC & Plumbing', description: 'Installing ductwork, water supply lines, and drainage piping.', level: 2, parent_id: 'wbs_em_mep', planned_quantity: 12, actual_quantity: 1.2, unit: 'floors', progress: 10, budget_amount: 13000000, order_index: 8 },

    { id: 'wbs_em_fin', project_id: 'prj_emerald', code: '4.0', title: 'Interior Finishing & Facade', description: 'Exterior glazing panels, drywall partitions, flooring, painting, and fixtures.', level: 1, parent_id: null, planned_quantity: 1, actual_quantity: 0.15, unit: 'LS', progress: 15, budget_amount: 20000000, order_index: 9 },
    { id: 'wbs_em_fac', project_id: 'prj_emerald', code: '4.1', title: 'Facade Cladding', description: 'Installation of outer framing and curtain glass cladding panels.', level: 2, parent_id: 'wbs_em_fin', planned_quantity: 4800, actual_quantity: 1440, unit: 'm2', progress: 30, budget_amount: 10000000, order_index: 10 },
    { id: 'wbs_em_dry', project_id: 'prj_emerald', code: '4.2', title: 'Drywall & Painting', description: 'Metal wall framing, drywall hanging, skim coat, and primer/painting.', level: 2, parent_id: 'wbs_em_fin', planned_quantity: 12, actual_quantity: 0, unit: 'floors', progress: 0, budget_amount: 10000000, order_index: 11 }
  ];

  // --- 3. Schedule Activities (CPM Schedule) ---
  const scheduleActivities = [
    { id: 'act_em_mob', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_sub', activity_id: 'A1000', name: 'Mobilization & Site Setup', description: 'Move site offices, set up perimeter fencing, water, and power lines.', phase: 'foundation', planned_start: '2026-01-01', planned_end: '2026-01-10', actual_start: '2026-01-01', actual_end: '2026-01-10', duration_days: 10, float_days: 0, progress: 100, status: 'completed', predecessors: [], successors: ['A1010'], dependency_type: 'FS', is_critical_path: true, is_milestone: false, assigned_crew: 'Raj Civil Contractor', resources_needed: 'Portacabins, barricades', labor_count: 8, order_index: 0 },
    { id: 'act_em_exc', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_exc', activity_id: 'A1010', name: 'Excavation & Shoring', description: 'Excavate basements, install structural shoring and sheet piles.', phase: 'foundation', planned_start: '2026-01-11', planned_end: '2026-01-30', actual_start: '2026-01-11', actual_end: '2026-01-31', duration_days: 20, float_days: 0, progress: 100, status: 'completed', predecessors: ['A1000'], successors: ['A1020'], dependency_type: 'FS', is_critical_path: true, is_milestone: false, assigned_crew: 'Balaji Excavators', resources_needed: 'Excavators, dumper trucks', labor_count: 12, order_index: 1 },
    { id: 'act_em_pil', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_con', activity_id: 'A1020', name: 'Foundation Piling & Concrete Pour', description: 'Bored piles, rebar cage install, and concrete pour for raft foundation.', phase: 'foundation', planned_start: '2026-02-01', planned_end: '2026-02-25', actual_start: '2026-02-01', actual_end: '2026-02-25', duration_days: 25, float_days: 0, progress: 100, status: 'completed', predecessors: ['A1010'], successors: ['A1030'], dependency_type: 'FS', is_critical_path: true, is_milestone: false, assigned_crew: 'Indus Piling Crew', resources_needed: 'Drill rig, concrete transit mixers', labor_count: 18, order_index: 2 },
    { id: 'act_em_col1', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_frm1', activity_id: 'A1030', name: 'Columns & Shear Walls (L1-L3)', description: 'Reinforced concrete framing for lower level structural vertical items.', phase: 'structure', planned_start: '2026-02-26', planned_end: '2026-03-12', actual_start: '2026-02-26', actual_end: '2026-03-13', duration_days: 15, float_days: 0, progress: 100, status: 'completed', predecessors: ['A1020'], successors: ['A1040'], dependency_type: 'FS', is_critical_path: true, is_milestone: false, assigned_crew: 'Royal Shuttering Team', resources_needed: 'Formwork, TMT rebar', labor_count: 16, order_index: 3 },
    { id: 'act_em_slb1', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_frm1', activity_id: 'A1040', name: 'Slab Casting (L1-L3)', description: 'Concrete casting and curing for floor levels 1, 2, and 3.', phase: 'structure', planned_start: '2026-03-13', planned_end: '2026-03-27', actual_start: '2026-03-14', actual_end: '2026-03-28', duration_days: 15, float_days: 0, progress: 100, status: 'completed', predecessors: ['A1030'], successors: ['A1050', 'A1090'], dependency_type: 'FS', is_critical_path: true, is_milestone: false, assigned_crew: 'L&T Concrete Sub', resources_needed: 'Scaffolding, RMC concrete', labor_count: 22, order_index: 4 },
    { id: 'act_em_col2', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_frm1', activity_id: 'A1050', name: 'Columns & Shear Walls (L4-L6)', description: 'Reinforced concrete columns and shear walls for mid levels.', phase: 'structure', planned_start: '2026-03-28', planned_end: '2026-04-11', actual_start: '2026-03-29', actual_end: '2026-04-12', duration_days: 15, float_days: 0, progress: 100, status: 'completed', predecessors: ['A1040'], successors: ['A1060'], dependency_type: 'FS', is_critical_path: true, is_milestone: false, assigned_crew: 'Royal Shuttering Team', resources_needed: 'Rebar, tower crane', labor_count: 16, order_index: 5 },
    { id: 'act_em_slb2', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_frm1', activity_id: 'A1060', name: 'Slab Casting (L4-L6)', description: 'Concrete slab casting and curing for levels 4, 5, and 6.', phase: 'structure', planned_start: '2026-04-12', planned_end: '2026-04-26', actual_start: '2026-04-13', actual_end: '2026-04-27', duration_days: 15, float_days: 0, progress: 100, status: 'completed', predecessors: ['A1050'], successors: ['A1070', 'A1100', 'A1110', 'A1120'], dependency_type: 'FS', is_critical_path: true, is_milestone: false, assigned_crew: 'L&T Concrete Sub', resources_needed: 'Formwork, tower crane', labor_count: 22, order_index: 6 },
    { id: 'act_em_col3', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_frm2', activity_id: 'A1070', name: 'Columns & Shear Walls (L7-L12)', description: 'Framing and structural concrete works for upper floor columns.', phase: 'structure', planned_start: '2026-04-27', planned_end: '2026-05-21', actual_start: '2026-04-28', actual_end: null, duration_days: 25, float_days: 0, progress: 60, status: 'in_progress', predecessors: ['A1060'], successors: ['A1080'], dependency_type: 'FS', is_critical_path: true, is_milestone: false, assigned_crew: 'Royal Shuttering Team', resources_needed: 'RMC Concrete, metal scaffolding', labor_count: 14, order_index: 7 },
    { id: 'act_em_slb3', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_frm2', activity_id: 'A1080', name: 'Slab Casting (L7-L12)', description: 'Casting and finishing upper suspended concrete floor slabs.', phase: 'structure', planned_start: '2026-05-22', planned_end: '2026-06-15', actual_start: null, actual_end: null, duration_days: 25, float_days: 0, progress: 0, status: 'not_started', predecessors: ['A1070'], successors: ['A1150'], dependency_type: 'FS', is_critical_path: true, is_milestone: false, assigned_crew: 'L&T Concrete Sub', resources_needed: 'Pump mix, power float', labor_count: 0, order_index: 8 },
    { id: 'act_em_conduit', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_ele', activity_id: 'A1090', name: 'Electrical Conduit Laying (L1-L6)', description: 'Running vertical conduit lines and embedded piping in floor slabs.', phase: 'mep', planned_start: '2026-03-28', planned_end: '2026-04-11', actual_start: '2026-03-29', actual_end: '2026-04-12', duration_days: 15, float_days: 15, progress: 100, status: 'completed', predecessors: ['A1040'], successors: ['A1130'], dependency_type: 'FS', is_critical_path: false, is_milestone: false, assigned_crew: 'Patel Electricals', resources_needed: 'PVC conduits, junction boxes', labor_count: 8, order_index: 9 },
    { id: 'act_em_hvac1', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_hvac', activity_id: 'A1100', name: 'HVAC Duct Installation (L1-L6)', description: 'Fabrication and hanging of air conditioning and ventilation sheet metal ducts.', phase: 'mep', planned_start: '2026-04-27', planned_end: '2026-05-16', actual_start: '2026-05-02', actual_end: null, duration_days: 20, float_days: 12, progress: 40, status: 'in_progress', predecessors: ['A1060'], successors: ['A1130'], dependency_type: 'FS', is_critical_path: false, is_milestone: false, assigned_crew: 'Voltas MEP Team', resources_needed: 'GI sheets, hangers, dampers', labor_count: 6, order_index: 10 },
    { id: 'act_em_plumb1', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_hvac', activity_id: 'A1110', name: 'Plumbing Piping & Drainage (L1-L6)', description: 'Installing supply lines, soil pipes, and bathroom risers for lower floors.', phase: 'mep', planned_start: '2026-04-27', planned_end: '2026-05-14', actual_start: '2026-05-05', actual_end: null, duration_days: 18, float_days: 14, progress: 20, status: 'in_progress', predecessors: ['A1060'], successors: ['A1130'], dependency_type: 'FS', is_critical_path: false, is_milestone: false, assigned_crew: 'Aashirvad Pipes Team', resources_needed: 'UPVC pipes, fittings, valves', labor_count: 5, order_index: 11 },
    { id: 'act_em_facade', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_fac', activity_id: 'A1120', name: 'Facade Cladding & Glazing', description: 'Mounting aluminum framing and curtain glass units on building exterior.', phase: 'finishing', planned_start: '2026-04-27', planned_end: '2026-05-26', actual_start: '2026-05-10', actual_end: null, duration_days: 30, float_days: 5, progress: 30, status: 'delayed', predecessors: ['A1060'], successors: ['A1140'], dependency_type: 'FS', is_critical_path: false, is_milestone: false, assigned_crew: 'Saint-Gobain Glazing', resources_needed: 'Curtain wall panels, suspended cradle', labor_count: 6, order_index: 12 },
    { id: 'act_em_drywall', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_dry', activity_id: 'A1130', name: 'Drywall Gypsum Board Panels', description: 'Metal studs layout, drywall hanging, and plaster sealing.', phase: 'finishing', planned_start: '2026-05-17', planned_end: '2026-06-10', actual_start: null, actual_end: null, duration_days: 25, float_days: 10, progress: 0, status: 'not_started', predecessors: ['A1100', 'A1110'], successors: ['A1140'], dependency_type: 'FS', is_critical_path: false, is_milestone: false, assigned_crew: 'Gyproc Drywall Crew', resources_needed: 'Gypsum boards, GI channels', labor_count: 0, order_index: 13 },
    { id: 'act_em_paint', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_dry', activity_id: 'A1140', name: 'Painting & Tile Work (L1-L6)', description: 'Screeding, tile laying in wet areas, and wall paint primer & finishes.', phase: 'finishing', planned_start: '2026-06-11', planned_end: '2026-07-10', actual_start: null, actual_end: null, duration_days: 30, float_days: 5, progress: 0, status: 'not_started', predecessors: ['A1120', 'A1130'], successors: ['A1150'], dependency_type: 'FS', is_critical_path: false, is_milestone: false, assigned_crew: 'Asian Paints Sub', resources_needed: 'Acrylic emulsion, wall putty', labor_count: 0, order_index: 14 },
    { id: 'act_em_test', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_mep', activity_id: 'A1150', name: 'Testing & Commissioning', description: 'Testing mechanical pumps, electrical load checks, and HVAC airflow tests.', phase: 'handover', planned_start: '2026-07-11', planned_end: '2026-07-25', actual_start: null, actual_end: null, duration_days: 15, float_days: 0, progress: 0, status: 'not_started', predecessors: ['A1080', 'A1140'], successors: ['A1160'], dependency_type: 'FS', is_critical_path: true, is_milestone: false, assigned_crew: 'Sterling & Wilson QC', resources_needed: 'Insulation testers, flow hoods', labor_count: 0, order_index: 15 },
    { id: 'act_em_handover', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_sub', activity_id: 'A1160', name: 'Client Inspection & Handover', description: 'Joint site walkthrough with client, snag list resolution, and key handover.', phase: 'handover', planned_start: '2026-07-26', planned_end: '2026-08-01', actual_start: null, actual_end: null, duration_days: 7, float_days: 0, progress: 0, status: 'not_started', predecessors: ['A1150'], successors: [], dependency_type: 'FS', is_critical_path: true, is_milestone: true, assigned_crew: 'Ganga Project Management', resources_needed: 'O&M manuals, snag lists', labor_count: 0, order_index: 16 }
  ];

  // --- 4. Budget Items ---
  const budgetItems = [
    { id: 'bud_1', project_id: 'prj_emerald', code: '01-PRE', title: 'Preliminaries & Site Setup', level: 1, parent_id: null, original_budget: 2000000, revised_budget: 2000000, committed_cost: 1500000, actual_cost: 1200000, forecast_cost: 2000000, revision_notes: 'Initial baseline budget.', revision_number: 0 },
    { id: 'bud_2', project_id: 'prj_emerald', code: '02-EXC', title: 'Excavation & Earthworks', level: 1, parent_id: null, original_budget: 3000000, revised_budget: 3000000, committed_cost: 2800000, actual_cost: 2800000, forecast_cost: 3000000, revision_notes: 'Initial baseline budget.', revision_number: 0 },
    { id: 'bud_3', project_id: 'prj_emerald', code: '03-SUB', title: 'Substructure & Foundation', level: 1, parent_id: null, original_budget: 25000000, revised_budget: 25000000, committed_cost: 24000000, actual_cost: 23500000, forecast_cost: 25000000, revision_notes: 'Initial baseline budget.', revision_number: 0 },
    { id: 'bud_4', project_id: 'prj_emerald', code: '04-SUP', title: 'Superstructure RCC Frame', level: 1, parent_id: null, original_budget: 50000000, revised_budget: 50000000, committed_cost: 45000000, actual_cost: 42000000, forecast_cost: 50000000, revision_notes: 'Initial baseline budget.', revision_number: 0 },
    { id: 'bud_5', project_id: 'prj_emerald', code: '05-MAS', title: 'Masonry & Partition Walls', level: 1, parent_id: null, original_budget: 8000000, revised_budget: 8000000, committed_cost: 0, actual_cost: 0, forecast_cost: 8000000, revision_notes: 'Initial baseline budget.', revision_number: 0 },
    { id: 'bud_6', project_id: 'prj_emerald', code: '06-WPF', title: 'Waterproofing & Insulation', level: 1, parent_id: null, original_budget: 4000000, revised_budget: 4000000, committed_cost: 0, actual_cost: 0, forecast_cost: 4000000, revision_notes: 'Initial baseline budget.', revision_number: 0 },
    { id: 'bud_7', project_id: 'prj_emerald', code: '07-PLT', title: 'Internal Plastering', level: 1, parent_id: null, original_budget: 5000000, revised_budget: 5000000, committed_cost: 0, actual_cost: 0, forecast_cost: 5000000, revision_notes: 'Initial baseline budget.', revision_number: 0 },
    { id: 'bud_8', project_id: 'prj_emerald', code: '08-FLR', title: 'Tiling & Flooring', level: 1, parent_id: null, original_budget: 9000000, revised_budget: 9000000, committed_cost: 0, actual_cost: 0, forecast_cost: 9000000, revision_notes: 'Initial baseline budget.', revision_number: 0 },
    { id: 'bud_9', project_id: 'prj_emerald', code: '09-DW', title: 'Doors, Windows & Glazing', level: 1, parent_id: null, original_budget: 15000000, revised_budget: 15000000, committed_cost: 0, actual_cost: 0, forecast_cost: 15000000, revision_notes: 'Initial baseline budget.', revision_number: 0 },
    { id: 'bud_10', project_id: 'prj_emerald', code: '10-ELE', title: 'Electrical Systems', level: 1, parent_id: null, original_budget: 12000000, revised_budget: 12000000, committed_cost: 0, actual_cost: 0, forecast_cost: 12000000, revision_notes: 'Initial baseline budget.', revision_number: 0 },
    { id: 'bud_11', project_id: 'prj_emerald', code: '11-PLU', title: 'Plumbing & Sanitary', level: 1, parent_id: null, original_budget: 8000000, revised_budget: 8000000, committed_cost: 0, actual_cost: 0, forecast_cost: 8000000, revision_notes: 'Initial baseline budget.', revision_number: 0 },
    { id: 'bud_12', project_id: 'prj_emerald', code: '12-MEC', title: 'HVAC & Ventilation', level: 1, parent_id: null, original_budget: 13000000, revised_budget: 13000000, committed_cost: 0, actual_cost: 0, forecast_cost: 13000000, revision_notes: 'Initial baseline budget.', revision_number: 0 },
    { id: 'bud_13', project_id: 'prj_emerald', code: '13-FF', title: 'Fire Fighting & Alarms', level: 1, parent_id: null, original_budget: 6000000, revised_budget: 6000000, committed_cost: 0, actual_cost: 0, forecast_cost: 6000000, revision_notes: 'Initial baseline budget.', revision_number: 0 },
    { id: 'bud_14', project_id: 'prj_emerald', code: '14-PNT', title: 'Wall Painting & Finishes', level: 1, parent_id: null, original_budget: 4000000, revised_budget: 4000000, committed_cost: 0, actual_cost: 0, forecast_cost: 4000000, revision_notes: 'Initial baseline budget.', revision_number: 0 },
    { id: 'bud_15', project_id: 'prj_emerald', code: '15-LND', title: 'Roadworks & Landscaping', level: 1, parent_id: null, original_budget: 7000000, revised_budget: 7000000, committed_cost: 0, actual_cost: 0, forecast_cost: 7000000, revision_notes: 'Initial baseline budget.', revision_number: 0 },
    { id: 'bud_16', project_id: 'prj_emerald', code: '16-MIS', title: 'Contingencies & Miscellaneous', level: 1, parent_id: null, original_budget: 5000000, revised_budget: 5000000, committed_cost: 0, actual_cost: 0, forecast_cost: 5000000, revision_notes: 'Initial baseline budget.', revision_number: 0 },

    // Child detailed line items (L2, quantity-driven, linked to WBS items)
    { id: 'bud_em_exc', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_exc', code: '03-SUB-01', title: 'Basement Excavation & Earthworks', level: 2, parent_id: 'bud_3', quantity: 5000, cost_per_unit: 3000, unit: 'm3', original_budget: 15000000, revised_budget: 15000000, committed_cost: 14800000, actual_cost: 14800000, forecast_cost: 15000000, revision_notes: 'Excavation child item.', revision_number: 0 },
    { id: 'bud_em_con', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_con', code: '03-SUB-02', title: 'Foundation Footing Concrete', level: 2, parent_id: 'bud_3', quantity: 2000, cost_per_unit: 5000, unit: 'm3', original_budget: 10000000, revised_budget: 10000000, committed_cost: 9700000, actual_cost: 9700000, forecast_cost: 10000000, revision_notes: 'Concrete child item.', revision_number: 0 },
    { id: 'bud_em_frm', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_frm1', code: '04-SUP-01', title: 'Columns and Floor Slab Structure', level: 2, parent_id: 'bud_4', quantity: 10000, cost_per_unit: 3100, unit: 'm3', original_budget: 31000000, revised_budget: 31000000, committed_cost: 28000000, actual_cost: 26000000, forecast_cost: 30500000, revision_notes: 'Frame structure child.', revision_number: 0 },
    { id: 'bud_em_mas', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_frm2', code: '04-SUP-02', title: 'Blockwork Masonry Partition Walls', level: 2, parent_id: 'bud_4', quantity: 8400, cost_per_unit: 2500, unit: 'sqm', original_budget: 21000000, revised_budget: 21000000, committed_cost: 13000000, actual_cost: 12000000, forecast_cost: 21000000, revision_notes: 'Masonry child.', revision_number: 0 },
    { id: 'bud_em_ele', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_ele', code: '10-ELE-01', title: 'PVC Conduit Laying & Wiring', level: 2, parent_id: 'bud_10', quantity: 10000, cost_per_unit: 120, unit: 'meters', original_budget: 1200000, revised_budget: 1200000, committed_cost: 0, actual_cost: 0, forecast_cost: 1200000, revision_notes: 'Electrical child', revision_number: 0 },
    { id: 'bud_em_dw1', project_id: 'prj_emerald', wbs_item_id: 'wbs_em_fac', code: '09-DW-01', title: 'Double Glazed Exterior Facade', level: 2, parent_id: 'bud_9', quantity: 500, cost_per_unit: 10000, unit: 'panels', original_budget: 5000000, revised_budget: 5000000, committed_cost: 0, actual_cost: 0, forecast_cost: 5000000, revision_notes: 'Facade glazing', revision_number: 0 }
  ];

  // --- 5. Milestones ---
  const milestones = [
    { id: 'ms_em_sub', project_id: 'prj_emerald', title: 'Substructure Completion', description: 'Excavation completed and foundation raft slab concrete successfully cured.', phase: 'foundation', status: 'completed', planned_start: '2026-01-01', planned_end: '2026-02-25', actual_start: '2026-01-01', actual_end: '2026-02-25', progress: 100, dependencies: [], assigned_to: 'Suresh Sharma', priority: 'high' },
    { id: 'ms_em_top', project_id: 'prj_emerald', title: 'Topping Out (L12 Concrete Frame)', description: 'Structural concrete pouring for all 12 storeys completed.', phase: 'structure', status: 'in_progress', planned_start: '2026-02-26', planned_end: '2026-06-15', actual_start: '2026-02-26', actual_end: null, progress: 85, dependencies: ['ms_em_sub'], assigned_to: 'Rohan Mehta', priority: 'high' },
    { id: 'ms_em_mep', project_id: 'prj_emerald', title: 'MEP Dry-in Approval', description: 'Verification of internal HVAC, piping, and wiring conduits for floors 1 to 6.', phase: 'mep', status: 'in_progress', planned_start: '2026-03-28', planned_end: '2026-05-20', actual_start: '2026-03-29', actual_end: null, progress: 40, dependencies: ['ms_em_sub'], assigned_to: 'Amit Patel', priority: 'medium' },
    { id: 'ms_em_facade', project_id: 'prj_emerald', title: 'Facade Completion', description: 'All glass curtain wall panels installed, rendering the tower weatherproof.', phase: 'finishing', status: 'delayed', planned_start: '2026-04-27', planned_end: '2026-05-26', actual_start: '2026-05-10', actual_end: null, progress: 30, dependencies: ['ms_em_top'], assigned_to: 'Suresh Sharma', priority: 'high' },
    { id: 'ms_em_handover', project_id: 'prj_emerald', title: 'Final Handover & Client Approval', description: 'Signoff of occupancy certificate and formal handover to client.', phase: 'handover', status: 'not_started', planned_start: '2026-07-26', planned_end: '2026-08-01', actual_start: null, actual_end: null, progress: 0, dependencies: ['ms_em_facade', 'ms_em_mep'], assigned_to: 'Suresh Sharma', priority: 'critical' }
  ];

  // --- 6. Progress Entries ---
  const progressEntries = [
    { id: 'prg_em_1', project_id: 'prj_emerald', budget_item_id: 'bud_em_frm', milestone_id: 'ms_em_top', date: '2026-05-30', report_type: 'daily', submitted_by: 'Priya Sharma', work_done_description: 'Finished forming columns and shear walls for Floor 9. Pouring concrete in progress.', quantity_done: 500, unit: 'm3', labor_count: 14, photo_urls: [], location_tag: 'Floor 9', issues_reported: 'Slight delay in pump arrival (30 mins).', weather_condition: 'Sunny, 28°C', status: 'approved', value_of_work_done: 1550000 },
    { id: 'prg_em_2', project_id: 'prj_emerald', budget_item_id: 'bud_em_ele', milestone_id: 'ms_em_mep', date: '2026-06-01', report_type: 'daily', submitted_by: 'Vijay Yadav', work_done_description: 'Conduit laying for electrical panels on Floor 5 and 6 corridor lines.', quantity_done: 120, unit: 'meters', labor_count: 8, photo_urls: [], location_tag: 'Floor 5', issues_reported: 'None.', weather_condition: 'Clear, 26°C', status: 'approved', value_of_work_done: 14400 },
    { id: 'prg_em_3', project_id: 'prj_emerald', budget_item_id: 'bud_em_dw1', milestone_id: 'ms_em_facade', date: '2026-06-02', report_type: 'daily', submitted_by: 'Priya Sharma', work_done_description: 'Glazing panels mounted on East facade, Floor 4 section.', quantity_done: 18, unit: 'panels', labor_count: 6, photo_urls: [], location_tag: 'East Facade Floor 4', issues_reported: 'High wind advisory halted works at 3 PM.', weather_condition: 'Windy, 22°C', status: 'submitted', value_of_work_done: 180000 }
  ];

  // --- 7. Attendance Entries ---
  const attendanceEntries = [
    { id: 'att_1', project_id: 'prj_emerald', worker_name: 'Rajesh Kumar', trade: 'carpenter', date: '2026-06-01', status: 'present', shift: 'full', remarks: '' },
    { id: 'att_2', project_id: 'prj_emerald', worker_name: 'Vijay Yadav', trade: 'mason', date: '2026-06-01', status: 'present', shift: 'full', remarks: '' },
    { id: 'att_3', project_id: 'prj_emerald', worker_name: 'Ramesh Patel', trade: 'electrician', date: '2026-06-02', status: 'present', shift: 'morning', remarks: '' },
    { id: 'att_4', project_id: 'prj_emerald', worker_name: 'Sandeep Singh', trade: 'laborer', date: '2026-06-02', status: 'absent', shift: 'full', remarks: 'Sick' },
    { id: 'att_5', project_id: 'prj_emerald', worker_name: 'Priya Sharma', trade: 'supervisor', date: '2026-06-03', status: 'present', shift: 'full', remarks: '' }
  ];

  // --- 8. Quality Inspections ---
  const qualityInspections = [
    { id: 'ins_1', project_id: 'prj_emerald', milestone_id: 'ms_em_sub', title: 'Foundation Reinforcement Steel Check', inspection_type: 'structural', status: 'passed', inspector_name: 'Priya Sharma', inspection_date: '2026-01-20', findings: 'All rebar spacing, diameter, and lap lengths comply with structural drawing Rev C. Cleanout completed.', severity: 'minor', corrective_action: '', photos: [], compliance_score: 98 },
    { id: 'ins_2', project_id: 'prj_emerald', milestone_id: 'ms_em_top', title: 'L5 Concrete Core Compression Test', inspection_type: 'structural', status: 'passed', inspector_name: 'Priya Sharma', inspection_date: '2026-04-05', findings: '28-day cylinder compressive strength met specified 35 MPa design limit.', severity: 'minor', corrective_action: '', photos: [], compliance_score: 100 },
    { id: 'ins_3', project_id: 'prj_emerald', milestone_id: 'ms_em_mep', title: 'Electrical Grounding Resistance Test L1-L3', inspection_type: 'electrical', status: 'requires_rework', inspector_name: 'Amit Patel', inspection_date: '2026-05-18', findings: 'Grounding resistance measured high at L2 riser. Loose joints suspected.', severity: 'moderate', corrective_action: 'Clean connection surfaces and re-tighten grounding terminal bolts.', photos: [], compliance_score: 75 }
  ];

  // --- 9. Documents ---
  const documents = [
    { id: 'doc_1', project_id: 'prj_emerald', title: 'Ganga Residency Structural Drawings', category: 'drawing', file_url: '', file_name: 'Structural_Design_RevD.pdf', revision: 'D', revision_notes: 'Added wind load calculations for L10-L12 framing.', uploaded_by: 'Structural Engineer Team', status: 'approved', tags: ['structural', 'drawings'] },
    { id: 'doc_2', project_id: 'prj_emerald', title: 'Method Statement for Excavation', category: 'method_statement', file_url: '', file_name: 'MS_Excavation_Shoring.pdf', revision: '02', revision_notes: 'Incorporated design office comments.', uploaded_by: 'Civil Designer Team', status: 'approved', tags: ['excavation', 'method_statement'] }
  ];

  // --- 10. Change Events ---
  const changeEvents = [
    { id: 'chg_1', project_id: 'prj_emerald', activity_id: 'act_em_exc', title: 'Additional Excavation Shoring', category: 'site_issue', description: 'Soft clay pocket encountered near East property line boundary. Required supplementary sheet piling and framing to prevent collapse.', impact_days: 5, impact_cost: 450000, severity: 'high', status: 'resolved', raised_by: 'Suresh Sharma', assigned_to: 'Balaji Geotech Ltd', resolution: 'Added steel walers and tiebacks. Completed and inspected.', attachments: [] },
    { id: 'chg_2', project_id: 'prj_emerald', activity_id: 'act_em_col3', title: 'Client L8 Layout Revision Request', category: 'design_change', description: 'Modify interior partitions for units 802 and 803 to create combined penthouse layout per client instruction.', impact_days: 8, impact_cost: 650000, severity: 'medium', status: 'under_review', raised_by: 'Lodha Estates', assigned_to: 'Vastu Interior Designers', resolution: '', attachments: [] }
  ];

  // --- 11. Collaboration Posts ---
  const collaborationPosts = [
    { id: 'post_1', project_id: 'prj_emerald', author_name: 'Priya Sharma', author_id: 'usr_sarah', category: 'general', title: 'L8 Reinforcement Steel Inspection Passed', content: 'Excited to report that structural inspection for L8 slab reinforcement has officially passed. Concrete pour is scheduled for tomorrow at 6:00 AM. Please ensure all other trades clear the slab area by 5:00 PM today.', attachments: [], priority: 'normal', tags: ['inspection', 'concrete', 'structure'] },
    { id: 'post_2', project_id: 'prj_emerald', author_name: 'Rohan Mehta', author_id: 'usr_david', category: 'safety', title: 'Weather Advisory - Heavy Rain Warning Mumbai', content: 'Met Department has issued a heavy rain advisory for Mumbai for the next 48 hours. Site supervisors: please check dewatering pump configurations in basement level 2, secure loose materials on all scaffolding decks, and disconnect exposed cables.', attachments: [], priority: 'urgent', tags: ['weather', 'safety'] }
  ];

  // --- 12. Notifications ---
  const notifications = [
    { id: 'not_1', project_id: 'prj_emerald', title: 'Inspection Failed', message: 'Electrical Grounding Resistance Test L1-L3 failed and requires rework.', type: 'quality', is_read: false, target_user_id: 'usr_admin', link: '/quality' },
    { id: 'not_2', project_id: 'prj_emerald', title: 'Schedule Overdue Notice', message: 'Activity "Facade Cladding & Glazing" is currently delayed past planned baseline.', type: 'schedule', is_read: false, target_user_id: 'usr_admin', link: '/scheduler' },
    { id: 'not_3', project_id: 'prj_emerald', title: 'New Layout Revision', message: 'Design change for Level 8 Layout Revision is under review.', type: 'info', is_read: true, target_user_id: 'usr_admin', link: '/collaboration' }
  ];

  // --- 13. Schedule Tasks ---
  const scheduleTasks = [
    { id: 'task_1', project_id: 'prj_emerald', name: 'Mobilization & Site Setup', description: 'Initial site offices erection and temporary services routing.', phase: 'foundation', start_date: '2026-01-01', end_date: '2026-01-10', duration_days: 10, progress: 100, status: 'completed', dependencies: [], assigned_crew: 'Raj Civil Contractor', resources_needed: 'Portacabins, barricades', is_critical_path: true, order_index: 0 },
    { id: 'task_2', project_id: 'prj_emerald', name: 'Excavation & Shoring', description: 'Deep excavation for foundation raft structures.', phase: 'foundation', start_date: '2026-01-11', end_date: '2026-01-31', duration_days: 20, progress: 100, status: 'completed', dependencies: ['task_1'], assigned_crew: 'Balaji Excavators', resources_needed: 'Excavators', is_critical_path: true, order_index: 1 },
    { id: 'task_3', project_id: 'prj_emerald', name: 'Foundation Piling & Concrete Pour', description: 'Substructure columns and foundation pour.', phase: 'foundation', start_date: '2026-02-01', end_date: '2026-02-25', duration_days: 25, progress: 100, status: 'completed', dependencies: ['task_2'], assigned_crew: 'Indus Piling Crew', resources_needed: 'Transit mixers', is_critical_path: true, order_index: 2 },
    { id: 'task_4', project_id: 'prj_emerald', name: 'Concrete Frame (L1-L6)', description: 'Structural slab and column framing for lower storeys.', phase: 'structure', start_date: '2026-02-26', end_date: '2026-04-26', duration_days: 60, progress: 100, status: 'completed', dependencies: ['task_3'], assigned_crew: 'Royal Shuttering Team', resources_needed: 'Scaffolding', is_critical_path: true, order_index: 3 },
    { id: 'task_5', project_id: 'prj_emerald', name: 'Concrete Frame (L7-L12)', description: 'Structural slab and column framing for upper storeys.', phase: 'structure', start_date: '2026-04-27', end_date: '2026-06-15', duration_days: 50, progress: 60, status: 'in_progress', dependencies: ['task_4'], assigned_crew: 'Royal Shuttering Team', resources_needed: 'TMT rebar, RMC', is_critical_path: true, order_index: 4 },
    { id: 'task_6', project_id: 'prj_emerald', name: 'HVAC Duct Installation (L1-L6)', description: 'Ductwork route assembly on levels 1 to 6.', phase: 'mep', start_date: '2026-04-27', end_date: '2026-05-20', duration_days: 24, progress: 40, status: 'in_progress', dependencies: ['task_4'], assigned_crew: 'Voltas MEP Team', resources_needed: 'Duct sheets', is_critical_path: false, order_index: 5 }
  ];

  // --- 14. Scheduling Rules ---
  const schedulingRules = [
    { id: 'rule_1', name: 'Concrete Curing Buffer', description: 'Ensure suspended concrete slab pours have a minimum 7-day curing buffer before structural framing columns can be formed above.', project_type: 'Residential Building', rule_type: 'buffer', condition: 'concrete_slab_to_columns', action: 'insert_delay', parameters: '{"days":7}', is_active: true, created_by: 'Suresh Sharma' },
    { id: 'rule_2', name: 'Shoring Inspection Gate', description: 'Deep excavation works cannot proceed past 5m depth without geotechnical validation of shoring sheet piling deflection.', project_type: 'Commercial Tower', rule_type: 'constraint', condition: 'excavation_depth_limit', action: 'hold_works', parameters: '{"depth_meters":5}', is_active: true, created_by: 'Suresh Sharma' }
  ];

  // --- 15. User (Simulated Accounts) ---
  const users = [
    { id: 'usr_admin', email: 'admin@planedge.co', role: 'admin', created_date: new Date().toISOString(), updated_date: new Date().toISOString(), created_by_id: null },
    { id: 'usr_pm', email: 'pm@planedge.co', role: 'user', created_date: new Date().toISOString(), updated_date: new Date().toISOString(), created_by_id: null }
  ];

  // Save all to localStorage
  saveCollection('Project', projects);
  saveCollection('WBSItem', wbsItems);
  saveCollection('ScheduleActivity', scheduleActivities);
  saveCollection('BudgetItem', budgetItems);
  saveCollection('Milestone', milestones);
  saveCollection('ProgressEntry', progressEntries);
  saveCollection('AttendanceEntry', attendanceEntries);
  saveCollection('QualityInspection', qualityInspections);
  saveCollection('Document', documents);
  saveCollection('ChangeEvent', changeEvents);
  saveCollection('CollaborationPost', collaborationPosts);
  saveCollection('Notification', notifications);
  saveCollection('ScheduleTask', scheduleTasks);
  saveCollection('SchedulingRule', schedulingRules);
  saveCollection('User', users);
};

// Auto-seed database immediately
seedDatabase();

// --- Budget Rollup Helper ---
const rollUpBudgetItems = (items) => {
  if (!items || items.length === 0) return [];
  const num = (v) => parseFloat(v) || 0;

  // Fetch approved/submitted progress entries to get cumulative actuals
  const progressEntries = getCollection('ProgressEntry').filter(e => e.report_type === 'daily' || !e.report_type);
  const actualsMap = {};
  progressEntries.forEach(pe => {
    if (pe.budget_item_id) {
      if (!actualsMap[pe.budget_item_id]) {
        actualsMap[pe.budget_item_id] = 0;
      }
      actualsMap[pe.budget_item_id] += num(pe.value_of_work_done);
    }
  });

  const itemMap = {};
  items.forEach(item => {
    const rate = num(item.cost_per_unit);
    const quantity = num(item.quantity);
    let orig = num(item.original_budget);
    let rev = num(item.revised_budget || item.original_budget);

    // If it's a child detailed line item, budget is derived from qty * unit cost
    if (item.level > 1 && quantity > 0 && rate > 0) {
      orig = quantity * rate;
      rev = quantity * rate;
    }

    const act = actualsMap[item.id] || 0;

    itemMap[item.id] = {
      ...item,
      original_budget: orig,
      revised_budget: rev,
      committed_cost: num(item.committed_cost),
      actual_cost: act,
      forecast_cost: num(item.forecast_cost || rev || orig),
    };
  });

  const getDirectChildren = (parentId) => {
    return Object.values(itemMap).filter(item => item.parent_id === parentId);
  };

  // Roll up L3 to L2
  const l2Items = Object.values(itemMap).filter(item => item.level === 2);
  l2Items.forEach(l2 => {
    const l3Children = getDirectChildren(l2.id);
    if (l3Children.length > 0) {
      l2.original_budget = l3Children.reduce((s, c) => s + c.original_budget, 0);
      l2.revised_budget = l3Children.reduce((s, c) => s + c.revised_budget, 0);
      l2.committed_cost = l3Children.reduce((s, c) => s + c.committed_cost, 0);
      l2.actual_cost = l3Children.reduce((s, c) => s + c.actual_cost, 0);
      l2.forecast_cost = l3Children.reduce((s, c) => s + c.forecast_cost, 0);
    }
  });

  // Roll up L2 to L1
  const l1Items = Object.values(itemMap).filter(item => item.level === 1 || !item.parent_id);
  l1Items.forEach(l1 => {
    const l2Children = getDirectChildren(l1.id);
    if (l2Children.length > 0) {
      // original_budget is constant L1 value, NOT rolled up from L2!
      l1.revised_budget = l2Children.reduce((s, c) => s + c.revised_budget, 0);
      l1.committed_cost = l2Children.reduce((s, c) => s + c.committed_cost, 0);
      l1.actual_cost = l2Children.reduce((s, c) => s + c.actual_cost, 0);
      l1.forecast_cost = l2Children.reduce((s, c) => s + c.forecast_cost, 0);
    } else {
      l1.revised_budget = l1.original_budget;
    }
  });

  return Object.values(itemMap);
};

// --- Progress Aggregator Helper ---
const aggregateProgressEntries = (entries) => {
  if (!entries || entries.length === 0) return [];
  const dailyEntries = entries.filter(e => e.report_type === 'daily' || !e.report_type);

  // Group by week (ISO week string, e.g. "2026-W22")
  const getWeekString = (dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'unknown';
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const year = d.getUTCFullYear();
    const weekNo = Math.ceil((((d - new Date(Date.UTC(year, 0, 1))) / 86400000) + 1) / 7);
    return `${year}-W${String(weekNo).padStart(2, '0')}`;
  };

  const getWeekRange = (weekStr) => {
    if (weekStr === 'unknown') return 'Unknown Date';
    const [year, week] = weekStr.split('-W').map(Number);
    const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
    const dow = simple.getUTCDay();
    const ISOweekStart = simple;
    if (dow <= 4) {
      ISOweekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
    } else {
      ISOweekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
    }
    const end = new Date(ISOweekStart);
    end.setUTCDate(end.getUTCDate() + 6);
    return `${ISOweekStart.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`;
  };

  // Group by month string, e.g. "2026-06"
  const getMonthString = (dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'unknown';
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };

  const getMonthLabel = (monthStr) => {
    if (monthStr === 'unknown') return 'Unknown Month';
    const [year, month] = monthStr.split('-');
    const date = new Date(year, month - 1, 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // 1. Generate weekly entries
  const weeklyMap = {};
  dailyEntries.forEach(e => {
    const wk = getWeekString(e.date);
    const key = `${e.project_id || 'all'}-${e.budget_item_id || 'all'}-${wk}`;
    if (!weeklyMap[key]) {
      weeklyMap[key] = {
        id: `prg_wk_${key}`,
        project_id: e.project_id,
        budget_item_id: e.budget_item_id,
        date: getWeekRange(wk),
        report_type: 'weekly',
        submitted_by: 'System Aggregated',
        work_done_description: [],
        quantity_done: 0,
        unit: e.unit,
        labor_count: 0,
        location_tag: new Set(),
        issues_reported: [],
        weather_condition: 'clear',
        status: 'approved',
        value_of_work_done: 0,
        _is_aggregated: true
      };
    }
    const w = weeklyMap[key];
    if (e.work_done_description) w.work_done_description.push(e.work_done_description);
    w.quantity_done += parseFloat(e.quantity_done) || 0;
    w.labor_count += parseFloat(e.labor_count) || 0;
    if (e.location_tag) w.location_tag.add(e.location_tag);
    if (e.issues_reported) w.issues_reported.push(e.issues_reported);
    w.value_of_work_done += parseFloat(e.value_of_work_done) || 0;
  });

  const weeklyEntries = Object.values(weeklyMap).map(w => ({
    ...w,
    work_done_description: w.work_done_description.filter(Boolean).join('; ') || 'System aggregated progress',
    location_tag: Array.from(w.location_tag).filter(Boolean).join(', ') || '',
    issues_reported: w.issues_reported.filter(Boolean).join('; ') || ''
  }));

  // 2. Generate monthly entries
  const monthlyMap = {};
  dailyEntries.forEach(e => {
    const mo = getMonthString(e.date);
    const key = `${e.project_id || 'all'}-${e.budget_item_id || 'all'}-${mo}`;
    if (!monthlyMap[key]) {
      monthlyMap[key] = {
        id: `prg_mo_${key}`,
        project_id: e.project_id,
        budget_item_id: e.budget_item_id,
        date: getMonthLabel(mo),
        report_type: 'monthly',
        submitted_by: 'System Aggregated',
        work_done_description: [],
        quantity_done: 0,
        unit: e.unit,
        labor_count: 0,
        location_tag: new Set(),
        issues_reported: [],
        weather_condition: 'clear',
        status: 'approved',
        value_of_work_done: 0,
        _is_aggregated: true
      };
    }
    const m = monthlyMap[key];
    if (e.work_done_description) m.work_done_description.push(e.work_done_description);
    m.quantity_done += parseFloat(e.quantity_done) || 0;
    m.labor_count += parseFloat(e.labor_count) || 0;
    if (e.location_tag) m.location_tag.add(e.location_tag);
    if (e.issues_reported) m.issues_reported.push(e.issues_reported);
    m.value_of_work_done += parseFloat(e.value_of_work_done) || 0;
  });

  const monthlyEntries = Object.values(monthlyMap).map(m => ({
    ...m,
    work_done_description: m.work_done_description.filter(Boolean).join('; ') || 'System aggregated progress',
    location_tag: Array.from(m.location_tag).filter(Boolean).join(', ') || '',
    issues_reported: m.issues_reported.filter(Boolean).join('; ') || ''
  }));

  return [...dailyEntries, ...weeklyEntries, ...monthlyEntries];
};

const getCollectionProcessed = (name) => {
  const items = getCollection(name);
  if (name === 'BudgetItem') {
    return rollUpBudgetItems(items);
  }
  if (name === 'ProgressEntry') {
    return aggregateProgressEntries(items);
  }
  return items;
};

// --- Generic Database Handler ---
const db = {
  list: (entityName, sortField = '-created_date', limit = 100) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        let items = getCollectionProcessed(entityName);

        // Sorting logic
        if (sortField) {
          const isDesc = sortField.startsWith('-');
          const field = isDesc ? sortField.substring(1) : sortField;

          items.sort((a, b) => {
            const valA = a[field];
            const valB = b[field];
            if (valA === undefined || valA === null) return 1;
            if (valB === undefined || valB === null) return -1;

            if (typeof valA === 'string') {
              return isDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
            }
            return isDesc ? valB - valA : valA - valB;
          });
        }

        // Limit logic
        if (limit > 0) {
          items = items.slice(0, limit);
        }

        resolve(items);
      }, 50); // slight simulated delay
    });
  },

  filter: (entityName, criteria = {}, sortField = null, limit = 100) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        let items = getCollectionProcessed(entityName);

        // Filtering
        items = items.filter(item => {
          for (const key in criteria) {
            if (item[key] !== criteria[key]) {
              return false;
            }
          }
          return true;
        });

        // Sorting
        if (sortField) {
          const isDesc = sortField.startsWith('-');
          const field = isDesc ? sortField.substring(1) : sortField;

          items.sort((a, b) => {
            const valA = a[field];
            const valB = b[field];
            if (valA === undefined || valA === null) return 1;
            if (valB === undefined || valB === null) return -1;

            if (typeof valA === 'string') {
              return isDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
            }
            return isDesc ? valB - valA : valA - valB;
          });
        }

        // Limit
        if (limit > 0) {
          items = items.slice(0, limit);
        }

        resolve(items);
      }, 50);
    });
  },

  create: (entityName, data) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const items = getCollection(entityName);
        const activeUser = JSON.parse(localStorage.getItem('Planedge_Monitors_current_user') || '{"id":"usr_admin"}');

        const newItem = {
          ...data,
          id: data.id || generateId(entityName.toLowerCase().substring(0, 4)),
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
          created_by_id: activeUser?.id || 'usr_admin'
        };

        if (entityName === 'ProgressEntry') {
          const budgetItemId = data.budget_item_id;
          if (budgetItemId) {
            const allProgress = getCollection('ProgressEntry');
            const cumulativeQty = allProgress
              .filter(p => p.budget_item_id === budgetItemId)
              .reduce((s, p) => s + (parseFloat(p.quantity_done) || 0), 0) + (parseFloat(data.quantity_done) || 0);

            const budgets = getCollection('BudgetItem');
            const budgetItem = budgets.find(b => b.id === budgetItemId);
            if (budgetItem && cumulativeQty >= (parseFloat(budgetItem.quantity) || 0)) {
              // Complete corresponding Milestones
              const milestones = getCollection('Milestone');
              let updatedMilestones = false;
              milestones.forEach(m => {
                if (m.project_id === data.project_id && (
                  m.id === budgetItem.milestone_id ||
                  m.title.toUpperCase().includes(budgetItem.title.toUpperCase()) ||
                  budgetItem.title.toUpperCase().includes(m.title.toUpperCase())
                )) {
                  m.status = 'completed';
                  m.progress = 100;
                  m.actual_end = new Date().toISOString().split('T')[0];
                  updatedMilestones = true;
                }
              });
              if (updatedMilestones) saveCollection('Milestone', milestones);

              // Complete corresponding ScheduleActivities
              const scheduleActivities = getCollection('ScheduleActivity');
              let updatedActivities = false;
              scheduleActivities.forEach(sa => {
                if (sa.project_id === data.project_id && (
                  sa.wbs_item_id === budgetItem.wbs_item_id ||
                  sa.name.toUpperCase().includes(budgetItem.title.toUpperCase()) ||
                  budgetItem.title.toUpperCase().includes(sa.name.toUpperCase())
                )) {
                  sa.status = 'completed';
                  sa.progress = 100;
                  sa.actual_end = new Date().toISOString().split('T')[0];
                  updatedActivities = true;
                }
              });
              if (updatedActivities) saveCollection('ScheduleActivity', scheduleActivities);
            }
          }
        }

        items.push(newItem);
        saveCollection(entityName, items);
        resolve(newItem);
      }, 50);
    });
  },

  update: (entityName, id, data) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const items = getCollection(entityName);
        const index = items.findIndex(item => item.id === id);

        if (index === -1) {
          reject(new Error(`${entityName} not found with id: ${id}`));
          return;
        }

        const updatedItem = {
          ...items[index],
          ...data,
          updated_date: new Date().toISOString()
        };

        if (entityName === 'ProgressEntry') {
          const budgetItemId = data.budget_item_id || items[index].budget_item_id;
          if (budgetItemId) {
            const allProgress = getCollection('ProgressEntry');
            const otherProgress = allProgress.filter(p => p.id !== id);
            const cumulativeQty = otherProgress
              .filter(p => p.budget_item_id === budgetItemId)
              .reduce((s, p) => s + (parseFloat(p.quantity_done) || 0), 0) + (parseFloat(data.quantity_done || items[index].quantity_done) || 0);

            const budgets = getCollection('BudgetItem');
            const budgetItem = budgets.find(b => b.id === budgetItemId);
            if (budgetItem && cumulativeQty >= (parseFloat(budgetItem.quantity) || 0)) {
              // Complete corresponding Milestones
              const milestones = getCollection('Milestone');
              let updatedMilestones = false;
              milestones.forEach(m => {
                if (m.project_id === (data.project_id || items[index].project_id) && (
                  m.id === budgetItem.milestone_id ||
                  m.title.toUpperCase().includes(budgetItem.title.toUpperCase()) ||
                  budgetItem.title.toUpperCase().includes(m.title.toUpperCase())
                )) {
                  m.status = 'completed';
                  m.progress = 100;
                  m.actual_end = new Date().toISOString().split('T')[0];
                  updatedMilestones = true;
                }
              });
              if (updatedMilestones) saveCollection('Milestone', milestones);

              // Complete corresponding ScheduleActivities
              const scheduleActivities = getCollection('ScheduleActivity');
              let updatedActivities = false;
              scheduleActivities.forEach(sa => {
                if (sa.project_id === (data.project_id || items[index].project_id) && (
                  sa.wbs_item_id === budgetItem.wbs_item_id ||
                  sa.name.toUpperCase().includes(budgetItem.title.toUpperCase()) ||
                  budgetItem.title.toUpperCase().includes(sa.name.toUpperCase())
                )) {
                  sa.status = 'completed';
                  sa.progress = 100;
                  sa.actual_end = new Date().toISOString().split('T')[0];
                  updatedActivities = true;
                }
              });
              if (updatedActivities) saveCollection('ScheduleActivity', scheduleActivities);
            }
          }
        }

        items[index] = updatedItem;
        saveCollection(entityName, items);
        resolve(updatedItem);
      }, 50);
    });
  },

  delete: (entityName, id) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const items = getCollection(entityName);
        const index = items.findIndex(item => item.id === id);

        if (index === -1) {
          reject(new Error(`${entityName} not found with id: ${id}`));
          return;
        }

        const deleted = items.splice(index, 1)[0];
        saveCollection(entityName, items);
        resolve(deleted);
      }, 50);
    });
  },

  bulkCreate: (entityName, arrayData) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const items = getCollection(entityName);
        const activeUser = JSON.parse(localStorage.getItem('Planedge_Monitors_current_user') || '{"id":"usr_admin"}');

        const createdItems = arrayData.map((data, i) => ({
          ...data,
          id: data.id || generateId(entityName.toLowerCase().substring(0, 4)),
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
          created_by_id: activeUser?.id || 'usr_admin',
          order_index: data.order_index !== undefined ? data.order_index : items.length + i
        }));

        const newItemsList = [...items, ...createdItems];
        saveCollection(entityName, newItemsList);
        resolve(createdItems);
      }, 50);
    });
  }
};

// Create entity services mappings
const entities = {};
const entityNames = [
  'Project',
  'WBSItem',
  'ScheduleActivity',
  'BudgetItem',
  'Milestone',
  'ProgressEntry',
  'AttendanceEntry',
  'QualityInspection',
  'Document',
  'ChangeEvent',
  'CollaborationPost',
  'Notification',
  'ScheduleTask',
  'SchedulingRule',
  'User'
];

entityNames.forEach(name => {
  entities[name] = {
    list: (sortField, limit) => db.list(name, sortField, limit),
    filter: (criteria, sortField, limit) => db.filter(name, criteria, sortField, limit),
    create: (data) => db.create(name, data),
    update: (id, data) => db.update(name, id, data),
    delete: (id) => db.delete(name, id),
    bulkCreate: (items) => db.bulkCreate(name, items)
  };
});

// --- Mock LLM and Helper Functions ---
const invokeLLM = async ({ prompt, response_json_schema, file_urls }) => {
  // 1. Check if it is the Schedule Generator prompt (CPM schedule activities)
  if (prompt.includes('detailed construction schedule') && prompt.includes('activity_id')) {
    // Generate CPM Schedule Activities dynamically based on prompt parameters
    const projectTypeMatch = prompt.match(/Project type:\s*([^\n]+)/);
    const startDateMatch = prompt.match(/Start date:\s*([^\n]+)/);
    const durationMatch = prompt.match(/Total duration:\s*([0-9]+)\s*months/);

    const projectType = projectTypeMatch ? projectTypeMatch[1].trim() : 'Residential';
    const startDateStr = startDateMatch ? startDateMatch[1].trim() : new Date().toISOString().split('T')[0];
    const durationMonths = durationMatch ? parseInt(durationMatch[1]) : 12;

    // Create logical timeline starting on start date
    const start = new Date(startDateStr);

    // Helper to format ISO dates
    const formatDate = (d) => d.toISOString().split('T')[0];

    // Dynamic CPM Schedule template activities
    const cpmTemplates = [
      { activity_id: 'A1000', name: 'Site Mobilization & Excavation Prep', phase: 'foundation', duration_days: 8, float_days: 0, is_critical_path: true, is_milestone: false, assigned_crew: 'Civil Crew A', predecessors: [] },
      { activity_id: 'A1010', name: 'Foundation Ground Drilling & Piling', phase: 'foundation', duration_days: 14, float_days: 0, is_critical_path: true, is_milestone: false, assigned_crew: 'Piling Subcontractor', predecessors: ['A1000'] },
      { activity_id: 'A1020', name: 'Foundation Slab Shuttering & Rebar Laying', phase: 'foundation', duration_days: 10, float_days: 0, is_critical_path: true, is_milestone: false, assigned_crew: 'Steel Fixers', predecessors: ['A1010'] },
      { activity_id: 'A1030', name: 'Raft Foundation Concrete Pouring', phase: 'foundation', duration_days: 2, float_days: 0, is_critical_path: true, is_milestone: false, assigned_crew: 'Concrete Specialist', predecessors: ['A1020'] },
      { activity_id: 'A1040', name: 'Foundation Concrete Curing & Waterproofing', phase: 'foundation', duration_days: 7, float_days: 0, is_critical_path: true, is_milestone: false, assigned_crew: 'Civil Crew B', predecessors: ['A1030'] },
      { activity_id: 'A1050', name: 'Columns and Core Walls (Lower Floors)', phase: 'structure', duration_days: 15, float_days: 0, is_critical_path: true, is_milestone: false, assigned_crew: 'Structural Shuttering B', predecessors: ['A1040'] },
      { activity_id: 'A1060', name: 'Slab Formwork & Casting (L1-L3)', phase: 'structure', duration_days: 12, float_days: 0, is_critical_path: true, is_milestone: false, assigned_crew: 'Concrete Crew C', predecessors: ['A1050'] },
      { activity_id: 'A1070', name: 'Columns and Walls Concrete (Upper Floors)', phase: 'structure', duration_days: 18, float_days: 0, is_critical_path: true, is_milestone: false, assigned_crew: 'Structural Shuttering B', predecessors: ['A1060'] },
      { activity_id: 'A1080', name: 'Slab Formwork & Casting (L4-L12)', phase: 'structure', duration_days: 22, float_days: 0, is_critical_path: true, is_milestone: false, assigned_crew: 'Concrete Crew C', predecessors: ['A1070'] },
      { activity_id: 'A1090', name: 'Main Vertical MEP Conduits & Risers', phase: 'mep', duration_days: 15, float_days: 10, is_critical_path: false, is_milestone: false, assigned_crew: 'Union MEP Crew', predecessors: ['A1060'] },
      { activity_id: 'A1100', name: 'HVAC Piping & Air Duct Installation', phase: 'mep', duration_days: 18, float_days: 8, is_critical_path: false, is_milestone: false, assigned_crew: 'HVAC Techs', predecessors: ['A1090'] },
      { activity_id: 'A1110', name: 'Internal Water Piping & Sewer Lines', phase: 'mep', duration_days: 14, float_days: 12, is_critical_path: false, is_milestone: false, assigned_crew: 'Pipe Plumbers', predecessors: ['A1090'] },
      { activity_id: 'A1120', name: 'Electrical Wiring Pulling & Junction Boxes', phase: 'mep', duration_days: 16, float_days: 14, is_critical_path: false, is_milestone: false, assigned_crew: 'Electrical Team', predecessors: ['A1090'] },
      { activity_id: 'A1130', name: 'Exterior Facade Sub-frame Anchoring', phase: 'finishing', duration_days: 14, float_days: 5, is_critical_path: false, is_milestone: false, assigned_crew: 'Facade Specialists', predecessors: ['A1080'] },
      { activity_id: 'A1140', name: 'Curtain Wall Double Glazing Installation', phase: 'finishing', duration_days: 20, float_days: 5, is_critical_path: false, is_milestone: false, assigned_crew: 'Glass Glazers', predecessors: ['A1130'] },
      { activity_id: 'A1150', name: 'Interior Drywall Partition Metal Studs', phase: 'finishing', duration_days: 15, float_days: 0, is_critical_path: true, is_milestone: false, assigned_crew: 'Drywall Installer A', predecessors: ['A1080', 'A1100', 'A1110', 'A1120'] },
      { activity_id: 'A1160', name: 'Wall plastering & Paint Undercoating', phase: 'finishing', duration_days: 12, float_days: 0, is_critical_path: true, is_milestone: false, assigned_crew: 'Finishing Painters', predecessors: ['A1150'] },
      { activity_id: 'A1170', name: 'Bathrooms and General Flooring Tiling', phase: 'finishing', duration_days: 14, float_days: 3, is_critical_path: false, is_milestone: false, assigned_crew: 'Tilers Group', predecessors: ['A1160'] },
      { activity_id: 'A1180', name: 'Painting Final Coat & Sanitary Fixtures', phase: 'finishing', duration_days: 10, float_days: 0, is_critical_path: true, is_milestone: false, assigned_crew: 'Detail Finishers', predecessors: ['A1160'] },
      { activity_id: 'A1190', name: 'Integrated Plumbing, Electrical & Fire Testing', phase: 'handover', duration_days: 8, float_days: 0, is_critical_path: true, is_milestone: false, assigned_crew: 'Commissioning Engineers', predecessors: ['A1180', 'A1140', 'A1170'] },
      { activity_id: 'A1200', name: 'Civil Defect Snagging List Rectification', phase: 'handover', duration_days: 7, float_days: 0, is_critical_path: true, is_milestone: false, assigned_crew: 'Snagging Crew', predecessors: ['A1190'] },
      { id: 'ms_gen_handover', activity_id: 'A1210', name: 'Client Snag Audit & Handover Signoff', phase: 'handover', duration_days: 2, float_days: 0, is_critical_path: true, is_milestone: true, assigned_crew: 'Management Representatives', predecessors: ['A1200'] }
    ];

    // Compute dates chronologically
    const taskEndDates = {};
    const processedActivities = cpmTemplates.map((tpl, idx) => {
      let earliestStart = new Date(start);

      // Calculate earliest start date based on predecessors
      if (tpl.predecessors && tpl.predecessors.length > 0) {
        let maxEndTime = 0;
        tpl.predecessors.forEach(predId => {
          if (taskEndDates[predId]) {
            const predEndTime = new Date(taskEndDates[predId]).getTime();
            if (predEndTime > maxEndTime) {
              maxEndTime = predEndTime;
            }
          }
        });
        if (maxEndTime > 0) {
          // Start the day after predecessors finish
          earliestStart = new Date(maxEndTime + 24 * 60 * 60 * 1000);
        }
      }

      const plannedStart = formatDate(earliestStart);
      const plannedEndObj = new Date(earliestStart);
      plannedEndObj.setDate(plannedEndObj.getDate() + tpl.duration_days - 1);
      const plannedEnd = formatDate(plannedEndObj);

      taskEndDates[tpl.activity_id] = plannedEnd;

      return {
        ...tpl,
        planned_start: plannedStart,
        planned_end: plannedEnd,
        status: 'not_started',
        progress: 0,
        order_index: idx
      };
    });

    return { activities: processedActivities };
  }

  // 2. Check if it is the Schedule Task generator (legacy SmartScheduler tasks)
  if (prompt.includes('detailed construction schedule for a') && prompt.includes('construction tasks organized by phases')) {
    // Extract parameters
    const projectTypeMatch = prompt.match(/a\s+([^\n]+)\s+project/i);
    const floorsMatch = prompt.match(/with\s+([^\n]+)\s+floors/i);
    const startDateMatch = prompt.match(/Start date:\s*([^\s,]+)/);

    const projectType = projectTypeMatch ? projectTypeMatch[1].trim() : 'Commercial';
    const floors = floorsMatch ? floorsMatch[1].trim() : '5';
    const startDate = startDateMatch ? startDateMatch[1].trim() : new Date().toISOString().split('T')[0];

    const tasks = [
      { name: 'Site Mobilization & Fencing Setup', phase: 'foundation', duration_days: 7, description: `Deliver site cabins and fence boundary lines for the ${floors}-floor ${projectType} site.`, assigned_crew: 'Mobilization Crew', is_critical_path: true },
      { name: 'Excavation & Shoring Wall Install', phase: 'foundation', duration_days: 15, description: 'Excavate structural footprint to foundation level.', assigned_crew: 'Excavation A', is_critical_path: true },
      { name: 'Pouring Concrete Raft Foundation', phase: 'foundation', duration_days: 10, description: 'Lay base rebar cages and concrete pour.', assigned_crew: 'Foundation Team', is_critical_path: true },
      { name: 'L1 to L3 Columns & Core Formwork', phase: 'structure', duration_days: 14, description: 'Form concrete pillars and elevator shafts.', assigned_crew: 'Formwork Crew', is_critical_path: true },
      { name: 'Slab Reinforcement & Cast (Lower Floors)', phase: 'structure', duration_days: 12, description: 'Pour floor slabs for level 1-3.', assigned_crew: 'Pouring Union', is_critical_path: true },
      { name: 'L4 to L6 Structural Framings', phase: 'structure', duration_days: 18, description: 'Form column structures for mid level floors.', assigned_crew: 'Formwork Crew', is_critical_path: true },
      { name: 'Electrical & Plumbing Riser Runs', phase: 'mep', duration_days: 16, description: 'Install electrical main lines and plumbing conduits in walls.', assigned_crew: 'MEP Services', is_critical_path: false },
      { name: 'HVAC Air Ducts Assembly L1-L3', phase: 'mep', duration_days: 14, description: 'Hang commercial duct assemblies.', assigned_crew: 'Air Conditioning Team', is_critical_path: false },
      { name: 'Drywall Boarding & Wall Screed', phase: 'finishing', duration_days: 18, description: 'Create internal rooms with plasterboard partitions.', assigned_crew: 'Finishing Crew', is_critical_path: false },
      { name: 'Glazing Curtain Wall Systems', phase: 'finishing', duration_days: 22, description: 'Mount facade windows on building structural frame.', assigned_crew: 'Glazing Crew', is_critical_path: false },
      { name: 'Elevators and Mechanical Commissioning', phase: 'handover', duration_days: 10, description: 'Test vertical transport systems and main breakers.', assigned_crew: 'Testing Engineers', is_critical_path: true },
      { name: 'Snagging Defect Rectifications & Cleaning', phase: 'handover', duration_days: 7, description: 'Final painting patch-ups and clean for delivery.', assigned_crew: 'Cleanup Team', is_critical_path: true }
    ];

    return { tasks };
  }

  // 3. Check if it is the Schedule Analyzer prompt
  if (prompt.includes('Analyze this construction schedule file')) {
    return {
      overall_score: 84,
      summary: 'The schedule aligns with standard industry sequence. Minor warning noted on a resource bottleneck where "Formwork Crew" overlaps on multiple parallel activities without sufficient float.',
      issues: [
        { severity: 'high', title: 'Resource Allocation Clash', description: 'Formwork Crew is assigned to both structure columns and shoring wall activities on overlapping dates.', recommendation: 'Offset the structural columns start date by 4 days, or introduce a second formwork sub-crew.' },
        { severity: 'medium', title: 'Critical Path Buffer Deficit', description: 'MEP Vertical Risers start immediately on structural slab casting completion. Minimum curing buffer not respected.', recommendation: 'Introduce a 5-day wet concrete curing buffer prior to mounting heavy MEP brackets.' },
        { severity: 'low', title: 'Open Predecessor Links', description: 'HVAC Air Ducts activity lacks a direct relationship link to general ceiling closing finishing works.', recommendation: 'Add HVAC ducts completion as a finish-to-start predecessor for partition drywall sealing.' }
      ]
    };
  }

  // 4. Fallback is the Executive Reports generator (raw markdown report)
  // Fetch current stats from mock DB to make the report sound incredibly real!
  const projs = getCollection('Project');
  const miles = getCollection('Milestone');
  const tasks = getCollection('ScheduleActivity');
  const lab = getCollection('AttendanceEntry');
  const chg = getCollection('ChangeEvent');
  const budget = getCollectionProcessed('BudgetItem');

  const totalBudget = budget.filter(b => b.level === 1).reduce((s, b) => s + (b.original_budget || 0), 0);
  const totalSpent = budget.filter(b => b.level === 1).reduce((s, b) => s + (b.actual_cost || 0), 0);

  const reportPeriod = prompt.includes('daily') ? 'DAILY' : prompt.includes('weekly') ? 'WEEKLY' : 'MONTHLY';

  const { formatCurrencyINR } = await import('@/lib/formatters');
  const reportText = `
# SITE-PULSE CONSTRUCTION PROGRESS REPORT (${reportPeriod})
**Date:** ${new Date().toISOString().split('T')[0]}  
**Classification:** Professional Operational Summary

---

## 1. Executive Summary
The portfolio shows stable progression across the board. Active attendance metrics reflect steady workforce presence, though external factors like localized high wind warnings slightly hampered facade glass mounting. Total cost variance remains within acceptable thresholds, with spent at **${formatCurrencyINR(totalSpent)}** against a combined baseline of **${formatCurrencyINR(totalBudget)}**.

## 2. Project Status
${projs.map(p => `*   **${p.name}** — Status: **${p.status.toUpperCase()}** | Progress: **${p.progress}%** | Site Location: *${p.location}*`).join('\n')}

## 3. Key Milestones Update
*   **Substructure Completion:** Completed on schedule. Raft slab concrete achieved 100% cured design capacity.
*   **Topping Out (L12 Concrete Frame):** Currently at **85%**. Columns for floor 9 and formwork for level 10 slab are progressing in sequence.
*   **Facade Curtain Wall Glazing:** Currently **Delayed** at 30% due to safety warnings on hoisting equipment during high-wind intervals.

## 4. Labor & Resource Allocation
A total of **${lab.length} trade teams** were active this week, logging critical task hours:
*   **Structural Formwork:** 10-14 members active on L9 vertical pouring.
*   **HVAC & Conduit MEP:** 8 technicians running vertical risers from level 4 up.
*   **General Civil Labor:** Site cleaning, material distribution, and waste disposal.

## 5. Change Management & Variances
*   **Resolved:** Encountered soft soil pocket during excavation shoring, mitigated by installing supplementary steel sheet piles at an impact cost of **$45,000** and **5 schedule days**.
*   **Under Review:** Layout change request from client to merge units 802 & 803. Currently awaiting design drawings and cost approval.

## 6. Risks & Immediate Action Items
1.  **Weather Interruption:** Monitor high-wind forecasts closely. Glazing works must hold when gusts exceed 25 knots.
2.  **MEP Sequencing:** Ensure electrical grounding rework on L1-L3 is cleared before starting wall drywall boarding.
3.  **Materials Deficit:** Concrete trucks delivery scheduled at 6:00 AM. Clear access road to avoid pump delays.
  `;

  return reportText.trim();
};

const uploadFile = async ({ file }) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!file) {
        resolve({ file_url: '' });
        return;
      }

      // Use standard Object URL so browser can actually display/read the file
      try {
        const file_url = URL.createObjectURL(file);
        resolve({ file_url, file_name: file.name });
      } catch (e) {
        console.error('Error creating object URL:', e);
        resolve({ file_url: '', file_name: file.name });
      }
    }, 150);
  });
};

// --- Authentication Client Mock ---
const auth = {
  me: () => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const token = localStorage.getItem('base44_access_token') || localStorage.getItem('token');
        if (!token) {
          reject({ status: 401, message: 'Authentication required' });
          return;
        }

        const currentUser = JSON.parse(localStorage.getItem('Planedge_Monitors_current_user') || 'null');
        if (currentUser) {
          resolve(currentUser);
        } else {
          // Default fallback
          const defaultUser = { id: 'usr_admin', email: 'admin@planedge.co', role: 'admin' };
          localStorage.setItem('Planedge_Monitors_current_user', JSON.stringify(defaultUser));
          resolve(defaultUser);
        }
      }, 50);
    });
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('Planedge_Monitors_current_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  loginViaEmailPassword: (email, password) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!email || !password) {
          reject(new Error('Email and password are required.'));
          return;
        }

        // Let any credentials log in during local execution
        const role = email.toLowerCase().includes('admin') ? 'admin' : 'user';
        const user = {
          id: generateId('usr'),
          email: email,
          role: role
        };

        localStorage.setItem('base44_access_token', 'mock_Planedge_Monitors_jwt_token_' + Date.now());
        localStorage.setItem('Planedge_Monitors_current_user', JSON.stringify(user));

        resolve(user);
      }, 300);
    });
  },

  register: ({ email, password }) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Save pending signup data in local storage
        localStorage.setItem('Planedge_Monitors_pending_register', JSON.stringify({ email, password }));
        resolve({ success: true });
      }, 200);
    });
  },

  verifyOtp: ({ email, otpCode }) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const pending = JSON.parse(localStorage.getItem('Planedge_Monitors_pending_register') || '{}');

        // Accept any OTP code for mock convenience
        const role = email.toLowerCase().includes('admin') ? 'admin' : 'user';
        const user = {
          id: generateId('usr'),
          email: email || pending.email || 'user@company.com',
          role: role
        };

        localStorage.removeItem('Planedge_Monitors_pending_register');
        localStorage.setItem('base44_access_token', 'mock_Planedge_Monitors_jwt_token_' + Date.now());
        localStorage.setItem('Planedge_Monitors_current_user', JSON.stringify(user));

        resolve({
          access_token: 'mock_Planedge_Monitors_jwt_token_' + Date.now(),
          user
        });
      }, 300);
    });
  },

  resendOtp: (email) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true });
      }, 100);
    });
  },

  setToken: (token) => {
    if (token) {
      localStorage.setItem('base44_access_token', token);
    } else {
      localStorage.removeItem('base44_access_token');
    }
  },

  loginWithProvider: (provider, redirectUrl) => {
    setTimeout(() => {
      const user = {
        id: 'usr_oauth',
        email: 'google.user@company.com',
        role: 'admin'
      };
      localStorage.setItem('base44_access_token', 'mock_Planedge_Monitors_oauth_token_' + Date.now());
      localStorage.setItem('Planedge_Monitors_current_user', JSON.stringify(user));
      window.location.href = redirectUrl || '/';
    }, 200);
  },

  resetPasswordRequest: (email) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true });
      }, 200);
    });
  },

  resetPassword: ({ resetToken, newPassword }) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true });
      }, 200);
    });
  },

  logout: (redirectUrl) => {
    localStorage.removeItem('base44_access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('Planedge_Monitors_current_user');
    if (redirectUrl) {
      window.location.href = '/login';
    } else {
      window.location.href = '/login';
    }
  },

  redirectToLogin: (redirectUrl) => {
    const redirectParam = redirectUrl ? `?from=${encodeURIComponent(redirectUrl)}` : '';
    window.location.href = `/login${redirectParam}`;
  }
};

// --- Users Client Mock (Admin features) ---
const usersMock = {
  inviteUser: (email, role) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const usersList = getCollection('User');
        const newUser = {
          id: generateId('usr'),
          email: email,
          role: role || 'user',
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
          created_by_id: 'usr_admin'
        };
        usersList.push(newUser);
        saveCollection('User', usersList);
        resolve(newUser);
      }, 200);
    });
  }
};

// Main base44 namespace export
export const base44 = {
  entities,
  auth,
  users: usersMock,
  integrations: {
    Core: {
      InvokeLLM: invokeLLM,
      UploadFile: uploadFile
    },
    Schedule: {
      generate: generateSchedule,
      finalize: finalizeSchedule,
      getModelParameters: getModelParameters
    }
  }
};
