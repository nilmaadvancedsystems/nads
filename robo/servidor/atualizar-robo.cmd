@echo off
rem Atualiza o robo do NILMA-SERVER sem matar o trabalho no meio (07/11/2026). Disparado do PC do escritorio:
rem   schtasks /run /s NILMA-SERVER /tn nads-atualizar-robo   (tarefa SYSTEM: cmd /c D:\nads-dados\atualizar-robo.cmd)
rem A tarefa roda a COPIA em D:\nads-dados (fora do git: o reset nao troca o arquivo que o cmd esta lendo). Esta copia
rem quase nunca muda: so busca o desenvolvimento e roda o robo/atualizar-robo.js DO COMMIT NOVO (git show), que decide se
rem reinicia (so se mudou algo que o robo usa, no maximo 1 vez a cada 30 min; [urgente] no commit passa na frente), pede ao
rem robo para sair com calma (robo\sair.pedido; ate 12 min, so entao forca) e faz o reset depois que ele saiu.
rem Instalar: copiar para D:\nads-dados\atualizar-robo.cmd com CRLF (ver robo/LEIAME.md). Log: D:\nads-dados\atualizar.log
set GIT=D:\Programas\Git\cmd\git.exe
set NODE=D:\Programas\nodejs\node.exe
set DADOS=D:\nads-dados
set LOG=D:\nads-dados\atualizar.log
for %%A in ("%LOG%") do if %%~zA GTR 1000000 move /y "%LOG%" "%LOG%.1" >nul
echo. >> "%LOG%"
echo %date% %time% atualizar-robo.cmd >> "%LOG%"
"%GIT%" -c safe.directory=* -C D:\nads fetch -q origin desenvolvimento >> "%LOG%" 2>&1
"%GIT%" -c safe.directory=* -C D:\nads show origin/desenvolvimento:robo/atualizar-robo.js > "%DADOS%\atualizar-robo.js" 2>> "%LOG%"
if errorlevel 1 (
  echo sem o robo/atualizar-robo.js no desenvolvimento: atualizo como antes, reset e reinicio na hora >> "%LOG%"
  "%GIT%" -c safe.directory=* -C D:\nads reset --hard origin/desenvolvimento >> "%LOG%" 2>&1
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'arquivador\.js' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; 'reiniciado o processo ' + $_.ProcessId }" >> "%LOG%" 2>&1
  exit /b 1
)
"%NODE%" "%DADOS%\atualizar-robo.js" servidor --repo D:\nads --git "%GIT%" --dados "%DADOS%" >> "%LOG%" 2>&1
