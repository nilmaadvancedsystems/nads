@echo off
rem Mantem de pe o claude-do-pc (FGTS, Alterdata, atendente de IA e suporte deste PC): se cair, volta em 30 segundos.
rem Codigo 3 quer dizer que ja existe outro rodando, e ai este sai.
cd /d "%~dp0"
:laco
node claude-do-pc.js >> claude-do-pc.log 2>&1
if %errorlevel%==3 exit /b
ping -n 31 127.0.0.1 >nul
goto laco
