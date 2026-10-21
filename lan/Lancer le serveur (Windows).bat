@echo off
rem TIEE Simulator - serveur reseau local (double-cliquer)
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe sur cet ordinateur.
  echo Installez la version LTS depuis https://nodejs.org puis relancez ce fichier.
  pause
  exit /b 1
)
if exist "car-regie-serveur-lan.mjs" (node "car-regie-serveur-lan.mjs") else (node "serveur.mjs")
pause
