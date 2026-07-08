import Database from "@tauri-apps/plugin-sql";
import type { IndexedFileFact } from "@ai-dev/indexing";

const DATABASE_URL = "sqlite:workspace.db";

type IndexedFileFactRow = {
  repository_id: string;
  path: string;
  size_bytes: number;
  extension: string | null;
  modified_at: string | null;
  indexed_at: string;
};

let databasePromise: Promise<Database> | null = null;

function getDatabase() {
  databasePromise ??= Database.load(DATABASE_URL);
  return databasePromise;
}

async function ensureIndexedFileTable(database: Database) {
  await database.execute(`
    CREATE TABLE IF NOT EXISTS indexed_file_facts (
      repository_id TEXT NOT NULL,
      path TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      extension TEXT,
      modified_at TEXT,
      indexed_at TEXT NOT NULL,
      PRIMARY KEY (repository_id, path)
    )
  `);
}

function rowToIndexedFileFact(row: IndexedFileFactRow): IndexedFileFact {
  return {
    repositoryId: row.repository_id,
    path: row.path,
    sizeBytes: row.size_bytes,
    extension: row.extension,
    modifiedAt: row.modified_at,
  };
}

export async function loadIndexedFileFacts(
  repositoryId: string,
): Promise<IndexedFileFact[]> {
  const database = await getDatabase();
  await ensureIndexedFileTable(database);

  const rows = await database.select<IndexedFileFactRow[]>(
    "SELECT repository_id, path, size_bytes, extension, modified_at, indexed_at FROM indexed_file_facts WHERE repository_id = $1 ORDER BY path",
    [repositoryId],
  );

  return rows.map(rowToIndexedFileFact);
}

export async function replaceIndexedFileFacts(
  repositoryId: string,
  files: IndexedFileFact[],
) {
  const database = await getDatabase();
  await ensureIndexedFileTable(database);
  const indexedAt = new Date().toISOString();

  await database.execute(
    "DELETE FROM indexed_file_facts WHERE repository_id = $1",
    [repositoryId],
  );

  for (const file of files) {
    await database.execute(
      `
        INSERT INTO indexed_file_facts (
          repository_id,
          path,
          size_bytes,
          extension,
          modified_at,
          indexed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        file.repositoryId,
        file.path,
        file.sizeBytes,
        file.extension,
        file.modifiedAt,
        indexedAt,
      ],
    );
  }
}
