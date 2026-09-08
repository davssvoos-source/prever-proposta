<#
.SYNOPSIS
  Atualiza o Prever instalado neste servidor com um pacote novo (R220, U118).

.DESCRIPTION
  Para o serviço, troca a pasta `app\` pela do pacote novo (a que está ao lado
  deste script, ou a indicada em -Pacote), preserva o `config.env` e sobe de
  novo. Não mexe na porta, na URL nem nas chaves — para isso, edite o
  config.env e reinicie o serviço, ou rode o instalador de novo.

.EXAMPLE
  .\atualizar.ps1
  .\atualizar.ps1 -Pacote "C:\Downloads\Prever-1.2.0"
#>
[CmdletBinding()]
param([string] $Pacote = "")

$ErrorActionPreference = "Stop"
$NOME_SERVICO = "PreverSistema"
$pasta = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent ([System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName) }
if (-not $Pacote) { $Pacote = $pasta }
$appNovo = Join-Path $Pacote "app"
if (-not (Test-Path (Join-Path $appNovo "server\index.mjs"))) { Write-Host "ERRO: não achei a pasta app\ do pacote novo em $Pacote" -ForegroundColor Red; exit 1 }
if (-not (Test-Path (Join-Path $pasta "config.env"))) { Write-Host "ERRO: este script tem de rodar na pasta onde o Prever está instalado (com o config.env)." -ForegroundColor Red; exit 1 }

Write-Host "Parando o serviço…"
Stop-Service -Name $NOME_SERVICO -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "Trocando o build…"
& robocopy $appNovo (Join-Path $pasta "app") /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { Write-Host "ERRO: a cópia falhou (robocopy $LASTEXITCODE)" -ForegroundColor Red; exit 1 }
foreach ($f in @("iniciar.mjs", "desinstalar.ps1", "atualizar.ps1")) {
  $src = Join-Path $Pacote $f
  if ((Test-Path $src) -and ($src -ne (Join-Path $pasta $f))) { Copy-Item $src -Destination (Join-Path $pasta $f) -Force }
}
Start-Service -Name $NOME_SERVICO
Write-Host "✔ Prever atualizado e no ar." -ForegroundColor Green
