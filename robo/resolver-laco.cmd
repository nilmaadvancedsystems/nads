@echo off
rem O Resolver do nads (o botao Resolver dos Feedbacks) no PC do Vitor: se cair, volta em 30 segundos.
rem O Claude dele so le, edita a copia do nads, testa e faz o commit local; quem publica e o Publicar do Vitor.
cd /d "%~dp0"
:laco
node resolver.js >> resolver.log 2>&1
ping -n 31 127.0.0.1 >nul
goto laco
