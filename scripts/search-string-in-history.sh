#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/search-string-in-history.sh "<string>"

Searches all commits in the current Git repository and prints commits where
the given string appears in at least one file snapshot.
EOF
}

if [[ "${1-}" == "-h" || "${1-}" == "--help" ]]; then
  usage
  exit 0
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: not inside a Git repository." >&2
  exit 1
fi

if [[ $# -gt 1 ]]; then
  usage >&2
  exit 1
fi

if [[ $# -eq 1 ]]; then
  needle="$1"
else
  read -r -p "Enter search string: " needle
fi

if [[ -z "$needle" ]]; then
  echo "Error: search string cannot be empty." >&2
  exit 1
fi

echo "Searching all commits for string: $needle" >&2

found=0
while IFS= read -r commit; do
  # Search the full tree snapshot of this commit for the exact string and list files.
  matches="$(git grep -F -l -- "$needle" "$commit" 2>/dev/null || true)"
  if [[ -n "$matches" ]]; then
    git show -s --format="%H %ad %an %s" --date=iso-strict "$commit"
    while IFS= read -r match; do
      file_path="${match#"$commit:"}"
      echo "  - $file_path"
    done <<<"$matches"
    found=1
  fi
done < <(git rev-list --all)

if [[ "$found" -eq 0 ]]; then
  echo "No commits found containing the string in any file snapshot." >&2
fi
