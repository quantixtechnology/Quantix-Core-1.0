#!/bin/bash
# Keep-alive wrapper that restarts the dev server if it dies
cd /home/z/my-project

while true; do
  echo "[$(date)] Starting dev server..." >> dev.log
  npx next dev -p 3000 >> dev.log 2>&1 &
  SERVER_PID=$!
  
  # Wait and check if process stays alive
  while kill -0 $SERVER_PID 2>/dev/null; do
    sleep 5
  done
  
  echo "[$(date)] Dev server died, restarting in 3s..." >> dev.log
  sleep 3
done
