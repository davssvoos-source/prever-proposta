// O painel do plantão — o mês em números, ao lado da escala (R122, U91).
//
// ── ELE MORA NA TELA DO SOBREAVISO, E ISSO É A ENTREGA ────────────────────
// A escala guarda o PLANO; o atendimento guarda o REGISTRO. Separá-los em duas
// telas obrigaria a comparar de memória. Aqui a grade do mês e o que de fato
// aconteceu nele ficam na mesma rolagem, com as MESMAS colunas de dia — é o
// mesmo `diasDoMes` dos dois lados.
//
// Nenhuma conta acontece neste arquivo: tudo vem de `./painel.ts`, que é puro
// e coberto por asserção. Aqui há JSX, cores e três estados de leitura.

import { useMemo, type CSSProperties } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend, Line, ComposedChart,
} from "recharts";
import { AlertTriangle, Moon, Sun, Sunset } from "lucide-react";
import { FONT, card } from "@/lib/ui";
import { ERRO, AVISO, PRISMA } from "@/lib/paleta";
import { usePessoasDoSobreaviso, useSobreaviso } from "@/features/sobreaviso/data";
import { useClientes } from "@/features/clientes/data";
import { useAtendimentosDoMes } from "./data";
import {
  kpisDoPlantao, porPlantonista, porCliente, serieDoMes, diaMaisPesado,
} from "./painel";

/** Quantas barras cabem num ranking sem espremer o rótulo. */
const TETO_RANKING = 6;

export function PainelDoPlantao({ mes, isLight }: { mes: string; isLight: boolean }) {
  const atendimentos = useAtendimentosDoMes(mes);
  const escala = useSobreaviso(mes);
  const { data: pessoas = [] } = usePessoasDoSobreaviso();
  const { data: clientes = [] } = useClientes();

  const textPrimary = isLight ? "#1e2229" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";
  const grade = isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.08)";

  const CARD: CSSProperties = {
    ...card(isLight), padding: "16px 18px",
    display: "flex", flexDirection: "column", gap: 12,
  };
  const SEC: CSSProperties = {
    fontFamily: FONT, fontWeight: 700, fontSize: 10,
    letterSpacing: "0.16em", textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.5)" : "rgba(248,200,17,0.65)",
  };

  const nomesDePessoa = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of pessoas as Array<{ id: string; nome: string | null }>) {
      if (p?.id) m[p.id] = p.nome ?? "Sem nome";
    }
    return m;
  }, [pessoas]);

  const nomesDeCliente = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of clientes as Array<{ id: string; nome: string | null }>) {
      if (c?.id) m[c.id] = c.nome ?? "Cliente sem nome";
    }
    return m;
  }, [clientes]);

  const linhas = atendimentos.data ?? [];
  const linhasDaEscala = escala.data ?? [];

  const kpis = useMemo(() => kpisDoPlantao(linhas, linhasDaEscala), [linhas, linhasDaEscala]);
  const serie = useMemo(() => serieDoMes(mes, linhas, linhasDaEscala), [mes, linhas, linhasDaEscala]);
  const rankPessoa = useMemo(
    () => porPlantonista(linhas, linhasDaEscala, nomesDePessoa), [linhas, linhasDaEscala, nomesDePessoa],
  );
  const rankCliente = useMemo(() => porCliente(linhas, nomesDeCliente), [linhas, nomesDeCliente]);
  const pico = useMemo(() => diaMaisPesado(serie), [serie]);

  // ── OS TRÊS ESTADOS DE LEITURA, E ELES NÃO SE CONFUNDEM ─────────────────
  // A U86 aprendeu isto do jeito caro: uma consulta RECUSADA virava uma grade
  // dizendo "31 dias descobertos", e o PDF exportava essa mentira. Aqui erro,
  // carregando e vazio são três telas diferentes — e o vazio só é vazio depois
  // que a leitura VOLTOU.
  if (atendimentos.isError) {
    return (
      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={15} color={isLight ? ERRO.light : ERRO.dark} />
          <span style={SEC}>Plantão do mês</span>
        </div>
        <span style={{ fontFamily: FONT, fontSize: 12.5, color: isLight ? ERRO.light : ERRO.dark }}>
          Não foi possível ler os atendimentos: {(atendimentos.error as Error)?.message ?? "erro desconhecido"}.
          Os números abaixo não seriam zero — seriam desconhecidos.
        </span>
      </div>
    );
  }
  if (atendimentos.isLoading) {
    return (
      <div style={CARD}>
        <span style={SEC}>Plantão do mês</span>
        <span style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary }}>Carregando os atendimentos…</span>
      </div>
    );
  }

  const KPI = ({ rotulo, valor, nota, cor, icone }: {
    rotulo: string; valor: string | number; nota?: string; cor?: string; icone?: React.ReactNode;
  }) => (
    <div style={{
      flex: "1 1 120px", minWidth: 120, borderRadius: 14, padding: "10px 12px",
      background: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${grade}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        {icone}
        <span style={{ fontFamily: FONT, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em",
                       textTransform: "uppercase", color: textSecondary }}>{rotulo}</span>
      </div>
      <div style={{ fontFamily: FONT, fontSize: 21, fontWeight: 800,
                    color: cor ?? textPrimary, fontVariantNumeric: "tabular-nums" }}>{valor}</div>
      {nota && <div style={{ fontFamily: FONT, fontSize: 10.5, color: textSecondary }}>{nota}</div>}
    </div>
  );

  const Ranking = ({ titulo, dados, vazio }: {
    titulo: string;
    dados: Array<{ chave: string; rotulo: string; total: number; naEscala?: number }>;
    vazio: string;
  }) => {
    const visiveis = dados.slice(0, TETO_RANKING);
    const restante = dados.length - visiveis.length;
    return (
      <div style={{ flex: "1 1 260px", minWidth: 240 }}>
        <div style={{ ...SEC, marginBottom: 8 }}>{titulo}</div>
        {visiveis.length === 0 ? (
          <span style={{ fontFamily: FONT, fontSize: 12, color: textSecondary }}>{vazio}</span>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(90, visiveis.length * 26 + 10)}>
            <BarChart data={visiveis} layout="vertical" margin={{ left: 0, right: 16, top: 2, bottom: 2 }}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="rotulo" width={110} tickLine={false} axisLine={false}
                     tick={{ fontFamily: FONT, fontSize: 10.5, fill: textSecondary }} />
              <RTooltip
                cursor={{ fill: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.05)" }}
                contentStyle={{ fontFamily: FONT, fontSize: 11, borderRadius: 10, border: `1px solid ${grade}`,
                                background: isLight ? "#fff" : "#14141a", color: textPrimary }}
                formatter={(v: number, _n, p: any) =>
                  p?.payload?.naEscala !== undefined
                    ? [`${v} (${p.payload.naEscala} na escala)`, "atendimentos"]
                    : [v, "atendimentos"]}
              />
              <Bar dataKey="total" radius={[0, 6, 6, 0]} fill={gold} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        )}
        {restante > 0 && (
          <span style={{ fontFamily: FONT, fontSize: 10.5, color: textSecondary }}>
            {/* O TETO É DECLARADO, e não silencioso: um ranking cortado sem
                dizer que cortou lê-se como a lista inteira. */}
            + {restante} fora do topo {TETO_RANKING}
          </span>
        )}
      </div>
    );
  };

  const divergentes = kpis.foraDaEscala + kpis.semEscala;

  return (
    <div style={CARD}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={SEC}>O que aconteceu no plantão deste mês</span>
        <span style={{ flex: 1 }} />
        {pico && (
          <span style={{ fontFamily: FONT, fontSize: 11, color: textSecondary }}>
            dia mais pesado: {pico.dia} ({pico.total})
          </span>
        )}
      </div>

      {kpis.total === 0 ? (
        <span style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary }}>
          Nenhum atendimento de plantão registrado neste mês. A escala acima diz quem
          estava de sobreaviso; esta seção diz o que foi atendido — e um mês sem
          registro é um mês sem chamada, ou um mês em que ninguém registrou.
        </span>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <KPI rotulo="Atendimentos" valor={kpis.total}
                 nota={`${kpis.remoto} remoto · ${kpis.presencial} presencial`} />
            <KPI rotulo="Madrugada" valor={kpis.madrugada} icone={<Moon size={12} color={textSecondary} />}
                 nota="00h às 08h" />
            <KPI rotulo="Noite" valor={kpis.noite} icone={<Sunset size={12} color={textSecondary} />}
                 nota="18h às 24h" />
            <KPI rotulo="No expediente" valor={kpis.emHorarioDeEquipe}
                 icone={<Sun size={12} color={textSecondary} />}
                 cor={kpis.emHorarioDeEquipe > 0 ? (isLight ? AVISO.light : AVISO.dark) : undefined}
                 nota="dia útil, 08h às 18h" />
            <KPI rotulo="Fora da escala" valor={divergentes}
                 cor={divergentes > 0 ? (isLight ? AVISO.light : AVISO.dark) : undefined}
                 nota={`${kpis.foraDaEscala} de outro · ${kpis.semEscala} sem escala`} />
            <KPI rotulo="Com chamado" valor={kpis.comChamado}
                 nota={`${kpis.semChamado} sem vínculo`} />
          </div>

          {kpis.semHora > 0 && (
            /* Um atendimento sem faixa não é zero em lugar nenhum — ele é
               contado à parte, e a tela diz. Somá-lo à madrugada faria o
               painel inventar um horário. */
            <span style={{ fontFamily: FONT, fontSize: 11, color: isLight ? AVISO.light : AVISO.dark }}>
              {kpis.semHora} atendimento(s) sem hora legível — fora das faixas acima.
            </span>
          )}

          {/* A SÉRIE DO MÊS, com a escala por trás. As barras são atendimentos
              por faixa; a linha é quantas horas de sobreaviso havia lançadas
              naquele dia. É o que deixa ver "teve chamada em dia descoberto". */}
          <ResponsiveContainer width="100%" height={190}>
            <ComposedChart data={serie} margin={{ left: -18, right: 6, top: 6, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grade} vertical={false} />
              <XAxis dataKey="dia" tickLine={false} axisLine={false} interval={1}
                     tick={{ fontFamily: FONT, fontSize: 9.5, fill: textSecondary }} />
              <YAxis yAxisId="a" allowDecimals={false} tickLine={false} axisLine={false}
                     tick={{ fontFamily: FONT, fontSize: 9.5, fill: textSecondary }} />
              <YAxis yAxisId="h" orientation="right" hide />
              <RTooltip
                contentStyle={{ fontFamily: FONT, fontSize: 11, borderRadius: 10, border: `1px solid ${grade}`,
                                background: isLight ? "#fff" : "#14141a", color: textPrimary }}
                labelFormatter={(d) => `dia ${d}`}
              />
              <Legend wrapperStyle={{ fontFamily: FONT, fontSize: 10.5 }} />
              <Bar yAxisId="a" stackId="f" dataKey="madrugada" name="madrugada" fill={PRISMA.azul.dark} />
              <Bar yAxisId="a" stackId="f" dataKey="expediente" name="expediente" fill={isLight ? AVISO.light : AVISO.dark} />
              <Bar yAxisId="a" stackId="f" dataKey="noite" name="noite" fill={gold} radius={[4, 4, 0, 0]} />
              <Line yAxisId="h" type="stepAfter" dataKey="horasDeEscala" name="horas de escala"
                    stroke={isLight ? "#047862" : "#2DD2A5"} strokeWidth={1.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>

          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <Ranking titulo="Por plantonista" dados={rankPessoa}
                     vazio="Nenhum atendimento com plantonista." />
            <Ranking titulo="Por cliente" dados={rankCliente}
                     vazio="Nenhum atendimento com cliente." />
          </div>
        </>
      )}
    </div>
  );
}
