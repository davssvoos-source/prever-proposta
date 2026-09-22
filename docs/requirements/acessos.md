# Acessos — Requisitos

Identificador do módulo: `acessos`.

Propósito: Cargos, matriz de telas, RLS, convites e o Painel Administrativo — quem pode o quê.

## Síntese (EARS)

<!-- A síntese é a leitura executiva do módulo; a autoridade é a regra citada, em ../PRODUTO.md. -->

- O sistema DEVE decidir o que cada cargo lê NO BANCO (RLS), e a matriz de telas DEVE ser
  configuração, não código (R18): admin, comercial, sac, operacional, tecnico e gestor (R13, R244,
  R304).
- Papel responde "o que pode"; equipe responde "de quem é a fila" — equipes nunca viram papel (R15,
  R81).
- A conta DEVE nascer por convite, nunca por cadastro próprio (R59, R277); convite pendente se
  cancela pela lista (R204).
- Todos os usuários DEVEM ver todas as atividades (R221), exceto o cargo técnico, que lê só campo
  (R264).
- O gestor e o operacional DEVEM ler TODA a base de clientes; escrever continua com quem tem relação
  de trabalho (R305).
- O Painel Administrativo DEVE ser a mesa do admin: Usuários | Permissões, conteúdo próprio, sem
  KPIs (R131, R193, R298).

## As regras que governam o módulo

As regras são ditadas pelo Davi e vivem em `../PRODUTO.md` — o catálogo, com `R#` único no sistema
(ADR-0001, ADR-0002). Esta tabela é a VISTA do módulo: número e essência, extraída do catálogo.
Fora deste arquivo, cite `produto:R#` ou simplesmente `R#`. Regra nova entra no catálogo primeiro e
depois nesta tabela; a cobertura de cada uma está em `../state/acessos.md`.

| Regra | Essência |
|---|---|
| R1 | O SAC é gestor |
| R2 | O Comercial também não é técnico |
| R3 | O Admin é tudo |
| R6 | O Controle Patrimonial usa o perfil de técnico; o chamado dele é o pedido de compra |
| R13 | Papéis definidos: Davi e Vinicius são Admin; Gilleno, Nicholas, Erik e Breno são Técnicos; o SAC é gestor q… |
| R15 | As equipes reais (confirmadas no export do Notion) incluem SAC e Monitoramento / Portaria — entraram no dom… |
| R18 | Quem abre cada tela é configuração, não código |
| R59 | Cadastrar um usuário não depende do e-mail sair |
| R81 | Saem Audiovisual e Business Ops; entra "Outras" |
| R129 | O Administrativo ganha uma aba de APIs, e o QAP ERP só é lido |
| R131 | O Administrativo TEM o conteúdo, em vez de apontar para ele |
| R158 | A Rubia é SAC: supervisora e líder da equipe de atendimento da Portaria Remota, e abre e gerencia os chamad… |
| R193 | O Administrativo é duas colunas — Usuários | Permissões — e as APIs abrem por um botão que troca a página p… |
| R204 | Convite pendente se cancela pela própria lista |
| R221 | Todos os usuários veem todas as atividades |
| R244 | O perfil OPERACIONAL |
| R264 | O técnico lê só atividade de campo — e todas as da equipe |
| R277 | A conta nasce por CONVITE; ninguém se cadastra sozinho — e só quem é do time lê |
| R294 | O cargo OPERACIONAL cria atividade interna e NÃO executa chamado de campo |
| R298 | O Painel Administrativo é a mesa do admin no desktop: sem KPIs, sem os textos de apresentação, com os convi… |
| R304 | Existe o cargo GESTOR: quem manda na equipe técnica de campo. Hoje é o Vinicius |
| R305 | Quem vê TODA a base de clientes: quem manda (gestor) e quem vê tudo (operacional). A tela aberta e o dado p… |

## Fora de escopo

- Quem entra na escala de sobreaviso (cargo técnico): módulo `campo` (R265).
- Senha: ninguém a digita pelo Davi; recuperação é do GoTrue.

## Referências

- Manual: `../manual/permissoes-e-acesso.md`, `../manual/seguranca.md`.
- ADRs: ADR-0002.
- Estado da implementação: `../state/acessos.md`.
