@echo off
echo =======================================================
echo Starting PropertyAI Application
echo =======================================================

echo.
echo [1/2] Starting Node.js Server...
start "PropertyAI-Server" cmd /k "title PropertyAI-Server && cd server && npm run dev"

echo.
echo [2/2] Starting Vite Client...
start "PropertyAI-Client" cmd /k "title PropertyAI-Client && cd client && npm run dev"

echo.
echo Application components are opening in separate windows.
echo To stop the application, run stop.bat
echo =======================================================
