# Clientes — Estado da Implementação

<!-- ESTADO ATUAL, não história: a história vive em ../PLANO_UNIFICACAO.md (U-série) e no git.
     Ao entregar, REESCREVA a seção afetada; datas só em Pendências. -->

## O que existe

- Lista paginada e filtrada por serviço (`clientes.tsx`, R55, R92), ficha numa página só (`clientes.$id.tsx`,
  R201–R212, R218, R219), estrutura do local em "O local" (R211), card de atividades igual ao da Início (R212).
- Patrimônio: 4.241 itens do QAP carregados (`docs/importacao/qap-equipamentos.json`); blocos nomeados por
  sistema; vínculo por arrasto em dois painéis; catálogo "Equipamentos cadastrados" (`equipamentos.tsx`, R198).
- Prospecção via RPC `achar_ou_criar_prospeccao_do_local` (U124); `clientes.novo.tsx` e `clientes.migrar.tsx`
  são legadas/guardadas.
- Baixa de equipamento gera atividade para o Controle Patrimonial (R293).
- Lógica e consultas em `src/features/clientes/` e `src/features/equipamentos/`.

## Padrões a reusar

- Local ≠ cliente (R84): a atividade aponta locais; o local pode não ser cliente.
- Sistema/bloco tem catálogo (R159); tipo novo entra no catálogo, não como texto livre.
- Ficha rola por dentro dos painéis, não a página (R208); largura toda (R205).

## Configuração

- Integração diária com o QAP ERP (R160) ainda não existe: a carga foi por arquivo. A API do QAP fica para
  quando o sistema estiver redondo (contato: Lopes).

## Cobertura R# → verificação

<!-- cobertura:inicio -->
<!-- Gerado por `node scripts/cobertura-regras.cjs` — não edite à mão. -->

Regras do módulo: 42 · com asserção nominal no verificador: 40 · sem menção nominal: 2.

| Regra | Verificado por |
|---|---|
| produto:R10 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R21 | 15 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R22 | 6 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R41 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R51 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R52 | 2 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R55 | 2 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R61 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R62 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R63 | 7 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R71 | 10 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R74 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R92 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R114 | 10 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R128 | 1 menção nominal em `scripts/verificar-logica.cjs` |
| produto:R146 | 10 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R159 | 6 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R160 | 2 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R166 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R173 | 12 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R192 | 15 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R196 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R197 | 6 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R198 | 21 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R199 | 19 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R200 | 11 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R201 | 12 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R202 | 19 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R203 | 14 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R205 | 6 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R206 | 18 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R207 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R208 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R209 | 15 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R210 | 13 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R211 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R212 | 7 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R218 | 10 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R219 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R237 | 14 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R242 | 11 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R293 | 1 menção nominal em `scripts/verificar-logica.cjs` |
<!-- cobertura:fim -->

## Pendências

- Rodar a migration U155 (G1 em `../DECISOES_PENDENTES.md`): até lá, Erik e Nicholas não veem a base inteira.
- Documentos do ERP com equipamentos por cliente (M3) e a API do QAP.
- 40 locais desconhecidos da carga (`../importacao/locais-desconhecidos.md`) e "quem vincula" esperam o Davi.
- O que depende do Davi está consolidado em `../DECISOES_PENDENTES.md`; a dívida técnica, em
  `../PENDENCIAS_TECNICAS.md`.
