# MVP Demo v1 Release Notes

## Release Status

- Release: MVP Demo v1
- Date: 2026-07-15
- Classification: Internal demo and engineering checkpoint
- Primary target: macOS ARM64 native Tauri application
- Patch application: Not implemented

MVP Demo v1 is the first complete review-only product workflow. It proves the
path from selecting and understanding a local repository through provider-backed
planning, generated artifact review, read-only validation, local Git comparison,
and a durable human approval decision.

It is not a production release and does not authorize AI-generated writes.

## Highlights

### Repository Understanding

- Native repository folder selection
- Persisted repository records and Git metadata
- Bounded file-tree indexing and progress state
- Repository Intelligence for folders, key files, extensions, and framework
  hints
- Searchable indexed-file browser and safe preview states

### Provider-Backed Planning

- Deterministic Mock Provider workflow
- Optional OpenAI structured plan and generated-artifact workflow
- Native environment credential boundary and sanitized connection diagnostics
- Bounded repository context and strict provider-output validation
- Persisted Agent Runs, Proposed Changes, patch artifacts, and Approval Requests

### Review And Safety

- Structured plan, affected-file, risk, and validation review
- Generated patch artifact states and read-only diff previews
- Single-file unified-diff validation
- Fixed read-only `git apply --check` applicability dry-run
- SHA-256 artifact digest bound to validation evidence
- Native target-file fingerprints with safe bounded content hashes
- Canonical repository snapshot digest and staleness comparison
- Apply Readiness gates in Agent Runs and Approval Review
- Permanently disabled `Apply unavailable` boundary

### Local Git And Approval

- Real read-only Git status and per-file diff inspection
- Explicit separation between generated artifacts and local working-tree diffs
- Persisted approve/reject decisions and pending-count updates
- Restart hydration for runs, proposals, artifacts, validation, and approvals

### Desktop Readiness

- Confirmation-gated Settings maintenance
- Frontend smoke and workflow coverage
- AI provider-contract coverage
- Native path, Git parser, preview, dry-run, fingerprint, and safety coverage
- Production `.app` and DMG build path

## Demo Workflow

1. Launch the native app.
2. Select and index a non-sensitive local repository.
3. Review Repository Intelligence.
4. Start a Mock Provider Agent Run.
5. Inspect the persisted structured plan and proposed files.
6. Review generated artifact states.
7. Validate a generated text artifact and run the read-only dry-run.
8. Inspect artifact digest, fingerprints, snapshot digest, and staleness gates.
9. Open the linked Approval Review.
10. Compare generated artifacts with matching local Git diffs.
11. Approve or reject without applying the patch.
12. Review Changes and guarded Settings actions.
13. Restart and confirm persisted review state.

Use [`docs/demo-script.md`](../demo-script.md) for narration, timing, recovery,
and recording instructions.

## Safety Statement

MVP Demo v1 does not include patch application.

- Agent Runs do not write repository files.
- Generated artifacts are persisted review data only.
- Approval changes review metadata only.
- Dry-run uses fixed `git apply --check`; it does not apply a patch.
- Apply Readiness is informational and cannot authorize a write.
- No Git staging, commit, reset, checkout, clean, or remote mutation is exposed.
- Target-file contents never cross the native fingerprint boundary.

## Configuration

Mock Provider is available without credentials.

OpenAI is optional:

```bash
OPENAI_API_KEY="..." npm run dev:tauri
```

`OPENAI_MODEL` may be supplied as an optional native environment value. API
keys are not committed or persisted by the application.

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

Packaged artifacts are emitted under:

```text
apps/desktop/src-tauri/target/release/bundle/macos/
apps/desktop/src-tauri/target/release/bundle/dmg/
```

## Known Limitations

- Safe Patch Application is limited to one eligible approved single-file text
  artifact with a native backup, exact typed confirmation, cross-process lock,
  bounded Git timeout, and authoritative exact-path post-apply verification.
- An unexpected, missing, staged, or conflicting post-apply path is persisted
  as `quarantine_required`; it is not presented as cleanly applied and requires
  manual inspection with Apply disabled.
- Approval alone is not application authorization; native revalidation and
  exact `APPLY PATCH` confirmation remain mandatory.
- Signing, notarization, automatic updates, crash reporting, and public
  distribution are not configured.
- Packaged verification currently targets macOS ARM64.
- OpenAI requires network access and a native environment credential.
- Mock Provider does not generate real patch content.
- Some target files intentionally remain non-hashable because they are binary,
  oversized, forbidden, symlinked, unreadable, or outside the repository.
- Team collaboration, cloud sync, pull-request creation, CI, deployment, and
  rollback are outside this checkpoint.

## Release Decision

**Ready for an internal recorded MVP demo:** Yes, when the pre-demo checklist
and verification commands pass on the recording machine.

**Ready for production or autonomous repository modification:** No.

## Next Boundary

The next product boundary is Safe Patch Recovery and Application Hardening:
retained packaged disposable-repository QA evidence and an explicit rollback
design using persisted backups. Repository-scoped cross-process locking,
bounded Git child-process timeouts, and exact-path post-verification with
quarantine are implemented. Multi-artifact application remains out of scope.
