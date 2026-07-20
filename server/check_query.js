import db from './db/index.js';

async function check() {
  try {
    const project_id = 'prj_emerald'; // Let's get any active project id or query it
    const projectRes = await db.query('SELECT id FROM projects LIMIT 1');
    if (projectRes.rows.length === 0) {
      console.log('No projects in DB');
      return;
    }
    const pid = projectRes.rows[0].id;
    console.log('Testing with project ID:', pid);

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
      ORDER BY contractor_name ASC, type_of_work ASC
    `;

    const res = await db.query(queryText, [pid]);
    console.log('Query successful, rows:', res.rows.length);
    console.log(res.rows);
  } catch (e) {
    console.error('QUERY ERROR:', e);
  } finally {
    await db.pool.end();
  }
}

check();
