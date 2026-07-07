import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Return DATE columns as YYYY-MM-DD strings (avoid timezone shifts via JS Date).
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

const { Pool } = pg;

// Use DATABASE_URL if available, otherwise fallback to individual config
const isProduction = process.env.NODE_ENV === 'production';

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    }
  : {
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432'),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'password',
      database: process.env.PGDATABASE || 'progress_monitoring',
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client', err);
});

export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log('Executed query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Database query execution error:', error);
    throw error;
  }
};

export const getClient = async () => {
  const client = await pool.connect();
  const query = client.query;
  const release = client.release;
  
  // monkey patch the query method to keep track of queries
  client.query = (...args) => {
    return query.apply(client, args);
  };
  client.release = () => {
    client.query = query;
    client.release = release;
    return release.apply(client);
  };
  return client;
};

export default {
  query,
  getClient,
  pool,
};
