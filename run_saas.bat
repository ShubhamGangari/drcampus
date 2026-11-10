@echo off
title Drivion CampusERP SaaS
cls
echo =====================================================================
echo  Starting Drivion CampusERP SaaS (Next.js 15 + TypeScript)
echo  Tailored for Indian Private Universities (SRHU Pilot Ready)
echo =====================================================================
echo.
cd /d "%~dp0"
echo Starting development server on http://localhost:3000 ...
echo Press Ctrl+C to stop the server at any time.
echo.
start "" http://localhost:3000
npm run dev
pause

