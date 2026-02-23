@echo off
echo =======================================================
echo Stopping PropertyAI Application
echo =======================================================

echo.
echo Stopping Server process tree...
taskkill /FI "WindowTitle eq PropertyAI-Server*" /T /F >nul 2>&1

echo.
echo Stopping Client process tree...
taskkill /FI "WindowTitle eq PropertyAI-Client*" /T /F >nul 2>&1

echo.
echo Application stopped successfully.
echo =======================================================
pause
