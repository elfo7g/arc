@echo off
cd /d "%~dp0..\mobile\expo"
set CI=1
set BROWSER=none
npx expo start --web --port 8090
