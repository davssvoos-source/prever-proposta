// O ponto de entrada do serviço Windows do Prever (R220, U118).
//
// O serviço (WinSW, `servico\prever-servico.exe`) roda `node iniciar.mjs`.
// Este arquivo lê `config.env` (ao lado dele) para o `process.env` — PORTA,
// HOST, SITE_URL, as chaves — e só então importa o servidor gerado pelo build
// (`app\server\index.mjs`, preset node-server do Nitro), que abre a porta ao
// ser importado. Assim a configuração fica num arquivo editável, e o XML do
// serviço nunca precisa mudar.
//
// Uma variável que já exista no ambiente do processo vence a do arquivo.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = dirname(fileURLToPath(import.meta.url));
const arquivo = join(raiz, "config.env");

if (existsSync(arquivo)) {
  for (const linha of readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(linha);
    if (!m || linha.trim().startsWith("#")) continue;
    const valor = m[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    if (process.env[m[1]] === undefined) process.env[m[1]] = valor;
  }
}

// a porta e o host são o que o instalador gravou; sem nada, 8080 em todas as interfaces
process.env.PORT ??= "8080";
process.env.HOST ??= "0.0.0.0";
process.env.NITRO_PORT ??= process.env.PORT;
process.env.NITRO_HOST ??= process.env.HOST;
process.env.NODE_ENV ??= "production";

const servidor = join(raiz, "app", "server", "index.mjs");
if (!existsSync(servidor)) {
  console.error(`Prever: o build não está em ${servidor}. Rode o instalador de novo ou o atualizar.ps1.`);
  process.exit(1);
}

console.log(`Prever: subindo em http://${process.env.HOST}:${process.env.PORT} (SITE_URL=${process.env.SITE_URL ?? "não definida"})`);
await import(new URL(`file://${servidor.replace(/\\/g, "/")}`).href);
