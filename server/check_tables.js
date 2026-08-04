import db from './db/index.js';

async function check() {
  try {
    const res = await db.query(`
      SELECT source_upload_type, COUNT(*)::int
      FROM wbs_items
      WHERE project_id = 'prj_emerald'
        AND sub_project_id = 'subp_w649x9bfv'
      GROUP BY source_upload_type
    `);
    console.log('Source Upload Types count for Tower A:');
    console.log(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await db.pool.end();
  }
}
check();
