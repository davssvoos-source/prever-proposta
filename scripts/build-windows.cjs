// O PACOTE PARA WINDOWS SERVER (R220, U118): `npm run build:windows`.
//
// 1. Faz o build do app com o preset `node-server` do Nitro (o build normal,
//    que a Lovable roda, sai para Cloudflare — a mesma árvore, outro alvo; a
//    variável NITRO_PRESET decide, sem tocar no vite.config).
// 2. Monta `dist-windows/Prever-<versão>/` com: `app/` (o build), o instalador
//    (`instalar.ps1`), `iniciar.mjs`, `atualizar.ps1`, `desinstalar.ps1`, o
//    `config.padrao.env` (as chaves PÚBLICAS do .env — a URL e a publishable
//    key do Supabase; a service role e a Anthropic nunca entram no pacote) e o
//    `VERSAO.txt`.
// 3. Compila o instalador para `Instalar-Prever.exe` (ps2exe, com pedido de
//    elevação) quando o módulo está instalado; sem ele, o .ps1 serve igual.
// 4. Fecha tudo num .zip ao lado.
//
// Nada disto é commitado: dist-windows/ está no .gitignore. O pacote é o que
// vai para o servidor (docs/manual/hospedagem-windows.md).

const { execSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const raiz = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(raiz, "package.json"), "utf8"));
const versao = pkg.version ?? "0.0.0";
const destino = path.join(raiz, "dist-windows", `Prever-${versao}`);

function rodar(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: raiz, ...opts });
}

// ── 1. o build para Node ──────────────────────────────────────────────────────
rodar("npx vite build", { env: { ...process.env, NITRO_PRESET: "node-server" } });
const servidor = path.join(raiz, ".output", "server", "index.mjs");
if (!fs.existsSync(servidor)) throw new Error("O build não gerou .output/server/index.mjs — o preset node-server não foi aplicado.");
const conteudo = fs.readFileSync(servidor, "utf8");
if (!/process\.env\.PORT|NITRO_PORT/.test(conteudo)) throw new Error("O servidor gerado não lê a PORTA do ambiente — o preset não é node-server.");
if (fs.existsSync(path.join(raiz, ".output", "server", "wrangler.json"))) throw new Error("O build saiu para Cloudflare (wrangler.json) — não serve para o Windows.");

// ── 2. a pasta do pacote ─────────────────────────────────────────────────────
fs.rmSync(destino, { recursive: true, force: true });
fs.mkdirSync(destino, { recursive: true });
fs.cpSync(path.join(raiz, ".output"), path.join(destino, "app"), { recursive: true });
for (const f of ["instalar.ps1", "iniciar.mjs", "atualizar.ps1", "desinstalar.ps1"]) {
  fs.copyFileSync(path.join(raiz, "deploy", "windows", f), path.join(destino, f));
}
// as chaves PÚBLICAS do .env viram o config.padrao.env — o instalador as copia
// para o config.env do servidor (o cliente já as tem embutidas pelo build)
const env = fs.readFileSync(path.join(raiz, ".env"), "utf8");
const publicas = env.split(/\r?\n/).filter((l) => /^(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY|SUPABASE_PROJECT_ID)=/.test(l));
if (publicas.some((l) => /SERVICE_ROLE|ANTHROPIC/.test(l))) throw new Error("Chave secreta no .env — nunca.");
fs.writeFileSync(path.join(destino, "config.padrao.env"), publicas.join("\n") + "\n");
let sha = "";
try { sha = execSync("git rev-parse --short HEAD", { cwd: raiz }).toString().trim(); } catch { /* sem git */ }
fs.writeFileSync(path.join(destino, "VERSAO.txt"), `Prever ${versao}${sha ? ` (${sha})` : ""}\nbuild: ${new Date().toISOString()}\npreset: node-server\n`);

// ── 3. o .exe do instalador (ps2exe), quando existe ──────────────────────────
const ps1 = path.join(destino, "instalar.ps1");
const exe = path.join(destino, "Instalar-Prever.exe");
const compilar = [
  "Import-Module ps2exe -ErrorAction Stop;",
  `Invoke-PS2EXE -inputFile '${ps1}' -outputFile '${exe}' -title 'Instalador do Prever' -company 'Grupo Prever' -product 'Prever Proposta' -version '${versao}.0' -requireAdmin -x64`,
].join(" ");
const r = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", compilar], { stdio: "inherit" });
if (r.status === 0 && fs.existsSync(exe)) console.log(`\n✔ ${path.relative(raiz, exe)}`);
else console.log("\nps2exe indisponível — o pacote vai com o instalar.ps1 (funciona igual: botão direito → Executar com o PowerShell, como administrador). Para gerar o .exe: Install-Module ps2exe.");

// ── 4. o zip ─────────────────────────────────────────────────────────────────
const zip = `${destino}.zip`;
fs.rmSync(zip, { force: true });
spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", `Compress-Archive -Path '${destino}\\*' -DestinationPath '${zip}' -Force`], { stdio: "inherit" });
console.log(`\n✔ pacote: ${path.relative(raiz, destino)}  |  zip: ${path.relative(raiz, zip)}`);
