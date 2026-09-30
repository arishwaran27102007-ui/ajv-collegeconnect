@echo off
title AJV CollegeConnect Portal
cd /d "%~dp0"

echo ====================================================
echo   AJV College of Engineering - CollegeConnect
echo ====================================================
echo.
echo Starting backend server on http://localhost:5000 ...
echo Opening portal in your default browser...
echo.

start "" "http://localhost:5000"
node backend/server.js

if %errorlevel% neq 0 (
    echo.
    echo Server stopped with error.
    pause
)
