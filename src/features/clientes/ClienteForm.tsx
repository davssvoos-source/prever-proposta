// Os CARDS EDITÁVEIS da ficha do cliente — a ficha é uma página só (R203, U112).
//
// Davi, 2026-09-07: "na página do cliente, eu quero que tenha tudo, não deve
// conter outra página para configurar o cliente, deve estar tudo na mesma
// página. Quero que seja uma página só, com layout bem estruturado, design
// clean."
//
// Até a U111 este arquivo era UM formulário que substituía a ficha inteira
// (o "modo de configuração"). Agora são três cards da coluna de identidade,
// cada um com o próprio lápis: abre a edição NO LUGAR, com Salvar/Cancelar
// dentro do card, e grava só os campos daquele card. O resto da página
// continua visível o tempo todo.
//
//   · CardLocal     — nome, CNPJ/CPF, tipo de local, situação, endereço (com o
//                     "Localizar no mapa" e as guardas da U84), complemento.
//   · CardContatos  — síndico/proprietário, zelador/encarregado(a), financeiro.
//   · CardEstrutura — apartamentos, acessos controlados, observações.
//
// O nome do arquivo ficou (ClienteForm.tsx) de propósito: é onde o verificador
// cobra, letra por letra, as guardas do endereço da U84 — editar o texto zera
// a conferência e a coordenada; o campo e o botão travam durante a busca; o
// nome do lugar que o mapa respondeu é impresso para um humano ler.

import { useState, type CSSProperties, type ReactNode } from "react";
import { MapPin, Loader2, Pencil, Phone, Mail, Users, Building2, LayoutGrid, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { geocode } from "@/features/gerencial/data";
import { TIPO_LABEL, TIPOS_LOCAL, whatsappLink } from "@/features/gerencial/constants";
import { mascararDocumento, validarDocumento } from "@/lib/normalizar";
import { FONT, card, etiqueta, botaoSelecao, goldButton } from "@/lib/ui";
import { PRISMA, cinzas } from "@/lib/paleta";
import { copiarTexto } from "@/lib/copiar";
import { enderecoParaCopiar } from "./ficha";

/**
 * R207: os botões de COPIAR da ficha (e-mail, endereço). O texto copiado nasce
 * na lógica pura (ficha.ts); aqui só o gesto e a frase. Quando o navegador não
 * dá a área de transferência, a frase diz o que fazer em vez de fingir sucesso.
 */
async function copiar(texto: string, oQue: string) {
  const ok = await copiarTexto(texto);
  if (ok) toast.success(`${oQue} copiado.`);
  else toast.error(`Não consegui copiar o ${oQue.toLowerCase()} — selecione o texto e copie à mão.`);
}
import {
  SITUACAO_LABEL,
  SERVICO_ORDEM,
  SERVICOS_OFERECIDOS,
  SERVICO_LABEL,
  SERVICO_CORES,
  temServico,
  type Cliente,
  type ClientePatch,
  type SituacaoCliente,
} from "./data";

export interface CardDoClienteProps {
  cliente: Cliente;
  podeEditar: boolean;
  salvando: boolean;
  /** grava SÓ os campos do card; rejeita para o card ficar aberto */
  onSalvar: (patch: ClientePatch) => Promise<unknown>;
}

/** Os estilos que os três cards dividem — tokens do design system, nada local. */
function useEstilosDoCard() {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  const CARD: CSSProperties = { ...card(isLight), borderRadius: 18, padding: 18 };
  const SEC_LABEL: CSSProperties = {
    fontFamily: FONT, fontWeight: 700, fontSize: 10.5,
    letterSpacing: "0.10em", textTransform: "uppercase", color: gold,
  };
  const LABEL: CSSProperties = {
    fontFamily: FONT, fontWeight: 700, fontSize: 10.5,
    letterSpacing: "0.10em", textTransform: "uppercase",
    color: c.textoSecundario, marginBottom: 6, display: "block",
  };
  const INPUT: CSSProperties = {
    width: "100%", boxSizing: "border-box", height: 42, borderRadius: 12, padding: "0 13px",
    background: c.campo, border: `1px solid ${c.divisoria}`, color: c.texto,
    fontFamily: FONT, fontWeight: 400, fontSize: 14, outline: "none",
    colorScheme: isLight ? "light" : "dark",
  };
  const TEXTAREA: CSSProperties = { ...INPUT, height: 96, padding: "11px 13px", resize: "vertical", lineHeight: 1.5 };
  const NOTA: CSSProperties = { display: "block", marginTop: 6, fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: c.textoSecundario, lineHeight: 1.45 };
  const DUAS: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
  // R205: em leitura, rótulo | valor numa GRADE — o valor alinhado à esquerda,
  // na mesma coluna em todas as linhas, em vez de fugir para a direita à
  // medida que o card alarga com o monitor
  const linha: CSSProperties = {
    display: "grid", gridTemplateColumns: "minmax(96px, 30%) minmax(0, 1fr)", alignItems: "baseline",
    columnGap: 12, padding: "7px 0", borderTop: `1px solid ${c.divisoria}`,
  };
  const linhaLabel: CSSProperties = { fontFamily: FONT, fontSize: 12, fontWeight: 600, color: c.textoSecundario };
  const linhaValor: CSSProperties = {
    fontFamily: FONT, fontSize: 13, fontWeight: 400, color: c.texto,
    textAlign: "left", minWidth: 0, wordBreak: "break-word",
  };
  /** o valor com um botão de ação encostado à direita (WhatsApp, copiar) — R207 */
  const celulaAcao: CSSProperties = { display: "flex", alignItems: "center", gap: 8, minWidth: 0 };
  const botaoAcao: CSSProperties = {
    width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginLeft: "auto",
    background: c.campo, border: `1px solid ${c.divisoria}`, color: gold, cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none",
  };
  const botaoLeve: CSSProperties = {
    height: 30, padding: "0 11px", borderRadius: 10,
    background: c.campo, border: `1px solid ${c.divisoria}`, color: c.texto,
    cursor: "pointer", flexShrink: 0, fontFamily: FONT, fontSize: 12, fontWeight: 600,
    display: "inline-flex", alignItems: "center", gap: 6,
  };
  // o botão de seleção do design system, sem o brilho (R174)
  const chip = (ativo: boolean): CSSProperties => ({
    ...botaoSelecao(ativo, isLight, null), boxShadow: "none",
    padding: "7px 12px", borderRadius: 10, fontSize: 12,
  });
  return { isLight, c, gold, CARD, SEC_LABEL, LABEL, INPUT, TEXTAREA, NOTA, DUAS, linha, linhaLabel, linhaValor, celulaAcao, botaoAcao, botaoLeve, chip };
}

/**
 * A casca comum: micro-rótulo com ícone, o lápis (só para quem pode editar),
 * e — em edição — Salvar e Cancelar dentro do card. A mesma casca nos três,
 * para o olho aprender uma vez onde a edição mora.
 */
function CascaDoCard({ titulo, icone, podeEditar, editando, salvando, aoAbrir, aoCancelar, aoSalvar, children, rotuloSalvar = "Salvar" }: {
  titulo: string; icone: ReactNode; podeEditar: boolean; editando: boolean; salvando: boolean;
  aoAbrir: () => void; aoCancelar: () => void; aoSalvar: () => void; children: ReactNode; rotuloSalvar?: string;
}) {
  const s = useEstilosDoCard();
  return (
    <div style={{ ...s.CARD, display: "flex", flexDirection: "column", gap: editando ? 14 : 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: s.gold, display: "flex" }}>{icone}</span>
        <span style={s.SEC_LABEL}>{titulo}</span>
        <span style={{ flex: 1 }} />
        {podeEditar && !editando && (
          <button type="button" onClick={aoAbrir} aria-label={`Editar ${titulo.toLowerCase()}`} title="Editar" style={{ ...s.botaoLeve, width: 30, padding: 0, justifyContent: "center" }}>
            <Pencil size={13} color={s.gold} />
          </button>
        )}
      </div>
      {children}
      {editando && (
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
          <button type="button" onClick={aoCancelar} disabled={salvando} style={{ ...s.botaoLeve, height: 36, padding: "0 14px" }}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={aoSalvar}
            disabled={salvando}
            style={{
              ...goldButton(), boxShadow: "none", height: 36, padding: "0 16px", borderRadius: 10,
              fontFamily: FONT, fontWeight: 700, fontSize: 12.5,
              cursor: salvando ? "wait" : "pointer", opacity: salvando ? 0.7 : 1,
            }}
          >
            {salvando ? "Salvando…" : rotuloSalvar}
          </button>
        </div>
      )}
    </div>
  );
}

// ── O LOCAL ─────────────────────────────────────────────────────────────────

export function CardLocal({ cliente, podeEditar, salvando, onSalvar }: CardDoClienteProps) {
  const s = useEstilosDoCard();
  const [editando, setEditando] = useState(false);

  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [tipoLocal, setTipoLocal] = useState("");
  const [situacao, setSituacao] = useState<SituacaoCliente>("ativo");
  const [endereco, setEndereco] = useState("");
  const [complemento, setComplemento] = useState("");
  // R210: o serviço prestado é um item do card O local (era etiqueta no
  // cabeçalho, R41/R173). A gravação continua mandando o ARRAY inteiro.
  const [servicos, setServicos] = useState<string[]>([]);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [geocodificando, setGeocodificando] = useState(false);
  /**
   * O QUE O MAPA ENTENDEU — U84, e a ausência disto era o defeito.
   *
   * `geocode()` devolve `bairro/cidade/uf/display_name` desde a U84,
   * explicitamente "para um humano LER e dizer: não é essa cidade". A tela lia
   * `lat`/`lng` e JOGAVA O RESTO FORA: mostrava dois números e a palavra
   * "Coordenadas encontradas." O campo de endereço é UMA linha de texto livre
   * (não há campo de cidade nem de UF nesta ficha), e texto livre é COMO SE
   * ERRA DE CIDADE — "Rua São Paulo, 1200" com `countrycodes=br` e `limit=1`
   * devolve a homônima de Guarulhos, 26 km fora, sem erro nenhum.
   *
   * E NADA MAIS NO SISTEMA RECONFERE. O mapa de clientes desenha o ponto sem
   * opinar sobre ele, e todo rótulo que o sistema imprime é o NOME DO PRÉDIO,
   * que está certo — não existe tela onde a cidade errada apareça. O erro fica
   * PERMANENTE no cadastro e é invisível: quem for até lá vai ao lugar errado.
   */
  const [resolvido, setResolvido] = useState<string | null>(null);
  const servicosMarcados = SERVICO_ORDEM.filter((sv) => temServico(cliente, sv));

  function abrir() {
    setNome(cliente.nome ?? "");
    setDocumento(mascararDocumento(cliente.documento ?? ""));
    setTipoLocal(cliente.tipo_local ?? "");
    setSituacao(cliente.situacao ?? "ativo");
    setEndereco(cliente.endereco ?? "");
    setComplemento(cliente.complemento ?? "");
    setServicos([...((cliente.servicos_prestados ?? []) as string[])]);
    setLat(cliente.latitude ?? null);
    setLng(cliente.longitude ?? null);
    setResolvido(null);
    setEditando(true);
  }

  async function buscarCoordenadas() {
    if (!endereco.trim()) {
      toast.error("Informe o endereço primeiro.");
      return;
    }
    setGeocodificando(true);
    try {
      const r = await geocode(endereco.trim());
      if (r) {
        setLat(r.lat);
        setLng(r.lng);
        setResolvido(
          r.display_name || [r.bairro, r.cidade, r.uf].filter(Boolean).join(", ") || null,
        );
        toast.success("Coordenadas encontradas — confira o lugar abaixo.");
      } else {
        setResolvido(null);
        toast.error(
          // A CASCA `geocode()` COLAPSA "não achei" e "o serviço recusou" no
          // mesmo `null` — o SERVIDOR distingue os dois (`nao_encontrado` ×
          // `servico_falhou`) e a casca de gerencial/data.ts apaga a diferença.
          // Enquanto ela apagar, esta frase NÃO PODE afirmar que o endereço não
          // existe: o bloqueio do Nominatim é por IP e cai sobre a operação
          // inteira, e "este endereço não existe" é a única frase do sistema que
          // instrui a pessoa a martelar o serviço que acabou de bloqueá-la.
          "Não achei este endereço. Confira o texto (bairro e cidade ajudam) — e, se ele está certo, o serviço de mapas pode ter recusado agora: repetir na mesma hora não adianta.",
        );
      }
    } finally {
      setGeocodificando(false);
    }
  }

  async function salvar() {
    if (!nome.trim()) { toast.error("Informe o nome do cliente."); return; }
    if (!endereco.trim()) { toast.error("Informe o endereço — é o que identifica o local nas ordens de serviço."); return; }
    // documento é opcional, mas errado não passa: é a chave que concilia o
    // cliente com o QAP e sai impressa no fechamento para o financeiro
    if (!validarDocumento(documento)) { toast.error("CNPJ/CPF inválido. Confira os dígitos ou deixe o campo em branco."); return; }
    try {
      await onSalvar({
        nome: nome.trim(),
        nome_predio: nome.trim(),
        documento: documento.trim() || null,
        tipo_local: tipoLocal || null,
        situacao,
        endereco: endereco.trim(),
        complemento: complemento.trim() || null,
        servicos_prestados: servicos,
        latitude: lat,
        longitude: lng,
      });
      setEditando(false);
    } catch { /* o toast é da página; o card fica aberto para corrigir */ }
  }

  return (
    <CascaDoCard titulo="O local" icone={<Building2 size={15} />} podeEditar={podeEditar} editando={editando} salvando={salvando}
      aoAbrir={abrir} aoCancelar={() => setEditando(false)} aoSalvar={salvar}>
      {!editando ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ ...s.linha, borderTop: "none", paddingTop: 0 }}>
            <span style={s.linhaLabel}>Endereço</span>
            <span style={s.celulaAcao}>
              <span style={s.linhaValor}>{cliente.endereco ?? "—"}</span>
              {/* R207: o endereço inteiro (com complemento e cidade) vai para a área de transferência */}
              {cliente.endereco && (
                <button
                  type="button"
                  onClick={() => copiar(enderecoParaCopiar(cliente), "Endereço")}
                  title="Copiar endereço"
                  aria-label="Copiar endereço"
                  style={s.botaoAcao}
                >
                  <Copy size={13} />
                </button>
              )}
            </span>
          </div>
          {cliente.complemento && (
            <div style={s.linha}><span style={s.linhaLabel}>Complemento</span><span style={s.linhaValor}>{cliente.complemento}</span></div>
          )}
          {(cliente.cidade || cliente.uf) && (
            <div style={s.linha}><span style={s.linhaLabel}>Cidade</span><span style={s.linhaValor}>{[cliente.cidade, cliente.uf].filter(Boolean).join(" / ")}</span></div>
          )}
          <div style={s.linha}>
            <span style={s.linhaLabel}>Tipo de local</span>
            <span style={{ ...s.linhaValor, color: cliente.tipo_local ? s.c.textoSecundario : (s.isLight ? "#AD4700" : "#FA842D") }}>
              {cliente.tipo_local ? (TIPO_LABEL[cliente.tipo_local] ?? cliente.tipo_local) : "não informado"}
            </span>
          </div>
          <div style={s.linha}><span style={s.linhaLabel}>Situação</span><span style={s.linhaValor}>{SITUACAO_LABEL[cliente.situacao] ?? cliente.situacao}</span></div>
          {/* R210: o serviço prestado mora aqui — etiquetas sólidas (R177), "nenhum" quando não há */}
          <div style={{ ...s.linha, alignItems: "center" }}>
            <span style={s.linhaLabel}>Serviço prestado</span>
            <span style={{ display: "flex", flexWrap: "wrap", gap: 6, minWidth: 0 }}>
              {servicosMarcados.length === 0 ? (
                <span style={{ ...s.linhaValor, color: s.c.textoSecundario }}>nenhum</span>
              ) : servicosMarcados.map((sv) => (
                <span
                  key={sv}
                  style={{
                    padding: "3px 9px", borderRadius: 999, ...etiqueta(SERVICO_CORES[sv]),
                    fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase",
                  }}
                >
                  {SERVICO_LABEL[sv]}
                </span>
              ))}
            </span>
          </div>
          {cliente.documento && (
            <div style={s.linha}><span style={s.linhaLabel}>CNPJ / CPF</span><span style={{ ...s.linhaValor, fontFamily: "ui-monospace, Menlo, monospace" }}>{cliente.documento}</span></div>
          )}
          {/* R210: a linha "Coordenadas" saiu — dois números não dizem nada a quem
              lê a ficha; o mapa continua sendo conferido na edição ("O mapa entendeu") */}
        </div>
      ) : (
        <>
          <div>
            <label style={s.LABEL}>Nome do cliente / prédio</label>
            <input style={s.INPUT} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Condomínio Mansões do Lago" />
          </div>
          <div>
            <label style={s.LABEL}>CNPJ / CPF</label>
            <input style={s.INPUT} value={documento} onChange={(e) => setDocumento(mascararDocumento(e.target.value))} inputMode="numeric" placeholder="00.000.000/0000-00" />
            <span style={s.NOTA}>Sai impresso no fechamento e é o que casa este cliente com o cadastro do QAP.</span>
          </div>
          <div>
            <label style={s.LABEL}>Tipo de local</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {TIPOS_LOCAL.map((t) => (
                <button key={t} type="button" aria-pressed={tipoLocal === t} style={s.chip(tipoLocal === t)} onClick={() => setTipoLocal(t)}>
                  {TIPO_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={s.LABEL}>Situação</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(Object.keys(SITUACAO_LABEL) as SituacaoCliente[]).map((sit) => (
                <button key={sit} type="button" aria-pressed={situacao === sit} style={s.chip(situacao === sit)} onClick={() => setSituacao(sit)}>
                  {SITUACAO_LABEL[sit]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={s.LABEL}>Serviço prestado</label>
            {/* R173: um grupo ainda não aceito pelo banco não se OFERECE — mas, se
                já estiver marcado, aparece (para poder ser desmarcado). R41: a
                gravação manda o array inteiro. */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SERVICO_ORDEM.filter((s) => SERVICOS_OFERECIDOS.includes(s) || temServico(cliente, s)).map((sv) => {
                const tem = servicos.includes(sv);
                return (
                  <button
                    key={sv}
                    type="button"
                    aria-pressed={tem}
                    style={s.chip(tem)}
                    onClick={() => {
                      const novos = tem ? servicos.filter((x) => x !== sv) : [...servicos, sv];
                      setServicos(novos);
                    }}
                  >
                    {SERVICO_LABEL[sv]}
                  </button>
                );
              })}
            </div>
            <span style={s.NOTA}>Define o grupo de clientes em que este local entra nas atividades de grupo.</span>
          </div>
          <div>
            <label style={s.LABEL}>Endereço completo</label>
            {/* EDITAR O ENDEREÇO INVALIDA A CONFERÊNCIA E A COORDENADA.
                A frase impressa abaixo manda, com todas as letras, "corrija o
                endereço e localize de novo" — e o gestor fazia a primeira metade
                e esquecia a segunda. Sem esta limpeza, "O mapa entendeu: …
                Guarulhos" continuava na tela descrevendo um texto que o campo não
                contém mais, e o salvar gravava a coordenada de Guarulhos com o
                endereço novo.

                E O CAMPO TRAVA ENQUANTO A BUSCA ESTÁ NO AR, pelo mesmo motivo,
                por outra porta: sem isso, editar o texto DURANTE a requisição
                deixava a resposta do texto ANTIGO chegar depois e reescrever
                `resolvido`/`lat`/`lng` por cima do texto NOVO — a mesma frase
                obsoleta, a mesma coordenada errada, agora por CORRIDA em vez de
                por esquecimento. A espera é limitada (o freio do Nominatim, 1,1 s,
                mais o timeout de 4 s), e travar o campo fecha a corrida inteira
                sem `ref`, sem token de requisição e sem tocar no contrato de
                `geocode()`.

                E O GATILHO DA U84 NÃO PEGA ESTE CASO. Ele zera quando o endereço
                muda E a coordenada veio IGUAL; aqui a coordenada MUDOU (o botão
                foi apertado), a perna 2 é falsa, e ele não age.

                Zerar aqui é a mesma política do gatilho, um passo antes, onde a
                pessoa ainda vê: o campo passa a dizer "sem coordenadas" e o botão
                volta a ser o único caminho. */}
            <input
              style={s.INPUT}
              value={endereco}
              disabled={geocodificando}
              onChange={(e) => {
                setEndereco(e.target.value);
                setResolvido(null);
                setLat(null);
                setLng(null);
              }}
              placeholder="Rua, número, bairro, cidade"
            />
          </div>
          <div>
            <label style={s.LABEL}>Complemento</label>
            <input style={s.INPUT} value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="Bloco, torre, referência" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={buscarCoordenadas}
              disabled={geocodificando}
              style={{ ...s.botaoLeve, height: 36, padding: "0 14px", cursor: geocodificando ? "wait" : "pointer" }}
            >
              {geocodificando ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} color={s.gold} />}
              Localizar no mapa
            </button>
            <span style={{ fontFamily: FONT, fontSize: 11.5, color: s.c.textoSecundario, fontVariantNumeric: "tabular-nums" }}>
              {lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "sem coordenadas"}
            </span>
          </div>
          {/* DOIS NÚMEROS NÃO SÃO CONFERÍVEIS POR UM HUMANO. O nome do lugar é.
              Esta linha é a única rede que existe contra "o mapa achou a rua
              homônima na cidade errada": ler o que o mapa RESPONDEU, e não
              confiar no que foi MANDADO. */}
          {resolvido && (
            <span style={s.NOTA}>
              O mapa entendeu: <b style={{ color: s.c.texto }}>{resolvido}</b> — se não é este o lugar, corrija o endereço
              (inclua bairro e cidade) e localize de novo.
            </span>
          )}
          {resolvido === null && lat != null && lng != null && (
            <span style={s.NOTA}>
              Coordenada já cadastrada — ninguém conferiu nesta sessão de qual lugar ela é.
              Se o endereço acima mudou, use “Localizar no mapa” e leia o que o mapa responder.
            </span>
          )}
        </>
      )}
    </CascaDoCard>
  );
}

// ── CONTATOS ────────────────────────────────────────────────────────────────

/**
 * Um bloco de contato em leitura: nome, WhatsApp e e-mail — cada um com o seu
 * botão de ação (R207): "Enviar mensagem no WhatsApp" abre a conversa;
 * "Copiar e-mail" põe o endereço na área de transferência. O texto do e-mail
 * continua sendo um `mailto:` para quem prefere o cliente de e-mail.
 *
 * `whatsapp` ausente (undefined) ESCONDE a linha — o financeiro não tem
 * telefone; `null` mostra o traço, porque o síndico devia ter.
 */
export function Contato({ rotulo, nome, whatsapp, email, primeiro = false }: {
  rotulo: string; nome: string | null; whatsapp?: string | null; email: string | null;
  /** o primeiro contato do card não leva a linha divisória em cima */
  primeiro?: boolean;
}) {
  const s = useEstilosDoCard();
  if (!nome && !whatsapp && !email) return null;
  const link: CSSProperties = { ...s.linhaValor, color: s.gold, fontWeight: 600, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  const rotuloForte: CSSProperties = { ...s.linhaLabel, color: s.c.texto, display: "flex", alignItems: "center", gap: 6 };
  const rotuloLeve: CSSProperties = { ...s.linhaLabel, display: "flex", alignItems: "center", gap: 6 };
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: primeiro ? 0 : 6 }}>
      <div style={{ ...s.linha, ...(primeiro ? { borderTop: "none", paddingTop: 0 } : { paddingTop: 12 }) }}>
        <span style={rotuloForte}><Users size={13} color={s.gold} /> {rotulo}</span>
        <span style={{ ...s.linhaValor, fontWeight: 600 }}>{nome ?? "—"}</span>
      </div>
      {whatsapp !== undefined && (
        <div style={s.linha}>
          <span style={rotuloLeve}><Phone size={12} color={s.gold} /> WhatsApp</span>
          {whatsapp ? (
            <span style={s.celulaAcao}>
              <span style={s.linhaValor}>{whatsapp}</span>
              <a
                href={whatsappLink(whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                title="Enviar mensagem no WhatsApp"
                aria-label={`Enviar mensagem no WhatsApp para ${nome ?? rotulo}`}
                style={s.botaoAcao}
              >
                <MessageCircle size={13} />
              </a>
            </span>
          ) : <span style={s.linhaValor}>—</span>}
        </div>
      )}
      <div style={s.linha}>
        <span style={rotuloLeve}><Mail size={12} color={s.gold} /> E-mail</span>
        {email ? (
          <span style={s.celulaAcao}>
            <a href={`mailto:${email}`} style={link}>{email}</a>
            <button
              type="button"
              onClick={() => copiar(email, "E-mail")}
              title="Copiar e-mail"
              aria-label={`Copiar o e-mail de ${nome ?? rotulo}`}
              style={s.botaoAcao}
            >
              <Copy size={13} />
            </button>
          </span>
        ) : <span style={s.linhaValor}>—</span>}
      </div>
    </div>
  );
}

export function CardContatos({ cliente, podeEditar, salvando, onSalvar, veFinanceiro }: CardDoClienteProps & { veFinanceiro: boolean }) {
  const s = useEstilosDoCard();
  const [editando, setEditando] = useState(false);
  const [nomeSindico, setNomeSindico] = useState("");
  const [telSindico, setTelSindico] = useState("");
  const [emailSindico, setEmailSindico] = useState("");
  const [nomeZelador, setNomeZelador] = useState("");
  const [telZelador, setTelZelador] = useState("");
  const [emailZelador, setEmailZelador] = useState("");
  const [respFinanceiro, setRespFinanceiro] = useState("");
  const [emailFinanceiro, setEmailFinanceiro] = useState("");

  // Residência e galpão não têm síndico nem zelador: é proprietário e
  // encarregado(a) — o mesmo vocabulário do formulário da proposta (R147).
  const semSindico = cliente.tipo_local === "residencia" || cliente.tipo_local === "empresa";
  const rotulo1 = semSindico ? "Proprietário" : "Síndico";
  const rotulo2 = semSindico ? "Encarregado(a)" : "Zelador(a)";
  const temSindico = !!(cliente.nome_sindico || cliente.telefone_sindico || cliente.email_sindico);
  const temZelador = !!(cliente.nome_zelador || cliente.telefone_zelador || cliente.email_zelador);
  const semContatos = !temSindico && !temZelador
    && !(veFinanceiro && (cliente.responsavel_financeiro || cliente.email_financeiro));

  function abrir() {
    setNomeSindico(cliente.nome_sindico ?? "");
    setTelSindico(cliente.telefone_sindico ?? "");
    setEmailSindico(cliente.email_sindico ?? "");
    setNomeZelador(cliente.nome_zelador ?? "");
    setTelZelador(cliente.telefone_zelador ?? "");
    setEmailZelador(cliente.email_zelador ?? "");
    setRespFinanceiro(cliente.responsavel_financeiro ?? "");
    setEmailFinanceiro(cliente.email_financeiro ?? "");
    setEditando(true);
  }

  async function salvar() {
    try {
      await onSalvar({
        nome_sindico: nomeSindico.trim() || null,
        telefone_sindico: telSindico.trim() || null,
        email_sindico: emailSindico.trim() || null,
        nome_zelador: nomeZelador.trim() || null,
        telefone_zelador: telZelador.trim() || null,
        email_zelador: emailZelador.trim() || null,
        responsavel_financeiro: respFinanceiro.trim() || null,
        email_financeiro: emailFinanceiro.trim() || null,
      });
      setEditando(false);
    } catch { /* o toast é da página */ }
  }

  return (
    <CascaDoCard titulo="Contatos" icone={<Users size={15} />} podeEditar={podeEditar} editando={editando} salvando={salvando}
      aoAbrir={abrir} aoCancelar={() => setEditando(false)} aoSalvar={salvar}>
      {!editando ? (
        semContatos ? (
          <div style={{ fontFamily: FONT, fontSize: 12.5, color: s.c.textoSecundario, paddingTop: 10 }}>
            Nenhum contato cadastrado{podeEditar ? " — use o lápis para preencher." : "."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Contato primeiro rotulo={rotulo1} nome={cliente.nome_sindico} whatsapp={cliente.telefone_sindico} email={cliente.email_sindico} />
            <Contato primeiro={!temSindico} rotulo={rotulo2} nome={cliente.nome_zelador} whatsapp={cliente.telefone_zelador} email={cliente.email_zelador} />
            {/* o financeiro não tem WhatsApp: a linha nem aparece (whatsapp undefined) */}
            {veFinanceiro && (
              <Contato primeiro={!temSindico && !temZelador} rotulo="Financeiro" nome={cliente.responsavel_financeiro} email={cliente.email_financeiro} />
            )}
          </div>
        )
      ) : (
        <>
          {/* R146 (U96): nome, WHATSAPP e e-mail do síndico e do zelador — o
              telefone sempre foi o WhatsApp na prática; a ficha diz isso e abre
              o WhatsApp ao clicar. */}
          <div>
            <label style={s.LABEL}>{rotulo1}</label>
            <input style={s.INPUT} value={nomeSindico} onChange={(e) => setNomeSindico(e.target.value)} placeholder="Nome" />
          </div>
          <div style={s.DUAS}>
            <div>
              <label style={s.LABEL}>WhatsApp</label>
              <input style={s.INPUT} value={telSindico} onChange={(e) => setTelSindico(e.target.value)} inputMode="tel" placeholder="(11) 90000-0000" />
            </div>
            <div>
              <label style={s.LABEL}>E-mail</label>
              <input style={s.INPUT} value={emailSindico} onChange={(e) => setEmailSindico(e.target.value)} inputMode="email" />
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${s.c.divisoria}`, paddingTop: 12 }}>
            <label style={s.LABEL}>{rotulo2}</label>
            <input style={s.INPUT} value={nomeZelador} onChange={(e) => setNomeZelador(e.target.value)} placeholder="Nome" />
          </div>
          <div style={s.DUAS}>
            <div>
              <label style={s.LABEL}>WhatsApp</label>
              <input style={s.INPUT} value={telZelador} onChange={(e) => setTelZelador(e.target.value)} inputMode="tel" placeholder="(11) 90000-0000" />
            </div>
            <div>
              <label style={s.LABEL}>E-mail</label>
              <input style={s.INPUT} value={emailZelador} onChange={(e) => setEmailZelador(e.target.value)} inputMode="email" />
            </div>
          </div>
          {veFinanceiro && (
            <div style={{ ...s.DUAS, borderTop: `1px solid ${s.c.divisoria}`, paddingTop: 12 }}>
              <div>
                <label style={s.LABEL}>Financeiro / cobrança</label>
                <input style={s.INPUT} value={respFinanceiro} onChange={(e) => setRespFinanceiro(e.target.value)} placeholder="Nome ou setor" />
              </div>
              <div>
                <label style={s.LABEL}>E-mail do financeiro</label>
                <input style={s.INPUT} value={emailFinanceiro} onChange={(e) => setEmailFinanceiro(e.target.value)} inputMode="email" />
              </div>
            </div>
          )}
        </>
      )}
    </CascaDoCard>
  );
}

// ── ESTRUTURA E OBSERVAÇÕES ────────────────────────────────────────────────

export function CardEstrutura({ cliente, podeEditar, salvando, onSalvar }: CardDoClienteProps) {
  const s = useEstilosDoCard();
  const [editando, setEditando] = useState(false);
  const [qtdAptos, setQtdAptos] = useState("");
  const [qtdAcessos, setQtdAcessos] = useState("");
  const [observacoes, setObservacoes] = useState("");

  function abrir() {
    setQtdAptos(cliente.qtd_apartamentos?.toString() ?? "");
    setQtdAcessos(cliente.qtd_acessos?.toString() ?? "");
    setObservacoes(cliente.observacoes ?? "");
    setEditando(true);
  }

  async function salvar() {
    const nAptos = qtdAptos.trim() === "" ? null : Number(qtdAptos);
    const nAcessos = qtdAcessos.trim() === "" ? null : Number(qtdAcessos);
    if (nAptos !== null && (!Number.isFinite(nAptos) || nAptos < 0)) { toast.error("Quantidade de apartamentos inválida."); return; }
    if (nAcessos !== null && (!Number.isFinite(nAcessos) || nAcessos < 0)) { toast.error("Quantidade de acessos inválida."); return; }
    try {
      await onSalvar({ qtd_apartamentos: nAptos, qtd_acessos: nAcessos, observacoes: observacoes.trim() || null });
      setEditando(false);
    } catch { /* o toast é da página */ }
  }

  const vazio = cliente.qtd_apartamentos == null && cliente.qtd_acessos == null && !cliente.observacoes;

  return (
    <CascaDoCard titulo="Estrutura e observações" icone={<LayoutGrid size={15} />} podeEditar={podeEditar} editando={editando} salvando={salvando}
      aoAbrir={abrir} aoCancelar={() => setEditando(false)} aoSalvar={salvar}>
      {!editando ? (
        vazio ? (
          <div style={{ fontFamily: FONT, fontSize: 12.5, color: s.c.textoSecundario, paddingTop: 10 }}>
            Nada registrado{podeEditar ? " — use o lápis para preencher." : "."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {cliente.qtd_apartamentos != null && (
              <div style={{ ...s.linha, borderTop: "none", paddingTop: 0 }}><span style={s.linhaLabel}>Apartamentos / unidades</span><span style={s.linhaValor}>{cliente.qtd_apartamentos}</span></div>
            )}
            {cliente.qtd_acessos != null && (
              <div style={{ ...s.linha, ...(cliente.qtd_apartamentos == null ? { borderTop: "none", paddingTop: 0 } : {}) }}><span style={s.linhaLabel}>Acessos controlados</span><span style={s.linhaValor}>{cliente.qtd_acessos}</span></div>
            )}
            {cliente.observacoes && (
              <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 400, color: s.c.texto, marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                {cliente.observacoes}
              </div>
            )}
          </div>
        )
      ) : (
        <>
          <div style={s.DUAS}>
            <div>
              <label style={s.LABEL}>Apartamentos / unidades</label>
              <input style={s.INPUT} value={qtdAptos} onChange={(e) => setQtdAptos(e.target.value)} inputMode="numeric" placeholder="0" />
            </div>
            <div>
              <label style={s.LABEL}>Acessos controlados</label>
              <input style={s.INPUT} value={qtdAcessos} onChange={(e) => setQtdAcessos(e.target.value)} inputMode="numeric" placeholder="0" />
            </div>
          </div>
          <div>
            <label style={s.LABEL}>Observações</label>
            <textarea style={s.TEXTAREA} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Particularidades do local, acesso da equipe, histórico relevante…" />
          </div>
        </>
      )}
    </CascaDoCard>
  );
}
