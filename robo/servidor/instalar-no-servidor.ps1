# Prepara o NILMA-SERVER para rodar o robô do arquivador e do SIEG no D: (03/11/2026: o PC do DPTO FISCAL 004 vivia
# sobrecarregado e o robô parava quando ele desligava; o servidor fica sempre ligado, tem 40 GB e SSD no D:, separado do
# disco do SCI e do Alterdata).
#
# Rodar NO SERVIDOR, logado com o usuário que vai ficar com a sessão aberta (o Google Drive para computador só monta o G:
# com alguém logado: na área de trabalho remota, feche a janela em vez de "Sair"):
#   powershell -ExecutionPolicy Bypass -File D:\nads\robo\servidor\instalar-no-servidor.ps1
# Antes do código estar no D:, copie só este arquivo para lá e rode do mesmo jeito: ele clona o resto.
#
# Não guarda nem digita senha: os logins (GitHub, Firebase, Google Drive, SIEG, Claude) a pessoa faz na tela.
# Não liga o robô: os dois (o do PC e o do servidor) nunca podem rodar juntos (a trava, arquivador.lock, é por máquina).
# Com tudo "ok": desliga-se o do PC, copiam-se os dados dele (o "O que vem do PC" abaixo) e só então, aqui:
#   Enable-ScheduledTask 'nads - robo do arquivador'; Start-ScheduledTask 'nads - robo do arquivador'
param([switch]$SoConferir)
$ErrorActionPreference = 'Stop'
# o PATH desta janela pode ser de antes do Node e do Git instalados (03/11/2026: "FALTA Node" logo depois de instalar)
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')

$CODIGO = 'D:\nads'
$ROBO = Join-Path $CODIGO 'robo'
$DADOS = 'D:\nads-dados'                  # NADS_LOCAL: o controle do arquivador novo e o perfil do Chrome do SIEG
$ROTINA = Join-Path $DADOS 'rotina'       # ARQUIVO_RAIZ: a planilha do cadastro e o manifesto da rotina antiga
$TAREFA = 'nads - robo do arquivador'
$falta = @()

function Ok($t) { Write-Host ('  ok    ' + $t) -ForegroundColor Green }
function Falta($t, $como) { Write-Host ('  FALTA ' + $t + ' -> ' + $como) -ForegroundColor Yellow; $script:falta += $t }

Write-Host "`nProgramas"
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node -and ([version]((node -v).TrimStart('v')) -ge [version]'22.0')) { Ok ('Node ' + (node -v)) }
else { Falta 'Node 22 ou mais novo' 'https://nodejs.org (o instalador "LTS" para Windows, 64 bits)' }
if (Get-Command git -ErrorAction SilentlyContinue) { Ok (git --version) }
else { Falta 'Git' 'https://git-scm.com/download/win' }
if (Test-Path 'C:\Program Files\Google\Chrome\Application\chrome.exe') { Ok 'Chrome' }
else { Falta 'Chrome' 'https://www.google.com/chrome (o SIEG pelo portal abre o Chrome do robô)' }
if (Test-Path 'C:\Program Files\WinRAR\UnRAR.exe') { Ok 'WinRAR (UnRAR)' }
else { Falta 'WinRAR' 'https://www.win-rar.com (o arquivador abre os .rar dos clientes)' }
if (Test-Path 'G:\Meu Drive') { Ok 'Google Drive em G:\Meu Drive' }
else { Falta 'Google Drive em G:\Meu Drive' 'https://www.google.com/drive/download, entrar com a conta do escritório, letra G:, modo "Transmitir arquivos" e o cache no D: (Preferências > engrenagem > Local do cache)' }
$claude = Join-Path $env:USERPROFILE '.local\bin\claude.exe'
if (Test-Path $claude) { Ok 'Claude Code (o [suporte] e o atendente do robô)' }
else { Write-Host '  aviso Claude Code não instalado: o robô roda, só sem o [suporte] e o atendente de IA (https://claude.com/claude-code)' -ForegroundColor DarkYellow }

Write-Host "`nCódigo em $CODIGO"
if (Test-Path (Join-Path $ROBO 'arquivador.js')) {
  if (-not $SoConferir) { git -C $CODIGO pull --ff-only origin desenvolvimento }
  Ok ('código (' + (git -C $CODIGO log -1 --format='%h %cd' --date=short) + ')')
}
elseif ($SoConferir) { Falta 'código' 'rode sem -SoConferir para clonar' }
elseif (Get-Command git -ErrorAction SilentlyContinue) {
  # pede o login do GitHub na tela (o repositório é particular)
  git clone -b desenvolvimento https://github.com/nilmaadvancedsystems/nads.git $CODIGO
  if (Test-Path (Join-Path $ROBO 'arquivador.js')) { Ok 'código clonado (desenvolvimento)' } else { Falta 'código' 'o git clone não terminou (login do GitHub?)' }
}
else { Falta 'código' 'instale o Git e rode de novo' }
# o .package-lock.json só aparece com o npm ci terminado (03/11/2026: um npm ci interrompido deixou a pasta node_modules
# pela metade, "Cannot find module 'puppeteer-core'", e a conferência só via a pasta)
$instalado = Join-Path $ROBO 'node_modules\.package-lock.json'
if ((Test-Path (Join-Path $ROBO 'package.json')) -and -not (Test-Path $instalado)) {
  if ($SoConferir) { Falta 'dependências do robô' 'rode sem -SoConferir' }
  elseif ($node) { Push-Location $ROBO; try { npm.cmd ci --omit=dev } finally { Pop-Location } }
}
if (Test-Path $instalado) { Ok 'dependências do robô' } elseif (Test-Path (Join-Path $ROBO 'package.json')) { Falta 'dependências do robô' "cd $ROBO; npm.cmd ci --omit=dev (até aparecer 'added ... packages')" }

Write-Host "`nPastas de dados no D:"
foreach ($p in @($DADOS, $ROTINA)) { if (-not (Test-Path $p)) { if (-not $SoConferir) { New-Item -ItemType Directory -Force $p | Out-Null } } }
if (-not $SoConferir) {
  [Environment]::SetEnvironmentVariable('NADS_LOCAL', $DADOS, 'User')
  [Environment]::SetEnvironmentVariable('ARQUIVO_RAIZ', $ROTINA, 'User')
  # o FGTS, o Alterdata, o atendente de IA e o suporte ficam no PC do escritório (robo/claude-do-pc.js)
  [Environment]::SetEnvironmentVariable('ARQ_SO_SERVIDOR', '1', 'User')
}
if ([Environment]::GetEnvironmentVariable('ARQ_SO_SERVIDOR', 'User') -eq '1') { Ok 'ARQ_SO_SERVIDOR = 1 (FGTS, Alterdata, IA e suporte ficam no PC)' } else { Falta 'ARQ_SO_SERVIDOR' 'rode sem -SoConferir' }
if ([Environment]::GetEnvironmentVariable('NADS_LOCAL', 'User') -eq $DADOS) { Ok "NADS_LOCAL = $DADOS" } else { Falta 'NADS_LOCAL' 'rode sem -SoConferir' }
if ([Environment]::GetEnvironmentVariable('ARQUIVO_RAIZ', 'User') -eq $ROTINA) { Ok "ARQUIVO_RAIZ = $ROTINA" } else { Falta 'ARQUIVO_RAIZ' 'rode sem -SoConferir' }

Write-Host "`nO que vem do PC (copiado na virada, com o robô de lá desligado)"
$doPc = @(
  @{ c = (Join-Path $DADOS 'arquivador-novo\config.json'); o = 'o config do arquivador novo (modo produção) e o manifesto/índices dele' },
  @{ c = (Join-Path $ROTINA 'necessario para o claude\dados agentes\cadastro_empresas_unificado.xlsx'); o = 'a planilha do cadastro' },
  @{ c = (Join-Path $ROBO 'sieg_credenciais.json'); o = 'as credenciais da API do SIEG' },
  @{ c = (Join-Path $ROBO 'gmail_token.json'); o = 'o login do Gmail do robô' }
)
foreach ($i in $doPc) { if (Test-Path $i.c) { Ok $i.o } else { Falta $i.o 'copiado do PC na virada' } }

Write-Host "`nLogins (a pessoa faz na tela, uma vez)"
if (Test-Path (Join-Path $env:USERPROFILE '.config\configstore\firebase-tools.json')) { Ok 'Firebase' }
else { Falta 'login do Firebase' 'npm install -g firebase-tools; depois: firebase login (conta sistemasnilma)' }
if (Test-Path (Join-Path $DADOS 'robo\sieg-perfil')) { Ok 'SIEG no Chrome do robô' }
else { Falta 'login do SIEG no Chrome do robô' "cd $ROBO; node sieg-portal.js entrar (entre no SIEG e feche a janela)" }

Write-Host "`nPartida"
if (-not $SoConferir -and (Test-Path (Join-Path $ROBO 'iniciar-arquivador-oculto.vbs'))) {
  # ao entrar o usuário (o G: só existe com a sessão aberta), sem janela e com prioridade abaixo do normal (7): o SCI e o
  # Alterdata sempre passam na frente. Fica DESLIGADA até a virada.
  $acao = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('"' + (Join-Path $ROBO 'iniciar-arquivador-oculto.vbs') + '"') -WorkingDirectory $ROBO
  $quando = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
  $jeito = New-ScheduledTaskSettingsSet -Priority 7 -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -StartWhenAvailable
  Register-ScheduledTask -TaskName $TAREFA -Action $acao -Trigger $quando -Settings $jeito -Force | Out-Null
  Disable-ScheduledTask -TaskName $TAREFA | Out-Null
}
$t = Get-ScheduledTask -TaskName $TAREFA -ErrorAction SilentlyContinue
if ($t) { Ok ("tarefa '$TAREFA' criada (" + $t.State + ')') } else { Falta 'tarefa de partida' 'rode sem -SoConferir' }

Write-Host ''
if ($falta.Count) { Write-Host ('Falta: ' + ($falta -join '; ')) -ForegroundColor Yellow; Write-Host 'Resolva e rode de novo.' }
else { Write-Host 'Tudo pronto. Na virada: desligar o robô do PC, e aqui: Enable-ScheduledTask / Start-ScheduledTask.' -ForegroundColor Green }
