<#
.SYNOPSIS
  Instalador do Prever para Windows Server (2016 ou mais novo) — R220, U118.

.DESCRIPTION
  Instala o sistema como um SERVIÇO do Windows, na porta que você escolher:
    1. confere que é administrador e que a pasta `app\` do pacote está ao lado;
    2. garante o Node.js (20 LTS ou mais novo) — baixa e instala em silêncio se faltar;
    3. copia o build para a pasta de instalação e grava o `config.env` (PORTA, URL, chaves);
    4. registra o serviço "Prever — Sistema" (WinSW), com reinício automático e logs rotativos;
    5. abre a porta no Firewall do Windows;
    6. sobe o serviço e confere que responde.

  Sem parâmetros, abre uma janela para preencher porta, pasta e URL. Com -SemInterface,
  usa só os parâmetros (para instalação por script). Idempotente: rodar de novo atualiza.

.EXAMPLE
  .\instalar.ps1
  .\instalar.ps1 -Porta 8081 -Pasta "D:\Prever" -SiteUrl "http://srv-prever:8081" -SemInterface

.NOTES
  Compilado para Instalar-Prever.exe por `npm run build:windows` (ps2exe), com pedido de elevação.
  Documentação: docs/manual/hospedagem-windows.md
#>
[CmdletBinding()]
param(
  [int]    $Porta = 0,
  [string] $Pasta = "",
  [string] $SiteUrl = "",
  [string] $ServiceRoleKey = "",
  [string] $AnthropicKey = "",
  [switch] $SemInterface
)

$ErrorActionPreference = "Stop"
$NOME_SERVICO   = "PreverSistema"
$NOME_EXIBICAO  = "Prever — Sistema"
$WINSW_URL      = "https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe"
$NODE_MSI_URL   = "https://nodejs.org/dist/v20.19.5/node-v20.19.5-x64.msi"
$NODE_MINIMO    = 18

function Escrever($texto, $cor = "Gray") { Write-Host $texto -ForegroundColor $cor }
function Falhar($texto) { Write-Host ""; Write-Host "ERRO: $texto" -ForegroundColor Red; Write-Host ""; if (-not $SemInterface) { Read-Host "Pressione Enter para sair" | Out-Null }; exit 1 }

# ── onde estamos: como .ps1 ($PSScriptRoot) ou como .exe compilado ──────────
function PastaDoInstalador {
  if ($PSScriptRoot) { return $PSScriptRoot }
  return Split-Path -Parent ([System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName)
}

# ── 1. administrador e pacote ───────────────────────────────────────────────
$identidade = [Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $identidade.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Falhar "Execute como administrador (clique com o botão direito → Executar como administrador)."
}
$origem = PastaDoInstalador
$appOrigem = Join-Path $origem "app"
if (-not (Test-Path (Join-Path $appOrigem "server\index.mjs"))) {
  Falhar "A pasta 'app' do pacote não está ao lado do instalador ($origem). Extraia o .zip inteiro antes de instalar."
}

# ── 2. a configuração: janela ou parâmetros ─────────────────────────────────
$padraoConfig = @{}
$arqPadrao = Join-Path $origem "config.padrao.env"
if (Test-Path $arqPadrao) {
  foreach ($l in Get-Content $arqPadrao) { if ($l -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') { $padraoConfig[$Matches[1]] = $Matches[2].Trim('"') } }
}
$host_ = $env:COMPUTERNAME.ToLower()
if (-not $SemInterface -and ($Porta -eq 0 -or -not $Pasta)) {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  $form = New-Object System.Windows.Forms.Form
  $form.Text = "Instalar o Prever"
  $form.Size = New-Object System.Drawing.Size(520, 400)
  $form.StartPosition = "CenterScreen"
  $form.FormBorderStyle = "FixedDialog"; $form.MaximizeBox = $false; $form.MinimizeBox = $false
  $y = 16
  function NovoCampo($rotulo, $valor, $senha = $false) {
    $lbl = New-Object System.Windows.Forms.Label; $lbl.Text = $rotulo; $lbl.Location = New-Object System.Drawing.Point(16, $script:y); $lbl.Size = New-Object System.Drawing.Size(470, 18)
    $tb = New-Object System.Windows.Forms.TextBox; $tb.Text = $valor; $tb.Location = New-Object System.Drawing.Point(16, ($script:y + 20)); $tb.Size = New-Object System.Drawing.Size(470, 24)
    if ($senha) { $tb.UseSystemPasswordChar = $true }
    $form.Controls.Add($lbl); $form.Controls.Add($tb); $script:y += 52; return $tb
  }
  $tbPorta = NovoCampo "Porta em que o sistema vai atender (só números — cada serviço do servidor usa a sua)" $(if ($Porta -gt 0) { "$Porta" } else { "8080" })
  $tbPasta = NovoCampo "Pasta de instalação" $(if ($Pasta) { $Pasta } else { "C:\Prever" })
  $tbUrl   = NovoCampo "Endereço pelo qual as pessoas vão abrir o sistema (SITE_URL — vai nos e-mails de convite)" $(if ($SiteUrl) { $SiteUrl } else { "http://$host_" })
  $tbSrk   = NovoCampo "Chave SERVICE ROLE do Supabase (opcional — só para convidar usuários pelo sistema)" $ServiceRoleKey $true
  $tbAnth  = NovoCampo "Chave da Anthropic (opcional — o assistente de criação rápida e da cobrança)" $AnthropicKey $true
  $ok = New-Object System.Windows.Forms.Button; $ok.Text = "Instalar"; $ok.Location = New-Object System.Drawing.Point(300, ($y + 6)); $ok.Size = New-Object System.Drawing.Size(90, 30); $ok.DialogResult = "OK"
  $cancel = New-Object System.Windows.Forms.Button; $cancel.Text = "Cancelar"; $cancel.Location = New-Object System.Drawing.Point(396, ($y + 6)); $cancel.Size = New-Object System.Drawing.Size(90, 30); $cancel.DialogResult = "Cancel"
  $form.Controls.Add($ok); $form.Controls.Add($cancel); $form.AcceptButton = $ok; $form.CancelButton = $cancel
  if ($form.ShowDialog() -ne "OK") { exit 0 }
  $Porta = [int]$tbPorta.Text; $Pasta = $tbPasta.Text.Trim(); $SiteUrl = $tbUrl.Text.Trim(); $ServiceRoleKey = $tbSrk.Text.Trim(); $AnthropicKey = $tbAnth.Text.Trim()
}
if ($Porta -le 0) { $Porta = 8080 }
if (-not $Pasta) { $Pasta = "C:\Prever" }
if (-not $SiteUrl) { $SiteUrl = "http://$host_" }
if ($SiteUrl -notmatch ':\d+(/|$)' -and $Porta -ne 80) { $SiteUrl = $SiteUrl.TrimEnd('/') + ":$Porta" }
if ($Porta -lt 1 -or $Porta -gt 65535) { Falhar "Porta inválida: $Porta (use de 1 a 65535)." }

Escrever ""
Escrever "═══ Prever — instalação ═══" "Yellow"
Escrever "  porta:  $Porta"
Escrever "  pasta:  $Pasta"
Escrever "  URL:    $SiteUrl"
Escrever ""

# a porta está livre? (o próprio serviço, numa reinstalação, não conta)
$servicoExiste = Get-Service -Name $NOME_SERVICO -ErrorAction SilentlyContinue
if ($servicoExiste) { Escrever "Serviço já existe — parando para atualizar…"; Stop-Service -Name $NOME_SERVICO -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2 }
$emUso = Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue
if ($emUso) { Falhar "A porta $Porta já está em uso (PID $($emUso[0].OwningProcess)). Escolha outra porta." }

# ── 3. Node.js ──────────────────────────────────────────────────────────────
function VersaoDoNode {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $cmd) { return 0 }
  $v = (& node --version) -replace '^v', ''
  return [int]($v.Split('.')[0])
}
$nodeMajor = VersaoDoNode
if ($nodeMajor -lt $NODE_MINIMO) {
  Escrever "Node.js $NODE_MINIMO+ não encontrado — baixando o Node 20 LTS…" "Yellow"
  $msi = Join-Path $env:TEMP "node-lts-x64.msi"
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $NODE_MSI_URL -OutFile $msi -UseBasicParsing
  } catch { Falhar "Não consegui baixar o Node.js ($NODE_MSI_URL). Instale o Node 20 LTS à mão (nodejs.org) e rode de novo." }
  $p = Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn /norestart" -Wait -PassThru
  if ($p.ExitCode -ne 0) { Falhar "A instalação do Node.js falhou (código $($p.ExitCode))." }
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
  if ((VersaoDoNode) -lt $NODE_MINIMO) { Falhar "O Node.js foi instalado mas não está no PATH desta sessão. Abra um novo terminal e rode o instalador de novo." }
}
$nodeExe = (Get-Command node).Source
Escrever "Node.js: $(& node --version) em $nodeExe" "Green"

# ── 4. copiar o build e gravar a configuração ───────────────────────────────
New-Item -ItemType Directory -Force -Path $Pasta | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Pasta "servico") | Out-Null
$appDestino = Join-Path $Pasta "app"
Escrever "Copiando o sistema para $appDestino…"
& robocopy $appOrigem $appDestino /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { Falhar "A cópia do build falhou (robocopy $LASTEXITCODE)." }
foreach ($f in @("iniciar.mjs", "atualizar.ps1", "desinstalar.ps1")) {
  $src = Join-Path $origem $f
  if (Test-Path $src) { Copy-Item $src -Destination (Join-Path $Pasta $f) -Force }
}

$config = Join-Path $Pasta "config.env"
$linhas = @(
  "# Prever — configuração do serviço (lida por iniciar.mjs). Edite e reinicie o serviço.",
  "PORT=$Porta",
  "HOST=0.0.0.0",
  "SITE_URL=$SiteUrl",
  "NODE_ENV=production"
)
foreach ($k in @("SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PROJECT_ID")) { if ($padraoConfig[$k]) { $linhas += "$k=$($padraoConfig[$k])" } }
if ($ServiceRoleKey) { $linhas += "SUPABASE_SERVICE_ROLE_KEY=$ServiceRoleKey" } else { $linhas += "# SUPABASE_SERVICE_ROLE_KEY=   (só para convidar usuários pelo sistema)" }
if ($AnthropicKey)   { $linhas += "ANTHROPIC_API_KEY=$AnthropicKey" }   else { $linhas += "# ANTHROPIC_API_KEY=   (o assistente de criação rápida e da cobrança)" }
# preserva chaves já gravadas numa reinstalação sem elas
if (Test-Path $config) {
  foreach ($l in Get-Content $config) {
    if ($l -match '^(SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC_API_KEY)=(.+)$') {
      $chave = $Matches[1]
      if (-not ($linhas | Where-Object { $_ -like "$chave=*" })) { $linhas = $linhas | Where-Object { $_ -notlike "# $chave=*" }; $linhas += $l }
    }
  }
}
Set-Content -Path $config -Value $linhas -Encoding UTF8
# só administradores leem o config.env (tem chave)
& icacls $config /inheritance:r /grant:r "Administrators:(F)" "SYSTEM:(F)" | Out-Null

# ── 5. o serviço (WinSW) ────────────────────────────────────────────────────
$winsw = Join-Path $Pasta "servico\prever-servico.exe"
$winswLocal = Join-Path $origem "WinSW-x64.exe"
if (-not (Test-Path $winsw)) {
  if (Test-Path $winswLocal) { Copy-Item $winswLocal -Destination $winsw -Force }
  else {
    Escrever "Baixando o WinSW (o embrulho de serviço)…"
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri $WINSW_URL -OutFile $winsw -UseBasicParsing }
    catch { Falhar "Não consegui baixar o WinSW ($WINSW_URL). Coloque o WinSW-x64.exe ao lado do instalador e rode de novo." }
  }
}
$xml = @"
<service>
  <id>$NOME_SERVICO</id>
  <name>$NOME_EXIBICAO</name>
  <description>Prever Proposta — o sistema interno do Grupo Prever (porta $Porta). Configuração em $config.</description>
  <executable>$nodeExe</executable>
  <arguments>"%BASE%\..\iniciar.mjs"</arguments>
  <workingdirectory>%BASE%\..</workingdirectory>
  <startmode>Automatic</startmode>
  <onfailure action="restart" delay="10 sec"/>
  <onfailure action="restart" delay="60 sec"/>
  <resetfailure>1 hour</resetfailure>
  <log mode="roll-by-size">
    <sizeThreshold>10240</sizeThreshold>
    <keepFiles>8</keepFiles>
  </log>
  <env name="NODE_ENV" value="production"/>
</service>
"@
Set-Content -Path (Join-Path $Pasta "servico\prever-servico.xml") -Value $xml -Encoding UTF8
if ($servicoExiste) { & $winsw uninstall | Out-Null; Start-Sleep -Seconds 1 }
& $winsw install | Out-Null
if ($LASTEXITCODE -ne 0) { Falhar "Não consegui registrar o serviço (WinSW install $LASTEXITCODE)." }

# ── 6. firewall ─────────────────────────────────────────────────────────────
$regra = "Prever Sistema (TCP $Porta)"
& netsh advfirewall firewall delete rule name="$regra" | Out-Null
& netsh advfirewall firewall add rule name="$regra" dir=in action=allow protocol=TCP localport=$Porta | Out-Null
Escrever "Firewall: porta $Porta liberada (regra '$regra')." "Green"

# ── 7. subir e conferir ─────────────────────────────────────────────────────
Start-Service -Name $NOME_SERVICO
$respondeu = $false
for ($i = 0; $i -lt 30 -and -not $respondeu; $i++) {
  Start-Sleep -Seconds 1
  try { $r = Invoke-WebRequest -Uri "http://localhost:$Porta/" -UseBasicParsing -TimeoutSec 3 -MaximumRedirection 0 -ErrorAction SilentlyContinue; if ($r -and $r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { $respondeu = $true } }
  catch { if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -in 301,302,303,307,308) { $respondeu = $true } }
}
Escrever ""
if ($respondeu) {
  Escrever "✔ O Prever está no ar: $SiteUrl  (local: http://localhost:$Porta)" "Green"
} else {
  Escrever "O serviço foi registrado e iniciado, mas ainda não respondeu em http://localhost:$Porta/." "Yellow"
  Escrever "Veja os logs em $Pasta\servico\prever-servico.out.log e .err.log." "Yellow"
}
Escrever ""
Escrever "Falta fazer no Supabase (uma vez): Authentication → URL Configuration →" "Yellow"
Escrever "  Site URL = $SiteUrl   e   Redirect URLs += $SiteUrl/**" "Yellow"
Escrever "Sem isso, o login por e-mail e o convite voltam para o endereço antigo."
Escrever ""
Escrever "Serviço: '$NOME_EXIBICAO' ($NOME_SERVICO). Atualizar: atualizar.ps1. Remover: desinstalar.ps1."
if (-not $SemInterface) { Read-Host "Pressione Enter para fechar" | Out-Null }
