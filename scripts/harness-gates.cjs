#!/usr/bin/env node
// harness-gates — valida e executa o manifesto de gates (.harness/harness.yaml).
//
// Porte do executor do Pattern Harness para Node (ADR-0004): o repositório é Node, e o
// harness fala a língua da stack — roda no Windows (cmd.exe), no Linux (sh) e no CI, sem
// Python nem sh do Git. O contrato é o do padrão: manifesto `version: 1`; `commands` é um
// mapa de strings não vazias; `${commands.x}` resolve com detecção de referência
// desconhecida, cíclica ou malformada; `gates` é lista não vazia de {name, run, required},
// nomes únicos, `required` booleano; chave YAML duplicada é erro (um gate a menos em
// silêncio seria o pior defeito). Cada gate roda no shell da PLATAFORMA, por isso todo
// `run:` é neutro de shell (`node …`, `npx …`, `npm …`).
//
// Saída: 0 tudo verde · 1 gate obrigatório falhou · 2 manifesto inválido (nada executa).
//
//   node scripts/harness-gates.cjs [--manifest <arquivo>]
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const yaml = require('js-yaml');

class ManifestError extends Error {}
const REFERENCE = /\$\{commands\.([^{}]+)\}/g;
const ehMapa = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function lerGates(arquivo) {
  // js-yaml recusa chave duplicada por padrão (YAMLException).
  const manifest = yaml.load(fs.readFileSync(arquivo, 'utf8'));
  if (!ehMapa(manifest) || typeof manifest.version !== 'number' || !Number.isInteger(manifest.version) || manifest.version !== 1) {
    throw new ManifestError('manifest version must be 1');
  }
  const commands = manifest.commands ?? {};
  if (!ehMapa(commands)) throw new ManifestError('commands must be a mapping');
  for (const [nome, cmd] of Object.entries(commands)) {
    if (typeof cmd !== 'string' || !cmd.trim()) throw new ManifestError(`commands.${nome} must be a nonempty string`);
  }
  const resolver = (comando, pilha = []) => {
    const resolvido = comando.replace(REFERENCE, (_, nome) => {
      if (!Object.hasOwn(commands, nome)) throw new ManifestError(`unknown command: ${nome}`);
      if (pilha.includes(nome)) throw new ManifestError(`cyclic command reference: ${nome}`);
      return resolver(commands[nome], [...pilha, nome]);
    });
    if (resolvido.includes('${commands.')) throw new ManifestError(`malformed command reference: ${comando}`);
    return resolvido;
  };
  for (const [nome, cmd] of Object.entries(commands)) resolver(cmd, [nome]);

  const gates = manifest.gates;
  if (!Array.isArray(gates) || gates.length === 0) throw new ManifestError('gates must be a nonempty list');
  const resultado = [];
  const nomes = new Set();
  for (const gate of gates) {
    const chaves = ehMapa(gate) ? Object.keys(gate).sort().join(',') : '';
    if (chaves !== 'name,required,run') throw new ManifestError('each gate needs exactly name, run and required');
    const { name, run, required } = gate;
    if (typeof name !== 'string' || !name.trim() || nomes.has(name)) {
      throw new ManifestError(`invalid or duplicate gate name: ${JSON.stringify(name)}`);
    }
    if (typeof run !== 'string' || !run.trim() || typeof required !== 'boolean') {
      throw new ManifestError(`invalid run/required for gate: ${name}`);
    }
    nomes.add(name);
    resultado.push([name, resolver(run), required]);
  }
  return resultado;
}

function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--manifest');
  const root = path.resolve(__dirname, '..');
  const manifesto = i >= 0 && args[i + 1] ? path.resolve(args[i + 1]) : path.join(root, '.harness/harness.yaml');
  let gates;
  try {
    gates = lerGates(manifesto);
  } catch (e) {
    console.error(`INVALID MANIFEST: ${e.message}`);
    return 2;
  }
  let falhou = false;
  for (const [nome, comando, obrigatorio] of gates) {
    console.log(`RUN ${nome}: ${comando}`);
    const r = spawnSync(comando, { shell: true, cwd: root, stdio: 'inherit' });
    let status = r.status;
    if (r.error || status === null) {
      console.error(`ERROR ${nome}: ${r.error ? r.error.message : 'sem código de saída'}`);
      status = 127;
    }
    // Comando não encontrado: 127 no sh (Linux/CI). O cmd.exe do Windows devolve 1 e não o
    // distingue de falha comum — o que o contrato exige (gate obrigatório FALHA) vale nos dois.
    console.log(`${status === 0 ? 'PASS' : 'FAIL'} ${nome} (exit=${status}, required=${obrigatorio})`);
    falhou = falhou || (obrigatorio && status !== 0);
  }
  return falhou ? 1 : 0;
}

process.exitCode = main();
