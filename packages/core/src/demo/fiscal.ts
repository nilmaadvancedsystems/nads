// Os dados de teste do Fiscal (Vitor, 06/10/2026: o ⚡ do modo desenvolvedor "só que para os parâmetros do fiscal"): as
// notas do mês como se tivessem vindo dos relatórios do Alterdata — Entradas e Saídas (com CFOPs de venda, ST, devolução e
// remessa, e a conta contábil), Serviços Tomados (com ISS, INSS e IRRF retidos) e Prestados. Cada nota de teste leva
// "(TESTE)" no nome e o número começa com T, para o Apagar tirar só elas. Só se usam no modo desenvolvedor ou na empresa
// de teste: nada disso vai para o banco.
import type { Empresa, Nota, NotaServico } from '../conferencia/tipos';

export type NotasFiscaisDeTeste = 'completo' | 'mercadorias';

export const OPCOES_FISCAIS_DE_TESTE: readonly { id: NotasFiscaisDeTeste | 'apagar-fiscal'; rotulo: string }[] = [
  { id: 'completo', rotulo: 'Notas do mês (Entradas, Saídas, Tomados e Prestados)' },
  { id: 'mercadorias', rotulo: 'Só Entradas e Saídas (faltando os serviços)' },
  { id: 'apagar-fiscal', rotulo: 'Apagar as notas de teste' },
];

const MARCA = ' (TESTE)';
const ehDeTeste = (n: { numero: string; nome: string }) => n.numero.startsWith('T') && n.nome.endsWith(MARCA);

const FORNECEDORES = ['DISTRIBUIDORA ALFA LTDA', 'ATACADO BETA LTDA', 'LATICINIOS GAMA LTDA', 'TRANSPORTES DELTA LTDA', 'ENERGIA EXEMPLO SA'];
const CLIENTES = ['MERCADO CENTRAL LTDA', 'PADARIA DO BAIRRO ME', 'RESTAURANTE SABOR LTDA', 'CONSUMIDOR FINAL', 'LOJA DA ESQUINA ME'];

// [CFOP, descrição, lançamento, conta contábil, peso (quantas vezes aparece na roda)]
type LinhaCfop = [string, string, string, string, number];
const CFOPS_SAIDA: LinhaCfop[] = [
  ['5102', 'Venda de mercadoria adquirida de terceiros', '00101', '30101', 5],
  ['5405', 'Venda de mercadoria com ST (substituído)', '00102', '30101', 3],
  ['6102', 'Venda de mercadoria fora do estado', '00103', '30102', 2],
  ['5202', 'Devolução de compra para comercialização', '00104', '10601', 1],
  ['5949', 'Outra saída não especificada (remessa)', '00105', '30199', 1],
];
const CFOPS_ENTRADA: LinhaCfop[] = [
  ['1102', 'Compra para comercialização', '00006', '10601', 5],
  ['1403', 'Compra para comercialização com ST', '00007', '10601', 3],
  ['2102', 'Compra para comercialização fora do estado', '00008', '10601', 2],
  ['1353', 'Aquisição de serviço de transporte (CT-e)', '00014', '40210', 1],
  ['1253', 'Compra de energia elétrica', '00040', '40220', 1],
];

/** Um valor "de verdade" (centavos quebrados), estável para a mesma nota. */
// os itens de teste: NCM, CST/CSOSN e CEST (a verificação do Fiscal, 07/10/2026)
const ITENS: [string, string, string][] = [['2202.10.00', '500', '03.007.00'], ['0402.21.10', '102', ''], ['1905.90.90', '500', '17.049.00'], ['2106.90.10', '102', ''], ['3401.11.90', '102', '']];
const valor = (i: number, fator: number) => Math.round((380 + ((i * 7919) % 2600) + (i % 3) * 0.37) * fator * 100) / 100;
const data = (dia: number, mes: string) => String(dia).padStart(2, '0') + '/' + mes.slice(5, 7) + '/' + mes.slice(0, 4);
const diasDoMes = (mes: string) => new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate();

function notas(mes: string, tabela: LinhaCfop[], nomes: string[], inicio: number, qtd: number): Nota[] {
  const ult = diasDoMes(mes);
  // os CFOPs na proporção do peso: mais vendas normais, menos devolução e remessa
  const roda = tabela.flatMap(c => Array.from({ length: c[4] }, () => c));
  return Array.from({ length: qtd }, (_, i) => {
    const [cfop, desc, lanc, conta, peso] = roda[i % roda.length];
    return {
      cfop, lanc, conta, desc, valor: valor(inicio + i, peso > 2 ? 1.6 : 1), numero: 'T' + (inicio + i), nome: nomes[i % nomes.length] + MARCA,
      data: data(1 + ((i * 3) % ult), mes), doc: '00.000.000/0001-' + String(10 + (i % nomes.length)), exportado: 'Não' as const, comp: mes,
      ncm: ITENS[i % ITENS.length][0], cst: ITENS[i % ITENS.length][1], ...(ITENS[i % ITENS.length][2] ? { cest: ITENS[i % ITENS.length][2] } : {}),
    };
  });
}

function servicos(mes: string, tipo: 'tomados' | 'prestados', inicio: number, qtd: number): NotaServico[] {
  const ult = diasDoMes(mes);
  const nomes = tipo === 'tomados'
    ? ['SOFTWARE GESTAO LTDA', 'LIMPEZA E CONSERVACAO LTDA', 'MANUTENCAO PREDIAL ME', 'CONSULTORIA EXEMPLO LTDA']
    : ['CLIENTE SERVICO ALFA LTDA', 'CLIENTE SERVICO BETA ME'];
  const c = (v: number, pct: number) => Math.round(v * pct * 100) / 100;
  return Array.from({ length: qtd }, (_, i) => {
    const v = valor(inicio + i, 1.4);
    const quem = i % nomes.length;
    // nos tomados: a limpeza e a manutenção (cessão de mão de obra) retêm INSS e ISS; a consultoria, IRRF e ISS
    const issRet = tipo === 'tomados' && quem > 0 ? c(v, 0.05) : 0;
    return {
      data: data(5 + ((i * 4) % (ult - 5)), mes), comp: mes, numero: 'T' + (inicio + i), lanc: tipo === 'tomados' ? '00300' : '00400',
      codPart: String(500 + quem), cnpj: '11.111.111/0001-' + String(20 + quem), nome: nomes[quem] + MARCA,
      valor: v, iss: c(v, 0.05), issRet, inss: tipo === 'tomados' && (quem === 1 || quem === 2) ? c(v, 0.11) : 0,
      irrf: tipo === 'tomados' && quem === 3 ? c(v, 0.015) : 0, exportado: 'Não' as const, conta: tipo === 'tomados' ? '40230' : '30201',
      // a consultoria também retém PIS, COFINS e CSLL; o NBS e a descrição do serviço
      ...(tipo === 'tomados' && quem === 3 ? { pis: c(v, 0.0065), cofins: c(v, 0.03), csll: c(v, 0.01) } : {}),
      nbs: ['1.1502.10.00', '1.2001.10.00', '1.2001.30.00', '1.1303.10.00'][quem % 4], descricao: ['Licença de software de gestão', 'Limpeza e conservação', 'Manutenção predial', 'Consultoria empresarial'][quem % 4],
    };
  });
}

/** A empresa da Conferência com as notas de teste dos meses (as de teste de antes saem; as de verdade ficam). */
export function comNotasFiscaisDeTeste(e: Empresa, meses: readonly string[], qual: NotasFiscaisDeTeste): Empresa {
  const limpa = semNotasFiscaisDeTeste(e);
  const ent: Nota[] = []; const sai: Nota[] = []; const tom: NotaServico[] = []; const pre: NotaServico[] = [];
  meses.forEach((mes, k) => {
    const base = 9000 + k * 100;
    sai.push(...notas(mes, CFOPS_SAIDA, CLIENTES, base, 24));
    ent.push(...notas(mes, CFOPS_ENTRADA, FORNECEDORES, base + 50, 16));
    if (qual === 'completo') { tom.push(...servicos(mes, 'tomados', base + 70, 8)); pre.push(...servicos(mes, 'prestados', base + 80, 4)); }
  });
  return {
    ...limpa, entradas: [...limpa.entradas, ...ent], saidas: [...limpa.saidas, ...sai],
    servTomados: [...limpa.servTomados, ...tom], servPrestados: [...limpa.servPrestados, ...pre],
  };
}

/** A empresa sem as notas de teste. */
export function semNotasFiscaisDeTeste(e: Empresa): Empresa {
  return {
    ...e, entradas: e.entradas.filter(n => !ehDeTeste(n)), saidas: e.saidas.filter(n => !ehDeTeste(n)),
    servTomados: e.servTomados.filter(n => !ehDeTeste(n)), servPrestados: e.servPrestados.filter(n => !ehDeTeste(n)),
  };
}
