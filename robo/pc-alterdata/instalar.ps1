# Instala o robô dos relatórios do Alterdata NESTE PC Windows (16/11/2026). O mesmo robô do servidor: balancete, razão,
# importação de lançamentos e as notas do Alterdata Fiscal, usando o Contábil e o Fiscal que ficam ABERTOS E LOGADOS aqui.
#
# Rodar no PowerShell deste PC (o usuário que fica logado no Alterdata, não precisa ser administrador):
#   Set-ExecutionPolicy -Scope Process Bypass; .\instalar.ps1
# ou, antes de ter o código aqui, baixando só este arquivo do GitHub (ver LEIAME.md).
#
# O que faz: instala o Git, o Node e o Python se faltarem (winget); baixa o código em C:\nads (do GitHub, público);
# instala as dependências do robô e o pywinauto; pede o "firebase login" (a conta do escritório, uma vez); cria o
# atalho na pasta Inicializar e liga o robô. Pode rodar de novo quantas vezes quiser: só faz o que falta.
param([string]$Pasta = 'C:\nads')
$ErrorActionPreference = 'Stop'

function Tem($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Passo($t) { Write-Host "`n== $t" -ForegroundColor Cyan }
function Recarregar() { $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') }
function Instalar($id) {
  if (-not (Tem winget)) { throw "Falta o winget para instalar $id. Instale o 'Instalador de Aplicativo' pela Microsoft Store e rode de novo." }
  winget install --id $id -e --silent --accept-source-agreements --accept-package-agreements
  Recarregar
}

Passo 'Programas (Git, Node, Python)'
if (-not (Tem git)) { Instalar 'Git.Git' } else { Write-Host 'Git: ok' }
if (-not (Tem node)) { Instalar 'OpenJS.NodeJS.LTS' } else { Write-Host ('Node: ' + (node --version)) }
# o Python: o do PATH, o do lançador "py", ou o instalado para todos (Program Files, o PowerShell como Administrador) ou só
# para o usuário (AppData). O "python" da Microsoft Store (WindowsApps) não serve: não devolve o caminho.
function AcharPython() {
  foreach ($c in @('py', 'python')) {
    if (Tem $c) {
      try {
        $x = if ($c -eq 'py') { & py -3 -c "import sys; print(sys.executable)" 2>$null } else { & python -c "import sys; print(sys.executable)" 2>$null }
        if ($x -and (Test-Path $x) -and ($x -notmatch 'WindowsApps')) { return $x }
      } catch { }
    }
  }
  $achados = @(Get-ChildItem -Path @("$env:ProgramFiles\Python3*\python.exe", "$env:LOCALAPPDATA\Programs\Python\Python3*\python.exe") -ErrorAction SilentlyContinue | Sort-Object FullName -Descending)
  if ($achados.Count) { return $achados[0].FullName }
  return $null
}
$py = AcharPython
if (-not $py) {
  if (Tem winget) {
    Write-Host 'instalando o Python 3.12 pelo winget...'
    winget install --id Python.Python.3.12 -e --silent --accept-source-agreements --accept-package-agreements
    Recarregar
    $py = AcharPython
  }
}
if (-not $py) {
  # sem o winget (ou ele não instalou): o instalador oficial do python.org, sem perguntas, com o "py" e no PATH
  Write-Host 'baixando o instalador oficial do Python (python.org)...'
  $exe = Join-Path $env:TEMP 'python-3.12.10-amd64.exe'
  Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe' -OutFile $exe -UseBasicParsing
  Start-Process -FilePath $exe -ArgumentList '/quiet', 'InstallAllUsers=0', 'PrependPath=1', 'Include_launcher=1', 'Include_test=0' -Wait
  Recarregar
  $py = AcharPython
}
if (-not $py) { throw 'Não consegui instalar o Python. Instale pelo python.org (marque "Add python.exe to PATH") e rode este instalador de novo.' }
Write-Host "Python: $py"

Passo "Código do nads em $Pasta"
if (-not (Test-Path (Join-Path $Pasta '.git'))) {
  git clone --branch desenvolvimento https://github.com/nilmaadvancedsystems/nads.git $Pasta
} else {
  git -C $Pasta pull --ff-only origin desenvolvimento
}
$robo = Join-Path $Pasta 'robo'

Passo 'Dependências do robô'
Push-Location $robo
try { npm ci --omit=dev } finally { Pop-Location }
& $py -m pip install --upgrade --quiet pywinauto pywin32
[Environment]::SetEnvironmentVariable('PYTHON_EXE', $py, 'User')
$env:PYTHON_EXE = $py
Write-Host 'pywinauto e pywin32: ok'

Passo 'Login do banco (firebase login, a conta do escritório)'
if (Test-Path (Join-Path $env:USERPROFILE '.config\configstore\firebase-tools.json')) {
  Write-Host 'já feito'
} else {
  npm install -g firebase-tools
  Recarregar
  firebase login
}

Passo 'Partida com o Windows'
$vbs = Join-Path $robo 'pc-alterdata\iniciar-oculto.vbs'
$atalho = Join-Path ([Environment]::GetFolderPath('Startup')) 'nads-alterdata.lnk'
$ws = New-Object -ComObject WScript.Shell
$l = $ws.CreateShortcut($atalho)
$l.TargetPath = 'wscript.exe'
$l.Arguments = '"' + $vbs + '"'
$l.WorkingDirectory = $robo
$l.Save()
Write-Host "atalho: $atalho"

Passo 'Ligando o robô agora'
Start-Process wscript.exe -ArgumentList ('"' + $vbs + '"')
Start-Sleep -Seconds 20
$log = Join-Path $robo 'alterdata-no-pc.log'
if (Test-Path $log) { Get-Content $log -Tail 8 }
Write-Host "`nPronto. Deixe o Alterdata Contábil e o Fiscal abertos e logados, e a tela destravada (o robô usa o mouse)." -ForegroundColor Green
Write-Host "Registro do robô: $log"
