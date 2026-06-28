# Gerador de Orçamentos — Grupo Prever

App web mobile-first em PT-BR, identidade azul navy `#1F3864` + dourado `#FFC000`, com Lovable Cloud (Supabase) como backend.

## Antes de implementar — preciso confirmar 2 pontos

1. **Catálogo de blocos e equipamentos**: a especificação descreve a estrutura, mas o conteúdo real (lista completa dos blocos `PED-*`, `VEI-*`, `CFTV-*`… e dos ~N equipamentos com custo) está na planilha `base_de_dados-servicos_eletronicos.xlsx`, que não veio anexada. Para o V1 vou **semear um catálogo de demonstração realista** baseado nos códigos citados na spec (CENT-PR, PED-1P-ES-MET-PP, VEI-2P-TAG-FAC-BASC-BASC-PR, CFTV-IP-4CH, ALARM-BAS, CERCA-100M, ELEV-KIT, etc.) com ~15 blocos, ~30 equipamentos e os 24 serviços SV001–SV024. Você poderá importar a planilha real depois pela tela Admin (T8) ou me enviar o `.xlsx` para eu fazer o seed completo.
2. **Login**: e-mail/senha (padrão) + Google? Ou apenas e-mail/senha por enquanto?

Vou seguir com seed de demo + login e-mail/senha **a menos que você diga o contrário**.

## Escopo V1 (ordem de entrega)

1. **Cloud + Auth + perfis (`comercial`/`tecnico`/`admin`)** — tabela `user_roles` separada com `has_role()` security definer; gate em `_authenticated`.
2. **Schema completo** das 9 tabelas da spec, com RLS:
   - `clientes`, `projetos`, `projeto_blocos`, `projeto_itens_variaveis`, `projeto_servicos` → usuário vê só os próprios; admin vê todos.
   - `blocos`, `blocos_itens`, `equipamentos`, `servicos` → leitura para `authenticated`; escrita só para `admin`.
   - Coluna `owner_id` em `projetos` e `clientes`.
3. **Seed** de blocos/itens/equipamentos/serviços de demonstração + 2 clientes e 1 projeto exemplo.
4. **T1 Dashboard** — lista de projetos com busca, filtros de status, badges coloridos, CTA "Nova Proposta".
5. **T2 Nova Proposta** — wizard 2 etapas (cliente novo/existente → dados do projeto).
6. **T3 Seleção de Blocos** (tela central) — accordion por camada com ícones, cards com toggle/quantidade, barra fixa "N blocos · X HH · Ver Orçamento". Auto-ativação de `CENT-PR` quando qualquer bloco `-PR` está ativo.
7. **T4 Itens Variáveis** — agrupados por bloco, input de quantidade.
8. **T5 Resumo/BOM** — agregação por modelo (qty_item × qty_bloco somando todos os blocos ativos + itens variáveis), preço = `custo × markup`, toggle FORNECIMENTO, subtotal equipamentos, subtotal instalação (HH × R$/h), total geral. Respeita `tipo_contrato`.
9. **T6 Serviços/Manutenção** — toggle por serviço + quantidades calculadas automaticamente pelas regras por prefixo (CENT/PED/VEI/CFTV/ALARM/CERCA/ELEV), total mensal.
10. **T7 Exportar PDF** — gerar PDF client-side (jsPDF) com logo/cores Prever, dados do cliente, BOM, totais, mensal de manutenção. Botão baixar.
11. **T8 Admin** — CRUD/listagem de equipamentos, blocos e itens; só acessível ao perfil `admin`.

## Detalhes técnicos

- **Stack**: TanStack Start (template atual) + TanStack Query + shadcn/ui + Tailwind v4.
- **Design tokens** em `src/styles.css` (oklch): `--primary` azul navy, `--accent` dourado, fonte Inter via `<link>` no `__root.tsx`. Sem hardcoded colors em componentes.
- **Mobile-first**: targets 375px, alvos de toque ≥44px, barra de ação fixa no rodapé na T3.
- **Cálculo de BOM**: feito no frontend, em `useMemo`, a partir das queries de `blocos_itens` + `projeto_blocos` + `equipamentos` + `projeto_itens_variaveis`.
- **Auto-ativação CENT-PR**: trigger no client ao ativar qualquer bloco `-PR`; também garantido por uma função utilitária ao salvar.
- **PDF**: `jspdf` + `jspdf-autotable` (puro JS, compatível com edge).
- **RLS**: `projetos`/`clientes` filtrados por `owner_id = auth.uid() OR has_role(auth.uid(),'admin')`; catálogos leitura pra autenticados, escrita pra admin.
- **Sem Edge Functions** — toda lógica em componentes/server functions TanStack quando necessário.

## Fora do V1
WhatsApp/e-mail, dimensionamento automático de switches/fontes, modo offline/PWA, assinatura digital, analytics, importação real de Excel (fica T8 manual no V1).

Confirmar os 2 pontos acima e eu começo a construir.
