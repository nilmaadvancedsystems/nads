@echo off
rem Atualiza o robo do NILMA-SERVER e reinicia o arquivador (03/11/2026). Disparado do PC do escritorio por uma tarefa
rem remota (schtasks /s NILMA-SERVER ... /ru SYSTEM): o repositorio e publico, entao o fetch nao pede login. O reset
rem deixa o D:\nads igual ao desenvolvimento; o que fica fora do git (credenciais, logs, node_modules) nao muda.
rem O laco (arquivador-laco.cmd, na sessao do Administrador) religa o arquivador em 30 s com o codigo novo.
set GIT=D:\Programas\Git\cmd\git.exe
set LOG=D:\nads-dados\atualizar.log
echo %date% %time% > "%LOG%"
"%GIT%" -c safe.directory=* -C D:\nads fetch origin desenvolvimento >> "%LOG%" 2>&1 || goto falhou
"%GIT%" -c safe.directory=* -C D:\nads reset --hard origin/desenvolvimento >> "%LOG%" 2>&1 || goto falhou
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'arquivador\.js' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; 'reiniciado o processo ' + $_.ProcessId }" >> "%LOG%" 2>&1
echo ok >> "%LOG%"
exit /b 0
:falhou
echo FALHOU >> "%LOG%"
exit /b 1
