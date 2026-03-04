#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$ROOT_DIR/.pids"
LOG_DIR="$ROOT_DIR/.logs"
SERVER_PORT="${SERVER_PORT:-3101}"
CLIENT_PORT="${CLIENT_PORT:-5274}"
VITE_PROXY_TARGET="${VITE_PROXY_TARGET:-http://localhost:${SERVER_PORT}}"

mkdir -p "$PID_DIR" "$LOG_DIR"

echo "======================================================="
echo "Starting PropertyAI Application (Linux)"
echo "======================================================="

echo
echo "[1/2] Starting Node.js Server..."
(
  cd "$ROOT_DIR/server"
  nohup env PORT="$SERVER_PORT" npm run dev >"$LOG_DIR/server.log" 2>&1 &
  echo $! >"$PID_DIR/server.pid"
)

sleep 1

echo
echo "[2/2] Starting Vite Client..."
(
  cd "$ROOT_DIR/client"
  nohup env VITE_PROXY_TARGET="$VITE_PROXY_TARGET" npm run dev -- --host 0.0.0.0 --port "$CLIENT_PORT" --strictPort >"$LOG_DIR/client.log" 2>&1 &
  echo $! >"$PID_DIR/client.pid"
)

echo
echo "Application components started in background."
echo "- Server URL: http://localhost:$SERVER_PORT"
echo "- Client URL: http://localhost:$CLIENT_PORT"
echo "- Vite proxy target: $VITE_PROXY_TARGET"
echo "- Server log: $LOG_DIR/server.log"
echo "- Client log: $LOG_DIR/client.log"
echo "To stop the application, run ./stop.sh"
echo "======================================================="
