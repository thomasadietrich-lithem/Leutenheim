@echo off
rem Change le courriel des alertes ou le mot de passe du tableau de bord.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CHANGER_REGLAGES.ps1" %*
echo.
pause
