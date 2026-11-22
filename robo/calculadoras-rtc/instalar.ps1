# As calculadoras da Reforma Tributária da Receita Federal no PC do servidor (21/11/2026; ver LEIAME.md ao lado).
#
#   powershell -ExecutionPolicy Bypass -File robo\calculadoras-rtc\instalar.ps1            instala (ou atualiza) e mede
#   powershell -ExecutionPolicy Bypass -File robo\calculadoras-rtc\instalar.ps1 -Registrar  e liga junto com o Windows
#
# O que faz, na pasta D:\nads-rtc (C:\nads-rtc no PC sem o disco D:; fora do repositório: o Java, os bancos e os .jar não vão para o git):
#   1. baixa o Java 25 (Temurin, da Eclipse Adoptium) em jdk\, se ainda não tem;
#   2. baixa o código das duas calculadoras na versão marcada abaixo (git clone --branch), gera o banco SQLite
#      (flyway:migrate) e o .jar (package, sem os testes);
#   3. liga as duas pelo ligar.ps1, só para este PC (127.0.0.1): o regime regular na 18080 e o Simples na 18082, com 256 MB
#      no máximo cada, cada uma com o seu registro (<pasta>\<nome>.log);
#   4. confere se respondem e mostra a memória de cada uma;
#   5. com -Registrar, cria a tarefa agendada "nads-calculadoras-rtc", que liga as duas quando o Windows liga.
# Pode rodar quantas vezes for: o que já está feito fica como está. Para trocar de versão, mude as versões abaixo.
param(
  # no servidor, o disco D: (onde já ficam D:\nads e D:\nads-dados); sem D:, o C:
  [string]$Pasta = $(if (Test-Path 'D:\') { 'D:\nads-rtc' } else { 'C:\nads-rtc' }),
  [switch]$Registrar
)
$ErrorActionPreference = 'Stop'

# Os programas de fora (git, java, mvnw) escrevem avisos na saída de erro ("Note: switching to...", os WARNING do Maven).
# Rodando pelo robô (sem console), o PowerShell 5.1 transforma cada linha dessas em erro e, com o Stop acima, parava a
# instalação no meio (21/11/2026, no servidor: "código 1 — RemoteException"). Aqui a saída de erro vira texto e quem
# decide se deu certo é o código de saída ($LASTEXITCODE), conferido depois de cada chamada.
function Nativo {
  param([string]$Exe, [string[]]$Argumentos)
  $ErrorActionPreference = 'Continue'
  & $Exe @Argumentos 2>&1 | ForEach-Object {
    $t = if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.Exception.Message } else { "$_" }
    if ($t -and $t.Trim() -and $t -ne 'System.Management.Automation.RemoteException') { Write-Host $t }
  }
}

# As versões da Receita (as tags dos repositórios). Conferidas em 21/11/2026.
$Calculadoras = @(
  @{ Nome = 'regime-regular';   Repo = 'https://github.com/ReceitaFederal/calculadora-rtc-regime-regular.git';   Versao = '1.7.2'; Jar = 'api-regime-geral.jar';    Porta = 18080; Metricas = 19101 },
  @{ Nome = 'simples-nacional'; Repo = 'https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional.git'; Versao = '1.0.2'; Jar = 'api-simples-nacional.jar'; Porta = 18082; Metricas = 19103 }
)
# o git: o do PATH ou o do servidor (D:\Programas\Git, o mesmo do robo\servidor\atualizar-robo.cmd)
$Git = (Get-Command git -ErrorAction SilentlyContinue).Source
if (-not $Git) { $Git = 'D:\Programas\Git\cmd\git.exe' }
if (-not (Test-Path $Git)) { throw 'não achei o git (nem no PATH nem em D:\Programas\Git)' }
$Jdk = Join-Path $Pasta 'jdk'
$Java = Join-Path $Jdk 'bin\java.exe'
New-Item -ItemType Directory -Force $Pasta | Out-Null

# 1. o Java 25
if (-not (Test-Path $Java)) {
  Write-Host 'Baixando o Java 25 (Temurin)...'
  $zip = Join-Path $Pasta 'jdk.zip'
  Invoke-WebRequest -UseBasicParsing 'https://api.adoptium.net/v3/binary/latest/25/ga/windows/x64/jdk/hotspot/normal/eclipse' -OutFile $zip
  $tmp = Join-Path $Pasta 'jdk-tmp'
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  Expand-Archive $zip $tmp
  Move-Item (Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName $Jdk
  Remove-Item -Recurse -Force $tmp, $zip
}
$env:JAVA_HOME = $Jdk
Nativo $Java @('-version')
if ($LASTEXITCODE) { throw "o Java em $Jdk não abriu" }

# 2. o código, o banco e o .jar de cada uma
foreach ($c in $Calculadoras) {
  $dir = Join-Path $Pasta $c.Nome
  $marca = Join-Path $dir '.versao-instalada'
  if ((Test-Path $marca) -and ((Get-Content $marca -Raw).Trim() -eq $c.Versao) -and (Test-Path (Join-Path $dir "target\$($c.Jar)"))) {
    Write-Host "$($c.Nome) $($c.Versao) já instalada."
    continue
  }
  Write-Host "Instalando $($c.Nome) $($c.Versao)..."
  # rmdir com \\?\: o Remove-Item do PowerShell 5.1 não apaga caminhos de mais de 260 caracteres
  if (Test-Path $dir) { cmd.exe /c "rmdir /s /q `"\\?\$dir`"" }
  # core.longpaths: os testes da Receita têm caminhos de mais de 260 caracteres (o git do Windows recusa sem isso)
  Nativo $Git @('-c', 'core.longpaths=true', '-c', 'advice.detachedHead=false', 'clone', '--quiet', '--depth', '1', '--branch', $c.Versao, $c.Repo, $dir)
  if ($LASTEXITCODE) { throw "git clone de $($c.Nome) falhou" }
  # o Simples usa o mesmo banco do regime regular: a pasta flyway vem de lá (README do Simples)
  if (-not (Test-Path (Join-Path $dir 'flyway'))) { Copy-Item -Recurse (Join-Path $Pasta 'regime-regular\flyway') (Join-Path $dir 'flyway') }
  Push-Location $dir
  try {
    New-Item -ItemType Directory -Force 'calculadora\db' | Out-Null
    Nativo '.\mvnw.cmd' @('--batch-mode', '--quiet', 'flyway:migrate', '-Dflyway.configFiles=flyway\flyway-pro.conf')
    if ($LASTEXITCODE) { throw "o banco de $($c.Nome) não foi gerado" }
    Nativo '.\mvnw.cmd' @('--batch-mode', '--quiet', 'clean', 'package', '-DskipTests')
    if ($LASTEXITCODE) { throw "o .jar de $($c.Nome) não foi gerado" }
  } finally { Pop-Location }
  Set-Content -Encoding ascii $marca $c.Versao
}

# 3. liga cada uma que está fora do ar (o ligar.ps1 ao lado: também o que a tarefa agendada chama) e confere
$ligar = Join-Path $PSScriptRoot 'ligar.ps1'
Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $Pasta 'iniciar.cmd')   # o de antes de 21/11/2026 à noite
& $ligar -Pasta $Pasta
$todasNoAr = ($LASTEXITCODE -eq 0)

# 4. a memória de cada uma e a livre no PC
Start-Sleep 10
Get-CimInstance Win32_Process -Filter "Name = 'java.exe'" | Where-Object { $_.CommandLine -match 'target\\api-(regime-geral|simples-nacional)\.jar' } | ForEach-Object {
  $p = Get-Process -Id $_.ProcessId
  $jar = if ($_.CommandLine -match 'target\\(\S+\.jar)') { $Matches[1] } else { '?' }
  Write-Host ("Memória de {0}: {1:N0} MB (pico {2:N0} MB)" -f $jar, ($p.WorkingSet64 / 1MB), ($p.PeakWorkingSet64 / 1MB))
}
$livre = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1KB
Write-Host ("Memória livre no PC agora: {0:N0} MB" -f $livre)

# 5. junto com o Windows (precisa de administrador)
if ($Registrar) {
  $acao = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ligar`" -Pasta `"$Pasta`""
  $quando = New-ScheduledTaskTrigger -AtStartup
  Register-ScheduledTask -TaskName 'nads-calculadoras-rtc' -Action $acao -Trigger $quando -RunLevel Limited -Force | Out-Null
  Write-Host 'Tarefa agendada nads-calculadoras-rtc criada (liga as calculadoras quando o Windows liga).'
}
if (-not $todasNoAr) { exit 1 }
