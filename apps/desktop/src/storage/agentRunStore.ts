import Database from "@tauri-apps/plugin-sql";
import type { AgentRun, AgentRunRecord, ProposedChangePlan } from "@ai-dev/ai";

const DATABASE_URL = "sqlite:workspace.db";

type AgentRunRow = {
  id: string;
  run_json: string;
  plan_json: string;
  created_at: string;
};

let databasePromise: Promise<Database> | null = null;

function getDatabase() {
  databasePromise ??= Database.load(DATABASE_URL);
  return databasePromise;
}

async function ensureAgentRunsTable(database: Database) {
  await database.execute(`
    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      run_json TEXT NOT NULL,
      plan_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
}

function rowToAgentRunRecord(row: AgentRunRow): AgentRunRecord {
  return {
    run: JSON.parse(row.run_json) as AgentRun,
    plan: JSON.parse(row.plan_json) as ProposedChangePlan,
    createdAt: row.created_at,
  };
}

export async function loadAgentRunRecords(): Promise<AgentRunRecord[]> {
  const database = await getDatabase();
  await ensureAgentRunsTable(database);

  const rows = await database.select<AgentRunRow[]>(
    "SELECT id, run_json, plan_json, created_at FROM agent_runs ORDER BY created_at DESC",
  );

  return rows.map(rowToAgentRunRecord);
}

export async function saveAgentRunRecord(record: AgentRunRecord) {
  const database = await getDatabase();
  await ensureAgentRunsTable(database);

  await database.execute(
    `
      INSERT INTO agent_runs (id, run_json, plan_json, created_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT(id) DO UPDATE SET
        run_json = excluded.run_json,
        plan_json = excluded.plan_json,
        created_at = excluded.created_at
    `,
    [
      record.run.id,
      JSON.stringify(record.run),
      JSON.stringify(record.plan),
      record.createdAt,
    ],
  );
}
