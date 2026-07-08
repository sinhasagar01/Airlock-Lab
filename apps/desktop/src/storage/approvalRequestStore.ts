import Database from "@tauri-apps/plugin-sql";
import type {
  ApprovalRequest,
  ApprovalRequestStatus,
  ApprovalRisk,
} from "@ai-dev/ai";

const DATABASE_URL = "sqlite:workspace.db";

type ApprovalRequestRow = {
  id: string;
  title: string;
  repository: string;
  agent_run_id: string;
  status: ApprovalRequestStatus;
  risk: ApprovalRisk;
  summary: string;
  files_json: string;
  created_at: string;
};

let databasePromise: Promise<Database> | null = null;

function getDatabase() {
  databasePromise ??= Database.load(DATABASE_URL);
  return databasePromise;
}

async function ensureApprovalRequestTable(database: Database) {
  await database.execute(`
    CREATE TABLE IF NOT EXISTS approval_requests (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      repository TEXT NOT NULL,
      agent_run_id TEXT NOT NULL,
      status TEXT NOT NULL,
      risk TEXT NOT NULL,
      summary TEXT NOT NULL,
      files_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
}

function rowToApprovalRequest(row: ApprovalRequestRow): ApprovalRequest {
  return {
    id: row.id,
    title: row.title,
    repository: row.repository,
    agentRunId: row.agent_run_id,
    status: row.status,
    risk: row.risk,
    summary: row.summary,
    files: JSON.parse(row.files_json) as string[],
    createdAt: row.created_at,
  };
}

export async function loadApprovalRequests(): Promise<ApprovalRequest[]> {
  const database = await getDatabase();
  await ensureApprovalRequestTable(database);

  const rows = await database.select<ApprovalRequestRow[]>(
    "SELECT id, title, repository, agent_run_id, status, risk, summary, files_json, created_at FROM approval_requests ORDER BY created_at DESC",
  );

  return rows.map(rowToApprovalRequest);
}

export async function saveApprovalRequest(request: ApprovalRequest) {
  const database = await getDatabase();
  await ensureApprovalRequestTable(database);

  await database.execute(
    `
      INSERT INTO approval_requests (
        id,
        title,
        repository,
        agent_run_id,
        status,
        risk,
        summary,
        files_json,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        repository = excluded.repository,
        agent_run_id = excluded.agent_run_id,
        status = excluded.status,
        risk = excluded.risk,
        summary = excluded.summary,
        files_json = excluded.files_json
    `,
    [
      request.id,
      request.title,
      request.repository,
      request.agentRunId,
      request.status,
      request.risk,
      request.summary,
      JSON.stringify(request.files),
      request.createdAt,
    ],
  );
}

export async function saveApprovalRequests(requests: ApprovalRequest[]) {
  for (const request of requests) {
    await saveApprovalRequest(request);
  }
}

export async function updateApprovalRequestStatus(
  requestId: string,
  status: ApprovalRequestStatus,
) {
  const database = await getDatabase();
  await ensureApprovalRequestTable(database);

  await database.execute(
    "UPDATE approval_requests SET status = $1 WHERE id = $2",
    [status, requestId],
  );
}
