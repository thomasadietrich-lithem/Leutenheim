@echo off
rem A lancer UNE SEULE FOIS : cree l acces de mise en ligne (utilisateur lth-deployer + code du telephone).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0INSTALLER_COMPTE.ps1" %*
echo.
pause
