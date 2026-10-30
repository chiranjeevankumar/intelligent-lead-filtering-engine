import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
  var _dbInstance: any | undefined;
}

export const getDb = () => {
  if (!global._dbInstance) {
    const pool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
    });

    pool.on('error', (err) => {
      // Prevent idle client termination from crashing server process
      console.warn('PostgreSQL idle client connection closed safely:', err.message);
    });

    global._postgresPool = pool;
    global._dbInstance = drizzle(pool, { schema });
  }
  return global._dbInstance;
};
