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
# As portas: 18080/18082 e as das métricas 19101/19103, não as 8080/8082/9101/9103 da Receita (22/11/2026: no servidor
# o regime regular não subiu na 8080, a porta mais usada por outros programas)
$Calculadoras = @(
  @{ Nome = 'regime-regular';   Jar = 'api-regime-geral.jar';     Porta = 18080; Metricas = 19101; Rota = '/calculadora/dados-abertos/versao' },
  @{ Nome = 'simples-nacional'; Jar = 'api-simples-nacional.jar'; Porta = 18082; Metricas = 19103; Rota = '/versao' }
)

function NoAr($c) { try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 "http://127.0.0.1:$($c.Porta)/api$($c.Rota)").StatusCode -eq 200 } catch { $false } }
# quem está ouvindo numa porta ('' = livre; sem o Get-NetTCPConnection, não se sabe e segue)
function QuemUsa([int]$porta) {
  try {
    $con = Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction Stop | Select-Object -First 1
    $p = Get-Process -Id $con.OwningProcess -ErrorAction SilentlyContinue
    return ('{0} (pid {1})' -f $(if ($p) { $p.ProcessName } else { '?' }), $con.OwningProcess)
  } catch { return '' }
}

$ligadas = @()
$ocupadas = @{}
foreach ($c in $Calculadoras) {
  $dir = Join-Path $Pasta $c.Nome
  if (-not (Test-Path (Join-Path $dir "target\$($c.Jar)"))) { Write-Host "$($c.Nome): não instalada em $dir"; continue }
  if (NoAr $c) { Write-Host "$($c.Nome): já no ar em 127.0.0.1:$($c.Porta)"; continue }
  # se ficou um processo velho dela que não responde (ou o de antes, noutra porta), sai antes (senão a porta fica presa)
  Get-CimInstance Win32_Process -Filter "Name = 'java.exe'" | Where-Object { $_.CommandLine -like "*target\$($c.Jar)*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep 1
  # a porta ocupada por outro programa: diz qual e não tenta (a calculadora cairia na partida)
  $quem = @($c.Porta, $c.Metricas) | ForEach-Object { $u = QuemUsa $_; if ($u) { "porta $_ ocupada por $u" } }
  if ($quem) { $ocupadas[$c.Nome] = ($quem -join '; '); continue }
  $argumentos = @('-Xms32m', '-Xmx256m', '-XX:+UseSerialGC', '-XX:TieredStopAtLevel=1', '--enable-native-access=ALL-UNNAMED',
    '-Dspring.profiles.active=offline', "-Dserver.port=$($c.Porta)", "-Dmanagement.server.port=$($c.Metricas)",
    '-Dserver.address=127.0.0.1', '-Dmanagement.server.address=127.0.0.1', '-jar', "target\$($c.Jar)")
  Start-Process -FilePath $Java -ArgumentList $argumentos -WorkingDirectory $dir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $Pasta "$($c.Nome).log") -RedirectStandardError (Join-Path $Pasta "$($c.Nome).erro.log") | Out-Null
  $ligadas += $c
}

$todas = $true
foreach ($c in $Calculadoras) {
  if (-not (Test-Path (Join-Path $Pasta "$($c.Nome)\target\$($c.Jar)"))) { $todas = $false; continue }
  if ($ocupadas.ContainsKey($c.Nome)) { $todas = $false; Write-Host "$($c.Nome): NÃO ligou: $($ocupadas[$c.Nome])"; continue }
  $ok = NoAr $c
  for ($i = 0; $i -lt ($EsperaSegundos / 3) -and -not $ok; $i++) { Start-Sleep 3; $ok = NoAr $c }
  if ($ok) { if ($ligadas -contains $c) { Write-Host "$($c.Nome): no ar em 127.0.0.1:$($c.Porta)" } }
  else {
    $todas = $false
    # o motivo: as linhas de erro do registro dela (o Spring escreve "APPLICATION FAILED TO START", "already in use"...) e
    # o fim da saída de erro
    $erros = @(Select-String -Path (Join-Path $Pasta "$($c.Nome).log") -Pattern 'FAILED|ERROR|Exception|already in use|Description:|Reason:' -ErrorAction SilentlyContinue | Select-Object -Last 3 | ForEach-Object { $_.Line.Trim() })
    $fim = $erros + @(Get-Content (Join-Path $Pasta "$($c.Nome).erro.log") -Tail 2 -ErrorAction SilentlyContinue)
    Write-Host ("{0}: NÃO respondeu em {1} s. Fim do registro: {2}" -f $c.Nome, $EsperaSegundos, (($fim | Where-Object { $_ }) -join ' | '))
  }
}
exit $(if ($todas) { 0 } else { 1 })
