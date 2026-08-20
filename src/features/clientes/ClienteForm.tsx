// Formulário de cliente — usado no cadastro (/clientes/novo) e na edição
// (/clientes/$id). Campos agrupados por assunto, no padrão visual do app
// (DESIGN_SYSTEM.md): card com gradiente, micro-label maiúsculo, CTA dourado.

import { useState, type CSSProperties } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { geocode } from "@/features/gerencial/data";
import { TIPO_LABEL, TIPOS_LOCAL } from "@/features/gerencial/constants";
import { mascararDocumento, validarDocumento } from "@/lib/normalizar";
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
  const [nomeSindico, setNomeSindico] = useState(inicial?.nome_sindico ?? "");
  const [telSindico, setTelSindico] = useState(inicial?.telefone_sindico ?? "");
  const [emailSindico, setEmailSindico] = useState(inicial?.email_sindico ?? "");
  const [nomeZelador, setNomeZelador] = useState(inicial?.nome_zelador ?? "");
  const [telZelador, setTelZelador] = useState(inicial?.telefone_zelador ?? "");
  const [emailZelador, setEmailZelador] = useState(inicial?.email_zelador ?? "");
  const [qtdAptos, setQtdAptos] = useState(inicial?.qtd_apartamentos?.toString() ?? "");
  const [qtdAcessos, setQtdAcessos] = useState(inicial?.qtd_acessos?.toString() ?? "");
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? "");

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";

  const CARD: CSSProperties = {
    background: isLight
      ? "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)"
      : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(248,200,17,0.10)",
    borderRadius: 18,
    padding: "18px 16px",
    boxShadow: isLight ? "0 1px 6px rgba(0,0,0,0.07)" : "none",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };
  const SEC_LABEL: CSSProperties = {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.5)" : "rgba(248,200,17,0.65)",
  };
  const LABEL: CSSProperties = {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: textSecondary,
    marginBottom: 6,
    display: "block",
  };
  const INPUT: CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    height: 46,
    borderRadius: 12,
    padding: "0 14px",
    background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
    color: textPrimary,
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 300,
    fontSize: 14,
    outline: "none",
    colorScheme: isLight ? "light" : "dark",
  };
  const TEXTAREA: CSSProperties = { ...INPUT, height: 88, padding: "12px 14px", resize: "vertical" };

  const chip = (ativo: boolean): CSSProperties => ({
    padding: "9px 14px",
    borderRadius: 12,
    border: ativo ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(252,222,72,0.16)",
    background: ativo
      ? "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)"
      : isLight ? "#f5f6f8" : "rgba(255,255,255,0.03)",
    color: ativo ? "#08090E" : textPrimary,
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
    transition: "all 0.15s",
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
        toast.success("Coordenadas encontradas.");
      } else {
        toast.error("Endereço não localizado no mapa.");
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Identificação */}
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
          <span
            style={{
              display: "block",
              marginTop: 6,
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 300,
              fontSize: 11,
              color: textSecondary,
            }}
          >
            Sai impresso no fechamento e é o que casa este cliente com o cadastro do QAP.
          </span>
        </div>
        <div>
          <label style={LABEL}>Tipo de local</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TIPOS_LOCAL.map((t) => (
              <button key={t} type="button" style={chip(tipoLocal === t)} onClick={() => setTipoLocal(t)}>
                {TIPO_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={LABEL}>Situação</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(Object.keys(SITUACAO_LABEL) as SituacaoCliente[]).map((s) => (
              <button key={s} type="button" style={chip(situacao === s)} onClick={() => setSituacao(s)}>
                {SITUACAO_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Endereço */}
      <div style={CARD}>
        <span style={SEC_LABEL}>Endereço</span>
        <div>
          <label style={LABEL}>Endereço completo</label>
          <input style={INPUT} value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro, cidade" />
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
              display: "flex", alignItems: "center", gap: 8,
              height: 42, padding: "0 16px", borderRadius: 12,
              background: isLight ? "#ffffff" : "#191921",
              border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
              color: textPrimary, cursor: geocodificando ? "wait" : "pointer",
              fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 600,
            }}
          >
            {geocodificando ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} color={gold} />}
            Localizar no mapa
          </button>
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: textSecondary }}>
            {lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "sem coordenadas"}
          </span>
        </div>
      </div>

      {/* Contatos */}
      <div style={CARD}>
        <span style={SEC_LABEL}>Contatos</span>
        <div>
          <label style={LABEL}>Síndico / responsável</label>
          <input style={INPUT} value={nomeSindico} onChange={(e) => setNomeSindico(e.target.value)} placeholder="Nome" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={LABEL}>Telefone</label>
            <input style={INPUT} value={telSindico} onChange={(e) => setTelSindico(e.target.value)} inputMode="tel" />
          </div>
          <div>
            <label style={LABEL}>E-mail</label>
            <input style={INPUT} value={emailSindico} onChange={(e) => setEmailSindico(e.target.value)} inputMode="email" />
          </div>
        </div>
        <div>
          <label style={LABEL}>Zelador / encarregado</label>
          <input style={INPUT} value={nomeZelador} onChange={(e) => setNomeZelador(e.target.value)} placeholder="Nome" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={LABEL}>Telefone</label>
            <input style={INPUT} value={telZelador} onChange={(e) => setTelZelador(e.target.value)} inputMode="tel" />
          </div>
          <div>
            <label style={LABEL}>E-mail</label>
            <input style={INPUT} value={emailZelador} onChange={(e) => setEmailZelador(e.target.value)} inputMode="email" />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={LABEL}>Financeiro / cobrança</label>
            <input
              style={INPUT}
              value={respFinanceiro}
              onChange={(e) => setRespFinanceiro(e.target.value)}
              placeholder="Nome ou setor"
            />
          </div>
          <div>
            <label style={LABEL}>E-mail do financeiro</label>
            <input
              style={INPUT}
              value={emailFinanceiro}
              onChange={(e) => setEmailFinanceiro(e.target.value)}
              inputMode="email"
            />
          </div>
        </div>
      </div>

      {/* Estrutura + observações */}
      <div style={CARD}>
        <span style={SEC_LABEL}>Estrutura do local</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
      </div>

      {/* Ações */}
      <div style={{ display: "flex", gap: 10 }}>
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            style={{
              flex: "0 0 auto", height: 52, padding: "0 20px", borderRadius: 26,
              background: isLight ? "#ffffff" : "#191921",
              border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
              color: textPrimary, cursor: "pointer",
              fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 13,
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
            flex: 1, height: 52, borderRadius: 26, border: "none",
            background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)",
            color: "#08090E",
            fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 13,
            letterSpacing: "0.14em", textTransform: "uppercase",
            cursor: salvando ? "wait" : "pointer",
            opacity: salvando ? 0.7 : 1,
            boxShadow: "0 6px 20px rgba(248,200,17,0.35)",
          }}
        >
          {salvando ? "Salvando…" : (rotuloAcao ?? "Salvar cliente")}
        </button>
      </div>
    </div>
  );
}
