# Liga as calculadoras da Receita que estão fora do ar, só para este PC (21/11/2026; ver LEIAME.md ao lado). Quem chama:
# o instalar.ps1 (no fim da instalação) e a tarefa agendada nads-calculadoras-rtc (quando o Windows liga).
#
#   powershell -ExecutionPolicy Bypass -File robo\calculadoras-rtc\ligar.ps1 [-Pasta D:\nads-rtc]
#
# Cada uma liga sozinha (a que já responde fica como está) e escreve o que acontece em <pasta>\<nome>.log e
# <pasta>\<nome>.erro.log: se uma cair, o motivo fica lá. Devolve 0 quando as duas respondem.
param(
  [string]$Pasta = $(if (Test-Path 'D:\') { 'D:\nads-rtc' } else { 'C:\nads-rtc' }),
  [int]$EsperaSegundos = 180
)
$ErrorActionPreference = 'Stop'

$Java = Join-Path $Pasta 'jdk\bin\java.exe'
if (-not (Test-Path $Java)) { Write-Host "Sem o Java em $Pasta\jdk: rode o instalar.ps1 antes."; exit 2 }
$Calculadoras = @(
  @{ Nome = 'regime-regular';   Jar = 'api-regime-geral.jar';     Porta = 8080; Rota = '/calculadora/dados-abertos/versao' },
  @{ Nome = 'simples-nacional'; Jar = 'api-simples-nacional.jar'; Porta = 8082; Rota = '/versao' }
)

function NoAr($c) { try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 "http://127.0.0.1:$($c.Porta)/api$($c.Rota)").StatusCode -eq 200 } catch { $false } }

$ligadas = @()
foreach ($c in $Calculadoras) {
  $dir = Join-Path $Pasta $c.Nome
  if (-not (Test-Path (Join-Path $dir "target\$($c.Jar)"))) { Write-Host "$($c.Nome): não instalada em $dir"; continue }
  if (NoAr $c) { Write-Host "$($c.Nome): já no ar em 127.0.0.1:$($c.Porta)"; continue }
  # se ficou um processo velho dela que não responde, sai antes (senão a porta fica presa)
  Get-CimInstance Win32_Process -Filter "Name = 'java.exe'" | Where-Object { $_.CommandLine -like "*target\$($c.Jar)*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  $argumentos = @('-Xms32m', '-Xmx256m', '-XX:+UseSerialGC', '-XX:TieredStopAtLevel=1', '--enable-native-access=ALL-UNNAMED',
    '-Dspring.profiles.active=offline', '-Dserver.address=127.0.0.1', '-Dmanagement.server.address=127.0.0.1', '-jar', "target\$($c.Jar)")
  Start-Process -FilePath $Java -ArgumentList $argumentos -WorkingDirectory $dir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $Pasta "$($c.Nome).log") -RedirectStandardError (Join-Path $Pasta "$($c.Nome).erro.log") | Out-Null
  $ligadas += $c
}

$todas = $true
foreach ($c in $Calculadoras) {
  if (-not (Test-Path (Join-Path $Pasta "$($c.Nome)\target\$($c.Jar)"))) { $todas = $false; continue }
  $ok = NoAr $c
  for ($i = 0; $i -lt ($EsperaSegundos / 3) -and -not $ok; $i++) { Start-Sleep 3; $ok = NoAr $c }
  if ($ok) { if ($ligadas -contains $c) { Write-Host "$($c.Nome): no ar em 127.0.0.1:$($c.Porta)" } }
  else {
    $todas = $false
    $fim = @(Get-Content (Join-Path $Pasta "$($c.Nome).log") -Tail 3 -ErrorAction SilentlyContinue) + @(Get-Content (Join-Path $Pasta "$($c.Nome).erro.log") -Tail 3 -ErrorAction SilentlyContinue)
    Write-Host ("{0}: NÃO respondeu em {1} s. Fim do registro: {2}" -f $c.Nome, $EsperaSegundos, (($fim | Where-Object { $_ }) -join ' | '))
  }
}
exit $(if ($todas) { 0 } else { 1 })
