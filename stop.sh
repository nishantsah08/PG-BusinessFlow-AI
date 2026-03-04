#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$ROOT_DIR/.pids"

stop_service() {
  local name="$1"
  local pid_file="$2"

  echo
  echo "Stopping $name process..."

  if [[ ! -f "$pid_file" ]]; then
    echo "No PID file found for $name ($pid_file)."
    return
  fi

  local pid
  pid="$(cat "$pid_file")"

  if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
    echo "$name is not running (stale PID file)."
    rm -f "$pid_file"
    return
  fi

  kill "$pid" 2>/dev/null || true

  for _ in {1..20}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$pid_file"
      echo "$name stopped successfully."
      return
    fi
    sleep 0.25
  done

  echo "$name did not stop gracefully; forcing termination..."
  kill -9 "$pid" 2>/dev/null || true
  rm -f "$pid_file"
}

echo "======================================================="
echo "Stopping PropertyAI Application (Linux)"
echo "======================================================="

stop_service "Server" "$PID_DIR/server.pid"
stop_service "Client" "$PID_DIR/client.pid"

echo
echo "Application stop sequence complete."
echo "======================================================="
