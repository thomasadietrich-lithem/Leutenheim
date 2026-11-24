@echo off
rem TOUTE la mise en ligne de LTH Studio en un double-clic (24/11/2026, meme principe que NeuroVision) :
rem statistiques de Cave Roller et tableau de bord ; plus tard les versions du jeu. Un seul code du telephone, un seul "O".
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Outils\TOUT_DEPLOYER.ps1" %*
echo.
pause
