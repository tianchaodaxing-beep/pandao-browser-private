export type DatabaseConfig = {
  connectionString: string;
};

export function getDatabaseConfig(): DatabaseConfig {
  return {
    connectionString:
      process.env.DATABASE_URL ??
      'postgres://127.0.0.1:5432/pandao_browser'
  };
}
