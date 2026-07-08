import Database from "@tauri-apps/plugin-sql";
import type { IndexingJob, IndexingJobStatus } from "@ai-dev/indexing";

const DATABASE_URL = "sqlite:workspace.db";

type IndexingJobRow = {
  id: string;
  repository_id: string;
  repository_name: string;
  status: IndexingJobStatus;
  progress: number;
  step: string;
  created_at: string;
  updated_at: string;
};

let databasePromise: Promise<Database> | null = null;

function getDatabase() {
  databasePromise ??= Database.load(DATABASE_URL);
  return databasePromise;
}

async function ensureIndexingJobTable(database: Database) {
  await database.execute(`
    CREATE TABLE IF NOT EXISTS indexing_jobs (
      id TEXT PRIMARY KEY,
      repository_id TEXT NOT NULL,
      repository_name TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL,
      step TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

function rowToIndexingJob(row: IndexingJobRow): IndexingJob {
  return {
    id: row.id,
    repositoryId: row.repository_id,
    repositoryName: row.repository_name,
    status: row.status,
    progress: row.progress,
    step: row.step,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadIndexingJobs(): Promise<IndexingJob[]> {
  const database = await getDatabase();
  await ensureIndexingJobTable(database);

  const rows = await database.select<IndexingJobRow[]>(
    "SELECT id, repository_id, repository_name, status, progress, step, created_at, updated_at FROM indexing_jobs ORDER BY updated_at DESC",
  );

  return rows.map(rowToIndexingJob);
}

export async function saveIndexingJob(job: IndexingJob) {
  const database = await getDatabase();
  await ensureIndexingJobTable(database);

  await database.execute(
    `
      INSERT INTO indexing_jobs (
        id,
        repository_id,
        repository_name,
        status,
        progress,
        step,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT(id) DO UPDATE SET
        repository_id = excluded.repository_id,
        repository_name = excluded.repository_name,
        status = excluded.status,
        progress = excluded.progress,
        step = excluded.step,
        updated_at = excluded.updated_at
    `,
    [
      job.id,
      job.repositoryId,
      job.repositoryName,
      job.status,
      job.progress,
      job.step,
      job.createdAt,
      job.updatedAt,
    ],
  );
}

export async function saveIndexingJobs(jobs: IndexingJob[]) {
  for (const job of jobs) {
    await saveIndexingJob(job);
  }
}
