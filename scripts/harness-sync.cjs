#!/usr/bin/env node
// harness-sync — regenera os adaptadores por ferramenta a partir da fonte canônica
// (AGENTS.md + .harness/). Node puro, sem dependências (ADR-0004).
//
// Adaptação ao Prever OS (ADR-0001): as skills vivem em .claude/skills/ como diretório
// real — não há symlink (o Windows não o faz por padrão, e a Lovable clona o repositório
// para publicar). Os `--check` normalizam CRLF antes de comparar.
//
//   node scripts/harness-sync.cjs          # (re)gera adaptadores
//   node scripts/harness-sync.cjs --check  # falha se algum adaptador divergiu (CI e gate)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');
let status = 0;
const normal = (s) => s.replace(/\r\n/g, '\n').replace(/\n+$/, '');

function emit(rel, conteudo) {
  const alvo = path.join(ROOT, rel);
  if (CHECK) {
    const atual = fs.existsSync(alvo) ? fs.readFileSync(alvo, 'utf8') : null;
    if (atual === null || normal(atual) !== normal(conteudo)) {
      console.error(`DIVERGENTE: ${rel} (rode node scripts/harness-sync.cjs)`);
      status = 1;
    }
  } else {
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.writeFileSync(alvo, normal(conteudo) + '\n');
    console.log(`gerado: ${rel}`);
  }
}

const GUIA = [
  'Siga AGENTS.md na raiz do repositório (cápsula de contexto, fonte canônica).',
  'Comandos e gates: .harness/harness.yaml. Documentação viva pelos índices',
  'docs/ESTADO_ATUAL.md, docs/REQUIREMENTS.md e docs/ARCHITECTURE.md — nunca leia',
  'docs/ por inteiro. Regras de produto: docs/PRODUTO.md (R-série, cite pelo número).',
  'Não edite arquivos gerados; rode node scripts/harness-sync.cjs após alterar a fonte.',
].join('\n');

// --- Claude Code: CLAUDE.md importa a fonte -------------------------------
emit('CLAUDE.md', '@AGENTS.md');

// --- Cursor: regra sempre ativa apontando para a fonte --------------------
emit('.cursor/rules/harness.mdc', [
  '---',
  'description: Pattern Harness — fonte canônica de instruções do Prever OS',
  'alwaysApply: true',
  '---',
  GUIA,
].join('\n'));

// --- Gemini CLI ------------------------------------------------------------
emit('.gemini/GEMINI.md', GUIA);

// --- Antigravity (.agent/rules, regra sempre ativa) ------------------------
emit('.agent/rules/harness.md', ['---', 'trigger: always_on', '---', GUIA].join('\n'));

// --- GitHub Copilot -------------------------------------------------------
emit('.github/copilot-instructions.md', GUIA);

// --- MCP: projeção para Claude Code (.mcp.json na raiz) -------------------
emit('.mcp.json', fs.readFileSync(path.join(ROOT, '.harness/mcp/servers.json'), 'utf8'));

if (CHECK && status === 0) console.log('adaptadores em sincronia');
process.exitCode = status;
