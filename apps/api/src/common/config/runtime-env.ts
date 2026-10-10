/**
 * Builds DATABASE_URL from discrete parts when it is not supplied directly. On ECS the Aurora
 * secret is injected as separate fields (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD), because
 * Secrets Manager stores a JSON object rather than a connection string. The password is URL-encoded
 * since generated passwords can contain reserved characters.
 */
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv): void {
  if (env['DATABASE_URL'] || !env['DB_HOST']) {
    return;
  }
  const user = encodeURIComponent(env['DB_USER'] ?? 'postgres');
  const password = encodeURIComponent(env['DB_PASSWORD'] ?? '');
  const port = env['DB_PORT'] ?? '5432';
  const name = env['DB_NAME'] ?? 'postgres';
  env['DATABASE_URL'] = `postgresql://${user}:${password}@${env['DB_HOST']}:${port}/${name}?schema=public&sslmode=require&connection_limit=10`;
}
