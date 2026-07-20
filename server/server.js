import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './db/index.js';
import { authenticateToken, requireAdmin } from './middleware/auth.js';
import { generateSchedule, finalizeSchedule, getModelParameters } from './services/scheduleModel.js';
import { seedWbsTemplateIfEmpty, syncDefaultWbsTemplate, applyWbsTemplateToProject, compareWbsIds } from './db/wbsTemplate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretplanedgekey123!';

function formatDbError(error) {
  if (error?.code === 'ECONNREFUSED') {
    return 'Database is not running. Start the PostgreSQL service, then run: npm run db:setup';
  }
  const cause = error?.errors?.[0];
  if (cause?.code === 'ECONNREFUSED') {
    return 'Database is not running. Start the PostgreSQL service, then run: npm run db:setup';
  }
  return error?.message || 'Database error';
}

// Express Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Ensure Uploads Directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
try {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
} catch (e) {
  // directory already exists
}

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure Multer for local uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

// Entity to table mapping
const tableMap = {
  'Project': 'projects',
  'WBSItem': 'wbs_items',
  'ScheduleActivity': 'schedule_activities',
  'BudgetItem': 'budget_items',
  'Milestone': 'milestones',
  'ProgressEntry': 'progress_entries',
  'AttendanceEntry': 'attendance_entries',
  'QualityInspection': 'quality_inspections',
  'Document': 'documents',
  'ChangeEvent': 'change_events',
  'CollaborationPost': 'collaboration_posts',
  'Notification': 'notifications',
  'ScheduleTask': 'schedule_tasks',
  'SchedulingRule': 'scheduling_rules',
  'User': 'users',
  'SubProject': 'sub_projects',
  'ProjectFlat': 'project_flats',
  'MepBoq': 'mep_boqs',
  'TechnicalStaff': 'technical_staff',
  'TechnicalStaffAttendance': 'technical_staff_attendance',
  'Contractor': 'contractors',
  'ContractorLabour': 'contractor_labours',
  'MachineryDetail': 'machinery_details',
  'MaterialStatus': 'material_status',
  'DaysReport': 'days_reports',
  'StatusReport': 'status_reports',
  'SpecialSiteVisit': 'special_site_visits',
  'CriticalIssue': 'critical_issues',
  'NextDaysPlan': 'next_days_plans',
  'WprReport': 'wpr_reports',
  'MprReport': 'mpr_reports',
  'Role': 'roles',
  'Module': 'modules',
  'RolePermission': 'role_permissions',
  'Dpr': 'dprs',
  'WbsHeader': 'wbs_headers',
  'WbsApprovalHistory': 'wbs_approval_history'
};

const TABLES_WITH_CREATED_BY = new Set(['projects']);

// --- Helpers for formatting values and DB operations ---
const formatValue = (val) => {
  if (Array.isArray(val) || (typeof val === 'object' && val !== null)) {
    return JSON.stringify(val);
  }
  return val;
};

const getNextVendorCode = async (client) => {
  const res = await client.query(`
    SELECT vendor_code 
    FROM contractors 
    WHERE vendor_code ~ '^V-\\d+$' 
    ORDER BY CAST(SUBSTRING(vendor_code FROM 3) AS INTEGER) DESC 
    LIMIT 1
  `);
  if (res.rows.length === 0) {
    return 'V-001';
  }
  const lastCode = res.rows[0].vendor_code;
  const num = parseInt(lastCode.substring(2), 10);
  const nextNum = num + 1;
  const padded = String(nextNum).padStart(3, '0');
  return `V-${padded}`;
};

// --- Budget Rollup Helper (adapted for DB) ---
const rollUpBudgetItems = async (items) => {
  if (!items || items.length === 0) return [];
  const num = (v) => parseFloat(v) || 0;

  // Fetch approved/submitted progress entries to get cumulative actuals
  const progressEntriesRes = await db.query(
    "SELECT * FROM progress_entries WHERE report_type = 'daily' OR report_type IS NULL"
  );
  const progressEntries = progressEntriesRes.rows;
  
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

    // Child budget is derived from qty * unit cost
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

// --- Progress Aggregator Helper (adapted for DB) ---
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

const getCollectionProcessed = async (name, items) => {
  if (name === 'BudgetItem') {
    return await rollUpBudgetItems(items);
  }
  if (name === 'ProgressEntry') {
    return aggregateProgressEntries(items);
  }
  return items;
};

// --- Projects Transactional API ---
app.post('/api/projects/save-with-subprojects', authenticateToken, async (req, res) => {
  const { id, projectId, projectData, subProjectChanges } = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    let finalProjectId = projectId || id;
    const allowedColumns = [
      'name', 'description', 'location', 'client', 'status',
      'start_date', 'end_date', 'budget', 'project_manager', 'priority',
      'project_type', 'project_code', 'elevation_photo_url'
    ];

    // 1. Save or Update Project
    if (finalProjectId) {
      const setClauses = [];
      const values = [];
      let i = 1;
      for (const col of allowedColumns) {
        if (projectData[col] !== undefined) {
          setClauses.push(`${col} = $${i}`);
          values.push(projectData[col]);
          i++;
        }
      }
      values.push(finalProjectId);
      const updateQuery = `UPDATE projects SET ${setClauses.join(', ')} WHERE id = $${i}`;
      await client.query(updateQuery, values);
    } else {
      const columns = [];
      const placeholders = [];
      const values = [];
      let i = 1;
      
      finalProjectId = 'proj_' + Math.random().toString(36).substr(2, 9);
      columns.push('id');
      placeholders.push(`$${i}`);
      values.push(finalProjectId);
      i++;

      for (const col of allowedColumns) {
        if (projectData[col] !== undefined) {
          columns.push(col);
          placeholders.push(`$${i}`);
          values.push(projectData[col]);
          i++;
        }
      }
      const insertQuery = `INSERT INTO projects (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
      await client.query(insertQuery, values);
    }

    // 2. Handle Sub Project Changes
    if (subProjectChanges) {
      const { added = [], updated = [], deleted = [] } = subProjectChanges;

      // Delete Sub Projects
      for (const sp of deleted) {
        if (sp.id) {
          await client.query('DELETE FROM sub_projects WHERE id = $1', [sp.id]);
        }
      }

      // Update Sub Projects
      for (const sp of updated) {
        if (sp.id && sp.name) {
          await client.query('UPDATE sub_projects SET name = $1 WHERE id = $2', [sp.name, sp.id]);
        }
      }

      // Add Sub Projects
      for (const sp of added) {
        const newSubId = 'sub_' + Math.random().toString(36).substr(2, 9);
        await client.query(
          `INSERT INTO sub_projects (id, project_id, name, built_up_area, floors_count, flats_per_floor) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [newSubId, finalProjectId, sp.name, 0, 1, 0]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, projectId: finalProjectId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Project save transaction failed:', error);
    res.status(500).json({ error: error.message || 'Transaction failed' });
  } finally {
    client.release();
  }
});

// --- Authentication API ---

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const checkUser = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists.' });
    }

    const id = `usr_${Math.random().toString(36).substring(2, 11)}`;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const role = email.toLowerCase().includes('admin') ? 'admin' : 'user';

    const insertRes = await db.query(
      'INSERT INTO users (id, email, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, email, role',
      [id, email, role, passwordHash]
    );

    const user = insertRes.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ user, access_token: token });
  } catch (error) {
    res.status(500).json({ error: formatDbError(error) });
  }
});

// Helper for fetching role permissions
async function getRolePermissions(roleId) {
  const result = await db.query(`
    SELECT m.id AS module_id, 
           COALESCE(rp.can_view, FALSE) AS can_view,
           COALESCE(rp.can_add, FALSE) AS can_add,
           COALESCE(rp.can_edit, FALSE) AS can_edit,
           COALESCE(rp.can_delete, FALSE) AS can_delete,
           COALESCE(rp.can_approve, FALSE) AS can_approve,
           COALESCE(rp.can_export, FALSE) AS can_export,
           COALESCE(rp.can_print, FALSE) AS can_print,
           COALESCE(rp.can_admin, FALSE) AS can_admin
    FROM modules m
    LEFT JOIN role_permissions rp ON rp.module_id = m.id AND rp.role_id = $1
  `, [roleId]);

  const permissions = {};
  result.rows.forEach(row => {
    permissions[row.module_id] = {
      can_view: row.can_view,
      can_add: row.can_add,
      can_edit: row.can_edit,
      can_delete: row.can_delete,
      can_approve: row.can_approve,
      can_export: row.can_export,
      can_print: row.can_print,
      can_admin: row.can_admin
    };
  });
  return permissions;
}

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const userRes = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const user = userRes.rows[0];
    if (user.status === 'inactive') {
      return res.status(400).json({ error: 'This user account is inactive. Please contact administration.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        company_access: user.company_access,
        project_access_id: user.project_access_id
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );
    const profile = { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      company_access: user.company_access,
      project_access_id: user.project_access_id
    };

    // Load permissions for this role
    profile.permissions = await getRolePermissions(user.role);

    res.json({ user: profile, access_token: token });
  } catch (error) {
    res.status(500).json({ error: formatDbError(error) });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const userRes = await db.query('SELECT id, email, role, company_access, project_access_id, mobile, status FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userRes.rows[0];
    if (user.status === 'inactive') {
      return res.status(401).json({ error: 'User account is inactive' });
    }

    // Load permissions for this role
    user.permissions = await getRolePermissions(user.role);

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: formatDbError(error) });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

app.post('/api/auth/sync-modules', authenticateToken, async (req, res) => {
  const clientModules = req.body;
  if (!Array.isArray(clientModules)) {
    return res.status(400).json({ error: 'Body must be an array of modules' });
  }

  try {
    await db.query('BEGIN');
    
    // Fetch all existing roles to auto-populate default permissions
    const rolesRes = await db.query('SELECT id FROM roles');
    const roles = rolesRes.rows.map(r => r.id);

    for (const m of clientModules) {
      // Upsert into modules table
      await db.query(`
        INSERT INTO modules (id, parent_module_id, module_name, route, display_order, is_active)
        VALUES ($1, $2, $3, $4, $5, TRUE)
        ON CONFLICT (id) DO UPDATE SET
          parent_module_id = EXCLUDED.parent_module_id,
          module_name = EXCLUDED.module_name,
          route = EXCLUDED.route,
          display_order = EXCLUDED.display_order
      `, [m.id, m.parent_module_id, m.module_name, m.route, m.display_order || 0]);

      // Seed default permissions for this module for all roles if not already present
      for (const roleId of roles) {
        // Admins get true by default, others get false
        const defaultAccess = (roleId === 'admin');
        await db.query(`
          INSERT INTO role_permissions (role_id, module_id, can_view, can_add, can_edit, can_delete, can_approve, can_export, can_print, can_admin)
          VALUES ($1, $2, $3, $3, $3, $3, $3, $3, $3, $3)
          ON CONFLICT (role_id, module_id) DO NOTHING
        `, [roleId, m.id, defaultAccess]);
      }
    }

    // Deactivate/delete modules that are not present in the frontend navigation list
    const clientModuleIds = clientModules.map(m => m.id);
    if (clientModuleIds.length > 0) {
      const placeholders = clientModuleIds.map((_, i) => `$${i + 1}`).join(', ');
      await db.query(`
        DELETE FROM modules 
        WHERE id NOT IN (${placeholders})
      `, clientModuleIds);
    }

    await db.query('COMMIT');
    res.json({ success: true, message: 'Modules and permissions synchronized successfully.' });
  } catch (error) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/role-permissions/batch', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only administrators can update permissions.' });
  }
  const permissions = req.body;
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Body must be an array of permissions' });
  }

  try {
    await db.query('BEGIN');
    for (const p of permissions) {
      await db.query(`
        INSERT INTO role_permissions (role_id, module_id, can_view, can_add, can_edit, can_delete, can_approve, can_export, can_print, can_admin)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (role_id, module_id) DO UPDATE SET
          can_view = EXCLUDED.can_view,
          can_add = EXCLUDED.can_add,
          can_edit = EXCLUDED.can_edit,
          can_delete = EXCLUDED.can_delete,
          can_approve = EXCLUDED.can_approve,
          can_export = EXCLUDED.can_export,
          can_print = EXCLUDED.can_print,
          can_admin = EXCLUDED.can_admin
      `, [
        p.role_id, p.module_id, 
        p.can_view || false, p.can_add || false, p.can_edit || false, p.can_delete || false,
        p.can_approve || false, p.can_export || false, p.can_print || false, p.can_admin || false
      ]);
    }
    await db.query('COMMIT');
    res.json({ success: true, message: 'Permissions updated successfully.' });
  } catch (error) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});

// Helper for notifications creation
const createNotification = async (projectId, title, message, type, targetUserId, link) => {
  const id = `not_${Math.random().toString(36).substring(2, 11)}`;
  try {
    await db.query(`
      INSERT INTO notifications (id, project_id, title, message, type, is_read, target_user_id, link)
      VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7)
    `, [id, projectId, title, message, type, targetUserId, link]);
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
};

app.post('/api/dprs/submit', authenticateToken, async (req, res) => {
  const { project_id, sub_project_id, date } = req.body;
  if (!project_id || !sub_project_id || !date) {
    return res.status(400).json({ error: 'project_id, sub_project_id, and date are required.' });
  }

  try {
    await db.query('BEGIN');

    // Fetch project name
    const prjRes = await db.query('SELECT name FROM projects WHERE id = $1', [project_id]);
    const projectName = prjRes.rows[0]?.name || 'Project';

    // Find if record exists
    const dprCheck = await db.query(
      'SELECT * FROM dprs WHERE project_id = $1 AND sub_project_id = $2 AND date = $3',
      [project_id, sub_project_id, date]
    );

    const dprId = dprCheck.rows[0]?.id || `dpr_${Math.random().toString(36).substring(2, 11)}`;

    if (dprCheck.rows.length === 0) {
      await db.query(`
        INSERT INTO dprs (id, project_id, sub_project_id, date, status, created_by, created_date, submitted_by, submitted_date, last_updated_by, last_updated_date)
        VALUES ($1, $2, $3, $4, 'pending', $5, CURRENT_TIMESTAMP, $5, CURRENT_TIMESTAMP, $5, CURRENT_TIMESTAMP)
      `, [dprId, project_id, sub_project_id, date, req.user.email]);
    } else {
      const currentStatus = dprCheck.rows[0].status;
      if (currentStatus === 'approved') {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: 'This DPR is already approved and locked.' });
      }
      await db.query(`
        UPDATE dprs SET
          status = 'pending',
          submitted_by = $1,
          submitted_date = CURRENT_TIMESTAMP,
          last_updated_by = $1,
          last_updated_date = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [req.user.email, dprId]);
    }

    await db.query('COMMIT');

    // Send notifications to Project Managers of this project
    const pmUsers = await db.query(`
      SELECT id FROM users 
      WHERE role = 'project_manager' 
        AND (project_access_id IS NULL OR project_access_id = '' OR project_access_id LIKE $1)
    `, [`%${project_id}%`]);

    for (const pm of pmUsers.rows) {
      await createNotification(
        project_id,
        'DPR Waiting for Approval',
        `A new DPR is waiting for your approval on ${projectName} (${date}).`,
        'info',
        pm.id,
        `/progress?tab=dpr&date=${date}&project_id=${project_id}&sub_project_id=${sub_project_id}`
      );
    }

    res.json({ success: true, message: 'DPR submitted for approval successfully.' });
  } catch (error) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/dprs/approve', authenticateToken, async (req, res) => {
  if (req.user.role !== 'project_manager' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only Project Managers or Admins can approve DPRs.' });
  }

  const { project_id, sub_project_id, date } = req.body;
  if (!project_id || !sub_project_id || !date) {
    return res.status(400).json({ error: 'project_id, sub_project_id, and date are required.' });
  }

  try {
    await db.query('BEGIN');

    const dprCheck = await db.query(
      'SELECT * FROM dprs WHERE project_id = $1 AND sub_project_id = $2 AND date = $3',
      [project_id, sub_project_id, date]
    );

    if (dprCheck.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'DPR record not found.' });
    }

    const dpr = dprCheck.rows[0];

    await db.query(`
      UPDATE dprs SET
        status = 'approved',
        approved_by = $1,
        approved_date = CURRENT_TIMESTAMP,
        last_updated_by = $1,
        last_updated_date = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [req.user.email, dpr.id]);

    await db.query('COMMIT');

    // Notify the submitter
    const submitterEmail = dpr.submitted_by || dpr.created_by;
    if (submitterEmail) {
      const subUser = await db.query('SELECT id FROM users WHERE email = $1', [submitterEmail]);
      if (subUser.rows.length > 0) {
        await createNotification(
          project_id,
          'DPR Approved',
          `Your DPR for ${date} has been approved.`,
          'info',
          subUser.rows[0].id,
          `/progress?tab=dpr&date=${date}&project_id=${project_id}&sub_project_id=${sub_project_id}`
        );
      }
    }

    res.json({ success: true, message: 'DPR approved successfully.' });
  } catch (error) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/dprs/reopen', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only Administrators can reopen DPRs.' });
  }

  const { project_id, sub_project_id, date, reason } = req.body;
  if (!project_id || !sub_project_id || !date) {
    return res.status(400).json({ error: 'project_id, sub_project_id, and date are required.' });
  }

  try {
    await db.query('BEGIN');

    const dprCheck = await db.query(
      'SELECT * FROM dprs WHERE project_id = $1 AND sub_project_id = $2 AND date = $3',
      [project_id, sub_project_id, date]
    );

    if (dprCheck.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'DPR record not found.' });
    }

    const dpr = dprCheck.rows[0];

    await db.query(`
      UPDATE dprs SET
        status = 'draft',
        reopened_by = $1,
        reopened_date = CURRENT_TIMESTAMP,
        reopen_reason = $2,
        last_updated_by = $1,
        last_updated_date = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [req.user.email, reason || '', dpr.id]);

    await db.query('COMMIT');

    // Notify the submitter
    const submitterEmail = dpr.submitted_by || dpr.created_by;
    if (submitterEmail) {
      const subUser = await db.query('SELECT id FROM users WHERE email = $1', [submitterEmail]);
      if (subUser.rows.length > 0) {
        await createNotification(
          project_id,
          'DPR Reopened',
          `Your DPR for ${date} has been reopened and is available for editing. Reason: ${reason || 'Not specified'}`,
          'info',
          subUser.rows[0].id,
          `/progress?tab=dpr&date=${date}&project_id=${project_id}&sub_project_id=${sub_project_id}`
        );
      }
    }

    res.json({ success: true, message: 'DPR reopened successfully.' });
  } catch (error) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});

// --- WBS Approval Workflow transactional API ---

const getAssignedReviewer = (code, title) => {
  const normTitle = String(title || '').toLowerCase();
  const rootId = String(code).split('.')[0];

  if (
    rootId === '1' || rootId === '2' || rootId === '3' || rootId === '4' ||
    normTitle.includes('earth') || normTitle.includes('rcc') ||
    normTitle.includes('masonry') || normTitle.includes('plaster') ||
    normTitle.includes('waterproofing')
  ) {
    return 'civil.head@planedge.co';
  }
  if (
    rootId === '5' || rootId === '6' || rootId === '7' || rootId === '8' || rootId === '9' ||
    normTitle.includes('wood') || normTitle.includes('door') ||
    normTitle.includes('window') || normTitle.includes('sliding') ||
    normTitle.includes('floor') || normTitle.includes('tile') ||
    normTitle.includes('tiling') || normTitle.includes('paint') ||
    normTitle.includes('polish') || normTitle.includes('grill') ||
    normTitle.includes('railing') || normTitle.includes('facade') ||
    normTitle.includes('glazing')
  ) {
    return 'finishing.head@planedge.co';
  }
  if (rootId === '10' || normTitle.includes('plumb') || normTitle.includes('drain')) {
    return 'mep.head@planedge.co';
  }
  if (rootId === '11' || normTitle.includes('elect')) {
    return 'electrical.head@planedge.co';
  }
  if (rootId === '12' || rootId === '13' || normTitle.includes('lift') || normTitle.includes('fire')) {
    return 'mep.head@planedge.co';
  }
  return 'planning.head@planedge.co';
};

app.post('/api/wbs/upload', authenticateToken, async (req, res) => {
  const { project_id, sub_project_id, upload_type, rows } = req.body;
  if (!project_id || !sub_project_id || !Array.isArray(rows)) {
    return res.status(400).json({ error: 'project_id, sub_project_id, and rows array are required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch existing WBS items for this project/sub-project
    const existingRes = await client.query(
      'SELECT * FROM wbs_items WHERE project_id = $1 AND sub_project_id = $2',
      [project_id, sub_project_id]
    );
    const existingItems = existingRes.rows;
    const existingByCode = new Map(existingItems.map(item => [item.code, item]));

    // Determine locked L1 parent categories
    const lockedL1Codes = new Set();
    existingItems.forEach(item => {
      if (item.level === 1 && (item.status === 'pending_approval' || item.status === 'approved')) {
        lockedL1Codes.add(item.code);
      }
    });
    existingItems.forEach(item => {
      if (item.level > 1) {
        const rootCode = item.code.split('.')[0];
        const rootItem = existingItems.find(i => i.level === 1 && i.code === rootCode);
        if (rootItem && (rootItem.status === 'pending_approval' || rootItem.status === 'approved')) {
          lockedL1Codes.add(rootCode);
        }
      }
    });

    // 2. Diffing
    const incomingByCode = new Map(rows.map(r => [r.code, r]));

    // Determine deletes (exist in DB, but not in new rows, and not locked)
    const toDeleteIds = existingItems
      .filter(item => {
        const rootCode = item.code.split('.')[0];
        return !incomingByCode.has(item.code) && !lockedL1Codes.has(rootCode);
      })
      .map(item => item.id);

    if (toDeleteIds.length > 0) {
      await client.query('DELETE FROM wbs_items WHERE id = ANY($1)', [toDeleteIds]);
    }

    // Determine inserts and updates
    let createdCount = 0;
    let updatedCount = 0;
    const codeToId = new Map(existingItems.map(item => [item.code, item.id]));

    // Sort rows so parents (levels 1 & 2) are processed before child rows (level 3)
    const sortedRows = [...rows].sort((a, b) => {
      const aLen = a.code.split('.').length;
      const bLen = b.code.split('.').length;
      return aLen - bLen;
    });

    for (const row of sortedRows) {
      const rootCode = row.code.split('.')[0];
      // Skip if this category belongs to a locked category
      if (lockedL1Codes.has(rootCode)) {
        continue;
      }

      const parentCode = row.code.split('.').slice(0, -1).join('.');
      const parentId = parentCode ? codeToId.get(parentCode) || null : null;
      const existing = existingByCode.get(row.code);
      const isL1 = row.code.split('.').filter(Boolean).length === 1;

      const payload = {
        project_id,
        sub_project_id,
        code: row.code,
        activity_id: row.activity_id || '',
        activity_code: row.activity_code || null,
        title: row.title,
        description: row.description || '',
        level: row.code.split('.').filter(Boolean).length,
        parent_id: parentId,
        planned_quantity: parseFloat(row.planned_quantity) || 0,
        actual_quantity: parseFloat(row.actual_quantity) || 0,
        unit: row.unit || '',
        lumsum_rate: parseFloat(row.lumsum_rate) || 0,
        total_days: parseInt(row.total_days) || 0,
        level_label: row.level_label || '',
        source_upload_type: row.source_upload_type || upload_type,
        progress: existing ? parseFloat(existing.progress) || 0 : 0,
        budget_amount: parseFloat(row.budget_amount) || 0,
        order_index: row.order_index || 0,
        status: existing ? existing.status || 'draft' : 'draft',
        assigned_reviewer: isL1 ? getAssignedReviewer(row.code, row.title) : null
      };

      let itemId;
      if (existing) {
        itemId = existing.id;
        const hasChanges = 
          existing.title !== payload.title ||
          existing.description !== payload.description ||
          parseFloat(existing.planned_quantity) !== payload.planned_quantity ||
          existing.unit !== payload.unit ||
          parseFloat(existing.lumsum_rate) !== payload.lumsum_rate ||
          parseInt(existing.total_days) !== payload.total_days ||
          parseFloat(existing.budget_amount) !== payload.budget_amount ||
          existing.level_label !== payload.level_label ||
          existing.parent_id !== payload.parent_id ||
          existing.assigned_reviewer !== payload.assigned_reviewer;

        if (hasChanges) {
          await client.query(`
            UPDATE wbs_items SET
              activity_id = $1, activity_code = $2, title = $3, description = $4,
              level = $5, parent_id = $6, planned_quantity = $7, actual_quantity = $8,
              unit = $9, lumsum_rate = $10, total_days = $11, level_label = $12,
              source_upload_type = $13, budget_amount = $14, order_index = $15,
              assigned_reviewer = $16, updated_date = CURRENT_TIMESTAMP
            WHERE id = $17
          `, [
            payload.activity_id, payload.activity_code, payload.title, payload.description,
            payload.level, payload.parent_id, payload.planned_quantity, payload.actual_quantity,
            payload.unit, payload.lumsum_rate, payload.total_days, payload.level_label,
            payload.source_upload_type, payload.budget_amount, payload.order_index,
            payload.assigned_reviewer, itemId
          ]);
          updatedCount += 1;
        }
      } else {
        itemId = `wbs_${Math.random().toString(36).substring(2, 11)}`;
        await client.query(`
          INSERT INTO wbs_items (
            id, project_id, sub_project_id, code, activity_id, activity_code, title,
            description, level, parent_id, planned_quantity, actual_quantity,
            unit, lumsum_rate, total_days, level_label, source_upload_type,
            progress, budget_amount, order_index, status, assigned_reviewer
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        `, [
          itemId, payload.project_id, payload.sub_project_id, payload.code,
          payload.activity_id, payload.activity_code, payload.title, payload.description,
          payload.level, payload.parent_id, payload.planned_quantity, payload.actual_quantity,
          payload.unit, payload.lumsum_rate, payload.total_days, payload.level_label,
          payload.source_upload_type, payload.progress, payload.budget_amount, payload.order_index,
          payload.status, payload.assigned_reviewer
        ]);
        createdCount += 1;
      }
      codeToId.set(row.code, itemId);
    }

    // 3. Manage WBS Header state & versioning
    const headerRes = await client.query(
      'SELECT * FROM wbs_headers WHERE project_id = $1 AND sub_project_id = $2',
      [project_id, sub_project_id]
    );

    let versionNo = 1;
    let headerId = `wbh_${Math.random().toString(36).substring(2, 11)}`;
    let remark = 'Initial Upload';

    if (headerRes.rows.length > 0) {
      const existingHeader = headerRes.rows[0];
      headerId = existingHeader.id;
      versionNo = existingHeader.version_no;
      
      if (existingHeader.status === 'changes_requested') {
        versionNo += 1;
        remark = `Uploaded Version ${versionNo}`;
      } else {
        remark = `Updated Version ${versionNo}`;
      }

      await client.query(`
        UPDATE wbs_headers SET
          status = 'draft',
          version_no = $1,
          last_uploaded_by = $2,
          last_uploaded_date = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [versionNo, req.user.email, headerId]);
    } else {
      await client.query(`
        INSERT INTO wbs_headers (
          id, project_id, sub_project_id, status, version_no,
          last_uploaded_by, last_uploaded_date
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      `, [headerId, project_id, sub_project_id, 'draft', versionNo, req.user.email]);
    }

    // 4. Record to Approval History
    await client.query(`
      INSERT INTO wbs_approval_history (
        id, project_id, sub_project_id, user_email, action, remarks, version_no
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      `wah_${Math.random().toString(36).substring(2, 11)}`,
      project_id, sub_project_id, req.user.email,
      `Uploaded Version ${versionNo}`, remark, versionNo
    ]);

    await client.query('COMMIT');
    res.json({
      success: true,
      created: createdCount,
      updated: updatedCount,
      deleted: toDeleteIds.length,
      version: versionNo
    });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get('/api/wbs/header', authenticateToken, async (req, res) => {
  const { project_id, sub_project_id } = req.query;
  if (!project_id || !sub_project_id) {
    return res.status(400).json({ error: 'project_id and sub_project_id are required.' });
  }
  try {
    let headerRes = await db.query(
      'SELECT * FROM wbs_headers WHERE project_id = $1 AND sub_project_id = $2',
      [project_id, sub_project_id]
    );

    if (headerRes.rows.length === 0) {
      const id = `wbh_${Math.random().toString(36).substring(2, 11)}`;
      await db.query(`
        INSERT INTO wbs_headers (id, project_id, sub_project_id, status, version_no)
        VALUES ($1, $2, $3, 'draft', 1)
      `, [id, project_id, sub_project_id]);

      headerRes = await db.query('SELECT * FROM wbs_headers WHERE id = $1', [id]);
    }

    const header = headerRes.rows[0];

    // Fetch individual L1 categories status
    const l1Res = await db.query(
      'SELECT id, code, title, status, assigned_reviewer, return_reason, returned_by FROM wbs_items WHERE project_id = $1 AND sub_project_id = $2 AND level = 1',
      [project_id, sub_project_id]
    );
    const l1Items = l1Res.rows;

    let computedStatus = 'draft';
    if (l1Items.length > 0) {
      const allApproved = l1Items.every(item => item.status === 'approved');
      const allDraft = l1Items.every(item => item.status === 'draft');
      if (allApproved) {
        computedStatus = 'approved';
      } else if (allDraft) {
        computedStatus = 'draft';
      } else {
        computedStatus = 'partially_approved';
      }
    }

    if (header.status !== computedStatus) {
      await db.query(
        'UPDATE wbs_headers SET status = $1 WHERE id = $2',
        [computedStatus, header.id]
      );
      header.status = computedStatus;
    }

    res.json({
      ...header,
      l1_items: l1Items
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/wbs/submit-approval', authenticateToken, async (req, res) => {
  const { project_id, sub_project_id, codes, reviewers } = req.body;
  if (!project_id || !sub_project_id || !Array.isArray(codes) || codes.length === 0 || !Array.isArray(reviewers) || reviewers.length === 0) {
    return res.status(400).json({ error: 'project_id, sub_project_id, codes, and reviewers list are required.' });
  }

  try {
    await db.query('BEGIN');

    const headerRes = await db.query(
      'SELECT * FROM wbs_headers WHERE project_id = $1 AND sub_project_id = $2',
      [project_id, sub_project_id]
    );

    if (headerRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'No WBS uploaded yet.' });
    }

    const header = headerRes.rows[0];

    // Fetch the target L1 items
    const l1Res = await db.query(
      'SELECT id, code, title, status, assigned_reviewer FROM wbs_items WHERE project_id = $1 AND sub_project_id = $2 AND level = 1 AND code = ANY($3)',
      [project_id, sub_project_id, codes]
    );
    const targetL1Items = l1Res.rows;

    if (targetL1Items.length === 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'None of the selected WBS Heads exist.' });
    }

    // Filter to only those L1 items that are in draft or changes_requested
    const itemsToSubmit = targetL1Items.filter(item => item.status === 'draft' || item.status === 'changes_requested');
    
    if (itemsToSubmit.length === 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'Selected WBS Heads are already submitted or approved.' });
    }

    const submittedReviewers = new Set();
    for (const item of itemsToSubmit) {
      const defaultReviewer = getAssignedReviewer(item.code, item.title);
      // Route to default reviewer if selected in popup, otherwise default to first selected reviewer
      const reviewerEmail = reviewers.includes(defaultReviewer) ? defaultReviewer : reviewers[0];
      submittedReviewers.add(reviewerEmail);

      await db.query(
        "UPDATE wbs_items SET status = 'pending_approval', assigned_reviewer = $1, return_reason = NULL, returned_by = NULL WHERE id = $2",
        [reviewerEmail, item.id]
      );
    }

    // Dynamic Overall status computation
    const allL1Res = await db.query(
      'SELECT status FROM wbs_items WHERE project_id = $1 AND sub_project_id = $2 AND level = 1',
      [project_id, sub_project_id]
    );
    const allL1Items = allL1Res.rows;

    let computedStatus = 'partially_approved';
    const allApproved = allL1Items.every(item => item.status === 'approved');
    const allDraft = allL1Items.every(item => item.status === 'draft');
    if (allApproved) {
      computedStatus = 'approved';
    } else if (allDraft) {
      computedStatus = 'draft';
    }

    const reviewersList = Array.from(submittedReviewers);

    await db.query(`
      UPDATE wbs_headers SET
        status = $1,
        submitted_by = $2,
        submitted_date = CURRENT_TIMESTAMP,
        reviewers = $3,
        approved_reviewers = '[]'::jsonb
      WHERE id = $4
    `, [computedStatus, req.user.email, JSON.stringify(reviewersList), header.id]);

    const itemsTitles = itemsToSubmit.map(i => i.title).join(', ');

    await db.query(`
      INSERT INTO wbs_approval_history (
        id, project_id, sub_project_id, user_email, action, remarks, version_no
      ) VALUES ($1, $2, $3, $4, 'Submitted for Approval', $5, $6)
    `, [
      `wah_${Math.random().toString(36).substring(2, 11)}`,
      project_id, sub_project_id, req.user.email,
      `Submitted categories: ${itemsTitles}. Pending review from: ${reviewersList.join(', ')}`,
      header.version_no
    ]);

    await db.query('COMMIT');

    // Notify assigned reviewers
    const usersRes = await db.query(
      'SELECT id, email FROM users WHERE email = ANY($1)',
      [reviewersList]
    );

    for (const u of usersRes.rows) {
      const itemsForReviewer = itemsToSubmit
        .filter(i => (i.assigned_reviewer || '').toLowerCase() === u.email.toLowerCase())
        .map(i => i.title)
        .join(', ');

      await createNotification(
        project_id,
        'WBS Head Awaiting Review',
        `The following WBS categories are awaiting your review: ${itemsForReviewer}. Submitted by: ${req.user.email}.`,
        'info',
        u.id,
        `/scheduler?project_id=${project_id}&sub_project_id=${sub_project_id}`
      );
    }

    res.json({ success: true, message: 'WBS Heads submitted for approval successfully.' });
  } catch (error) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/wbs/review', authenticateToken, async (req, res) => {
  const { project_id, sub_project_id, status, comment } = req.body;
  const codes = req.body.codes || (req.body.code ? [req.body.code] : null);

  if (!project_id || !sub_project_id || !status || !Array.isArray(codes) || codes.length === 0) {
    return res.status(400).json({ error: 'project_id, sub_project_id, codes, and status are required.' });
  }

  if (status === 'changes_requested' && (!comment || !comment.trim())) {
    return res.status(400).json({ error: 'Reason for return is mandatory.' });
  }

  try {
    await db.query('BEGIN');

    const headerRes = await db.query(
      'SELECT * FROM wbs_headers WHERE project_id = $1 AND sub_project_id = $2',
      [project_id, sub_project_id]
    );

    if (headerRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'WBS Header record not found.' });
    }

    const header = headerRes.rows[0];

    // Fetch the target L1 categories
    const l1Res = await db.query(
      'SELECT * FROM wbs_items WHERE project_id = $1 AND sub_project_id = $2 AND code = ANY($3) AND level = 1',
      [project_id, sub_project_id, codes]
    );
    const targetL1Items = l1Res.rows;

    if (targetL1Items.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: `None of the WBS categories were found.` });
    }

    const userEmail = req.user.email;

    // Check if user is the assigned reviewer or admin for all requested categories
    for (const item of targetL1Items) {
      if ((item.assigned_reviewer || '').toLowerCase() !== userEmail.toLowerCase() && req.user.role !== 'admin') {
        await db.query('ROLLBACK');
        return res.status(403).json({ error: `You are not assigned as the reviewer for category: ${item.title}` });
      }
    }

    const plannerRes = await db.query("SELECT id FROM users WHERE role = 'planning_team' OR email = $1", [header.submitted_by]);
    const plannerIds = plannerRes.rows.map(r => r.id);

    if (status === 'changes_requested') {
      for (const item of targetL1Items) {
        await db.query(`
          UPDATE wbs_items SET
            status = 'changes_requested',
            approval_status = 'changes_requested',
            returned_by = $1,
            returned_date = CURRENT_TIMESTAMP,
            return_reason = $2,
            approved_by = NULL,
            approved_date = NULL,
            remarks = NULL
          WHERE id = $3
        `, [userEmail, comment, item.id]);

        await db.query(`
          INSERT INTO wbs_approval_history (
            id, project_id, sub_project_id, user_email, action, remarks, version_no
          ) VALUES ($1, $2, $3, $4, 'Changes Requested', $5, $6)
        `, [
          `wah_${Math.random().toString(36).substring(2, 11)}`,
          project_id, sub_project_id, userEmail,
          `Category: ${item.title}. Return Reason: ${comment}`,
          header.version_no
        ]);

        for (const pid of plannerIds) {
          await createNotification(
            project_id,
            'WBS Category Returned',
            `Category "${item.title}" returned for changes by ${userEmail}. Reason: ${comment}`,
            'warning',
            pid,
            `/scheduler?project_id=${project_id}&sub_project_id=${sub_project_id}`
          );
        }
      }
    } else if (status === 'approved') {
      for (const item of targetL1Items) {
        await db.query(`
          UPDATE wbs_items SET
            status = 'approved',
            approval_status = 'approved',
            approved_by = $1,
            approved_date = CURRENT_TIMESTAMP,
            remarks = $2,
            returned_by = NULL,
            returned_date = NULL,
            return_reason = NULL
          WHERE id = $3
        `, [userEmail, comment || '', item.id]);

        await db.query(`
          INSERT INTO wbs_approval_history (
            id, project_id, sub_project_id, user_email, action, remarks, version_no
          ) VALUES ($1, $2, $3, $4, 'Approved', $5, $6)
        `, [
          `wah_${Math.random().toString(36).substring(2, 11)}`,
          project_id, sub_project_id, userEmail,
          `Approved category: ${item.title}. Remarks: ${comment || ''}`,
          header.version_no
        ]);

        for (const pid of plannerIds) {
          await createNotification(
            project_id,
            'WBS Category Approved',
            `Category "${item.title}" approved by ${userEmail}.`,
            'success',
            pid,
            `/scheduler?project_id=${project_id}&sub_project_id=${sub_project_id}`
          );
        }
      }
    }

    // Dynamic Overall status computation
    const allL1Res = await db.query(
      'SELECT status FROM wbs_items WHERE project_id = $1 AND sub_project_id = $2 AND level = 1',
      [project_id, sub_project_id]
    );
    const allL1Items = allL1Res.rows;

    let computedStatus = 'partially_approved';
    const allApproved = allL1Items.every(item => item.status === 'approved');
    const allDraft = allL1Items.every(item => item.status === 'draft');
    if (allApproved) {
      computedStatus = 'approved';
    } else if (allDraft) {
      computedStatus = 'draft';
    }

    const updateQuery = computedStatus === 'approved' ? `
      UPDATE wbs_headers SET
        status = 'approved',
        approved_by = $1,
        approved_date = CURRENT_TIMESTAMP
      WHERE id = $2
    ` : `
      UPDATE wbs_headers SET
        status = $1
      WHERE id = $2
    `;

    const updateParams = computedStatus === 'approved' ? [userEmail, header.id] : [computedStatus, header.id];
    await db.query(updateQuery, updateParams);

    await db.query('COMMIT');
    res.json({ success: true, message: 'WBS categories reviewed successfully.' });
  } catch (error) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/wbs/reopen', authenticateToken, async (req, res) => {
  const { project_id, sub_project_id } = req.body;
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only administrators can reopen approved WBS.' });
  }

  try {
    await db.query('BEGIN');

    const headerRes = await db.query(
      'SELECT * FROM wbs_headers WHERE project_id = $1 AND sub_project_id = $2',
      [project_id, sub_project_id]
    );

    if (headerRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'WBS record not found.' });
    }

    const header = headerRes.rows[0];

    await db.query(`
      UPDATE wbs_headers SET
        status = 'draft'
      WHERE id = $1
    `, [header.id]);

    await db.query(`
      UPDATE wbs_items SET
        status = 'draft',
        return_reason = NULL,
        returned_by = NULL
      WHERE project_id = $1 AND sub_project_id = $2 AND level = 1
    `, [project_id, sub_project_id]);

    await db.query(`
      INSERT INTO wbs_approval_history (
        id, project_id, sub_project_id, user_email, action, remarks, version_no
      ) VALUES ($1, $2, $3, $4, 'Reopened to Draft', $5, $6)
    `, [
      `wah_${Math.random().toString(36).substring(2, 11)}`,
      project_id, sub_project_id, req.user.email,
      'Approval cancelled by admin, reopened for edits',
      header.version_no
    ]);

    await db.query('COMMIT');
    res.json({ success: true, message: 'WBS reopened to draft successfully.' });
  } catch (error) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/wbs/approval-history', authenticateToken, async (req, res) => {
  const { project_id, sub_project_id } = req.query;
  if (!project_id || !sub_project_id) {
    return res.status(400).json({ error: 'project_id and sub_project_id are required.' });
  }
  try {
    const historyRes = await db.query(
      'SELECT * FROM wbs_approval_history WHERE project_id = $1 AND sub_project_id = $2 ORDER BY date DESC',
      [project_id, sub_project_id]
    );
    res.json(historyRes.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dprs/stats', authenticateToken, async (req, res) => {
  try {
    const role = req.user.role;
    const projectAccess = req.user.project_access_id;
    let assignedProjects = [];
    if (projectAccess) {
      assignedProjects = projectAccess.split(',').map(p => p.trim()).filter(Boolean);
    }

    const hasProjectFilter = assignedProjects.length > 0 && role !== 'admin';

    // Site Engineer Stats
    if (role === 'site_engineer') {
      let query = 'SELECT status, COUNT(*)::int AS count FROM dprs';
      const params = [];
      if (hasProjectFilter) {
        query += ' WHERE project_id = ANY($1)';
        params.push(assignedProjects);
      }
      query += ' GROUP BY status';
      
      const statsRes = await db.query(query, params);
      const stats = { draft: 0, pending: 0, approved: 0 };
      statsRes.rows.forEach(r => {
        stats[r.status] = r.count;
      });
      return res.json(stats);
    }

    // Project Manager Stats
    if (role === 'project_manager') {
      let pendingQuery = "SELECT COUNT(*)::int FROM dprs WHERE status = 'pending'";
      let approvedTodayQuery = "SELECT COUNT(*)::int FROM dprs WHERE status = 'approved' AND approved_date >= CURRENT_DATE";
      let pendingSinceYesterdayQuery = "SELECT COUNT(*)::int FROM dprs WHERE status = 'pending' AND created_date < CURRENT_DATE";

      const params = [];
      if (hasProjectFilter) {
        pendingQuery += ' AND project_id = ANY($1)';
        approvedTodayQuery += ' AND project_id = ANY($1)';
        pendingSinceYesterdayQuery += ' AND project_id = ANY($1)';
        params.push(assignedProjects);
      }

      const pendingRes = await db.query(pendingQuery, params);
      const approvedTodayRes = await db.query(approvedTodayQuery, params);
      const pendingSinceYesterdayRes = await db.query(pendingSinceYesterdayQuery, params);

      return res.json({
        pendingApproval: pendingRes.rows[0].count,
        approvedToday: approvedTodayRes.rows[0].count,
        pendingSinceYesterday: pendingSinceYesterdayRes.rows[0].count
      });
    }

    // Admin Stats
    const totalRes = await db.query("SELECT status, COUNT(*)::int AS count FROM dprs GROUP BY status");
    const reopenedRes = await db.query("SELECT COUNT(*)::int AS count FROM dprs WHERE reopened_date IS NOT NULL");

    const stats = { draft: 0, pending: 0, approved: 0, reopened: reopenedRes.rows[0].count };
    totalRes.rows.forEach(r => {
      stats[r.status] = r.count;
    });
    return res.json(stats);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Dynamic CRUD API for Entities ---

// 1. List
app.get('/api/entities/:entity', authenticateToken, async (req, res) => {
  const { entity } = req.params;
  const { sortField, limit } = req.query;
  const tableName = tableMap[entity];

  if (!tableName) {
    return res.status(400).json({ error: `Unknown entity: ${entity}` });
  }

  try {
    let queryText = `SELECT * FROM ${tableName}`;
    const queryParams = [];

    // Sorting
    if (sortField) {
      const isDesc = sortField.startsWith('-');
      const field = isDesc ? sortField.substring(1) : sortField;
      // SQL injection safe validation of field names is recommended, but here we interpolate carefully
      queryText += ` ORDER BY "${field}" ${isDesc ? 'DESC' : 'ASC'}`;
    }

    // Limit
    if (limit && parseInt(limit) > 0) {
      queryParams.push(parseInt(limit));
      queryText += ` LIMIT $${queryParams.length}`;
    }

    const result = await db.query(queryText, queryParams);
    const processed = await getCollectionProcessed(entity, result.rows);
    res.json(processed);
  } catch (error) {
    res.status(500).json({ error: formatDbError(error) });
  }
});

// 2. Filter (using POST for rich criteria objects)
app.post('/api/entities/:entity/filter', authenticateToken, async (req, res) => {
  const { entity } = req.params;
  const { sortField, limit } = req.query;
  const criteria = req.body || {};
  const tableName = tableMap[entity];

  if (!tableName) {
    return res.status(400).json({ error: `Unknown entity: ${entity}` });
  }

  try {
    let queryText = `SELECT * FROM ${tableName} WHERE 1=1`;
    const queryParams = [];

    Object.keys(criteria).forEach((key) => {
      if (criteria[key] === null) {
        queryText += ` AND "${key}" IS NULL`;
      } else {
        queryParams.push(criteria[key]);
        queryText += ` AND "${key}" = $${queryParams.length}`;
      }
    });

    if (sortField) {
      const isDesc = sortField.startsWith('-');
      const field = isDesc ? sortField.substring(1) : sortField;
      queryText += ` ORDER BY "${field}" ${isDesc ? 'DESC' : 'ASC'}`;
    }

    if (limit && parseInt(limit) > 0) {
      queryParams.push(parseInt(limit));
      queryText += ` LIMIT $${queryParams.length}`;
    }

    const result = await db.query(queryText, queryParams);
    const processed = await getCollectionProcessed(entity, result.rows);
    res.json(processed);
  } catch (error) {
    res.status(500).json({ error: formatDbError(error) });
  }
});

// 3. Create
app.post('/api/entities/:entity', authenticateToken, async (req, res) => {
  const { entity } = req.params;
  const data = req.body;
  const tableName = tableMap[entity];

  if (!tableName) {
    return res.status(400).json({ error: `Unknown entity: ${entity}` });
  }

  try {
    // Inject standard columns if missing
    if (!data.id) {
      const prefix = entity.toLowerCase().substring(0, 4);
      data.id = `${prefix}_${Math.random().toString(36).substring(2, 11)}`;
    }
    
    if (entity === 'Contractor' && !data.vendor_code) {
      data.vendor_code = await getNextVendorCode(db);
    }
    
    // Inject created_by_id only for tables that have this column
    if (TABLES_WITH_CREATED_BY.has(tableName) && !data.created_by_id) {
      data.created_by_id = req.user.id;
    }

    if (entity === 'User') {
      if (!data.email || !data.email.trim()) {
        return res.status(400).json({ error: 'User ID is required.' });
      }
      if (!data.password || !data.password.trim()) {
        return res.status(400).json({ error: 'Password is required.' });
      }
      const checkUser = await db.query('SELECT * FROM users WHERE email = $1', [data.email.trim()]);
      if (checkUser.rows.length > 0) {
        return res.status(400).json({ error: 'User ID already exists.' });
      }
      const salt = await bcrypt.genSalt(10);
      data.password_hash = await bcrypt.hash(data.password, salt);
      delete data.password;
    }

    // Dynamic insert query builder
    const keys = Object.keys(data);
    const columns = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const values = keys.map(k => formatValue(data[k]));

    const result = await db.query(
      `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) RETURNING *`,
      values
    );

    const newItem = result.rows[0];

    // Cascading logical updates for ProgressEntry
    if (entity === 'ProgressEntry') {
      const budgetItemId = data.budget_item_id;
      if (budgetItemId) {
        const progressRes = await db.query(
          "SELECT SUM(quantity_done) as total_qty FROM progress_entries WHERE budget_item_id = $1 AND (status = 'approved' OR status = 'submitted')",
          [budgetItemId]
        );
        const cumulativeQty = parseFloat(progressRes.rows[0].total_qty) || 0;

        const budgetRes = await db.query('SELECT * FROM budget_items WHERE id = $1', [budgetItemId]);
        const budgetItem = budgetRes.rows[0];

        if (budgetItem && cumulativeQty >= (parseFloat(budgetItem.quantity) || 0)) {
          // Cascade milestone completion
          if (budgetItem.milestone_id) {
            await db.query(
              "UPDATE milestones SET status = 'completed', progress = 100, actual_end = CURRENT_DATE WHERE id = $1",
              [budgetItem.milestone_id]
            );
          } else {
            await db.query(
              "UPDATE milestones SET status = 'completed', progress = 100, actual_end = CURRENT_DATE WHERE project_id = $1 AND (UPPER(title) = UPPER($2) OR UPPER($2) LIKE '%' || UPPER(title) || '%' OR UPPER(title) LIKE '%' || UPPER($2) || '%')",
              [data.project_id, budgetItem.title]
            );
          }

          // Cascade activity completion
          if (budgetItem.wbs_item_id) {
            await db.query(
              "UPDATE schedule_activities SET status = 'completed', progress = 100, actual_end = CURRENT_DATE WHERE project_id = $1 AND (wbs_item_id = $2 OR UPPER(name) = UPPER($3) OR UPPER($3) LIKE '%' || UPPER(name) || '%' OR UPPER(name) LIKE '%' || UPPER($3) || '%')",
              [data.project_id, budgetItem.wbs_item_id, budgetItem.title]
            );
          } else {
            await db.query(
              "UPDATE schedule_activities SET status = 'completed', progress = 100, actual_end = CURRENT_DATE WHERE project_id = $1 AND (UPPER(name) = UPPER($2) OR UPPER($2) LIKE '%' || UPPER(name) || '%' OR UPPER(name) LIKE '%' || UPPER($2) || '%')",
              [data.project_id, budgetItem.title]
            );
          }
        }
      }
    }

    res.json(newItem);
  } catch (error) {
    res.status(500).json({ error: formatDbError(error) });
  }
});

// 4. Update
app.put('/api/entities/:entity/:id', authenticateToken, async (req, res) => {
  const { entity, id } = req.params;
  const data = req.body;
  const tableName = tableMap[entity];

  if (!tableName) {
    return res.status(400).json({ error: `Unknown entity: ${entity}` });
  }

  try {
    if (entity === 'ProgressEntry') {
      const existingRes = await db.query('SELECT status, quantity_done FROM progress_entries WHERE id = $1', [id]);
      if (existingRes.rows.length > 0 && existingRes.rows[0].status === 'approved') {
        const existing = existingRes.rows[0];
        const newQty = parseFloat(data.quantity_done);
        if (newQty < parseFloat(existing.quantity_done)) {
          return res.status(400).json({ error: 'Cost Control Lock: Approved progress quantity/cost cannot be decreased.' });
        }
      }
    }

    if (entity === 'User') {
      if (data.email) {
        const checkUser = await db.query('SELECT * FROM users WHERE email = $1 AND id <> $2', [data.email.trim(), id]);
        if (checkUser.rows.length > 0) {
          return res.status(400).json({ error: 'User ID already exists.' });
        }
      }
      if (data.password && data.password.trim()) {
        const salt = await bcrypt.genSalt(10);
        data.password_hash = await bcrypt.hash(data.password, salt);
      }
      delete data.password;
    }

    // Separate id and strip metadata / auto-managed keys
    const READ_ONLY_UPDATE_KEYS = new Set(['id', 'created_date', 'created_by_id', 'updated_date']);
    const keys = Object.keys(data).filter(
      (k) => !READ_ONLY_UPDATE_KEYS.has(k) && !k.startsWith('_')
    );
    
    if (keys.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Dynamic update query builder
    const hasUpdatedDate = ['users', 'projects'].includes(tableName);
    const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
    const updateClause = hasUpdatedDate ? `${setClauses}, updated_date = CURRENT_TIMESTAMP` : setClauses;
    const values = [id, ...keys.map(k => formatValue(data[k]))];

    const result = await db.query(
      `UPDATE ${tableName} SET ${updateClause} WHERE id = $1 RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `${entity} not found with id: ${id}` });
    }

    const updatedItem = result.rows[0];

    // Cascading updates for progress entry quantity modifications
    if (entity === 'ProgressEntry') {
      const budgetItemId = data.budget_item_id || updatedItem.budget_item_id;
      if (budgetItemId) {
        const progressRes = await db.query(
          "SELECT SUM(quantity_done) as total_qty FROM progress_entries WHERE budget_item_id = $1 AND (status = 'approved' OR status = 'submitted')",
          [budgetItemId]
        );
        const cumulativeQty = parseFloat(progressRes.rows[0].total_qty) || 0;

        const budgetRes = await db.query('SELECT * FROM budget_items WHERE id = $1', [budgetItemId]);
        const budgetItem = budgetRes.rows[0];

        if (budgetItem && cumulativeQty >= (parseFloat(budgetItem.quantity) || 0)) {
          // Cascade milestone completion
          if (budgetItem.milestone_id) {
            await db.query(
              "UPDATE milestones SET status = 'completed', progress = 100, actual_end = CURRENT_DATE WHERE id = $1",
              [budgetItem.milestone_id]
            );
          } else {
            await db.query(
              "UPDATE milestones SET status = 'completed', progress = 100, actual_end = CURRENT_DATE WHERE project_id = $1 AND (UPPER(title) = UPPER($2) OR UPPER($2) LIKE '%' || UPPER(title) || '%' OR UPPER(title) LIKE '%' || UPPER($2) || '%')",
              [updatedItem.project_id, budgetItem.title]
            );
          }

          // Cascade activity completion
          if (budgetItem.wbs_item_id) {
            await db.query(
              "UPDATE schedule_activities SET status = 'completed', progress = 100, actual_end = CURRENT_DATE WHERE project_id = $1 AND (wbs_item_id = $2 OR UPPER(name) = UPPER($3) OR UPPER($3) LIKE '%' || UPPER(name) || '%' OR UPPER(name) LIKE '%' || UPPER($3) || '%')",
              [updatedItem.project_id, budgetItem.wbs_item_id, budgetItem.title]
            );
          } else {
            await db.query(
              "UPDATE schedule_activities SET status = 'completed', progress = 100, actual_end = CURRENT_DATE WHERE project_id = $1 AND (UPPER(name) = UPPER($2) OR UPPER($2) LIKE '%' || UPPER(name) || '%' OR UPPER(name) LIKE '%' || UPPER($2) || '%')",
              [updatedItem.project_id, budgetItem.title]
            );
          }
        }
      }
    }

    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ error: formatDbError(error) });
  }
});

// 5. Delete
app.delete('/api/entities/:entity/:id', authenticateToken, async (req, res) => {
  const { entity, id } = req.params;
  const tableName = tableMap[entity];

  if (!tableName) {
    return res.status(400).json({ error: `Unknown entity: ${entity}` });
  }

  try {
    if (entity === 'ProgressEntry') {
      const existingRes = await db.query('SELECT status FROM progress_entries WHERE id = $1', [id]);
      if (existingRes.rows.length > 0 && existingRes.rows[0].status === 'approved') {
        return res.status(400).json({ error: 'Cost Control Lock: Completed/approved work progress cannot be deleted.' });
      }
    }

    const result = await db.query(`DELETE FROM ${tableName} WHERE id = $1 RETURNING *`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: `${entity} not found with id: ${id}` });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: formatDbError(error) });
  }
});

// 6. Bulk Create
app.post('/api/entities/:entity/bulk', authenticateToken, async (req, res) => {
  const { entity } = req.params;
  const arrayData = req.body;
  const tableName = tableMap[entity];

  if (!tableName) {
    return res.status(400).json({ error: `Unknown entity: ${entity}` });
  }

  if (!Array.isArray(arrayData)) {
    return res.status(400).json({ error: 'Body must be an array of objects' });
  }

  try {
    const createdItems = [];
    for (let item of arrayData) {
      if (!item.id) {
        const prefix = entity.toLowerCase().substring(0, 4);
        item.id = `${prefix}_${Math.random().toString(36).substring(2, 11)}`;
      }
      
      if (entity === 'Contractor' && !item.vendor_code) {
        item.vendor_code = await getNextVendorCode(db);
      }
      
      if (!item.created_by_id && TABLES_WITH_CREATED_BY.has(tableName)) {
        item.created_by_id = req.user.id;
      }

      const keys = Object.keys(item);
      const columns = keys.map(k => `"${k}"`).join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const values = keys.map(k => formatValue(item[k]));

      const result = await db.query(
        `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      createdItems.push(result.rows[0]);
    }
    res.json(createdItems);
  } catch (error) {
    res.status(500).json({ error: formatDbError(error) });
  }
});

// --- Upload API Route ---
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  // Return the statically accessible URL
  const file_url = `/uploads/${req.file.filename}`;
  res.json({
    file_url,
    file_name: req.file.originalname
  });
});

// --- Integrations / Schedule API ---

app.get('/api/integrations/schedule/parameters', authenticateToken, async (req, res) => {
  try {
    const params = await getModelParameters();
    res.json(params);
  } catch (error) {
    res.status(500).json({ error: formatDbError(error) });
  }
});

app.post('/api/integrations/schedule/generate', authenticateToken, async (req, res) => {
  try {
    const result = await generateSchedule(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: formatDbError(error) });
  }
});

app.post('/api/integrations/schedule/finalize', authenticateToken, async (req, res) => {
  try {
    const result = await finalizeSchedule(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: formatDbError(error) });
  }
});

// --- Simulated AI LLM API (Do NOT use live AI) ---
app.post('/api/integrations/llm', authenticateToken, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  try {
    // 1. CPM Schedule Analyzer Response
    if (prompt.includes('Analyze this construction schedule file')) {
      return res.json({
        overall_score: 84,
        summary: 'The schedule aligns with standard industry sequence. Minor warning noted on a resource bottleneck where "Formwork Crew" overlaps on multiple parallel activities without sufficient float.',
        issues: [
          { severity: 'high', title: 'Resource Allocation Clash', description: 'Formwork Crew is assigned to both structure columns and shoring wall activities on overlapping dates.', recommendation: 'Offset the structural columns start date by 4 days, or introduce a second formwork sub-crew.' },
          { severity: 'medium', title: 'Critical Path Buffer Deficit', description: 'MEP Vertical Risers start immediately on structural slab casting completion. Minimum curing buffer not respected.', recommendation: 'Introduce a 5-day wet concrete curing buffer prior to mounting heavy MEP brackets.' },
          { severity: 'low', title: 'Open Predecessor Links', description: 'HVAC Air Ducts activity lacks a direct relationship link to general ceiling closing finishing works.', recommendation: 'Add HVAC ducts completion as a finish-to-start predecessor for partition drywall sealing.' }
        ]
      });
    }

    // 2. Legacy SmartScheduler Tasks Response
    if (prompt.includes('detailed construction schedule for a') && prompt.includes('construction tasks organized by phases')) {
      const projectTypeMatch = prompt.match(/a\s+([^\n]+)\s+project/i);
      const floorsMatch = prompt.match(/with\s+([^\n]+)\s+floors/i);
      
      const projectType = projectTypeMatch ? projectTypeMatch[1].trim() : 'Commercial';
      const floors = floorsMatch ? floorsMatch[1].trim() : '5';

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
      return res.json({ tasks });
    }

    // 3. Fallback: Simulated Site Progress Report
    const projectsRes = await db.query('SELECT * FROM projects');
    const milestonesRes = await db.query('SELECT * FROM milestones');
    const attendanceRes = await db.query('SELECT * FROM attendance_entries');
    const budgetRes = await db.query('SELECT * FROM budget_items');

    const rawBudgetItems = budgetRes.rows;
    const rolledBudgets = await rollUpBudgetItems(rawBudgetItems);
    const totalBudget = rolledBudgets.filter(b => b.level === 1).reduce((s, b) => s + (parseFloat(b.original_budget) || 0), 0);
    const totalSpent = rolledBudgets.filter(b => b.level === 1).reduce((s, b) => s + (parseFloat(b.actual_cost) || 0), 0);
    
    const reportPeriod = prompt.includes('daily') ? 'DAILY' : prompt.includes('weekly') ? 'WEEKLY' : 'MONTHLY';
    
    const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
    const formattedBudget = formatter.format(totalBudget);
    const formattedSpent = formatter.format(totalSpent);

    const reportText = `
# SITE-PULSE CONSTRUCTION PROGRESS REPORT (${reportPeriod})
**Date:** ${new Date().toISOString().split('T')[0]}  
**Classification:** Professional Operational Summary

---

## 1. Executive Summary
The portfolio shows stable progression across the board. Active attendance metrics reflect steady workforce presence, though external factors like localized high wind warnings slightly hampered facade glass mounting. Total cost variance remains within acceptable thresholds, with spent at **${formattedSpent}** against a combined baseline of **${formattedBudget}**.

## 2. Project Status
${projectsRes.rows.map(p => `*   **${p.name}** — Status: **${p.status.toUpperCase()}** | Progress: **${p.progress}%** | Site Location: *${p.location}*`).join('\n')}

## 3. Key Milestones Update
*   **Substructure Completion:** Completed on schedule. Raft slab concrete achieved 100% cured design capacity.
*   **Topping Out (L12 Concrete Frame):** Currently at **85%**. Columns for floor 9 and formwork for level 10 slab are progressing in sequence.
*   **Facade Curtain Wall Glazing:** Currently **Delayed** at 30% due to safety warnings on hoisting equipment during high-wind intervals.

## 4. Labor & Resource Allocation
A total of **${attendanceRes.rows.length} trade records** active this week, logging critical task hours:
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

    res.json({ text: reportText.trim() });
  } catch (error) {
    res.status(500).json({ error: formatDbError(error) });
  }
});

// --- Standard WBS Template API ---

app.get('/api/wbs-template', authenticateToken, async (req, res) => {
  try {
    await seedWbsTemplateIfEmpty();
    const result = await db.query(
      'SELECT wbs_id, title, description, level, parent_wbs_id, order_index, updated_date FROM wbs_template_items ORDER BY level ASC, order_index ASC'
    );
    const items = result.rows.sort((a, b) => compareWbsIds(a.wbs_id, b.wbs_id));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: formatDbError(error) });
  }
});

app.post('/api/wbs-template/items', authenticateToken, requireAdmin, async (req, res) => {
  const { wbs_id, title, description, level, parent_wbs_id, order_index } = req.body;
  if (!wbs_id || !title || !level) {
    return res.status(400).json({ error: 'wbs_id, title, and level are required.' });
  }
  try {
    const result = await db.query(
      `INSERT INTO wbs_template_items (wbs_id, title, description, level, parent_wbs_id, order_index)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [wbs_id, title, description || null, level, parent_wbs_id || null, order_index ?? 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: `WBS ID "${wbs_id}" already exists.` });
    }
    res.status(500).json({ error: formatDbError(error) });
  }
});

app.put('/api/wbs-template/items/:wbsId', authenticateToken, requireAdmin, async (req, res) => {
  const { wbsId } = req.params;
  const { title, description, order_index } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'title is required.' });
  }
  try {
    const result = await db.query(
      `UPDATE wbs_template_items
       SET title = $1, description = $2, order_index = COALESCE($3, order_index), updated_date = CURRENT_TIMESTAMP
       WHERE wbs_id = $4
       RETURNING *`,
      [title, description || null, order_index, wbsId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template item not found.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: formatDbError(error) });
  }
});

app.delete('/api/wbs-template/items/:wbsId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM wbs_template_items WHERE wbs_id = $1 RETURNING wbs_id',
      [req.params.wbsId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template item not found.' });
    }
    res.json({ success: true, wbs_id: result.rows[0].wbs_id });
  } catch (error) {
    res.status(500).json({ error: formatDbError(error) });
  }
});

app.post('/api/wbs-template/apply', authenticateToken, async (req, res) => {
  const { project_id, sub_project_id, mode = 'merge' } = req.body;
  if (!project_id) {
    return res.status(400).json({ error: 'project_id is required.' });
  }
  if (!sub_project_id) {
    return res.status(400).json({ error: 'sub_project_id is required.' });
  }
  try {
    const result = await applyWbsTemplateToProject(project_id, sub_project_id, mode);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: formatDbError(error) });
  }
});

app.post('/api/wbs-template/reset', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await syncDefaultWbsTemplate();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: formatDbError(error) });
  }
});

app.get('/api/analytics/labour-productivity', authenticateToken, async (req, res) => {
  const { project_id, sub_project_id, from_date, to_date, contractor_id, type_of_work } = req.query;

  if (!project_id) {
    return res.status(400).json({ error: 'project_id is required.' });
  }

  try {
    let paramIndex = 1;
    const queryParams = [project_id];

    let qtyFilters = '';
    let labourFilters = '';

    if (sub_project_id) {
      paramIndex++;
      queryParams.push(sub_project_id);
      qtyFilters += ` AND pe.sub_project_id = $${paramIndex}`;
      labourFilters += ` AND cl.sub_project_id = $${paramIndex}`;
    }

    if (from_date) {
      paramIndex++;
      queryParams.push(from_date);
      qtyFilters += ` AND pe.date >= $${paramIndex}`;
      labourFilters += ` AND cl.date >= $${paramIndex}`;
    }

    if (to_date) {
      paramIndex++;
      queryParams.push(to_date);
      qtyFilters += ` AND pe.date <= $${paramIndex}`;
      labourFilters += ` AND cl.date <= $${paramIndex}`;
    }

    let mainFilters = '';
    if (contractor_id) {
      paramIndex++;
      queryParams.push(contractor_id);
      mainFilters += ` AND lab.contractor_id = $${paramIndex}`;
    }

    if (type_of_work) {
      paramIndex++;
      queryParams.push(type_of_work);
      mainFilters += ` AND LOWER(TRIM(lab.type_of_work)) = LOWER(TRIM($${paramIndex}))`;
    }

    const queryText = `
      WITH RECURSIVE wbs_hierarchy AS (
        SELECT id AS level2_id, id AS current_id, title AS level2_title, code AS level2_code
        FROM wbs_items
        WHERE level = 2 AND project_id = $1
        
        UNION ALL
        
        SELECT h.level2_id, w.id, h.level2_title, h.level2_code
        FROM wbs_hierarchy h
        JOIN wbs_items w ON w.parent_id = h.current_id
      ),
      qty_aggregation AS (
        SELECT
          pe.project_id,
          h.level2_title AS sub_activity_name,
          pe.unit,
          COALESCE(SUM(pe.quantity_done), 0) AS total_qty
        FROM progress_entries pe
        JOIN wbs_hierarchy h ON pe.wbs_item_id = h.current_id
        WHERE pe.project_id = $1
          AND pe.status IN ('submitted', 'approved')
          ${qtyFilters}
        GROUP BY pe.project_id, h.level2_title, pe.unit
      ),
      labour_aggregation AS (
        SELECT
          cl.project_id,
          cl.contractor_id,
          c.name AS contractor_name,
          cl.type_of_work,
          COALESCE(SUM(cl.carpenter + cl.barbender + cl.mason + cl.skilled_other + cl.carpenter_helper + cl.barbender_helper + cl.semi_skilled_other + cl.mc + cl.fc), 0) AS total_labour
        FROM contractor_labours cl
        JOIN contractors c ON cl.contractor_id = c.id
        WHERE cl.project_id = $1
          ${labourFilters}
        GROUP BY cl.project_id, cl.contractor_id, c.name, cl.type_of_work
      )
      SELECT
        COALESCE(lab.contractor_id, c.id, '') AS contractor_id,
        COALESCE(lab.contractor_name, c.name, 'Unassigned Contractor') AS contractor_name,
        COALESCE(lab.type_of_work, qty.sub_activity_name) AS type_of_work,
        COALESCE(qty.unit, '—') AS unit,
        ROUND(COALESCE(qty.total_qty, 0), 2) AS executed_qty,
        COALESCE(lab.total_labour, 0) AS total_labour,
        CASE
          WHEN COALESCE(lab.total_labour, 0) > 0 THEN ROUND(COALESCE(qty.total_qty, 0) / lab.total_labour, 2)
          ELSE 0
        END AS productivity
      FROM labour_aggregation lab
      FULL OUTER JOIN qty_aggregation qty ON LOWER(TRIM(qty.sub_activity_name)) = LOWER(TRIM(lab.type_of_work))
      LEFT JOIN contractors c ON LOWER(TRIM(c.type_of_work)) LIKE '%' || LOWER(TRIM(qty.sub_activity_name)) || '%'
      WHERE 1=1
        ${mainFilters}
      ORDER BY contractor_name ASC, type_of_work ASC
    `;

    const result = await db.query(queryText, queryParams);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: formatDbError(error) });
  }
});

// Ensure tables added after initial schema setup
async function ensureExtendedTables() {
  await db.query(`
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
  await db.query(`
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
  await db.query(`
    ALTER TABLE wbs_items
    ADD COLUMN IF NOT EXISTS sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE
  `);
  await db.query(`
    ALTER TABLE wbs_items
    ADD COLUMN IF NOT EXISTS activity_id VARCHAR(50)
  `);
  await db.query(`
    ALTER TABLE wbs_items
    ADD COLUMN IF NOT EXISTS activity_code VARCHAR(255)
  `);
  await db.query(`
    ALTER TABLE wbs_items
    ADD COLUMN IF NOT EXISTS lumsum_rate NUMERIC(15, 2) DEFAULT 0
  `);
  await db.query(`
    ALTER TABLE wbs_items
    ADD COLUMN IF NOT EXISTS total_days NUMERIC(10, 2) DEFAULT 0
  `);
  await db.query(`
    ALTER TABLE wbs_items
    ADD COLUMN IF NOT EXISTS source_upload_type VARCHAR(30)
  `);
  await db.query(`
    ALTER TABLE wbs_items
    ADD COLUMN IF NOT EXISTS level_label VARCHAR(50)
  `);
  await db.query(`
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS project_type VARCHAR(100)
  `);
  await db.query(`
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS project_code VARCHAR(100)
  `);
  await db.query(`
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS elevation_photo_url TEXT
  `);
  await db.query(`
    ALTER TABLE progress_entries
    ADD COLUMN IF NOT EXISTS wbs_item_id VARCHAR(50) REFERENCES wbs_items(id) ON DELETE SET NULL
  `);
  await db.query(`
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
  await db.query(`
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
  await db.query(`
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
  await db.query(`
    ALTER TABLE contractors
    DROP COLUMN IF EXISTS project_id,
    ADD COLUMN IF NOT EXISTS vendor_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS type_of_work VARCHAR(255),
    ADD COLUMN IF NOT EXISTS vendor_category VARCHAR(100)
  `);
  await db.query(`
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
  await db.query(`
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
  await db.query(`
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
  await db.query(`
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
  await db.query(`
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
  await db.query(`
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

  await db.query(`
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

  await db.query(`
    ALTER TABLE contractor_labours
    ADD COLUMN IF NOT EXISTS skilled_other NUMERIC(12, 2) DEFAULT 0
  `);
  await db.query(`
    ALTER TABLE contractor_labours
    ADD COLUMN IF NOT EXISTS semi_skilled_other NUMERIC(12, 2) DEFAULT 0
  `);

  await db.query(`
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

  await db.query(`
    CREATE TABLE IF NOT EXISTS mpr_reports (
      id VARCHAR(50) PRIMARY KEY,
      project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
      month_id VARCHAR(20) NOT NULL,
      month_start DATE NOT NULL,
      month_end DATE NOT NULL,
      status VARCHAR(50) DEFAULT 'draft',
      form_data TEXT,
      submitted_by VARCHAR(255),
      submitted_at TIMESTAMP,
      created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (project_id, month_id)
    )
  `);

  // Migrate existing tables at startup
  const targetTables = [
    'technical_staff_attendance',
    'machinery_details',
    'days_reports',
    'status_reports',
    'special_site_visits',
    'critical_issues',
    'next_days_plans'
  ];

  for (const table of targetTables) {
    await db.query(`
      ALTER TABLE ${table}
      ADD COLUMN IF NOT EXISTS sub_project_id VARCHAR(50) REFERENCES sub_projects(id) ON DELETE CASCADE
    `);
  }

  for (const table of targetTables) {
    await db.query(`
      UPDATE ${table} t
      SET sub_project_id = (SELECT id FROM sub_projects sp WHERE sp.project_id = t.project_id LIMIT 1)
      WHERE t.sub_project_id IS NULL
    `);
  }

  // Update unique constraint on technical_staff_attendance
  await db.query(`
    ALTER TABLE technical_staff_attendance
    DROP CONSTRAINT IF EXISTS technical_staff_attendance_technical_staff_id_date_key
  `);
  await db.query(`
    ALTER TABLE technical_staff_attendance
    DROP CONSTRAINT IF EXISTS technical_staff_attendance_staff_date_sub_project_key
  `);
  await db.query(`
    ALTER TABLE technical_staff_attendance
    ADD CONSTRAINT technical_staff_attendance_staff_date_sub_project_key UNIQUE (technical_staff_id, date, sub_project_id)
  `);

  // Contractor Labours migrations for Contractor + Type of Work mapping
  await db.query(`
    ALTER TABLE contractor_labours
    ADD COLUMN IF NOT EXISTS type_of_work VARCHAR(255)
  `);
  await db.query(`
    ALTER TABLE contractor_labours
    DROP CONSTRAINT IF EXISTS contractor_labours_contractor_id_date_sub_project_id_key
  `);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS contractor_labours_contractor_date_sub_work_key
    ON contractor_labours (contractor_id, date, sub_project_id, type_of_work)
    WHERE sub_project_id IS NOT NULL
  `);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS contractor_labours_contractor_date_null_sub_work_key
    ON contractor_labours (contractor_id, date, type_of_work)
    WHERE sub_project_id IS NULL
  `);

  // Add partial unique index for project-wide WPR (sub_project_id IS NULL)
  // Standard UNIQUE constraint doesn't enforce uniqueness for NULLs in PostgreSQL
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS wpr_reports_project_week_null_sub
    ON wpr_reports (project_id, week_id)
    WHERE sub_project_id IS NULL
  `);

  // Seed dummy contractors if empty
  const contractorsCheck = await db.query("SELECT COUNT(*) FROM contractors");
  if (parseInt(contractorsCheck.rows[0].count) === 0) {
    console.log("Seeding dummy contractors...");
    await db.query(`
      INSERT INTO contractors (id, name, contact_person, phone, email, trade, gst_number, address, remark, vendor_code, type_of_work, vendor_category) VALUES
      ('c1', 'Apex RCC Structures', 'Rajesh Kumar', '9876543210', 'apex@example.com', 'RCC Work', '27AAAAA0000A1Z1', 'Mumbai', 'Primary RCC contractor', 'V-001', 'RCC Concrete Work', 'Class A'),
      ('c2', 'Deluxe Masonry & Plastering', 'Vijay Yadav', '9876543211', 'deluxe@example.com', 'Masonry, Plaster Work', '27BBBBB1111B1Z2', 'Thane', 'Masonry contractor', 'V-002', 'Brickwork and internal plastering', 'Class B'),
      ('c3', 'Star Electricals & Wiring', 'Ramesh Patel', '9876543212', 'star@example.com', 'Electrical Work', '27CCCCC2222C1Z3', 'Navi Mumbai', 'Electrical conduit and wiring contractor', 'V-003', 'Electrical wiring and fixtures', 'Class A'),
      ('c4', 'Sterling & Wilson Plumbing', 'Amit Patel', '9876543213', 'sterling@example.com', 'Plumbing, Drainage Work', '27DDDDD3333D1Z4', 'Pune', 'Plumbing and MEP contractor', 'V-004', 'Sanitary routing and drainage pipes', 'Class A')
    `);
  }

  // Seed dummy technical staff if empty
  const staffCheck = await db.query("SELECT COUNT(*) FROM technical_staff");
  if (parseInt(staffCheck.rows[0].count) === 0) {
    console.log("Seeding dummy technical staff...");
    await db.query(`
      INSERT INTO technical_staff (id, project_id, name, designation, remark) VALUES
      ('s1', 'prj_emerald', 'Suresh Sharma', 'Project Manager', 'Lead project manager'),
      ('s2', 'prj_emerald', 'Rohan Mehta', 'Site Engineer', 'R.C.C. block supervision'),
      ('s3', 'prj_emerald', 'Priya Sharma', 'QC Auditor', 'Quality control and structural checks'),
      ('s4', 'prj_emerald', 'Vijay Yadav', 'Safety Officer', 'Health and safety coordinator')
    `);
  }
}

// Start listening
app.listen(PORT, async () => {
  console.log(`Express server running on http://localhost:${PORT} in development mode`);
  try {
    await ensureExtendedTables();
    await seedWbsTemplateIfEmpty();
  } catch (error) {
    console.error('Startup initialization failed:', error.message);
  }
});
