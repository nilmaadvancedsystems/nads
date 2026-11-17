@echo off
rem O robo dos relatorios do Alterdata neste PC (alterdata-no-pc.js). Mantem de pe: se cair ou sair para atualizar, puxa o
rem codigo novo do GitHub (ramo desenvolvimento) e liga de novo em 10 segundos. Codigo 3: ja existe outro rodando, este sai.
rem Registro: robo\alterdata-no-pc.log
cd /d "%~dp0.."
:laco
for /f %%H in ('git -C .. rev-parse HEAD 2^>nul') do set ANTES=%%H
git -C .. pull -q --ff-only origin desenvolvimento >> alterdata-no-pc.log 2>&1
git -C .. diff --quiet %ANTES% HEAD -- robo/package-lock.json 2>nul || call npm ci --omit=dev >> alterdata-no-pc.log 2>&1
node alterdata-no-pc.js >> alterdata-no-pc.log 2>&1
if %errorlevel%==3 exit /b
ping -n 11 127.0.0.1 >nul
goto laco
