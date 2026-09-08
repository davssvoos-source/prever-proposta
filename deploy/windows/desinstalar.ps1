<#
.SYNOPSIS
  Remove o serviço do Prever deste servidor (R220, U118).

.DESCRIPTION
  Para e desregistra o serviço, apaga a regra do firewall e — só com -ApagarPasta —
  remove a pasta de instalação (o config.env com as chaves vai junto). O banco
  (Supabase) não é tocado: os dados ficam onde sempre estiveram.
#>
[CmdletBinding()]
param([switch] $ApagarPasta)

$ErrorActionPreference = "Continue"
$NOME_SERVICO = "PreverSistema"
$pasta = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent ([System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName) }
$winsw = Join-Path $pasta "servico\prever-servico.exe"
$porta = (Get-Content (Join-Path $pasta "config.env") -ErrorAction SilentlyContinue | Where-Object { $_ -match '^PORT=(\d+)' } | ForEach-Object { $Matches[1] } | Select-Object -First 1)

Stop-Service -Name $NOME_SERVICO -Force -ErrorAction SilentlyContinue
if (Test-Path $winsw) { & $winsw uninstall | Out-Null } else { & sc.exe delete $NOME_SERVICO | Out-Null }
if ($porta) { & netsh advfirewall firewall delete rule name="Prever Sistema (TCP $porta)" | Out-Null }
Write-Host "Serviço removido." -ForegroundColor Green
if ($ApagarPasta) {
  Set-Location (Split-Path -Parent $pasta)
  Remove-Item -Recurse -Force $pasta
  Write-Host "Pasta $pasta apagada."
} else {
  Write-Host "A pasta $pasta ficou (config.env com as chaves, logs). Use -ApagarPasta para remover."
}
