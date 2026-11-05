// A sugestão de conta de cada natureza de CFOP (Vitor, 05/11/2026: "um botão de sugestão, de acordo com as normas contábeis, ou
// do escritório, qual conta vai e o porquê"). A regra diz que tipo de conta a natureza pede (ou se não vai para o Contábil) e por
// quê; a conta em si sai do plano da própria empresa, pelo nome (os planos do escritório mudam de código de uma empresa para
// outra: a Caixa é 10101 numa e outra coisa em outra). Sem a conta no plano, a sugestão diz o que falta criar no Alterdata.
//
// Decisões do Vitor (05/11/2026):
//   - venda para entrega futura: o simples faturamento (5922/6922) vai para Adiantamento de clientes; a receita entra na entrega
//     (5116/6116 e 5117/6117) — NBC TG 47;
//   - remessas e retornos sem venda (comodato, conserto, industrialização, demonstração, outras saídas): não vão para o Contábil;
//   - venda de produção sem conta de produção no plano: avisa que falta a conta (não cai em Vendas de mercadorias);
//   - bonificação, doação ou brinde dado (5910/6910): despesa de bonificação.
import { nomeNorm } from '../../formatos';
import type { Conta, Grupo, TipoCfop } from '../tipos';

export interface SugestaoDaNatureza {
  /** conta: a do plano que serve; falta-conta: o plano não tem e precisa criar; nao-contabil: não vai para o Contábil */
  tipo: 'conta' | 'nao-contabil' | 'falta-conta';
  conta?: { codigo: string; nome: string };
  /** a conta que a natureza pede, em palavras ("Venda de produção do estabelecimento") */
  pede: string;
  /** o porquê */
  motivo: string;
  /** de onde vem a regra */
  base: string;
}

interface Regra {
  /** os 3 últimos dígitos do CFOP */
  finais: readonly string[];
  tipo: TipoCfop;
  pede: string;
  motivo: string;
  base: string;
  nao?: true;
  /** o grupo da conta no plano e o que o nome tem de ter (e não pode ter) */
  grupos?: readonly Grupo[];
  nome?: RegExp;
  semNome?: RegExp;
  /** o centro de custo em que a conta tem de estar (com o plano dividido em centros; sem eles, vale o nome) */
  centro?: CentroDeCusto;
}

/**
 * O centro de custo da conta no plano (Vitor, 05/11/2026: "as diferenças de centro de custo: CPV, CMV e CSP, frete industrial e
 * frete comercial"): o da indústria (CPV), o do comércio (CMV), o dos serviços (CSP) e as despesas com vendas.
 */
export type CentroDeCusto = 'CPV' | 'CMV' | 'CSP' | 'vendas';

const NOME_DO_CENTRO: Record<CentroDeCusto, string> = { CPV: 'CPV', CMV: 'CMV', CSP: 'CSP', vendas: 'despesas com vendas' };

/** o cabeçalho do centro, pelo nome (o "CUSTO DOS PRODUTOS VENDIDOS - CPV", o "CMV- CUSTOS DAS MERCADORIAS VENDIDAS"…) */
const CABECALHOS: readonly [CentroDeCusto, RegExp][] = [
  ['CPV', /\bcpv\b|custos? (dos )?produtos? vendidos?/],
  ['CMV', /\bcmv\b|custos? (das )?mercadorias? vendidas?/],
  ['CSP', /\bcsp\b|custos? (dos )?servicos? prestados?/],
  ['vendas', /^despesas? (com|de) vendas?\b/],
];
/** outros cabeçalhos: encerram o centro de cima (as despesas administrativas não são custo) */
const OUTROS_CABECALHOS = /^(despesas?|receitas?|custos?|ativo|passivo|patrimonio|outras despesas|despesas? administrativ|despesas? financeir|despesas? tribut)/;

/**
 * O centro de custo de cada conta (código → centro), pela ordem do plano: a conta fica no centro do último cabeçalho de centro que
 * vem antes dela (um outro cabeçalho no caminho encerra). Plano sem cabeçalho de centro: vazio (aí a regra vale só pelo nome).
 */
export function centrosDoPlano(contas: readonly Conta[]): Map<string, CentroDeCusto> {
  const emOrdem = contas.map((c, i) => ({ c, o: c.ordem ?? i })).sort((a, b) => a.o - b.o).map(x => x.c);
  const r = new Map<string, CentroDeCusto>();
  let atual: CentroDeCusto | null = null;
  for (const c of emOrdem) {
    const n = nomeNorm(c.nome);
    // cabeçalho: a sintética do dinâmico ou, no balancete normal (sem a marca), o nome em maiúsculas do Alterdata
    const ehCabecalho = !!c.sintetica || (/[A-Z]/.test(c.nome) && c.nome === c.nome.toUpperCase());
    const cab = ehCabecalho ? CABECALHOS.find(([, re]) => re.test(n)) : undefined;
    if (cab) { atual = cab[0]; continue; }
    if (ehCabecalho && OUTROS_CABECALHOS.test(n)) { atual = null; continue; }
    if (c.grupo !== 'Despesa') { atual = null; continue; }
    if (atual && !ehCabecalho) r.set(c.codigo, atual);
  }
  return r;
}

const NBC_RECEITA = 'NBC TG 47 / NBC TG 1002 (receita)';
const ESCRITORIO = 'Regra do escritório (Vitor, 05/11/2026)';
const NBC_ESTOQUE = 'NBC TG 16 / NBC TG 1002 (estoques e custos)';

const REGRAS: readonly Regra[] = [
  // ─── saídas ───
  { tipo: 'Saída', finais: ['101', '103', '105', '107', '109', '111', '113', '116', '118', '122', '124', '125', '401'],
    pede: 'Venda de produção do estabelecimento', grupos: ['Receita'], nome: /\b(venda|vendas|receita)\b.*\bprodu/, semNome: /devolu|cancel|abatim/,
    motivo: 'É a venda do que a própria empresa fabricou: receita bruta de venda de produtos, reconhecida na entrega do produto ao cliente (o 5116/6116 é a entrega da encomenda, quando a receita entra).',
    base: NBC_RECEITA },
  { tipo: 'Saída', finais: ['102', '104', '106', '108', '110', '112', '114', '115', '117', '119', '120', '123', '403', '405'],
    pede: 'Venda de mercadorias', grupos: ['Receita'], nome: /\b(venda|vendas|receita)\b.*\bmercador/, semNome: /devolu|cancel|abatim|produ/,
    motivo: 'É a revenda de mercadoria comprada de terceiros: receita bruta de venda de mercadorias, reconhecida na entrega (o 5117/6117 é a entrega da encomenda).',
    base: NBC_RECEITA },
  { tipo: 'Saída', finais: ['922'],
    pede: 'Adiantamento de clientes', grupos: ['Passivo'], nome: /adiantament.*client/,
    motivo: 'O simples faturamento da venda para entrega futura ainda não é receita: o cliente pagou (ou deve) antes de receber. Fica no passivo, em Adiantamento de clientes, e vira receita na entrega (5116/6116, 5117/6117).',
    base: NBC_RECEITA + ' · ' + ESCRITORIO },
  { tipo: 'Saída', finais: ['910'],
    // sem exigir o centro: nos planos do escritório a Bonificação fica ora nas despesas com vendas, ora em outras despesas
    pede: 'Bonificação (despesa)', grupos: ['Despesa'], nome: /bonifica|brinde|doac/, semNome: /receb|devolu/,
    motivo: 'A mercadoria sai do estoque sem receita: é uma despesa (bonificação, brinde ou doação), não custo nem dedução da receita.',
    base: ESCRITORIO },
  { tipo: 'Saída', finais: ['201', '410'],
    pede: '(-) Devolução de compras de insumos (CPV)', grupos: ['Despesa'], centro: 'CPV', nome: /devolu.*compra/,
    motivo: 'A empresa devolveu ao fornecedor o insumo comprado para a produção: reduz as compras do custo dos produtos (CPV), não é receita.',
    base: NBC_ESTOQUE },
  { tipo: 'Saída', finais: ['202', '411'],
    pede: '(-) Devolução de compras de mercadorias (CMV)', grupos: ['Despesa'], centro: 'CMV', nome: /devolu.*compra/,
    motivo: 'A empresa devolveu ao fornecedor a mercadoria comprada para revenda: reduz as compras do custo das mercadorias (CMV), não é receita.',
    base: NBC_ESTOQUE },
  { tipo: 'Saída', finais: ['208', '209', '210'],
    pede: '(-) Devolução de compras', grupos: ['Despesa'], nome: /devolu.*compra/,
    motivo: 'A empresa devolveu ao fornecedor o que tinha comprado: reduz as compras (custo), não é receita.',
    base: NBC_ESTOQUE },
  { tipo: 'Saída', finais: ['551'],
    pede: 'Venda de ativo imobilizado (outras receitas)', grupos: ['Receita'], nome: /(venda|alienac|ganho).*(imobiliz|ativo|bens)|outras receitas/,
    motivo: 'A venda de um bem do imobilizado não é receita da atividade: o resultado (o valor da venda menos o valor contábil do bem) vai para outras receitas, e o bem sai do imobilizado.',
    base: 'NBC TG 27 / NBC TG 1002 (imobilizado)' },
  { tipo: 'Saída', finais: ['933'],
    pede: 'Receita de prestação de serviços', grupos: ['Receita'], nome: /servic/, semNome: /devolu|cancel/,
    motivo: 'É serviço prestado na nota conjugada (ISS): receita de prestação de serviços.',
    base: NBC_RECEITA },
  { tipo: 'Saída', nao: true, finais: ['901', '902', '903', '904', '905', '906', '907', '908', '909', '911', '912', '913', '914', '915', '916', '917', '918', '919', '920', '921', '923', '924', '925', '934', '949'],
    pede: 'Não vai para o Contábil',
    motivo: 'Remessa ou retorno sem venda (comodato, conserto, industrialização por terceiros, demonstração, consignação, amostra, outras saídas): o bem continua da empresa (ou volta para o dono), não há receita nem custo.',
    base: ESCRITORIO },
  // ─── entradas ───
  { tipo: 'Entrada', finais: ['101', '401', '122', '124', '125'],
    pede: 'Compras de insumos (CPV)', grupos: ['Despesa'], centro: 'CPV', nome: /compra.*(insumo|materia|industrializ)|insumo|materia prima/, semNome: /devolu|frete/,
    motivo: 'Compra do que entra na produção (indústria): custo dos produtos vendidos (CPV), não despesa e não o CMV. O estoque se acerta no fechamento.',
    base: NBC_ESTOQUE },
  { tipo: 'Entrada', finais: ['102', '403', '117', '118', '121'],
    pede: 'Compras de mercadorias (CMV)', grupos: ['Despesa'], centro: 'CMV', nome: /compra.*mercador|mercadorias para revenda/, semNome: /devolu|frete/,
    motivo: 'Compra de mercadoria para revender (comércio): custo das mercadorias vendidas (CMV), não despesa e não o CPV. O estoque se acerta no fechamento.',
    base: NBC_ESTOQUE },
  { tipo: 'Entrada', finais: ['201', '202', '203', '204', '410', '411'],
    pede: '(-) Devolução de vendas', grupos: ['Receita'], nome: /devolu.*venda/,
    motivo: 'O cliente devolveu o que a empresa vendeu: é dedução da receita bruta (conta redutora), não despesa.',
    base: NBC_RECEITA + ' (item 23.2 da 1002)' },
  { tipo: 'Entrada', finais: ['556', '407'],
    pede: 'Material de uso e consumo', grupos: ['Despesa'], nome: /uso e consumo|material de consumo|materiais de consumo/,
    motivo: 'O material é usado pela própria empresa e não é revendido nem vira produto: despesa (ou custo, se for da produção).',
    base: 'NBC TG 1002 (despesas)' },
  { tipo: 'Entrada', finais: ['551', '406'],
    pede: 'A conta do bem no imobilizado', grupos: ['Ativo'], nome: /imobiliz|maquin|equipament|veicul|moveis|computador/, semNome: /deprecia/,
    motivo: 'O bem fica na empresa por mais de um ano, para uso: ativo imobilizado (depreciado depois), não despesa.',
    base: 'NBC TG 27 / NBC TG 1002 (imobilizado)' },
  { tipo: 'Entrada', finais: ['352'],
    pede: 'Frete industrial (CPV)', grupos: ['Despesa'], centro: 'CPV', nome: /frete/,
    motivo: 'Transporte contratado pelo estabelecimento industrial (o frete dos insumos): faz parte do custo dos produtos (CPV).',
    base: NBC_ESTOQUE },
  { tipo: 'Entrada', finais: ['353'],
    pede: 'Frete comercial (CMV)', grupos: ['Despesa'], centro: 'CMV', nome: /frete/,
    motivo: 'Transporte contratado pelo estabelecimento comercial (o frete das mercadorias compradas): faz parte do custo das mercadorias (CMV).',
    base: NBC_ESTOQUE },
  { tipo: 'Entrada', finais: ['354', '355', '356', '932'],
    pede: 'Fretes', grupos: ['Despesa'], nome: /frete/,
    motivo: 'O serviço de transporte: frete sobre compras (custo) ou sobre vendas (despesa com vendas), conforme o caso.',
    base: NBC_ESTOQUE },
  { tipo: 'Entrada', finais: ['126', '128'],
    pede: 'Compras para a prestação de serviços (CSP)', grupos: ['Despesa'], centro: 'CSP', nome: /compra|materia(l|is)\b|insumo/, semNome: /devolu/,
    motivo: 'Compra do que é usado na prestação do serviço: custo dos serviços prestados (CSP), não o CPV nem o CMV.',
    base: NBC_ESTOQUE },
  { tipo: 'Entrada', finais: ['252', '253', '254', '255', '256', '257'],
    pede: 'Energia elétrica', grupos: ['Despesa'], nome: /energia/,
    motivo: 'Consumo de energia elétrica: despesa (ou custo, se for da produção).',
    base: 'NBC TG 1002 (despesas)' },
  { tipo: 'Entrada', finais: ['301', '302', '303', '304', '305', '306', '307'],
    pede: 'Telefone e comunicação', grupos: ['Despesa'], nome: /telefon|comunica|internet/,
    motivo: 'Serviço de comunicação: despesa.',
    base: 'NBC TG 1002 (despesas)' },
  { tipo: 'Entrada', finais: ['910'],
    pede: 'Bonificações recebidas', grupos: ['Receita', 'Despesa'], nome: /bonifica/,
    motivo: 'A mercadoria recebida em bonificação entra no estoque sem custo: o valor vai para bonificações recebidas (ou reduz o custo das compras, conforme o plano).',
    base: ESCRITORIO },
  { tipo: 'Entrada', nao: true, finais: ['901', '902', '903', '904', '905', '906', '907', '908', '909', '911', '912', '913', '914', '915', '916', '917', '918', '919', '920', '921', '922', '923', '924', '925', '934', '949'],
    pede: 'Não vai para o Contábil',
    motivo: 'Remessa ou retorno sem compra (comodato, conserto, industrialização, demonstração, consignação, amostra, outras entradas): o bem não passa a ser da empresa (ou só volta para ela).',
    base: ESCRITORIO },
];

/** O CFOP pede a regra: pelo tipo (1/2/3 entrada, 5/6/7 saída) e pelos 3 últimos dígitos. */
function regraDoCfop(cfop: string, tipo: TipoCfop): Regra | null {
  const f = String(cfop || '').replace(/\D/g, '').slice(-3);
  return f.length === 3 ? REGRAS.find(r => r.tipo === tipo && r.finais.includes(f)) || null : null;
}

/** A conta do plano que serve à regra: do grupo certo, analítica, com o nome que bate; a mais curta no nome primeiro. */
function contaDaRegra(r: Regra, contas: readonly Conta[], centros: ReadonlyMap<string, CentroDeCusto>): Conta | null {
  if (!r.nome) return null;
  // com o plano dividido em centros, só as contas do centro da regra (o frete do CMV não serve ao frete industrial)
  const peloCentro = r.centro && centros.size > 0;
  const servem = contas.filter(c => !c.sintetica && (!r.grupos || r.grupos.includes(c.grupo))
    && (!peloCentro || centros.get(c.codigo) === r.centro)
    && r.nome!.test(nomeNorm(c.nome)) && !(r.semNome && r.semNome.test(nomeNorm(c.nome))));
  return servem.sort((a, b) => a.nome.length - b.nome.length || a.codigo.localeCompare(b.codigo))[0] || null;
}

/**
 * A sugestão de uma natureza (os CFOPs do grupo; vale a regra do primeiro que tiver regra). null = nenhuma regra para esses
 * CFOPs (a sugestão não aparece).
 */
export function sugestaoDaNatureza(cfops: readonly string[], tipo: TipoCfop, contas: readonly Conta[]): SugestaoDaNatureza | null {
  const r = cfops.map(c => regraDoCfop(c, tipo)).find(Boolean);
  if (!r) return null;
  if (r.nao) return { tipo: 'nao-contabil', pede: r.pede, motivo: r.motivo, base: r.base };
  const centros = centrosDoPlano(contas);
  const conta = contaDaRegra(r, contas, centros);
  if (conta) return { tipo: 'conta', conta: { codigo: conta.codigo, nome: conta.nome }, pede: r.pede, motivo: r.motivo, base: r.base };
  const noCentro = r.centro && centros.size > 0
    ? ([...centros.values()].includes(r.centro) ? ' no centro ' + NOME_DO_CENTRO[r.centro] : ' (nem o centro ' + NOME_DO_CENTRO[r.centro] + ')')
    : '';
  return { tipo: 'falta-conta', pede: r.pede, motivo: r.motivo + ' O plano desta empresa não tem essa conta' + noCentro + ': crie no Alterdata e importe o balancete de novo.', base: r.base };
}
