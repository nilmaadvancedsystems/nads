// O CNPJ/CPF de cada cliente do DP (Sávio, 07/10/2026: "copiar o CNPJ ou CPF de cada cliente sem pontos ou traços para
// acesso aos sites do governo"), só os dígitos. Primeiro o do Cadastro do nads (Sávio, 20/10/2026: "puxar automaticamente
// do cadastro de empresas"; o nads vale), que também é onde se cadastra; sem ele, o do Entregas pelo código, também dos
// clientes inativos lá (era por isso que 342, 394, 395 e 432 ficavam "sem cadastro"). Usado pelas Configurações e pelo
// Início do DP (10/11/2026: "quero que aqui tenha a informação do cnpj e o movimento assim como nas config").
import { useGmailDoEntregas } from '../../dados/repo';
import type { ClienteDoDpNaTela } from './useClientesDoDp';

export function useDocumentosDoDp(clientes: readonly Pick<ClienteDoDpNaTela, 'codigo' | 'cadastro'>[]) {
  const gmail = useGmailDoEntregas();
  const doEntregasPorCodigo = gmail.documentos();
  const porCodigo = new Map<number, string>();
  for (const c of clientes) {
    const d = c.cadastro?.cnpj || doEntregasPorCodigo.get(c.codigo);
    if (d) porCodigo.set(c.codigo, d);
  }
  /** os que vêm do Entregas (não se mudam daqui) */
  const doEntregas = new Set(clientes.filter(c => !c.cadastro?.cnpj && doEntregasPorCodigo.has(c.codigo)).map(c => c.codigo));
  // nos exemplos não há cadastro do Entregas: um CNPJ inventado pelo código, para a coluna aparecer (os de código
  // terminado em 4 ficam sem, para a tela mostrar o cadastro na linha)
  if (gmail.exemplos) for (const c of clientes) if (!porCodigo.has(c.codigo) && c.codigo % 10 !== 4) porCodigo.set(c.codigo, String(c.codigo).padStart(8, '0') + '000100');
  return { porCodigo, doEntregas };
}
