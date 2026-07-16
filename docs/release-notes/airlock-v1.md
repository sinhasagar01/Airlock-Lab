# Airlock v1 Release Notes

## Release Status

- Release: Airlock v1
- Date: 2026-07-16
- Classification: Internal demo and engineering checkpoint
- Primary target: macOS ARM64 native Tauri application
- Patch application: **Implemented** (one eligible single-file artifact, gated)

Airlock v1 is the first checkpoint where the product does what its name promises:
it is a change-control airlock for AI-generated code. Nothing reaches the working
tree unless a human approved it, and the machine can prove exactly what it did. It
succeeds MVP Demo v1, which was review-only and explicitly did **not** apply
patches.

Since v1 the product was renamed to Airlock, Safe Patch Application and Rollback
shipped behind native safety gates, the native layer was hardened against several
real fail-open paths, covert demo fabrication was removed, and the interface was
rebuilt into four surfaces with **Review** as the front door.

It is not a production release. It authorizes exactly one narrow, verified,
reversible write per action — nothing autonomous.

## Highlights

### Safe Patch Application and Rollback (new)

- Native `apply_approved_patch_artifact` applies one approved, generated,
  single-file text artifact behind the exact phrase `APPLY PATCH`.
- A bounded pre-apply backup is persisted before any working-tree write.
- Authoritative exact-path post-apply verification: an apply finalizes as
  `applied_verified` only when proposal, artifact, parsed diff, backup,
  fingerprint, and the complete post-apply Git changed-path set agree exactly.
- Native rollback restores one `applied_verified` artifact from its app-local
  pre-apply backup behind the phrase `ROLL BACK` — never via Git.
- Unexpected, missing, staged, conflicting, or interrupted outcomes are
  **quarantined** with Apply disabled and reconciled conservatively on startup;
  an inspection is recorded behind the phrase `INSPECTED`.
- Repository-scoped cross-process apply lock (OS advisory file + durable SQLite
  record) and a fixed 15-second timeout on every Git child process.

### Native Safety Hardening

- `git status` porcelain parsing preserves the leading space of an unstaged
  change and C-unquotes quoted paths, ending a class of false quarantines.
- Unified diffs are parsed hunk-aware, rejecting a second file section smuggled
  past the first hunk into an approved single-file artifact.
- An unreadable working tree now fails the snapshot **closed** instead of
  reporting a clean tree.
- Apply and reconciliation guards allow-list the states that are safe, so an
  unrecognized status can no longer fall through to a write.
- Control characters are rejected in repository-relative paths; every Git child
  process is bounded, not only the apply command.

### Honest State

- Airlock no longer invents a repository. Until you pick one it says
  "No repository selected"; a failed storage read no longer leaves a fabricated
  repository active.
- Covertly persisted demo rows are gone; retained demo records are labelled
  "Demo record".
- Agent runs and approvals are scoped to the selected repository, and repository
  facts (branch, cleanliness, file list) are scoped to the repository they
  describe rather than bleeding across a switch.

### The Airlock Interface

- Four surfaces — **Review**, **Working tree**, **Repositories**, **Settings** —
  with Review as the front door: propose → check → decide → apply on one page.
- Agent Runs folded into Review; the 18 readiness gates sit behind an "Evidence"
  disclosure; the apply affordance renders in exactly one place.
- The proposed diff is labelled "Proposed — not yet real"; status pills state the
  user's obligation ("Needs you", "No patch"); duplicated and empty cards removed.
- Responsive down to phone widths, with dead CSS swept across the stylesheet.

### Offline Demo Unlock

- The Mock Provider now returns one real, applyable patch (it creates
  `airlock-demo.md`), so the full propose → approve → apply → rollback loop can be
  exercised offline, with **no API key**.

### Provider-Backed Planning (from v1)

- Deterministic Mock Provider and optional OpenAI structured planning behind a
  native environment credential boundary with sanitized diagnostics and bounded
  repository context.

## Demo Workflow

1. Launch the native app (or `npm run dev:web` for the UI-only preview).
2. Open **Review** and propose a change with the Mock Provider.
3. Watch structure validation and the read-only `git apply --check` run; read the
   verdict and, if you like, the Evidence disclosure.
4. Approve the proposal (this records a decision; it writes nothing).
5. Apply the one eligible artifact with the exact `APPLY PATCH` confirmation.
6. Inspect the resulting change in **Working tree**.
7. Roll it back from its app-local backup with `ROLL BACK`, and confirm the tree
   is restored.
8. Restart and confirm persisted review state.

Use [`docs/demo-script.md`](../demo-script.md) for narration, timing, and
recording instructions.

## Safety Statement

Airlock v1 applies patches, within a deliberately narrow boundary.

- Approval records a decision; it never writes a file.
- Apply writes exactly one approved single-file artifact, behind a pre-apply
  backup, a typed `APPLY PATCH` confirmation, and exact post-apply verification.
- React passes durable IDs and confirmation phrases only — never a path, file
  contents, or a Git argument. Native code is authoritative for every write.
- Rollback restores only from app-local backups. No `add`, `commit`, `reset`,
  `checkout`, `clean`, or staging operation exists anywhere in the path, and Git
  history is never touched.
- Anything the machine cannot prove is quarantined with Apply disabled, not
  presented as cleanly applied.

## Configuration

Mock Provider is available without credentials and now produces an applyable
demo patch.

OpenAI is optional:

```bash
OPENAI_API_KEY="..." npm run dev:tauri
```

`OPENAI_MODEL` may be supplied as an optional native environment value. API keys
are not committed or persisted by the application.

## Build And Verification

Release verification commands:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
```

Native checks:

```bash
PATH=/opt/homebrew/opt/rustup/bin:$PATH cargo fmt \
  --manifest-path apps/desktop/src-tauri/Cargo.toml -- --check
PATH=/opt/homebrew/opt/rustup/bin:$PATH cargo test \
  --manifest-path apps/desktop/src-tauri/Cargo.toml
```

Verified at this checkpoint: **186 frontend**, **19 AI**, and **105 native**
tests passing; typecheck, lint, `build:web`, and `git diff --check` clean;
`cargo fmt --check` clean.

Packaged artifacts are emitted under:

```text
apps/desktop/src-tauri/target/release/bundle/macos/
apps/desktop/src-tauri/target/release/bundle/dmg/
```

## Known Limitations

- Safe apply is limited to **one eligible single-file text artifact** per action;
  multi-artifact transactions are not implemented, and quarantined outcomes
  require manual inspection.
- Approval alone is not application authorization; native revalidation and exact
  `APPLY PATCH` confirmation remain mandatory.
- OpenAI requires network access and a native environment credential; Mock
  Provider's patch is a fixed demo fixture, not model output.
- Signing, notarization, automatic updates, crash reporting, and public
  distribution are not configured; packaged verification targets macOS ARM64.
- Some target files intentionally remain non-hashable (binary, oversized,
  forbidden, symlinked, unreadable, or outside the repository).
- Team collaboration, cloud sync, pull-request creation, and CI/deployment are
  outside this checkpoint.

## Release Decision

**Ready for an internal recorded demo of the full apply/rollback loop:** Yes,
when the verification commands pass on the recording machine.

**Ready for production or autonomous repository modification:** No.

## Next Boundary

The next boundaries are multi-artifact application within a single transaction,
signing and notarization for distribution beyond the build machine, and closing
the remaining product-decision items recorded in
[`docs/roadmap.md`](../roadmap.md).
