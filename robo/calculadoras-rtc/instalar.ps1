# As calculadoras da Reforma Tributária da Receita Federal no PC do servidor (21/11/2026; ver LEIAME.md ao lado).
#
#   powershell -ExecutionPolicy Bypass -File robo\calculadoras-rtc\instalar.ps1            instala (ou atualiza) e mede
#   powershell -ExecutionPolicy Bypass -File robo\calculadoras-rtc\instalar.ps1 -Registrar  e liga junto com o Windows
#
# O que faz, na pasta D:\nads-rtc (C:\nads-rtc no PC sem o disco D:; fora do repositório: o Java, os bancos e os .jar não vão para o git):
#   1. baixa o Java 25 (Temurin, da Eclipse Adoptium) em jdk\, se ainda não tem;
#   2. baixa o código das duas calculadoras na versão marcada abaixo (git clone --branch), gera o banco SQLite
#      (flyway:migrate) e o .jar (package, sem os testes);
#   3. liga as duas, só para este PC (127.0.0.1): o regime regular na 8080 e o Simples na 8082, com 256 MB no máximo cada;
#   4. confere se respondem e mostra a memória de cada uma;
#   5. com -Registrar, cria a tarefa agendada "nads-calculadoras-rtc", que liga as duas quando o Windows liga.
# Pode rodar quantas vezes for: o que já está feito fica como está. Para trocar de versão, mude as versões abaixo.
param(
  # no servidor, o disco D: (onde já ficam D:\nads e D:\nads-dados); sem D:, o C:
  [string]$Pasta = $(if (Test-Path 'D:\') { 'D:\nads-rtc' } else { 'C:\nads-rtc' }),
  [switch]$Registrar
)
$ErrorActionPreference = 'Stop'

# As versões da Receita (as tags dos repositórios). Conferidas em 21/11/2026.
$Calculadoras = @(
  @{ Nome = 'regime-regular';   Repo = 'https://github.com/ReceitaFederal/calculadora-rtc-regime-regular.git';   Versao = '1.7.2'; Jar = 'api-regime-geral.jar';    Porta = 8080; Metricas = 9101 },
  @{ Nome = 'simples-nacional'; Repo = 'https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional.git'; Versao = '1.0.2'; Jar = 'api-simples-nacional.jar'; Porta = 8082; Metricas = 9103 }
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
& $Java -version

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
  & $Git -c core.longpaths=true clone --quiet --depth 1 --branch $c.Versao $c.Repo $dir
  if ($LASTEXITCODE) { throw "git clone de $($c.Nome) falhou" }
  # o Simples usa o mesmo banco do regime regular: a pasta flyway vem de lá (README do Simples)
  if (-not (Test-Path (Join-Path $dir 'flyway'))) { Copy-Item -Recurse (Join-Path $Pasta 'regime-regular\flyway') (Join-Path $dir 'flyway') }
  Push-Location $dir
  try {
    New-Item -ItemType Directory -Force 'calculadora\db' | Out-Null
    & .\mvnw.cmd --batch-mode --quiet flyway:migrate '-Dflyway.configFiles=flyway\flyway-pro.conf'
    if ($LASTEXITCODE) { throw "o banco de $($c.Nome) não foi gerado" }
    & .\mvnw.cmd --batch-mode --quiet clean package -DskipTests
    if ($LASTEXITCODE) { throw "o .jar de $($c.Nome) não foi gerado" }
  } finally { Pop-Location }
  Set-Content -Encoding ascii $marca $c.Versao
}

# 3. o iniciar.cmd (o que a tarefa agendada chama): as duas, só para este PC
$linhas = @('@echo off', 'rem Gerado por robo\calculadoras-rtc\instalar.ps1. Liga as calculadoras da Receita, so para este PC.')
foreach ($c in $Calculadoras) {
  $dir = Join-Path $Pasta $c.Nome
  $linhas += "start `"rtc-$($c.Nome)`" /min /d `"$dir`" `"$Java`" -Xms32m -Xmx256m -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Dspring.profiles.active=offline -Dserver.address=127.0.0.1 -Dmanagement.server.address=127.0.0.1 -jar target\$($c.Jar)"
}
$iniciar = Join-Path $Pasta 'iniciar.cmd'
Set-Content -Encoding ascii $iniciar $linhas

# 4. liga (se ainda não está no ar), confere e mede
function NoAr($porta, $rota) { try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 "http://127.0.0.1:$porta/api$rota").StatusCode -eq 200 } catch { $false } }
$rotas = @{ 8080 = '/calculadora/dados-abertos/versao'; 8082 = '/versao' }
if (-not ($Calculadoras | Where-Object { NoAr $_.Porta $rotas[$_.Porta] })) { Start-Process -WindowStyle Hidden cmd.exe "/c `"$iniciar`"" }
foreach ($c in $Calculadoras) {
  $ok = $false
  for ($i = 0; $i -lt 60 -and -not $ok; $i++) { Start-Sleep 2; $ok = NoAr $c.Porta $rotas[$c.Porta] }
  Write-Host ("{0}: {1}" -f $c.Nome, $(if ($ok) { "no ar em 127.0.0.1:$($c.Porta)" } else { 'NÃO respondeu em 2 minutos' }))
}
Start-Sleep 10
Get-CimInstance Win32_Process -Filter "Name = 'java.exe'" | Where-Object { $_.CommandLine -like '*-Dspring.profiles.active=offline*' } | ForEach-Object {
  $p = Get-Process -Id $_.ProcessId
  $jar = if ($_.CommandLine -match 'target\\(\S+\.jar)') { $Matches[1] } else { '?' }
  Write-Host ("Memória de {0}: {1:N0} MB (pico {2:N0} MB)" -f $jar, ($p.WorkingSet64 / 1MB), ($p.PeakWorkingSet64 / 1MB))
}
$livre = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1KB
Write-Host ("Memória livre no PC agora: {0:N0} MB" -f $livre)

# 5. junto com o Windows
if ($Registrar) {
  $acao = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$iniciar`""
  $quando = New-ScheduledTaskTrigger -AtStartup
  Register-ScheduledTask -TaskName 'nads-calculadoras-rtc' -Action $acao -Trigger $quando -RunLevel Limited -Force | Out-Null
  Write-Host 'Tarefa agendada nads-calculadoras-rtc criada (liga as calculadoras quando o Windows liga).'
}
