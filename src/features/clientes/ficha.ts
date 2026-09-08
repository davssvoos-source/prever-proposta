// A lógica pura da ficha do cliente (R207, U114): o que os botões de ação
// copiam. Tela só pinta; o texto que vai para a área de transferência nasce
// aqui, onde o verificador consegue conferir letra por letra.

export interface EnderecoDoCliente {
  endereco?: string | null;
  complemento?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

/**
 * O endereço numa linha só, como se cola no WhatsApp ou no mapa:
 * "Rua das Paineiras, 250, Torre B, São Paulo - SP". Parte vazia não deixa
 * vírgula sobrando; cidade e UF vão juntas com hífen, o formato dos Correios.
 */
export function enderecoParaCopiar(c: EnderecoDoCliente): string {
  const cidadeUf = [c.cidade?.trim(), c.uf?.trim()].filter((p) => p && p.length > 0).join(" - ");
  return [c.endereco?.trim(), c.complemento?.trim(), cidadeUf]
    .filter((p): p is string => !!p && p.length > 0)
    .join(", ");
}
