import Database from "@tauri-apps/plugin-sql";
import type {
  PersistedProposedChange,
  ProposedChangeStatus,
} from "@ai-dev/ai";
import { ensureProposedPatchArtifacts } from "@ai-dev/ai";

const DATABASE_URL = "sqlite:workspace.db";

type ProposedChangeRow = {
  id: string;
  run_id: string;
  approval_request_id: string | null;
  repository_id: string;
  title: string;
  summary: string;
  status: ProposedChangeStatus;
  files_json: string;
  patch_artifacts_json: string;
  created_at: string;
  updated_at: string;
};

let databasePromise: Promise<Database> | null = null;

function getDatabase() {
  databasePromise ??= Database.load(DATABASE_URL);
  return databasePromise;
}

async function ensureProposedChangesTable(database: Database) {
  await database.execute(`
    CREATE TABLE IF NOT EXISTS proposed_changes (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      approval_request_id TEXT,
      repository_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL,
      files_json TEXT NOT NULL,
      patch_artifacts_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

function rowToProposedChange(row: ProposedChangeRow): PersistedProposedChange {
  return ensureProposedPatchArtifacts({
    id: row.id,
    runId: row.run_id,
    approvalRequestId: row.approval_request_id ?? undefined,
    repositoryId: row.repository_id,
    title: row.title,
    summary: row.summary,
    status: row.status,
    files: JSON.parse(row.files_json) as PersistedProposedChange["files"],
    patchArtifacts: JSON.parse(
      row.patch_artifacts_json,
    ) as PersistedProposedChange["patchArtifacts"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function loadProposedChanges(): Promise<PersistedProposedChange[]> {
  const database = await getDatabase();
  await ensureProposedChangesTable(database);

  const rows = await database.select<ProposedChangeRow[]>(
    "SELECT id, run_id, approval_request_id, repository_id, title, summary, status, files_json, patch_artifacts_json, created_at, updated_at FROM proposed_changes ORDER BY updated_at DESC",
  );

  return rows.map(rowToProposedChange);
}

export async function saveProposedChange(change: PersistedProposedChange) {
  const database = await getDatabase();
  await ensureProposedChangesTable(database);
  const normalizedChange = ensureProposedPatchArtifacts(change);

  await database.execute(
    `
      INSERT INTO proposed_changes (
        id,
        run_id,
        approval_request_id,
        repository_id,
        title,
        summary,
        status,
        files_json,
        patch_artifacts_json,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT(id) DO UPDATE SET
        run_id = excluded.run_id,
        approval_request_id = excluded.approval_request_id,
        repository_id = excluded.repository_id,
        title = excluded.title,
        summary = excluded.summary,
        status = excluded.status,
        files_json = excluded.files_json,
        patch_artifacts_json = excluded.patch_artifacts_json,
        updated_at = excluded.updated_at
    `,
    [
      normalizedChange.id,
      normalizedChange.runId,
      normalizedChange.approvalRequestId ?? null,
      normalizedChange.repositoryId,
      normalizedChange.title,
      normalizedChange.summary,
      normalizedChange.status,
      JSON.stringify(normalizedChange.files),
      JSON.stringify(normalizedChange.patchArtifacts),
      normalizedChange.createdAt,
      normalizedChange.updatedAt,
    ],
  );
}

export async function saveProposedChanges(changes: PersistedProposedChange[]) {
  for (const change of changes) {
    await saveProposedChange(change);
  }
}
