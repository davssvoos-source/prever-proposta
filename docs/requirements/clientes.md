# Clientes — Requisitos

Identificador do módulo: `clientes`.

Propósito: O cadastro que vem do QAP, a prospecção, os locais, os sistemas instalados e
equipamentos, e a ficha do cliente.

## Síntese (EARS)

<!-- A síntese é a leitura executiva do módulo; a autoridade é a regra citada, em ../PRODUTO.md. -->

- O sistema NÃO DEVE cadastrar cliente: cliente vem do QAP (R10, R21); `clientes` não tem policy de
  INSERT.
- Prédio orçado DEVE ser PROSPECÇÃO e continuar prospecção depois da proposta (R22).
- QUANDO um equipamento entra, ele DEVE vir do QAP com sete campos (R196, R237); o local do QAP casa
  EXATO ou não casa (R199).
- O sistema instalado DEVE ser um BLOCO do cliente criado no app, e o vínculo equipamento → bloco
  DEVE ser por arrasto em dois painéis (R200, R206).
- A ficha do cliente DEVE ser UMA página de desktop, em colunas que terminam na mesma linha, e o
  centro de tudo o que se refere ao cliente (R128, R201, R203, R209, R219).
- A coordenada de um cliente DEVE ser fato conferido, e o endereço vale sem o mapa (R114, R242).

## As regras que governam o módulo

As regras são ditadas pelo Davi e vivem em `../PRODUTO.md` — o catálogo, com `R#` único no sistema
(ADR-0001, ADR-0002). Esta tabela é a VISTA do módulo: número e essência, extraída do catálogo.
Fora deste arquivo, cite `produto:R#` ou simplesmente `R#`. Regra nova entra no catálogo primeiro e
depois nesta tabela; a cobertura de cada uma está em `../state/clientes.md`.

| Regra | Essência |
|---|---|
| R10 | Clientes e equipamentos (estoque e por cliente) vêm do QAP via API; o resto é centralizado no app |
| R21 | O cliente é do QAP, não nosso |
| R22 | Prospecto não é cliente |
| R41 | Cliente tem "Serviço prestado" |
| R51 | No mapa da página Clientes, cada bairro mostra o próprio nome escrito dentro do polígono (no centro geométr… |
| R52 | O mapa de Clientes ganhou zoom e pan completos ("mecanismo de zoom.. |
| R55 | A lista de Clientes é paginada, 10 por vez, com numerador no final: primeira página, anterior, os números (… |
| R61 | A página de Clientes virou tela fixa a partir de 1024px: a página em si não rola mais — quem rola, se preci… |
| R62 | Dois ajustes no mapa de Clientes: - Arrastar o mapa não seleciona mais texto. O nome de um bairro é `<text>… |
| R63 | A ficha do cliente ganhou a estrutura permanente de blocos: registrar, uma vez, como cada acesso do condomí… |
| R71 | Cinco acertos na página de Clientes |
| R74 | No mapa de Clientes, a roda do mouse dá zoom sozinha |
| R92 | Em Clientes, um eixo de filtro só: Serviço |
| R114 | A coordenada de um cliente é um fato CONFERIDO, não um palpite que sobrevive ao endereço |
| R128 | A página do cliente é o centro de tudo o que se refere ao cliente |
| R146 | A ficha do cliente é tela de computador, em duas colunas, e tem síndico e zelador (nome, WhatsApp, e-mail),… |
| R159 | O catálogo de sistemas ganha o controle de acesso eletrônico e a sua central; a Prever também faz portaria … |
| R160 | A integração com o QAP ERP sincroniza uma vez por dia e tem o botão "Sincronizar", que pede o sincronismo à… |
| R166 | O Catálogo usa a guarda padrão e será refeito: equipamentos pelo QAP, serviços editados no app, blocos no b… |
| R173 | Portaria Autônoma e Portaria Presencial são grupos de clientes, ao lado de Portaria Remota e Monitoramento … |
| R192 | A tela /mapa não existe mais, e o botão "Mapa" saiu do Painel Comercial |
| R196 | O equipamento entra com sete campos: Almoxarifado, Tipo de Categoria, Modelo, Fabricante, Identificação, Lo… |
| R197 | Identificação é opcional, e o campo existe sempre |
| R198 | O catálogo do sistema é a tela "Equipamentos cadastrados" (`/equipamentos`): uma linha por VARIAÇÃO |
| R199 | O local do QAP casa EXATO ou não casa |
| R200 | Sistema instalado é um BLOCO do cliente, criado no app; o equipamento vem do QAP e é VINCULADO ao bloco — a… |
| R201 | A ficha do cliente é uma página de computador: cabeçalho de página e duas colunas |
| R202 | Em cliente que já é nosso, o bloco é NOMEADO direto e recebe os equipamentos do QAP — sem a estrutura por p… |
| R203 | A ficha do cliente é UMA página só: não existe tela nem modo de configuração; cada card edita no lugar |
| R205 | A ficha do cliente preenche a largura da janela |
| R206 | O vínculo equipamento → bloco é por ARRASTO, em dois painéis lado a lado |
| R207 | Contato e endereço têm botões de ação |
| R208 | Os painéis de blocos e de equipamentos rolam por dentro, não a página |
| R209 | A ficha do cliente é de desktop: três colunas, cada uma com a forma do seu conteúdo |
| R210 | O serviço prestado é um item do card O local; a linha "Coordenadas" sai |
| R211 | A estrutura do local (apartamentos, acessos, observações) é parte do card O local — não um card à parte |
| R212 | Na ficha do cliente, a coluna Atividades usa o MESMO card da Início |
| R218 | Na ficha do cliente, visitas técnicas, chamados e atividades ficam na MESMA lista |
| R219 | As colunas da ficha terminam na mesma linha |
| R237 | Equipamento entra no cliente só pelo QAP; numa atividade só se move para dentro de um bloco ou se remove do… |
| R242 | O endereço vale sem o mapa |
| R293 | A baixa de equipamento gera UMA atividade para o Gilleno por ATENDIMENTO, com a lista do que saiu |

## Fora de escopo

- Quem LÊ a base de clientes (gestor, operacional) e quem ESCREVE: módulo `acessos` (R305).
- Mapa de clientes: a tela `/mapa` saiu (R192); o mapa da lista tem zoom e pan (R52, R74).

## Referências

- Manual: `../manual/clientes-qap.md`.
- Dados da carga: `../importacao/` (não é documentação).
- ADRs: ADR-0002.
- Estado da implementação: `../state/clientes.md`.
