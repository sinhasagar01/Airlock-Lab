import { createWorkspaceSummary } from "@ai-dev/core";
import { createMockProvider } from "@ai-dev/ai";
import { summarizeScanTarget } from "@ai-dev/indexing";
import { StatusBadge } from "@ai-dev/ui";

const workspace = createWorkspaceSummary({
  name: "AI Developer Workspace",
  repositories: 0,
  activeRuns: 0,
  pendingApprovals: 0
});

const provider = createMockProvider();
const scanTarget = summarizeScanTarget({
  path: "/select/a/repository",
  includeGitState: true,
  includeDocumentation: true
});

export function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">AI Developer Workspace</div>
        <nav aria-label="Primary navigation">
          <a aria-current="page">Home</a>
          <a>Repositories</a>
          <a>Tasks</a>
          <a>Agent Runs</a>
          <a>Changes</a>
          <a>Documents</a>
          <a>Settings</a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1>{workspace.name}</h1>
          </div>
          <div className="status-row">
            <StatusBadge tone="neutral">Provider: {provider.id}</StatusBadge>
            <StatusBadge tone="warning">
              Pending approvals: {workspace.pendingApprovals}
            </StatusBadge>
          </div>
        </header>

        <section className="panel" aria-labelledby="mvp-start-heading">
          <p className="eyebrow">MVP scaffold</p>
          <h2 id="mvp-start-heading">Local-first app shell ready</h2>
          <p>
            The first screen is intentionally operational: workspace context,
            repository readiness, agent state, and approval visibility.
          </p>
          <div className="grid">
            <div>
              <span className="metric">{workspace.repositories}</span>
              <span className="label">Repositories</span>
            </div>
            <div>
              <span className="metric">{workspace.activeRuns}</span>
              <span className="label">Active runs</span>
            </div>
            <div>
              <span className="metric">{scanTarget.mode}</span>
              <span className="label">Indexing mode</span>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
