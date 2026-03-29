#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd /Users/mike/gc-portal
/opt/homebrew/bin/node /opt/homebrew/bin/npx tsx scripts/load-handoff.ts
