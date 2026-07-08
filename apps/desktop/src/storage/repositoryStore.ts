import Database from "@tauri-apps/plugin-sql";
import type { RepositorySummary } from "@ai-dev/indexing";

const DATABASE_URL = "sqlite:workspace.db";

type RepositoryRow = {
  id: string;
  name: string;
  path: string;
  branch: string;
  status: RepositorySummary["status"];
  open_changes: number;
  last_indexed_at: string | null;
};

let databasePromise: Promise<Database> | null = null;

function getDatabase() {
  databasePromise ??= Database.load(DATABASE_URL);
  return databasePromise;
}

async function ensureRepositoryTable(database: Database) {
  await database.execute(`
    CREATE TABLE IF NOT EXISTS repositories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      branch TEXT NOT NULL,
      status TEXT NOT NULL,
      open_changes INTEGER NOT NULL,
      last_indexed_at TEXT
    )
  `);
}

function rowToRepository(row: RepositoryRow): RepositorySummary {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    branch: row.branch,
    status: row.status,
    openChanges: row.open_changes,
    lastIndexedAt: row.last_indexed_at,
  };
}

export async function loadSavedRepositories(): Promise<RepositorySummary[]> {
  const database = await getDatabase();
  await ensureRepositoryTable(database);

  const rows = await database.select<RepositoryRow[]>(
    "SELECT id, name, path, branch, status, open_changes, last_indexed_at FROM repositories ORDER BY name",
  );

  return rows.map(rowToRepository);
}

export async function saveRepositories(repositories: RepositorySummary[]) {
  const database = await getDatabase();
  await ensureRepositoryTable(database);

  for (const repository of repositories) {
    await database.execute(
      `
        INSERT INTO repositories (
          id,
          name,
          path,
          branch,
          status,
          open_changes,
          last_indexed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT(path) DO UPDATE SET
          name = excluded.name,
          branch = excluded.branch,
          status = excluded.status,
          open_changes = excluded.open_changes,
          last_indexed_at = excluded.last_indexed_at
      `,
      [
        repository.id,
        repository.name,
        repository.path,
        repository.branch,
        repository.status,
        repository.openChanges,
        repository.lastIndexedAt,
      ],
    );
  }
}
