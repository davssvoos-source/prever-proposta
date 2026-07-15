# Regras de Blocos — Escopo Técnico do Orçamento

> Documento de revisão. Reflete TODAS as regras implementadas no motor de blocos
> até 15/07/2026 (fonte: `blockAutoItems.ts`, `alarmeEngine.ts`, `guarita.ts`,
> `TotemWizard.tsx`, `ElevadoresWizard.tsx`, telas do fluxo de orçamento).
> Marque cada regra como ✅ correta, ✏️ ajustar ou ➕ acrescente as que faltam.

---

## 0. Conceitos gerais

| Conceito | Regra atual |
|---|---|
| **Sufixo de portaria** | Todo bloco de acesso recebe sufixo no código: `-PR` (Portaria Remota), `-PP` (Portaria Presencial), `-PA` (Portaria Autônoma) ou `-SM` (sem portaria). Vem do "Sistema Proposto". **Sufixos permitidos por tipo de local:** Condomínios → PR/PP/PA (default PR) · **Galpão → PR, PP, PA ou SM** (SM quando sem sistema definido) · **Residência → SOMENTE SM** (nunca tem portaria). |
| **Troca de sistema (PR↔PP↔PA)** | Regenera o código de todos os blocos e apaga os itens automáticos (recalculados ao reabrir cada bloco). Blocos de Elevadores e Totem não são regenerados (código próprio, não depende de portaria). |
| **Eclusa** | Bloco de acesso pode ser 1B (1 barreira) ou 2B (eclusa, 2 barreiras). |
| **Itens automáticos × manuais** | Itens `auto` são recalculados pelo motor; itens `manual` (adicionados na busca por nome/modelo) são preservados. Remoções manuais de itens auto também são preservadas. |

---

## 1. Blocos de Acesso (Pedestres — PED / Veicular — VEI)

### 1.1 Leitoras e acionamentos (por ocorrência no bloco)
| Sigla | Equipamento | Qtd |
|---|---|---|
| FAC | EQ011 — Leitora Facial | 1 por FAC |
| FAC | EQ032 — Acrílico Somente Facial | 1 por FAC |
| FAC + CAT | EQ012 — Suporte Facial p/ Catraca | 1 por FAC (só se o bloco tem catraca) |
| DIG | EQ214 — Leitora Biometria Digital | 1 por DIG |
| BOTANA | EQ021 — Botoeira comum + EQ035 — Acrílico do botão | 1+1 por BOTANA |
| BOTAPR | EQ020 — Botoeira por aproximação | 1 por BOTAPR |
| LPR | EQ092 — Câmera IP LPR | 1 por LPR |

### 1.2 Receptores RF e Módulo Guarita
| Regra | Detalhe |
|---|---|
| CTRL (controle remoto) | EQ004 — Receptor RF RTX 3004: **1 por bloco/eclusa** que tenha CTRL (não soma por barreira — 1 receptor atende as 2 barreiras da mesma eclusa). |
| TAG | EQ007 — Receptor HCS Multifunção RMF3004: **1 por TAG**. |
| Módulo Guarita | EQ003 — MG 3000: **⌈(total de RTX + RMF de TODOS os blocos do projeto) ÷ 4⌉**. Os blocos "conversam entre si": o item aparece uma única vez, no primeiro bloco de acesso que tem receptores, com a quantidade do projeto inteiro. Recalculado a cada salvamento de bloco e ao abrir o resumo. |

### 1.3 Barreiras físicas
| Sigla | Equipamento | Qtd |
|---|---|---|
| CAT | EQ016 — Catraca | 1 por CAT |
| CAN | EQ055 — Cancela e Braço 4m | 1 por CAN |
| PORP | EQ022 — Display Puxe/Empurre + EQ027 — Fechadura magnética c/ sensor | 1+1 por PORP |
| LAC | EQ064 — Central de Laço Indutivo + EQ065 — Laço físico | **1+1 por LAC** |
| Fotocélula (só VEI) | EQ215 — Fotocélula anti-esmagamento (unidade; 1 par = 2 un) | **Cancela (CAN): 2 pares por cancela** · **Portão veicular (PORV): deslizante → 1 par; pivotante ou basculante → 2 pares por barreira** · **cada sigla FOT soma +1 par** |
| MOL | EQ030 — Mola aérea | 1 por MOL |

### 1.4 Motores
| Configuração | Equipamento |
|---|---|
| PED + PORP + MOT | EQ201 — Motor de giro p/ porta pedestre (1 por MOT) |
| Basculante 1,5m / 2,0m / 2,5m / 3,0m | EQ038 / EQ039 / EQ040 / EQ041 (1 por ocorrência) |
| Deslizante até 800kg / 1300kg / 1500kg | EQ042 / EQ043 / EQ044 (1 por ocorrência) |
| Pivotante 1 folha — 2,0m / 3,5m / 4,5m | EQ045 / EQ046 / EQ047 (motor completo) |
| Pivotante 2 folhas — 2,0m / 3,5m / 4,5m | EQ048+EQ051 / EQ049+EQ052 / EQ050+EQ053 (par direita+esquerda) |

### 1.5 Regras condicionadas à portaria (sufixo do projeto)
| Condição | Itens |
|---|---|
| PORP + projeto PR | EQ118 — Sensor magnético mini (1 por PORP) + EQ213 — Módulo relé 8CH ×2 |
| Projeto PR + eclusa (2B) | EQ213 — Módulo relé 8CH ×1 adicional |
| **Interfone (PED + PR)** | EQ017 — Interfone IP + EQ033 — Acrílico do interfone: 1 de cada **por barreira** |
| **Interfone (VEI + PR)** | NÃO leva interfone, **exceto** PORV + eclusa (2B) + FAC → 1 interfone + 1 acrílico |
| **Vídeo porteiro (PED + PP)** | EQ019: 1 por barreira de pedestres que tenha **FAC, DIG ou PORTARIA** |
| **Vídeo porteiro (VEI + PP)** | Mesma regra do interfone PR: só **PORV + eclusa (2B) + FAC** → 1 EQ019 |
| **PORV + projeto PR** | ALM_XASPAS — XAS Porta de Aço c/ Suporte: 1 por portão veicular |
| Projeto SM (Residência/Galpão) | Nenhuma regra de portaria é aplicada (sem interfone, relés, sensor, vídeo porteiro) |

---

## 2. CFTV

Configuração por câmera: tipo (Dome/Bullet), metragem de cabo (0–100+ m) e I.As.

### 2.1 Câmeras
| Tecnologia | Dome | Bullet |
|---|---|---|
| IP | EQ089 — Câmera IP Dome G4 | EQ300 — Câmera IP Bullet |
| Analógico | EQ078 — Câmera analógica Dome | EQ077 — Câmera analógica Bullet |

### 2.2 Gravador (pela soma de câmeras do bloco)
| Total de câmeras | IP (NVR) | Analógico (DVR) |
|---|---|---|
| até 4 | EQ301 (4ch) | EQ069 (4ch) |
| 5–8 | EQ084 (8ch) | EQ068 (8ch) |
| 9–16 | EQ085 (16ch) | EQ067 (16ch) |
| 17–32 | EQ086 (32ch) | EQ066 (32ch) |
| 33–36 | 32ch + 4ch | idem analógico |
| 37–40 | 32ch + 8ch | idem |
| 41–48 | 32ch + 16ch | idem |
| 49–64 | 2× 32ch | idem |
| >64 | ⌈n/32⌉ × 32ch | idem |

### 2.3 HD (1 por gravador, pelo porte do gravador)
| Gravador | HD |
|---|---|
| 4 canais | EQ097 |
| 8 ou 16 canais | EQ096 |
| 32 canais | EQ095 |

### 2.4 Acessórios e cabo
| Item | Regra |
|---|---|
| EQ073 — Balun passivo | 1 por câmera (só analógico) |
| EQ098 — Caixa plástica organizadora | 1 por câmera |
| EQ302 — Cabo de rede CAT5-E (caixa 300 m) | ⌈soma dos metros de todas as câmeras ÷ 300⌉ (0 m → sem cabo) |

### 2.5 I.A por câmera → serviços MENSAIS (não entram na lista de equipamentos)
| I.A | Serviço | Valor/mês |
|---|---|---|
| Leitura de Placas (LPR) | SV030 | R$ 170,00 |
| Detecção de presença | SV031 | R$ 110,00 |
| Detecção de ausência | SV032 | R$ 190,00 |
| Detecção de movimento | SV033 | R$ 190,00 |

Qtd de cada serviço = nº de câmeras do bloco com aquela I.A marcada. Exibidos na seção "Mensalidades".

---

## 3. Alarme (fluxo por zonas)

Zona = ambiente. Cada zona: tipo de sensor + qtd (1–3 sensores ou pares) + cabeamento (com fio).

### 3.1 Com fio (AMT 4010)
| Seleção | Equipamento |
|---|---|
| IVP Interno | ALM_IVP5311 — IVP 5311 MW PET |
| IVP Externo | ALM_IVP7000 — IVP 7000 MW EX |
| IVA até 40 m (par) | ALM_IVA5040 — IVA 5040 AT |
| IVA até 80 m (par) | ALM_IVA5080 — IVA 5080 AT |
| Porta interna / Janela interna | ALM_XASSOBP — XAS Sobrepor: **⌈total de sensores sobrepor ÷ 5⌉ pacotes** (vende em pacote c/ 5) |
| Porta externa / Janela externa | ALM_XASPAM — XAS Porta de Aço Mini (1 por unidade) |
| Zona marcada "TX sem fio" | ALM_TX4020 — TX 4020 Smart: **1 por sensor** da zona (sem cabo) |

**Central (com fio)** — automática:
| Item | Regra |
|---|---|
| ALM_AMT4010 + ALM_XEG4000 (GPRS) + ALM_XB1270 (bateria) + ALM_SIRMOREY (sirene 12V) | 1 de cada, **exceto em projeto de Portaria Remota** (a central e a sirene já vêm no bloco CENT — não duplica) |
| ALM_XAR4000 — XAR 4000 Smart | +1 quando o local é **Residência ou Galpão** |
| ALM_XEZ4008 — Expansor de zonas | **⌈nº de zonas ÷ 8⌉** |
| EQ302 — Cabo (caixa 300 m) | ⌈soma dos metros das zonas cabeadas ÷ 300⌉ |

### 3.2 Sem fio (AMT 8000)
| Seleção | Equipamento |
|---|---|
| IVP Interno | ALM_IVP4101 — IVP 4101 PET Smart |
| IVP Externo | ALM_IVP8000EXG2 — IVP 8000 EX G2 |
| IVA 40 m (par) | ALM_IVA8040 — IVA 8040 AT |
| Porta / Janela | ALM_XAS8000 — XAS 8000 (1 por abertura) |

**Central (sem fio)** — automática: ALM_AMT8000 + ALM_XAG8000 (GPRS) + **ALM_XSS8000 (sirene, 1 por projeto)** + **ALM_XAT8000 (teclado — a central não acompanha)**, sempre (inclusive em projeto PR, pois é painel físico diferente).
**Repetidor**: ALM_REP8000 — contador manual, decisão do técnico pela distância/obstáculos.
Sem expansor de zonas e sem cabo no sem fio.

---

## 4. Cerca Elétrica

Entrada: perímetro (m) + nº de esquinas.

| Item | Regra |
|---|---|
| EQ146 — Haste industrial | ⌈perímetro ÷ 3⌉ |
| EQ147 — Sapata | 1 por haste (⌈p ÷ 3⌉) |
| EQ150 — Fio inox 0,90 mm (rolo 25 m) | ⌈perímetro ÷ 25⌉ |
| EQ153 — Placa de aviso | ⌈perímetro ÷ 6⌉ |
| EQ148 — Haste cantoneira | 1 por esquina |
| Eletrificador | ≤400 m: EQ141 (ELC 5001) · ≤1250 m: EQ142 (ELC 5002) · ≤1750 m: EQ143 (ELC 5003) · >1750 m: ⌈p ÷ 1750⌉ × EQ143 |
| Por eletrificador | EQ154 — Bateria 12v 7A ×1 · EQ155 — Haste aterramento ×1 · EQ156 — Conector ×1 · EQ157 — Caixa de aterramento ×2 |

---

## 5. Elevadores (Kit Antena)

Entrada: quantidade de kits. Por kit:
| Item | Qtd |
|---|---|
| EQ158 — Switch POE 4P | 1 |
| EQ166 — Roteador W4-300S | 2 |
| EQ167 — Antena Wom 5a | 1 |
| EQ170 — Suporte 40cm | 2 |
| EQ169 — Telefone TDMI 400 | 1 |
| EQ089 — Câmera IP Dome G4 | 1 |
| EQ171 — Filtro de linha 5 tomadas | 1 |

---

## 6. Totem de Monitoramento

Entrada: nº de totens + câmeras por totem (2, 3 ou 4; padrão 3). Por totem:
| Item | Qtd |
|---|---|
| EQ197 — Switch 8P | 1 |
| EQ174 — Fonte 12v 5A | 1 |
| EQ303 — Poste 2,6 m | 1 |
| EQ300 — Câmera IP Bullet | total de câmeras dos totens |

---

## 7. Central de Portaria Remota (CENT)

Criada automaticamente quando o Sistema Proposto = Portaria Remota (condomínios);
removida ao trocar para PP/PA (com confirmação se houver edições manuais). Máx. 1 por visita.

| Item | Qtd |
|---|---|
| EQ001 — Roteador Firewall DrayTek Vigor 2915 | 1 |
| EQ002 — ATA PABX Grandstream HT813 | 1 |
| EQ189 — Rack Armário 12U | 1 |
| EQ190 — Rack Bandeja | 2 |
| EQ191 — Calha 8 Tomadas | 1 |
| EQ192 — Caixa Comando 80x60 | 1 |
| EQ193 — Caixa Rack p/ Relês | 1 |
| EQ099 — Central de Alarme AMT 4010 | 1 |
| EQ100 — Sirene 12v | 1 |
| EQ102 — Módulo GPRS XEG 4000 | 1 |
| EQ103 — Expansor de PGM XEP 4004 | 4 |
| EQ023 — Botão de Emergência | 1 |
| EQ024 — GiroFlex 12v | 1 |

---

## 8. Fluxos por Tipo de Local

| Tipo de Local | 1ª tela do orçamento | Particularidades |
|---|---|---|
| Cond. Vertical / Horizontal | Estrutura (qtd apartamentos, sistema atual, sistema proposto, Airbnb) | CENT-PR automática se sistema = PR |
| Residência / Galpão | Proposta (Serviço Proposto: Monitoramento 24h \| Implantação de Sistema) | Blocos com sufixo SM (sem regras de portaria); XAR 4000 na central de alarme com fio |

---

## ✅ Dúvidas resolvidas (revisão de 15/07/2026)

1. **Fonte auxiliar p/ IVAs (com fio)**: NÃO precisa — sem regra de fonte.
2. **Sirene no Alarme**: 1 sirene automática por projeto, conforme a central: com fio → ALM_SIRMOREY (suprimida em projeto PR, já vem na CENT) · sem fio → ALM_XSS8000.
3. **Teclado no Alarme sem fio**: SIM — 1 ALM_XAT8000 automático (a AMT 8000 não acompanha teclado).
4. **XAS 8000 em zona**: SIM — vale a regra de zona (máx. 3 por zona) também para portas/janelas sem fio.
5. **Guarita em Residência/Galpão**: SIM — receptores e Módulo Guarita aplicam-se a projetos SM, mas somente se houver CTRL ou TAG no escopo (comportamento atual).
