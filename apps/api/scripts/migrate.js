// One-off migration runner for the `migrate` image target (ECS run-task / docker compose).
// Builds DATABASE_URL from the discrete DB_* fields ECS injects from the Aurora secret, then runs
// `prisma migrate deploy`. Kept dependency-free so it runs straight from the build stage.
const { spawnSync } = require('node:child_process');

const env = { ...process.env };
if (!env.DATABASE_URL && env.DB_HOST) {
  const user = encodeURIComponent(env.DB_USER || 'postgres');
  const password = encodeURIComponent(env.DB_PASSWORD || '');
  env.DATABASE_URL = `postgresql://${user}:${password}@${env.DB_HOST}:${env.DB_PORT || '5432'}/${env.DB_NAME || 'postgres'}?schema=public&sslmode=require`;
}
if (!env.DATABASE_URL) {
  console.error('DATABASE_URL (or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME) is required');
  process.exit(1);
}
const result = spawnSync('npx', ['prisma', 'migrate', 'deploy', '--schema', 'apps/api/prisma/schema.prisma'], {
  stdio: 'inherit',
  env,
});
process.exit(result.status ?? 1);
