// Formulário de cliente — usado no cadastro (/clientes/novo) e na configuração
// (/clientes/$id). Campos agrupados por assunto, no design system da casa:
// card(isLight), micro-rótulo, campo em cinza neutro, botão de seleção sem
// brilho, e o botão dourado como ÚNICA ação principal.
//
// ── R201 (U111): DUAS COLUNAS NO DESKTOP ────────────────────────────────────
// Davi, 2026-09-07: "revise toda a página de configuração do cliente" (com
// "layout para desktop"). Era uma coluna só de quatro cards empilhados, com
// 46px de campo e um segundo tema claro (gradientes próprios). Agora:
//   · coluna 1 — quem é e onde fica: Identificação, Endereço;
//   · coluna 2 — com quem falar e o que tem: Contatos, Estrutura do local.
// No celular empilha na mesma ordem (.ficha-colunas em styles.css). Nenhum
// campo entrou nem saiu; o que muda é o lugar e o desenho.
//
// As guardas do endereço (U84) continuam iguais, letra por letra: editar o
// texto zera a conferência e a coordenada; o campo e o botão travam durante
// a busca; o nome do lugar que o mapa respondeu é impresso para um humano ler.

import { useState, type CSSProperties } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { geocode } from "@/features/gerencial/data";
import { TIPO_LABEL, TIPOS_LOCAL } from "@/features/gerencial/constants";
import { mascararDocumento, validarDocumento } from "@/lib/normalizar";
import { FONT, card, botaoSelecao, goldButton } from "@/lib/ui";
import { PRISMA, cinzas } from "@/lib/paleta";
import {
  SITUACAO_LABEL,
  type Cliente,
  type ClientePatch,
  type SituacaoCliente,
} from "./data";

export interface ClienteFormProps {
  inicial?: Cliente | null;
  salvando?: boolean;
  onSubmit: (patch: ClientePatch) => void;
  onCancelar?: () => void;
  rotuloAcao?: string;
}

export function ClienteForm({ inicial, salvando, onSubmit, onCancelar, rotuloAcao }: ClienteFormProps) {
  const { isLight } = useTheme();

  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [documento, setDocumento] = useState(mascararDocumento(inicial?.documento ?? ""));
  const [respFinanceiro, setRespFinanceiro] = useState(inicial?.responsavel_financeiro ?? "");
  const [emailFinanceiro, setEmailFinanceiro] = useState(inicial?.email_financeiro ?? "");
  const [tipoLocal, setTipoLocal] = useState(inicial?.tipo_local ?? "");
  const [situacao, setSituacao] = useState<SituacaoCliente>(inicial?.situacao ?? "ativo");
  const [endereco, setEndereco] = useState(inicial?.endereco ?? "");
  const [complemento, setComplemento] = useState(inicial?.complemento ?? "");
  const [lat, setLat] = useState<number | null>(inicial?.latitude ?? null);
  const [lng, setLng] = useState<number | null>(inicial?.longitude ?? null);
  const [geocodificando, setGeocodificando] = useState(false);
  /**
   * O QUE O MAPA ENTENDEU — U84, e a ausência disto era o defeito.
   *
   * `geocode()` devolve `bairro/cidade/uf/display_name` desde a U84,
   * explicitamente "para um humano LER e dizer: não é essa cidade". Esta tela
   * lia `lat`/`lng` e JOGAVA O RESTO FORA: mostrava dois números e a palavra
   * "Coordenadas encontradas." O campo de endereço é UMA linha de texto livre
   * (não há campo de cidade nem de UF nesta ficha), e texto livre é COMO SE
   * ERRA DE CIDADE — "Rua São Paulo, 1200" com `countrycodes=br` e `limit=1`
   * devolve a homônima de Guarulhos, 26 km fora, sem erro nenhum.
   *
   * E NADA MAIS NO SISTEMA RECONFERE. O mapa de clientes desenha o ponto sem
   * opinar sobre ele, e todo rótulo que o sistema imprime é o NOME DO PRÉDIO,
   * que está certo — não existe tela onde a cidade errada apareça. O erro fica
   * PERMANENTE no cadastro e é invisível: quem for até lá vai ao lugar errado.
   *
   * A correção não acrescenta mecanismo nenhum e não faz UMA requisição a mais:
   * ela para de apagar o que já foi buscado.
   */
  const [resolvido, setResolvido] = useState<string | null>(null);
  const [nomeSindico, setNomeSindico] = useState(inicial?.nome_sindico ?? "");
  const [telSindico, setTelSindico] = useState(inicial?.telefone_sindico ?? "");
  const [emailSindico, setEmailSindico] = useState(inicial?.email_sindico ?? "");
  const [nomeZelador, setNomeZelador] = useState(inicial?.nome_zelador ?? "");
  const [telZelador, setTelZelador] = useState(inicial?.telefone_zelador ?? "");
  const [emailZelador, setEmailZelador] = useState(inicial?.email_zelador ?? "");
  const [qtdAptos, setQtdAptos] = useState(inicial?.qtd_apartamentos?.toString() ?? "");
  const [qtdAcessos, setQtdAcessos] = useState(inicial?.qtd_acessos?.toString() ?? "");
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? "");

  const c = cinzas(isLight);
  const textPrimary = c.texto;
  const textSecondary = c.textoSecundario;
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;

  const CARD: CSSProperties = {
    ...card(isLight), borderRadius: 18, padding: 16,
    display: "flex", flexDirection: "column", gap: 12,
  };
  const SEC_LABEL: CSSProperties = {
    fontFamily: FONT, fontWeight: 700, fontSize: 10.5,
    letterSpacing: "0.10em", textTransform: "uppercase", color: gold,
  };
  const LABEL: CSSProperties = {
    fontFamily: FONT, fontWeight: 700, fontSize: 10.5,
    letterSpacing: "0.10em", textTransform: "uppercase",
    color: textSecondary, marginBottom: 6, display: "block",
  };
  const INPUT: CSSProperties = {
    width: "100%", boxSizing: "border-box", height: 42, borderRadius: 12, padding: "0 13px",
    background: c.campo, border: `1px solid ${c.divisoria}`, color: textPrimary,
    fontFamily: FONT, fontWeight: 400, fontSize: 14, outline: "none",
    colorScheme: isLight ? "light" : "dark",
  };
  const TEXTAREA: CSSProperties = { ...INPUT, height: 96, padding: "11px 13px", resize: "vertical", lineHeight: 1.5 };
  const NOTA: CSSProperties = { display: "block", marginTop: 6, fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary, lineHeight: 1.45 };
  const DUAS: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };

  // o botão de seleção do design system, sem o brilho (R174)
  const chip = (ativo: boolean): CSSProperties => ({
    ...botaoSelecao(ativo, isLight, null), boxShadow: "none",
    padding: "8px 13px", borderRadius: 10, fontSize: 12,
  });

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

  function submeter() {
    if (!nome.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    if (!endereco.trim()) {
      toast.error("Informe o endereço — é o que identifica o local nas ordens de serviço.");
      return;
    }
    // documento é opcional, mas errado não passa: é a chave que concilia o
    // cliente com o QAP e sai impressa no fechamento para o financeiro
    if (!validarDocumento(documento)) {
      toast.error("CNPJ/CPF inválido. Confira os dígitos ou deixe o campo em branco.");
      return;
    }
    const nAptos = qtdAptos.trim() === "" ? null : Number(qtdAptos);
    const nAcessos = qtdAcessos.trim() === "" ? null : Number(qtdAcessos);
    if (nAptos !== null && (!Number.isFinite(nAptos) || nAptos < 0)) {
      toast.error("Quantidade de apartamentos inválida.");
      return;
    }
    if (nAcessos !== null && (!Number.isFinite(nAcessos) || nAcessos < 0)) {
      toast.error("Quantidade de acessos inválida.");
      return;
    }
    onSubmit({
      nome: nome.trim(),
      nome_predio: nome.trim(),
      documento: documento.trim() || null,
      responsavel_financeiro: respFinanceiro.trim() || null,
      email_financeiro: emailFinanceiro.trim() || null,
      tipo_local: tipoLocal || null,
      situacao,
      endereco: endereco.trim(),
      complemento: complemento.trim() || null,
      latitude: lat,
      longitude: lng,
      nome_sindico: nomeSindico.trim() || null,
      telefone_sindico: telSindico.trim() || null,
      email_sindico: emailSindico.trim() || null,
      nome_zelador: nomeZelador.trim() || null,
      telefone_zelador: telZelador.trim() || null,
      email_zelador: emailZelador.trim() || null,
      qtd_apartamentos: nAptos,
      qtd_acessos: nAcessos,
      observacoes: observacoes.trim() || null,
    });
  }

  const semSindico = tipoLocal === "residencia" || tipoLocal === "empresa";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="ficha-colunas">
        {/* ══ COLUNA 1 — quem é e onde fica ═══════════════════════════════════ */}
        <section aria-label="Identificação e endereço" style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <div style={CARD}>
            <span style={SEC_LABEL}>Identificação</span>
            <div>
              <label style={LABEL}>Nome do cliente / prédio</label>
              <input style={INPUT} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Condomínio Mansões do Lago" />
            </div>
            <div>
              <label style={LABEL}>CNPJ / CPF</label>
              <input
                style={INPUT}
                value={documento}
                onChange={(e) => setDocumento(mascararDocumento(e.target.value))}
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
              />
              <span style={NOTA}>
                Sai impresso no fechamento e é o que casa este cliente com o cadastro do QAP.
              </span>
            </div>
            <div>
              <label style={LABEL}>Tipo de local</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {TIPOS_LOCAL.map((t) => (
                  <button key={t} type="button" aria-pressed={tipoLocal === t} style={chip(tipoLocal === t)} onClick={() => setTipoLocal(t)}>
                    {TIPO_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={LABEL}>Situação</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(Object.keys(SITUACAO_LABEL) as SituacaoCliente[]).map((s) => (
                  <button key={s} type="button" aria-pressed={situacao === s} style={chip(situacao === s)} onClick={() => setSituacao(s)}>
                    {SITUACAO_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={CARD}>
            <span style={SEC_LABEL}>Endereço</span>
            <div>
              <label style={LABEL}>Endereço completo</label>
              {/* EDITAR O ENDEREÇO INVALIDA A CONFERÊNCIA E A COORDENADA.
                  A frase impressa abaixo manda, com todas as letras, "corrija o
                  endereço e localize de novo" — e o gestor fazia a primeira metade
                  e esquecia a segunda. Sem esta limpeza, "O mapa entendeu: …
                  Guarulhos" continuava na tela descrevendo um texto que o campo não
                  contém mais, e `submeter()` gravava a coordenada de Guarulhos com
                  o endereço novo.

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
                  foi apertado), a perna 2 é falsa, e ele não age. Num cliente NOVO
                  nem chega perto: ele é BEFORE UPDATE e isto é um INSERT.

                  Zerar aqui é a mesma política do gatilho, um passo antes, onde a
                  pessoa ainda vê: o campo passa a dizer "sem coordenadas" e o botão
                  volta a ser o único caminho. É deleção de estado, não mecanismo
                  novo — e é o que `NovaVisitaDialog` e `/gerencial/nova` já fazem. */}
              <input
                style={INPUT}
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
              <label style={LABEL}>Complemento</label>
              <input style={INPUT} value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="Bloco, torre, referência" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={buscarCoordenadas}
                disabled={geocodificando}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  height: 38, padding: "0 14px", borderRadius: 12,
                  background: c.campo, border: `1px solid ${c.divisoria}`,
                  color: textPrimary, cursor: geocodificando ? "wait" : "pointer",
                  fontFamily: FONT, fontSize: 12, fontWeight: 600,
                }}
              >
                {geocodificando ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} color={gold} />}
                Localizar no mapa
              </button>
              <span style={{ fontFamily: FONT, fontSize: 11.5, color: textSecondary, fontVariantNumeric: "tabular-nums" }}>
                {lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "sem coordenadas"}
              </span>
            </div>
            {/* DOIS NÚMEROS NÃO SÃO CONFERÍVEIS POR UM HUMANO. O nome do lugar é.
                Esta linha é a única rede que existe contra "o mapa achou a rua
                homônima na cidade errada": ler o que o mapa RESPONDEU, e não
                confiar no que foi MANDADO. */}
            {resolvido && (
              <span style={NOTA}>
                O mapa entendeu: <b style={{ color: textPrimary }}>{resolvido}</b> — se não é este o lugar, corrija o endereço
                (inclua bairro e cidade) e localize de novo.
              </span>
            )}
            {resolvido === null && lat != null && lng != null && (
              <span style={NOTA}>
                Coordenada já cadastrada — ninguém conferiu nesta sessão de qual lugar ela é.
                Se o endereço acima mudou, use “Localizar no mapa” e leia o que o mapa responder.
              </span>
            )}
          </div>
        </section>

        {/* ══ COLUNA 2 — com quem falar e o que tem ═══════════════════════════ */}
        <section aria-label="Contatos e estrutura do local" style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <div style={CARD}>
            <span style={SEC_LABEL}>Contatos</span>
            {/* R146 (U96): nome, WHATSAPP e e-mail do síndico e do zelador — o
                telefone sempre foi o WhatsApp na prática; agora a ficha diz isso e
                abre o WhatsApp ao clicar. Residência e galpão trocam os rótulos por
                proprietário / encarregado(a), como no formulário da proposta. */}
            <div>
              <label style={LABEL}>{semSindico ? "Proprietário" : "Síndico"}</label>
              <input style={INPUT} value={nomeSindico} onChange={(e) => setNomeSindico(e.target.value)} placeholder="Nome" />
            </div>
            <div style={DUAS}>
              <div>
                <label style={LABEL}>WhatsApp</label>
                <input style={INPUT} value={telSindico} onChange={(e) => setTelSindico(e.target.value)} inputMode="tel" placeholder="(11) 90000-0000" />
              </div>
              <div>
                <label style={LABEL}>E-mail</label>
                <input style={INPUT} value={emailSindico} onChange={(e) => setEmailSindico(e.target.value)} inputMode="email" />
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${c.divisoria}`, paddingTop: 12 }}>
              <label style={LABEL}>{semSindico ? "Encarregado(a)" : "Zelador(a)"}</label>
              <input style={INPUT} value={nomeZelador} onChange={(e) => setNomeZelador(e.target.value)} placeholder="Nome" />
            </div>
            <div style={DUAS}>
              <div>
                <label style={LABEL}>WhatsApp</label>
                <input style={INPUT} value={telZelador} onChange={(e) => setTelZelador(e.target.value)} inputMode="tel" placeholder="(11) 90000-0000" />
              </div>
              <div>
                <label style={LABEL}>E-mail</label>
                <input style={INPUT} value={emailZelador} onChange={(e) => setEmailZelador(e.target.value)} inputMode="email" />
              </div>
            </div>
            <div style={{ ...DUAS, borderTop: `1px solid ${c.divisoria}`, paddingTop: 12 }}>
              <div>
                <label style={LABEL}>Financeiro / cobrança</label>
                <input style={INPUT} value={respFinanceiro} onChange={(e) => setRespFinanceiro(e.target.value)} placeholder="Nome ou setor" />
              </div>
              <div>
                <label style={LABEL}>E-mail do financeiro</label>
                <input style={INPUT} value={emailFinanceiro} onChange={(e) => setEmailFinanceiro(e.target.value)} inputMode="email" />
              </div>
            </div>
          </div>

          <div style={CARD}>
            <span style={SEC_LABEL}>Estrutura do local</span>
            <div style={DUAS}>
              <div>
                <label style={LABEL}>Apartamentos / unidades</label>
                <input style={INPUT} value={qtdAptos} onChange={(e) => setQtdAptos(e.target.value)} inputMode="numeric" placeholder="0" />
              </div>
              <div>
                <label style={LABEL}>Acessos controlados</label>
                <input style={INPUT} value={qtdAcessos} onChange={(e) => setQtdAcessos(e.target.value)} inputMode="numeric" placeholder="0" />
              </div>
            </div>
            <div>
              <label style={LABEL}>Observações</label>
              <textarea
                style={TEXTAREA}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Particularidades do local, acesso da equipe, histórico relevante…"
              />
            </div>
            <span style={NOTA}>
              Os sistemas instalados (blocos) e os equipamentos do QAP são montados na própria
              ficha, fora deste formulário.
            </span>
          </div>
        </section>
      </div>

      {/* Ações — a única ação principal da tela é a dourada */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            style={{
              height: 42, padding: "0 18px", borderRadius: 12,
              background: c.campo, border: `1px solid ${c.divisoria}`,
              color: textPrimary, cursor: "pointer",
              fontFamily: FONT, fontWeight: 600, fontSize: 13,
            }}
          >
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={submeter}
          disabled={salvando}
          style={{
            ...goldButton(), height: 42, minWidth: 200, padding: "0 20px", borderRadius: 12,
            fontFamily: FONT, fontWeight: 700, fontSize: 13,
            cursor: salvando ? "wait" : "pointer", opacity: salvando ? 0.7 : 1,
          }}
        >
          {salvando ? "Salvando…" : (rotuloAcao ?? "Salvar cliente")}
        </button>
      </div>
    </div>
  );
}
