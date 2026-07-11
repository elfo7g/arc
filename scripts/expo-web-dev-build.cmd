@echo off
cd /d "%~dp0..\mobile\dev-build"
set CI=1
set BROWSER=none
npx expo start --web --port 8091
