// Copiar um texto para a área de transferência (o CNPJ/CPF só com os dígitos, para colar nos sites do governo), usado nas
// Configurações e no Início do DP. Quando o navegador recusa a área de transferência, o jeito antigo: um campo escondido e
// o "copiar" do navegador.

/** copia o texto; devolve se deu certo */
export async function copiarTexto(texto: string): Promise<boolean> {
  const antigo = () => {
    const campo = Object.assign(document.createElement('textarea'), { value: texto });
    campo.style.position = 'fixed'; campo.style.opacity = '0';
    document.body.appendChild(campo); campo.select();
    const ok = document.execCommand('copy');
    campo.remove();
    return ok;
  };
  if (!navigator.clipboard?.writeText) return antigo();
  try { await navigator.clipboard.writeText(texto); return true; } catch { return antigo(); }
}
