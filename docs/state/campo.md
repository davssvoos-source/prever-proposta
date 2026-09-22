# Campo — Estado da Implementação

<!-- ESTADO ATUAL, não história: a história vive em ../PLANO_UNIFICACAO.md (U-série) e no git.
     Ao entregar, REESCREVA a seção afetada; datas só em Pendências. -->

## O que existe

- Programação da equipe técnica em `src/routes/_authenticated/chamados.programacao.tsx` com a lógica em
  `src/features/programacao/modelo.ts` (blocos, jornada, janela, recusa do indisponível — R288).
- Equipes e escala por semana (`src/features/duplas/`, `DialogoEquipes`); composição vale do momento da
  troca em diante (R285).
- Sobreaviso por semana com barra no calendário e painel do plantão (`src/features/sobreaviso/modelo.ts`,
  `src/features/plantao/modelo.ts`, `GradeMes.tsx`); hoje exibido dentro da Gestão Técnica (módulo `paineis`).
- Viaturas por NFC: `src/features/viaturas/modelo.ts`, telas `viatura.index.tsx` e `viatura.$codigo.tsx`;
  cadastro e folha do gestor na aba Viaturas do Administrativo (R271, R272); migration U134.
- Implantação com período (`src/features/implantacao/modelo.ts`, R120).
- Tela do chamado de campo em layout de desktop (R247) e app do técnico (`android/`, Capacitor) com
  três telas (R263).
- Histórico: 227 OS importadas com marcos de campo (R70, R72).

## Padrões a reusar

- Quem afirma que a visita aconteceu é gente, antes de o sistema concluir (R109, R110).
- `CARGOS_DE_CAMPO = ["tecnico", "admin"]`: o seletor de responsável por atividade de campo lê daqui.
- Toda mudança de escala ou plantão passa por RPC (troca atômica); a tela nunca grava duas linhas.
- Programação compartilhada em texto (R105): o texto sai de função pura, não do componente.

## Configuração

- APK: para onde aponta (URL do servidor) ainda depende do Davi; push de notificação não existe.
- NFC: `android.permission.NFC` no `AndroidManifest.xml`; a etiqueta carrega o endereço da viatura.

## Cobertura R# → verificação

<!-- cobertura:inicio -->
<!-- Gerado por `node scripts/cobertura-regras.cjs` — não edite à mão. -->

Regras do módulo: 63 · com asserção nominal no verificador: 62 · sem menção nominal: 1.

| Regra | Verificado por |
|---|---|
| produto:R5 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R7 | 1 menção nominal em `scripts/verificar-logica.cjs` |
| produto:R11 | 2 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R12 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R14 | 1 menção nominal em `scripts/verificar-logica.cjs` |
| produto:R56 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R57 | 11 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R70 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R72 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R75 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R96 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R97 | 7 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R98 | 7 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R99 | 6 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R100 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R101 | 9 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R102 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R105 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R106 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R107 | 2 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R108 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R109 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R110 | 1 menção nominal em `scripts/verificar-logica.cjs` |
| produto:R111 | 1 menção nominal em `scripts/verificar-logica.cjs` |
| produto:R112 | 11 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R116 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R117 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R120 | 59 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R122 | 25 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R127 | 1 menção nominal em `scripts/verificar-logica.cjs` |
| produto:R130 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R134 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R148 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R155 | 15 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R156 | 13 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R162 | 2 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R163 | 12 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R165 | 11 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R172 | 6 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R247 | 6 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R253 | 11 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R254 | 24 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R256 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R263 | 24 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R265 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R266 | 7 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R267 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R268 | 2 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R269 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R270 | 2 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R271 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R272 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R273 | 11 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R274 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R276 | 15 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R283 | 28 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R284 | 21 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R285 | 20 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R286 | 14 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R287 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R288 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R292 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R297 | 18 menções nominalis em `scripts/verificar-logica.cjs` |
<!-- cobertura:fim -->

## Pendências

- Validação do gestor por tipo (Fase C) espera os fluxos M1 (`../DECISOES_PENDENTES.md`).
- APK: destino, push e urgência → plantonista dependem do Davi; esta máquina não compila APK.
- Botão Retorno no card e mini-calendário da data agendada: esperam M1.
- O que depende do Davi está consolidado em `../DECISOES_PENDENTES.md`; a dívida técnica, em
  `../PENDENCIAS_TECNICAS.md`.
