#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$ROOT_DIR/.pids"
LOG_DIR="$ROOT_DIR/.logs"

mkdir -p "$PID_DIR" "$LOG_DIR"

echo "======================================================="
echo "Starting PropertyAI Application (Linux)"
echo "======================================================="

echo
echo "[1/2] Starting Node.js Server..."
(
  cd "$ROOT_DIR/server"
  nohup npm run dev >"$LOG_DIR/server.log" 2>&1 &
  echo $! >"$PID_DIR/server.pid"
)

sleep 1

echo
echo "[2/2] Starting Vite Client..."
(
  cd "$ROOT_DIR/client"
  nohup npm run dev -- --host 0.0.0.0 --port 5174 --strictPort >"$LOG_DIR/client.log" 2>&1 &
  echo $! >"$PID_DIR/client.pid"
)

echo
echo "Application components started in background."
echo "- Server log: $LOG_DIR/server.log"
echo "- Client log: $LOG_DIR/client.log"
echo "To stop the application, run ./stop.sh"
echo "======================================================="
