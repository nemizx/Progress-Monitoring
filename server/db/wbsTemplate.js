import db from './index.js';
import { DEFAULT_WBS_TEMPLATE } from '../data/defaultWbsTemplate.js';

async function insertDefaultTemplateItems() {
  const l1Items = DEFAULT_WBS_TEMPLATE.filter((i) => i.level === 1);
  for (const item of l1Items) {
    await db.query(
      `INSERT INTO wbs_template_items (wbs_id, title, description, level, parent_wbs_id, order_index)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (wbs_id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         level = EXCLUDED.level,
         parent_wbs_id = EXCLUDED.parent_wbs_id,
         order_index = EXCLUDED.order_index,
         updated_date = CURRENT_TIMESTAMP`,
      [item.wbs_id, item.title, item.description || null, item.level, item.parent_wbs_id, item.order_index]
    );
  }

  const l2Items = DEFAULT_WBS_TEMPLATE.filter((i) => i.level === 2);
  for (const item of l2Items) {
    await db.query(
      `INSERT INTO wbs_template_items (wbs_id, title, description, level, parent_wbs_id, order_index)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (wbs_id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         level = EXCLUDED.level,
         parent_wbs_id = EXCLUDED.parent_wbs_id,
         order_index = EXCLUDED.order_index,
         updated_date = CURRENT_TIMESTAMP`,
      [item.wbs_id, item.title, item.description || null, item.level, item.parent_wbs_id, item.order_index]
    );
  }
}

export async function syncDefaultWbsTemplate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS wbs_template_items (
      wbs_id VARCHAR(20) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      level INTEGER NOT NULL,
      parent_wbs_id VARCHAR(20) REFERENCES wbs_template_items(wbs_id) ON DELETE CASCADE,
      order_index INTEGER DEFAULT 0,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query('DELETE FROM wbs_template_items');
  await insertDefaultTemplateItems();

  return { total: DEFAULT_WBS_TEMPLATE.length };
}

export async function seedWbsTemplateIfEmpty() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS wbs_template_items (
        wbs_id VARCHAR(20) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        level INTEGER NOT NULL,
        parent_wbs_id VARCHAR(20) REFERENCES wbs_template_items(wbs_id) ON DELETE CASCADE,
        order_index INTEGER DEFAULT 0,
        updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM wbs_template_items');
    if (rows[0].count > 0) {
      return;
    }

    console.log('Seeding standard WBS template...');
    await insertDefaultTemplateItems();
    console.log(`Standard WBS template seeded (${DEFAULT_WBS_TEMPLATE.length} items).`);
  } catch (error) {
    console.error('Failed to seed WBS template:', error.message);
  }
}

export function compareWbsIds(a, b) {
  const partsA = String(a).split('.').map(Number);
  const partsB = String(b).split('.').map(Number);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const na = partsA[i] ?? 0;
    const nb = partsB[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

export async function applyWbsTemplateToProject(projectId, subProjectId, mode = 'merge') {
  const templateRes = await db.query(
    'SELECT * FROM wbs_template_items ORDER BY level ASC, order_index ASC, wbs_id ASC'
  );
  const template = templateRes.rows;
  if (template.length === 0) {
    throw new Error('Standard WBS template is empty. Please configure the template first.');
  }

  const projectCheck = await db.query('SELECT id FROM projects WHERE id = $1', [projectId]);
  if (projectCheck.rows.length === 0) {
    throw new Error('Project not found.');
  }

  const subProjectCheck = await db.query(
    'SELECT id FROM sub_projects WHERE id = $1 AND project_id = $2',
    [subProjectId, projectId]
  );
  if (subProjectCheck.rows.length === 0) {
    throw new Error('Sub-project not found for this project.');
  }

  if (mode === 'replace') {
    await db.query(
      'DELETE FROM wbs_items WHERE project_id = $1 AND sub_project_id = $2',
      [projectId, subProjectId]
    );
  }

  const existingRes = await db.query(
    'SELECT id, code FROM wbs_items WHERE project_id = $1 AND sub_project_id = $2',
    [projectId, subProjectId]
  );
  const idByCode = {};
  existingRes.rows.forEach((row) => {
    idByCode[row.code] = row.id;
  });

  let created = 0;
  let skipped = 0;
  const idPrefix = subProjectId.replace(/[^a-z0-9]/gi, '_');

  const l1Items = template.filter((i) => i.level === 1).sort((a, b) => compareWbsIds(a.wbs_id, b.wbs_id));
  for (const item of l1Items) {
    if (idByCode[item.wbs_id]) {
      skipped += 1;
      continue;
    }
    const id = `wbs_${idPrefix}_${item.wbs_id.replace(/\./g, '_')}`;
    await db.query(
      `INSERT INTO wbs_items (id, project_id, sub_project_id, code, title, description, level, parent_id, order_index)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8)`,
      [id, projectId, subProjectId, item.wbs_id, item.title, item.description || '', item.level, item.order_index]
    );
    idByCode[item.wbs_id] = id;
    created += 1;
  }

  const l2Items = template.filter((i) => i.level === 2).sort((a, b) => compareWbsIds(a.wbs_id, b.wbs_id));
  for (const item of l2Items) {
    if (idByCode[item.wbs_id]) {
      skipped += 1;
      continue;
    }
    const parentId = idByCode[item.parent_wbs_id];
    if (!parentId) {
      throw new Error(`Parent WBS ${item.parent_wbs_id} not found for item ${item.wbs_id}.`);
    }
    const id = `wbs_${idPrefix}_${item.wbs_id.replace(/\./g, '_')}`;
    await db.query(
      `INSERT INTO wbs_items (id, project_id, sub_project_id, code, title, description, level, parent_id, order_index)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, projectId, subProjectId, item.wbs_id, item.title, item.description || '', item.level, parentId, item.order_index]
    );
    idByCode[item.wbs_id] = id;
    created += 1;
  }

  return { created, skipped, total: template.length };
}
