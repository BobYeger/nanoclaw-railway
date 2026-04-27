#!/bin/bash
# Railway entrypoint: fix volume permissions and drop to non-root user
# The /data volume may be root-owned on first mount, so we fix ownership
# before starting the app as the node user.
# claude-code refuses --dangerously-skip-permissions when running as root.

set -e

# Fix ownership of the data volume (runs as root)
chown -R node:node /data 2>/dev/null || true

# Drop to node user and exec the CMD

# Inject Claude OAuth credentials if provided
if [ -n "$CLAUDE_CREDENTIALS_JSON" ]; then
    mkdir -p /home/node/.claude
    echo "$CLAUDE_CREDENTIALS_JSON" > /home/node/.claude/.credentials.json
    chown node:node /home/node/.claude/.credentials.json
    chmod 600 /home/node/.claude/.credentials.json
    echo "[bootstrap] Claude OAuth credentials injected"
fi
exec gosu node "$@"
