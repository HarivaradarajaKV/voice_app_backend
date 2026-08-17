import { Client } from 'pg';

async function testConn() {
  const connStr = "postgresql://postgres.fckzorigxuakbjhufhap:Voice%232026app@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres";
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to Supabase via PG client successfully!');
    const res = await client.query('SELECT current_database(), current_user, version()');
    console.log('DB query result:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('Connection error:', err);
  }
}

testConn();
