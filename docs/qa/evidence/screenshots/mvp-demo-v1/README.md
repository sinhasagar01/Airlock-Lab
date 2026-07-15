# MVP Demo v1 Screenshots — Incomplete Evidence

**This screenshot set is incomplete. It is not packaged click-through QA evidence
and must not be cited as a passing result.**

## Status

- Packaged UI click-through: **Not completed**
- Screenshot set: **Incomplete — capture aborted**

## What happened

A packaged-app click-through attempt was started and abandoned before it
reached any product behavior worth recording:

- The macOS picker resolved to a remembered non-disposable repository, which
  violates the requirement in
  [`docs/qa/disposable-repository-apply-qa.md`](../../../disposable-repository-apply-qa.md)
  that the pass run only against a newly created disposable repository.
- The attempt stopped before indexing, approval, validation, or apply.
- No files and no Git state were mutated.

## What this directory contains

This directory is tracked, but **no screenshot is committed**.

One untracked local file may exist on the machine where the attempt ran:

- `01-packaged-launch.png` — the packaged app at launch only. It shows that the
  binary starts. It demonstrates no repository selection, indexing, approval,
  validation, apply, or recovery behavior.

It is deliberately kept out of Git history. Committing an aborted attempt's
screenshot would place a durable artifact in permanent history that a later
reader could mistake for evidence that packaged click-through QA happened, and
removing it afterwards would not shrink the history that carries it.

No other screenshot was captured. A `02-repository-selected.png` does not exist.

## Before this set can be cited

Complete the manual pass on a recording host against a **fresh disposable
repository**, following
[`docs/qa/disposable-repository-apply-qa.md`](../../../disposable-repository-apply-qa.md).
Then delete this file, replace the set, and append the operator name, timestamp,
attempt ID, and backup ID to
[`docs/qa/evidence/mvp-demo-v1-disposable-apply-qa.md`](../../mvp-demo-v1-disposable-apply-qa.md),
whose "Evidence Gaps And Manual Follow-Up" section still owns these three
outstanding items.

Do not reuse the launch screenshot above as evidence for a later build.
