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
  'WprReport': 'wpr_reports'
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
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    const profile = { id: user.id, email: user.email, role: user.role };

    res.json({ user: profile, access_token: token });
  } catch (error) {
    res.status(500).json({ error: formatDbError(error) });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const userRes = await db.query('SELECT id, email, role FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(userRes.rows[0]);
  } catch (error) {
    res.status(500).json({ error: formatDbError(error) });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
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
