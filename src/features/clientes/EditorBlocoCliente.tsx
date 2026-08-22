// Editor da ESTRUTURA de um bloco na ficha do cliente — R63/U52.
//
// Davi: "montar a estrutura de cada cliente de acordo com os blocos de cada
// cliente... uma vez que a gente registrar o layout, não precisaremos mais
// fazer isso, pois ficará salvo."
//
// MESMO VOCABULÁRIO do wizard de orçamento (src/lib/blocos.ts): as mesmas
// opções de barreira/entrada/saída/abertura, e o MESMO `gerarCodigoBloco` —
// então um bloco cadastrado aqui usa a régua que o Davi já conhece
// ("PED-2B-...-PR"), sem reinventar vocabulário.
//
// FORMULÁRIO ÚNICO, não wizard passo-a-passo: o wizard de orçamento
// (visita.$id.orcamento.blocos.$cat.tsx) faz uma pergunta por tela porque
// está construindo o bloco do zero, sem nada ainda escolhido. Aqui é edição
// de um registro que já existe (ou nasce com um padrão razoável) — os campos
// relevantes aparecem e desaparecem no MESMO formulário conforme a escolha
// (trocar de "Porta" para "Elevador" troca os campos abaixo na hora), o que
// é mais rápido pra ajustar depois do que reabrir um wizard inteiro.
//
// ESCOPO (R63): só os tipos que `gerarCodigoBloco` sabe montar sem sub-wizard
// próprio — PED, VEI, CFTV, AL, CER, CENT (ver TIPOS_COM_ESTRUTURA em
// inventario.ts). ELV/TOT continuam no modo simples (nome/descrição).

import { useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LABELS, OPCOES, CAT_NOMES, gerarCodigoBloco, gerarDescricaoBloco,
  type BlocoConfig, type BarreiraConfig, type TipoBloco,
} from "@/lib/blocos";
import { salvarConfigBloco, type SistemaInstalado } from "./inventario";
import { useModalEstilos, BotaoFechar } from "./InventarioCliente";
import { configPadrao, configValida } from "./blocoCliente";

const SUFIXOS_PORTARIA = [
  { valor: "PR", label: "Portaria Remota" },
  { valor: "PP", label: "Portaria Presencial" },
  { valor: "PA", label: "Portaria Autônoma" },
  { valor: "SM", label: "Sem portaria (residência/galpão)" },
] as const;

interface Props {
  sistema: SistemaInstalado;
  onFechar: () => void;
}

export function EditorBlocoCliente({ sistema, onFechar }: Props) {
  const s = useModalEstilos();
  const qc = useQueryClient();
  const tipoBloco = sistema.tipo as TipoBloco;

  const [config, setConfig] = useState<BlocoConfig>(
    () => sistema.config_bloco ?? configPadrao(tipoBloco),
  );

  const codigo = useMemo(() => (configValida(config) ? gerarCodigoBloco(config) : null), [config]);
  const descricaoPreview = useMemo(
    () => (configValida(config) ? gerarDescricaoBloco(config) : null),
    [config],
  );

  const salvar = useMutation({
    mutationFn: () => salvarConfigBloco(sistema.id, config),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-inventario", sistema.cliente_id] });
      toast.success("Estrutura do bloco salva.");
      onFechar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valido = configValida(config);

  return (
    <>
      <div style={s.backdrop} onClick={() => !salvar.isPending && onFechar()} />
      <div style={{ ...s.painel, width: "min(520px, 92vw)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={s.titulo}>Estrutura do bloco — {sistema.nome}</span>
          <BotaoFechar onClick={onFechar} />
        </div>
        <div style={{ fontFamily: "var(--fonte)", fontSize: 11.5, color: s.textSecondary, marginBottom: 16 }}>
          {CAT_NOMES[tipoBloco]}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(tipoBloco === "PED" || tipoBloco === "VEI") && (
            <>
              <Alternador
                estilos={s}
                rotulo="É uma eclusa (2 barreiras)?"
                valor={config.eclusa}
                aoMudar={(eclusa) => setConfig((c) => ({
                  ...c, eclusa,
                  b2: eclusa ? (c.b2 ?? { tipo: tipoBloco === "PED" ? "PORP" : "PORV", entrada: "", saida: "" }) : c.b2,
                }))}
              />
              <CampoBarreira
                estilos={s}
                tipoBloco={tipoBloco}
                rotulo={config.eclusa ? "Barreira 1" : "Barreira"}
                valor={config.b1}
                aoMudar={(b1) => setConfig((c) => ({ ...c, b1 }))}
              />
              {config.eclusa && (
                <CampoBarreira
                  estilos={s}
                  tipoBloco={tipoBloco}
                  rotulo="Barreira 2"
                  valor={config.b2}
                  aoMudar={(b2) => setConfig((c) => ({ ...c, b2 }))}
                />
              )}
              <SelectCampo
                estilos={s}
                rotulo="Sistema de portaria"
                valor={config.portaria ?? "PR"}
                opcoes={SUFIXOS_PORTARIA.map((o) => ({ valor: o.valor, label: o.label }))}
                aoMudar={(portaria) => setConfig((c) => ({ ...c, portaria: portaria as BlocoConfig["portaria"] }))}
              />
            </>
          )}

          {tipoBloco === "CFTV" && (
            <>
              <SelectCampo
                estilos={s}
                rotulo="Tecnologia"
                valor={config.tecnologia ?? ""}
                opcoes={OPCOES.tecCftv.map((v) => ({ valor: v, label: LABELS[v] }))}
                aoMudar={(tecnologia) => setConfig((c) => ({ ...c, tecnologia }))}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <CampoNumero
                  estilos={s} rotulo="Câmeras dome" valor={config.qtdDome ?? 0}
                  aoMudar={(qtdDome) => setConfig((c) => ({ ...c, qtdDome }))}
                />
                <CampoNumero
                  estilos={s} rotulo="Câmeras bullet" valor={config.qtdBullet ?? 0}
                  aoMudar={(qtdBullet) => setConfig((c) => ({ ...c, qtdBullet }))}
                />
              </div>
            </>
          )}

          {tipoBloco === "AL" && (
            <SelectCampo
              estilos={s}
              rotulo="Tecnologia"
              valor={config.tecnologia ?? ""}
              opcoes={OPCOES.tecAl.map((v) => ({ valor: v, label: LABELS[v] }))}
              aoMudar={(tecnologia) => setConfig((c) => ({ ...c, tecnologia }))}
            />
          )}

          {tipoBloco === "CER" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <CampoNumero
                estilos={s} rotulo="Perímetro (metros)" valor={config.perimetro ?? 0}
                aoMudar={(perimetro) => setConfig((c) => ({ ...c, perimetro }))}
              />
              <CampoNumero
                estilos={s} rotulo="Esquinas" valor={config.esquinas ?? 0}
                aoMudar={(esquinas) => setConfig((c) => ({ ...c, esquinas }))}
              />
            </div>
          )}

          {tipoBloco === "CENT" && (
            <SelectCampo
              estilos={s}
              rotulo="Sistema de portaria"
              valor={config.portaria ?? "PR"}
              opcoes={SUFIXOS_PORTARIA.map((o) => ({ valor: o.valor, label: o.label }))}
              aoMudar={(portaria) => setConfig((c) => ({ ...c, portaria: portaria as BlocoConfig["portaria"] }))}
            />
          )}

          {/* Prévia — o mesmo código/descrição que o orçamento gera, ao vivo,
              antes de salvar. É o que deixa "bati tudo certo?" auditável sem
              precisar salvar pra descobrir. */}
          <div style={{
            borderRadius: 12, padding: "11px 13px",
            background: s.isLight ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.045)",
          }}>
            <div style={{
              fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 9.5, letterSpacing: "0.10em",
              textTransform: "uppercase", color: s.gold, marginBottom: 5,
            }}>
              Código do bloco
            </div>
            {valido ? (
              <>
                <div style={{
                  fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12.5, fontWeight: 600,
                  color: s.textPrimary, wordBreak: "break-all",
                }}>
                  {codigo}
                </div>
                <div style={{ fontFamily: "var(--fonte)", fontSize: 11.5, color: s.textSecondary, marginTop: 4 }}>
                  {descricaoPreview}
                </div>
              </>
            ) : (
              <div style={{ fontFamily: "var(--fonte)", fontSize: 12, color: s.textSecondary }}>
                Complete os campos acima para gerar o código.
              </div>
            )}
          </div>

          <button
            style={{ ...s.cta, opacity: salvar.isPending || !valido ? 0.6 : 1 }}
            disabled={salvar.isPending || !valido}
            onClick={() => salvar.mutate()}
          >
            {salvar.isPending ? "Salvando…" : "Salvar estrutura"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Pecinhas do formulário ───────────────────────────────────────────────────

type Estilos = ReturnType<typeof useModalEstilos>;

function Alternador({ estilos: s, rotulo, valor, aoMudar }: {
  estilos: Estilos; rotulo: string; valor: boolean; aoMudar: (v: boolean) => void;
}) {
  return (
    <div>
      <label style={s.label}>{rotulo}</label>
      <div style={{ display: "flex", gap: 8 }}>
        {[{ v: false, l: "Não" }, { v: true, l: "Sim" }].map((o) => (
          <button
            key={String(o.v)}
            onClick={() => aoMudar(o.v)}
            style={{
              flex: 1, height: 40, borderRadius: 10, cursor: "pointer",
              border: valor === o.v ? "none" : s.isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
              background: valor === o.v ? "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)" : s.isLight ? "#f5f6f8" : "rgba(255,255,255,0.03)",
              color: valor === o.v ? "#08090E" : s.textPrimary,
              fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 13,
            }}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectCampo({ estilos: s, rotulo, valor, opcoes, aoMudar, placeholder }: {
  estilos: Estilos; rotulo: string; valor: string; opcoes: { valor: string; label: string }[];
  aoMudar: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label style={s.label}>{rotulo}</label>
      <select value={valor} onChange={(e) => aoMudar(e.target.value)} style={{ ...s.input, cursor: "pointer" }}>
        {placeholder && <option value="">{placeholder}</option>}
        {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
      </select>
    </div>
  );
}

function CampoNumero({ estilos: s, rotulo, valor, aoMudar }: {
  estilos: Estilos; rotulo: string; valor: number; aoMudar: (v: number) => void;
}) {
  return (
    <div>
      <label style={s.label}>{rotulo}</label>
      <input
        type="number"
        min={0}
        value={valor}
        onChange={(e) => aoMudar(Math.max(0, Number(e.target.value) || 0))}
        style={s.input}
      />
    </div>
  );
}

/**
 * Uma barreira (b1 ou b2). Os campos que aparecem seguem EXATAMENTE
 * `barreiraSteps()` do wizard de orçamento (blocos.$cat.tsx) — mesma régua,
 * só que tudo no mesmo formulário em vez de uma tela por pergunta.
 */
function CampoBarreira({ estilos: s, tipoBloco, rotulo, valor, aoMudar }: {
  estilos: Estilos; tipoBloco: "PED" | "VEI"; rotulo: string;
  valor: BarreiraConfig | undefined; aoMudar: (v: BarreiraConfig) => void;
}) {
  const v = valor ?? { tipo: "", entrada: "", saida: "" };

  const tiposBarreira = tipoBloco === "PED"
    ? [{ valor: "CAT", label: "Catraca" }, { valor: "PORP", label: "Porta" }, { valor: "ELEV", label: "Elevador" }]
    : [{ valor: "CAN", label: "Cancela" }, { valor: "PORV", label: "Portão Veicular" }];

  const opcoesDe = (mapa: Record<string, readonly string[]>) =>
    (mapa[v.tipo] ?? []).map((t) => ({ valor: t, label: LABELS[t] }));
  const opcoesEntrada = opcoesDe({ CAT: OPCOES.entradaCat, PORP: OPCOES.entradaPorp, CAN: OPCOES.entradaCan, PORV: OPCOES.entradaPorv });
  const opcoesSaida = opcoesDe({ CAT: OPCOES.saidaCat, PORP: OPCOES.saidaPorp, CAN: OPCOES.saidaCan, PORV: OPCOES.saidaPorv });

  const ehElevador = v.tipo === "ELEV";
  const temEntradaSaida = !!v.tipo && !ehElevador;
  const temAbertura = (v.tipo === "PORP" || v.tipo === "PORV") && !!v.entrada && !!v.saida;
  const opcoesAbertura = v.tipo === "PORP" ? OPCOES.aberturaPed : v.tipo === "PORV" ? OPCOES.aberturaVei : [];

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 10, padding: 12, borderRadius: 12,
      border: s.isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.10)",
    }}>
      <span style={{ fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 11, color: s.gold }}>{rotulo}</span>

      <SelectCampo
        estilos={s} rotulo="Tipo" valor={v.tipo} opcoes={tiposBarreira} placeholder="— escolher —"
        // trocar de tipo invalida entrada/saída/abertura escolhidos — são
        // outra lista de opções, e manter o valor velho geraria um código
        // com um token que nem aparece na lista daquele tipo
        aoMudar={(tipo) => aoMudar({ tipo, entrada: "", saida: "" })}
      />

      {ehElevador && (
        <>
          <SelectCampo
            estilos={s} rotulo="Quantidade de elevadores" valor={v.tamanho ?? ""} placeholder="— escolher —"
            opcoes={OPCOES.qtdElevadores.map((t) => ({ valor: t, label: LABELS[t] }))}
            aoMudar={(tamanho) => aoMudar({ ...v, tamanho })}
          />
          <SelectCampo
            estilos={s} rotulo="Porta corta-fogo" valor={v.abertura ?? ""} placeholder="— escolher —"
            opcoes={OPCOES.cortaFogo.map((t) => ({ valor: t, label: LABELS[t] }))}
            aoMudar={(abertura) => aoMudar({ ...v, abertura })}
          />
        </>
      )}

      {temEntradaSaida && (
        <>
          <SelectCampo
            estilos={s} rotulo="Entrada" valor={v.entrada} placeholder="— escolher —"
            opcoes={opcoesEntrada}
            aoMudar={(entrada) => aoMudar({ ...v, entrada })}
          />
          <SelectCampo
            estilos={s} rotulo="Saída" valor={v.saida} placeholder="— escolher —"
            opcoes={opcoesSaida}
            // trocar a saída não deveria mexer em abertura/peso/etc., mas
            // como abertura só aparece DEPOIS de entrada+saída estarem
            // preenchidos, não há valor de abertura órfão possível aqui
            aoMudar={(saida) => aoMudar({ ...v, saida })}
          />
        </>
      )}

      {temAbertura && (
        <SelectCampo
          estilos={s} rotulo="Abertura" valor={v.abertura ?? ""} placeholder="— escolher —"
          opcoes={opcoesAbertura.map((t) => ({ valor: t, label: LABELS[t] }))}
          aoMudar={(abertura) => aoMudar({
            ...v, abertura,
            // trocar de abertura invalida peso/folhas/tamanho da abertura
            // anterior — MOL tinha peso, BASC/PIVO têm tamanho/folhas, e são
            // conceitos diferentes mesmo quando o nome do campo se repete
            peso: undefined, folhas: undefined, tamanho: undefined,
          })}
        />
      )}

      {v.tipo === "PORP" && v.abertura === "MOL" && (
        <SelectCampo
          estilos={s} rotulo="Peso da porta" valor={v.peso ?? ""} placeholder="— escolher —"
          opcoes={OPCOES.pesoMola.map((t) => ({ valor: t, label: LABELS[t] }))}
          aoMudar={(peso) => aoMudar({ ...v, peso })}
        />
      )}

      {v.tipo === "PORV" && v.abertura === "PIVO" && (
        <>
          <SelectCampo
            estilos={s} rotulo="Folhas" valor={v.folhas ?? ""} placeholder="— escolher —"
            opcoes={OPCOES.folhasPivo.map((t) => ({ valor: t, label: LABELS[t] }))}
            aoMudar={(folhas) => aoMudar({ ...v, folhas })}
          />
          <SelectCampo
            estilos={s} rotulo="Tamanho do vão" valor={v.tamanho ?? ""} placeholder="— escolher —"
            opcoes={OPCOES.tamanhoPivo.map((t) => ({ valor: t, label: LABELS[t] }))}
            aoMudar={(tamanho) => aoMudar({ ...v, tamanho })}
          />
        </>
      )}

      {v.tipo === "PORV" && v.abertura === "BASC" && (
        <SelectCampo
          estilos={s} rotulo="Tamanho do vão" valor={v.tamanho ?? ""} placeholder="— escolher —"
          opcoes={OPCOES.tamanhoBasc.map((t) => ({ valor: t, label: LABELS[t] }))}
          aoMudar={(tamanho) => aoMudar({ ...v, tamanho })}
        />
      )}
      {/* DESL: sem pergunta de peso — sempre 1500KG, mesma regra do wizard
          original (só trabalhamos com esse motor) */}
    </div>
  );
}
