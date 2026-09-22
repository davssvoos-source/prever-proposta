# Requisitos — Índice de Módulos

Um arquivo por módulo em `requirements/`. Cada um diz **o que** o módulo faz e aponta as
regras de `PRODUTO.md` que o governam — as regras são o catálogo, com identificador `R#`
único no sistema inteiro (ADR-0001). O **porquê** estrutural está nos ADRs
(`ARCHITECTURE.md`); o estado da implementação, em `state/<modulo>.md`.

> **Protocolo**: leia apenas o(s) módulo(s) pertinentes à tarefa.
>
> **Regra dura da coluna Status**: UMA linha, ≤ 140 caracteres —
> `Completo`, `Parcial — pendem X, Y` ou `Pendente`. Detalhe vive em
> `state/<modulo>.md`, nunca aqui.

| Módulo | Conteúdo | Status |
|---|---|---|
| [atividades](requirements/atividades.md) | A atividade como unidade: naturezas, tipos, estrutura, Início, chat | Parcial — pendem os fluxos por tipo (M1) e a atividade mista campo + operacional (D2) |
| [campo](requirements/campo.md) | Agenda, programação, equipes, retorno, plantão, viaturas, app do técnico | Parcial — pendem validação do gestor (Fase C), botão Retorno no card e APK |
| [comercial](requirements/comercial.md) | Visita, orçamento por blocos, proposta, funil, painel | Parcial — pendem ticket médio (D1) e histórico de propostas (M4) |
| [clientes](requirements/clientes.md) | Cadastro do QAP, prospecção, locais, sistemas e equipamentos, ficha | Parcial — pende rodar a U155 (leitura do operacional) e a API do QAP (M3) |
| [financeiro](requirements/financeiro.md) | Contratos, cobrança do chamado, fechamentos, quem vê valores | Parcial — pende o texto padrão da cobrança (D5) |
| [acessos](requirements/acessos.md) | Cargos, matriz de telas, RLS, convites, Administrativo | Parcial — pendem trocar o cargo do Vinicius (G2), avisos ao gestor (D6), convites aceitos (D4) |
| [paineis](requirements/paineis.md) | Início, Operacional Técnica, Gestão Técnica, indicadores | Completo — orçamento de largura a 1366px em dívida (P77) |
| [interface](requirements/interface.md) | Design system, temas, tipografia, réguas | Parcial — pende aplicar a revisão de tipografia (D3, 66 desvios) |
| [plataforma](requirements/plataforma.md) | Build, publicação, versões, Supabase, migrations, verificação, hospedagem | Parcial — pendem instalar a v1.0.2 no servidor (G4), SITE_URL (G3), backup testado (I3) |
| [_template.md](requirements/_template.md) | Modelo — copiar para `requirements/<modulo>.md` ao criar um módulo | — |
