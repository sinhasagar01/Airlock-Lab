#!/usr/bin/env bash
set -euo pipefail

cd "/Users/sagarakspuchu/Documents/AI Developer Workspace"

echo "Waiting until 02:40 IST..."

target="$(date -j -f "%Y-%m-%d %H:%M:%S" "$(date +%Y-%m-%d) 02:40:00" +%s)"
now="$(date +%s)"

if [ "$now" -gt "$target" ]; then
  target="$(date -j -v+1d -f "%Y-%m-%d %H:%M:%S" "$(date +%Y-%m-%d) 02:40:00" +%s)"
fi

sleep_seconds=$((target - now))
echo "Sleeping for $sleep_seconds seconds..."
sleep "$sleep_seconds"

echo "Starting Codex overnight task run..."

codex < tasks/overnight/OVERNIGHT-CODEX-PROMPT.md | tee tasks/overnight/overnight-codex-log.txt

echo "Codex overnight run finished."