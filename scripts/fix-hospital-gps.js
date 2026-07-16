require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: false });
  await c.connect();
  await c.query('ALTER TABLE hospitals DROP COLUMN IF EXISTS bed_capacity');
  await c.query('ALTER TABLE hospitals DROP COLUMN IF EXISTS er_bays');
  await c.query(`
    UPDATE hospitals SET
      latitude = CASE
        WHEN name ILIKE '%Mayo%' THEN 31.5704500
        WHEN name ILIKE '%Jinnah%' THEN 31.4847200
        WHEN name ILIKE '%Services%' THEN 31.5389100
        WHEN name ILIKE '%General%' THEN 31.4912500
        WHEN name ILIKE '%Shifa%' THEN 33.6630500
        WHEN name ILIKE '%PIMS%' THEN 33.6951200
        ELSE latitude END,
      longitude = CASE
        WHEN name ILIKE '%Mayo%' THEN 74.3089200
        WHEN name ILIKE '%Jinnah%' THEN 74.3015800
        WHEN name ILIKE '%Services%' THEN 74.3336400
        WHEN name ILIKE '%General%' THEN 74.3168800
        WHEN name ILIKE '%Shifa%' THEN 73.0652100
        WHEN name ILIKE '%PIMS%' THEN 73.0550400
        ELSE longitude END
  `);
  await c.query(`UPDATE hospitals SET latitude = 31.5497000, longitude = 74.3436000 WHERE latitude IS NULL OR longitude IS NULL`);
  const r = await c.query('SELECT name, latitude, longitude FROM hospitals ORDER BY name');
  console.table(r.rows);
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
