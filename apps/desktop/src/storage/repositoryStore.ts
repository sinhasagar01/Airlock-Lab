import Database from "@tauri-apps/plugin-sql";
import type { RepositorySummary } from "@ai-dev/indexing";

const DATABASE_URL = "sqlite:workspace.db";

type RepositoryRow = {
  id: string;
  name: string;
  path: string;
  is_git_repository: number;
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
      is_git_repository INTEGER NOT NULL DEFAULT 0,
      branch TEXT NOT NULL,
      status TEXT NOT NULL,
      open_changes INTEGER NOT NULL,
      last_indexed_at TEXT
    )
  `);

  try {
    await database.execute(
      "ALTER TABLE repositories ADD COLUMN is_git_repository INTEGER NOT NULL DEFAULT 0",
    );
  } catch {
    // Existing databases already have this column.
  }
}

function rowToRepository(row: RepositoryRow): RepositorySummary {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    isGitRepository: row.is_git_repository === 1,
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
    "SELECT id, name, path, is_git_repository, branch, status, open_changes, last_indexed_at FROM repositories ORDER BY name",
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
          is_git_repository,
          branch,
          status,
          open_changes,
          last_indexed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT(path) DO UPDATE SET
          name = excluded.name,
          is_git_repository = excluded.is_git_repository,
          branch = excluded.branch,
          status = excluded.status,
          open_changes = excluded.open_changes,
          last_indexed_at = excluded.last_indexed_at
      `,
      [
        repository.id,
        repository.name,
        repository.path,
        repository.isGitRepository ? 1 : 0,
        repository.branch,
        repository.status,
        repository.openChanges,
        repository.lastIndexedAt,
      ],
    );
  }
}
