// O balancete que o robô gera no Alterdata Contábil (Vitor, 14/10/2026: "Gerar no Alterdata" na Importação): a
// Conferência pede (pedidosAlterdata), o robô devolve o .xlsx em base64 e ele entra pelo MESMO caminho do arquivo
// escolhido à mão. Aqui só o que é puro: o texto do andamento, a competência do pedido e o base64 → bytes.

/** O que o texto do andamento precisa de um pedido (o pedido inteiro mora em dados/alterdata.ts do app). */
export interface AndamentoDoPedido { status: string; erro: string; passos: readonly { nome: string }[] }

export interface TextoDoAndamento {
  /** ok = pronto; erro = erro/cancelado; andando = na fila ou com o robô */
  tom: 'andando' | 'ok' | 'erro';
  titulo: string;
  /** o último passo do robô, ou o motivo do erro */
  detalhe: string;
  /** ainda dá para cancelar (pendente ou com o robô) */
  podeCancelar: boolean;
}

/** O andamento do pedido em palavras: "Na fila…" enquanto pendente, o último passo com o robô, o erro dele. */
export function textoDoAndamento(p: AndamentoDoPedido): TextoDoAndamento {
  const ultimo = p.passos.length ? p.passos[p.passos.length - 1].nome : '';
  switch (p.status) {
    case 'pendente': return { tom: 'andando', titulo: 'Na fila…', detalhe: 'O robô pega o pedido em instantes.', podeCancelar: true };
    case 'trabalhando': return { tom: 'andando', titulo: 'O robô está gerando o balancete', detalhe: ultimo, podeCancelar: true };
    case 'pronto': return { tom: 'ok', titulo: 'Balancete pronto', detalhe: 'Lendo o arquivo…', podeCancelar: false };
    case 'cancelado': return { tom: 'erro', titulo: 'Pedido cancelado', detalhe: '', podeCancelar: false };
    case 'erro': return { tom: 'erro', titulo: 'O robô não conseguiu gerar o balancete', detalhe: p.erro || 'sem detalhe', podeCancelar: false };
    default: return { tom: 'andando', titulo: 'Aguardando o robô…', detalhe: p.status, podeCancelar: false };
  }
}

/** A competência ('aaaa-mm') do balancete: o último mês marcado na Conferência; sem nenhum, o mês anterior ao de hoje. */
export function competenciaDoBalancete(meses: readonly string[], hoje: Date): string {
  const validos = meses.filter(m => /^\d{4}-(0[1-9]|1[0-2])$/.test(m)).sort();
  if (validos.length) return validos[validos.length - 1];
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/** O arquivo do robô (base64) em bytes, para o mesmo leitor de planilha do arquivo escolhido à mão. */
export function base64ParaBuffer(base64: string): ArrayBuffer {
  const bin = atob(base64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Um balancete pequeno de exemplo (CSV no formato do "Xlsx Dados Arquivo": a descrição com o [código] na 3ª coluna,
 * recuada pelo nível, e o saldo atual com D/C na 8ª) para a versão de exemplo do pedido: dá para testar a tela inteira
 * sem o Alterdata. Em base64, como o robô entrega.
 */
export function balanceteDeExemploEmBase64(): string {
  const linha = (desc: string, saldo: string) => ',,"' + desc + '",,,,,"' + saldo + '"';
  const csv = [
    ',,"Descricao",,,,,"Saldo atual"',
    linha('ATIVO [1]', '15.000,00 D'),
    linha('  ATIVO CIRCULANTE [11]', '15.000,00 D'),
    linha('    CAIXA [11001]', '3.000,00 D'),
    linha('    BANCOS CONTA MOVIMENTO [11002]', '12.000,00 D'),
    linha('PASSIVO [2]', '9.000,00 C'),
    linha('  PASSIVO CIRCULANTE [21]', '9.000,00 C'),
    linha('    FORNECEDORES [21001]', '9.000,00 C'),
    linha('RECEITAS [3]', '40.000,00 C'),
    linha('  RECEITA BRUTA [31]', '40.000,00 C'),
    linha('    VENDAS DE MERCADORIAS [31001]', '40.000,00 C'),
    linha('DESPESAS [4]', '25.000,00 D'),
    linha('  DESPESAS OPERACIONAIS [41]', '25.000,00 D'),
    linha('    ALUGUEIS [41001]', '25.000,00 D'),
  ].join('\n');
  return btoa(csv);
}
