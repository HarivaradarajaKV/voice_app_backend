import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  const connStr = "postgresql://postgres.fckzorigxuakbjhufhap:Voice%232026app@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres";
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('⚡ Connected to PostgreSQL database for DDL execution...');

    console.log('Resetting schema public...');
    await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;');

    const sql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf-8');
    console.log('Executing init.sql...');
    await client.query(sql);
    console.log('✅ All tables, enums, indexes, and constraints created successfully in PostgreSQL!');
    await client.end();
  } catch (err: any) {
    console.error('Migration error:', err.message);
    process.exit(1);
  }
}

runMigration();
