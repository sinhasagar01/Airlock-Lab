# Provider Adapters

## Current Providers

The Agent Run composer supports two planning providers behind the shared
`AgentProviderAdapter` contract:

- **Mock Provider** is enabled by default and produces deterministic review
  records without an external request.
- **OpenAI** is available only in the native Tauri app when
  `OPENAI_API_KEY` is present in the native process environment.

Both providers generate structured plans. OpenAI can also return review-only
patch artifact records alongside its plan; Mock Provider leaves every artifact
as `not_generated`. Neither provider applies patches, writes files, uses tools,
or mutates Git state.

## Credential Boundary

OpenAI credentials are read by the Rust/Tauri process. The API key is never
returned to React, stored in SQLite, written to local storage, or committed to
the repository. Local `.env` files are ignored by Git, but the current MVP
expects credentials to be supplied directly to the native process environment:

```bash
OPENAI_API_KEY="..." npm run dev:tauri
```

`OPENAI_MODEL` is optional. When omitted, the native adapter uses its current
default planning model. The UI reads only a safe configuration result:
`configured`, `model`, and an unavailable reason.

Native configuration rejects model identifiers longer than 120 characters or
containing path separators, whitespace, or unsupported punctuation. Invalid
model configuration is reported explicitly and never silently replaced for a
provider request.

## Connection Testing

Settings exposes a confirmation-free, read-only **Test connection** action only
when OpenAI is configured. The action calls a native Tauri command that performs
a fixed lookup for the configured model with a 15-second timeout. It sends no
task, repository context, file paths, file contents, or generated artifacts.

The native process does not read or return the provider response body. React
receives only:

- Sanitized connection status
- Whether native configuration exists
- Configured model identifier
- Check timestamp
- Optional request latency
- A stable user-facing message

Authentication, model access, rate limiting, timeout, invalid configuration,
and provider availability remain distinct diagnostics. Raw errors, response
bodies, headers, account metadata, and API keys never cross the native boundary.
Connection results are session state only and are not written to SQLite or
local storage.

## OpenAI Planning Boundary

The OpenAI adapter uses the Responses API with strict structured output. The
native request sets `store: false`, supplies no tools, and requests one JSON
object matching the plan schema.

Only these task and repository facts may be sent:

- Task title and task prompt
- Repository name
- Branch
- Indexed file count
- Detected key-file paths
- Detected project folder names
- Top file-extension counts
- Git repository, clean/dirty, and changed-file-count summary

The adapter does not send full file contents, indexed path inventories,
internal run/repository IDs, environment files, private-key paths, credential
files, or secret files. Both TypeScript and Rust enforce size/count limits and
safe relative paths.

Because full file content is intentionally absent, OpenAI must return
`unavailable` when a truthful patch would require guessing existing content.
It may return a generated single-file unified diff only when bounded task and
repository metadata are sufficient, such as a proposed new file. Generated
content is a proposal, not current repository state or permission to apply.

## Output Validation

OpenAI output must include:

- A bounded plan summary
- One to twelve implementation steps
- Up to twenty safe repository-relative affected-file paths
- One to ten risks
- One to twelve validation checks
- Zero to one patch artifact per proposed file
- `approvalRequired: true`

Provider-supplied execution statuses are not trusted. The app assigns
plan/check statuses locally. Artifact paths must be safe, unique, and exactly
match proposed files. Text artifacts must contain one matching single-file
unified diff; failed, unavailable, and binary records cannot carry preview
text. The app derives addition/deletion counts and strips raw content above the
64 KiB inline-review limit while retaining a `generated`/`isTooLarge` record.
Malformed, unsafe, mismatched, or incomplete output is rejected before a run,
proposed change, or approval request is persisted.

## Error Handling

The native boundary maps authentication, rate-limit, timeout, unavailable,
invalid-output, and generic request failures to stable error codes. Raw provider
response bodies and upstream details are not exposed to the frontend. The
composer keeps the submitted task visible so the user can retry or switch back
to Mock Provider.

## Deferred Capabilities

The OpenAI adapter reports patch proposal generation as supported. These
capabilities remain unsupported:

- Streaming
- Tool use
- File writes
- Git mutation

Those capabilities require separate permission, artifact, and approval work.
They must not be inferred from successful plan generation.

## References

- [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses)
- [OpenAI model documentation](https://developers.openai.com/api/docs/models)
