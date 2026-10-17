// O que vale quando o banco ainda não tem o lcdpr/config: as mesmas categorias, plano, regras de NCM e tabelas da página
// antiga do Entregas (defaultState do lcdpr.html). O CPF do produtor fica vazio aqui (é o dado de uma pessoa e já está
// gravado no banco); sem ele, o CT-e não é filtrado pelo destinatário.
import type { Categoria, ConfigLcdpr, ListaDoLcdpr, RegraNcm } from './tipos';

/** Os modelos de histórico ({{doc}}, {{fornecedor}}, {{cnpj}}). */
export const MODELOS = {
  fretes: 'Pelo valor de fretes s/ CTe nº {{doc}} - {{fornecedor}}',
  pecas: 'Pelo serviço/aquisição de peças para conservação e manutenção de máquinas/equipamentos conf. nota fiscal nº {{doc}} - {{fornecedor}}',
  combustiveis: 'Pela compra de combustíveis/lubrificantes conf. nota fiscal {{doc}} - {{fornecedor}} - {{cnpj}}',
  usoConsumo: 'Pela compra de materiais para uso e consumo conforme nota fiscal {{doc}} - {{fornecedor}} - {{cnpj}}',
  matConstrucao: 'Pela compra de material p/ conservação e manutenção em geral conf. nota fiscal {{doc}} - {{fornecedor}} - {{cnpj}}',
  adubos: 'Pela compra de adubos, defensivos e fertilizantes conf. nota fiscal {{doc}} - {{fornecedor}}',
  insumosAnimais: 'Pela compra de insumos conf. nota fiscal nº {{doc}} - {{fornecedor}} - {{cnpj}}',
  bovinos: 'Compra de bovinos conf. NF {{doc}} - {{fornecedor}}',
  generico: 'Pela compra conforme NF nº {{doc}} - {{fornecedor}}',
  maquinas: 'Pela compra de máquinas/implementos agrícolas conf. NF nº {{doc}} - {{fornecedor}}',
  benfeitorias: 'Pagamento de benfeitorias no imóvel rural conf. NF {{doc}} - {{fornecedor}}',
  fixo: 'Pelo pagamento de {{fornecedor}}',
} as const;

const M = MODELOS;
const cat = (nome: string, conta: string, codHist: string, historico: string): Categoria => ({ nome, conta, codHist, historico });
/** várias regras com a mesma conta, histórico e modelo */
const regras = (conta: string, codHist: string, historico: string, prefixos: string[]): RegraNcm[] => prefixos.map(prefixo => ({ prefixo, conta, codHist, historico }));

export function configPadrao(): ConfigLcdpr {
  return {
    config: { cpfProdutor: '', contaCredoraPadrao: '35', imovelPadrao: '001', tipoDocPadrao: '1', tipoLancPadrao: '2', categoriaFretesCTe: 'Fretes e Carretos' },
    categorias: [
      cat('Fretes e Carretos', '805', '91011', M.fretes),
      cat('Conservação e Manutenção (peças)', '784', '00066', M.pecas),
      cat('Combustíveis e Lubrificantes', '924', '00061', M.combustiveis),
      cat('Uso e Consumo', '812', '00044', M.usoConsumo),
      cat('Material de Construção', '847', '00176', M.matConstrucao),
      cat('Adubos, Defensivos e Fertilizantes', '722', '96337', M.adubos),
      cat('Insumos para Animais', '85', '00563', M.insumosAnimais),
      cat('Compra de Bovinos', '730', '', M.bovinos),
      cat('Máquinas e Implementos Agrícolas', '735', '', M.maquinas),
      cat('Material Siderúrgico', '1292', '', M.generico),
      cat('Ferragens', '910', '', M.generico),
      cat('Benfeitorias e Instalações', '752', '00176', M.benfeitorias),
      cat('Máquinas/Equip. Conservação e Reparos', '875', '00066', M.pecas),
      cat('Energia Elétrica', '966', '92023', M.fixo),
      cat('Impostos Municipais', '1043', '00189', M.fixo),
      cat('Impostos Estaduais', '1050', '00224', M.fixo),
      cat('Impostos Federais', '1057', '91326', M.fixo),
      cat('Taxas Cartoriais', '931', '91327', M.fixo),
    ],
    planoContas: ([
      ['35', 'Caixa', 'Disponível'], ['805', 'Fretes e Carretos', 'Despesa'], ['784', 'Conservação e Manutenção de Máquinas/Equip.', 'Despesa'],
      ['924', 'Combustíveis e Lubrificantes', 'Despesa'], ['812', 'Materiais de Uso e Consumo', 'Despesa'], ['847', 'Material de Construção/Manutenção Geral', 'Despesa'],
      ['722', 'Adubos, Defensivos e Fertilizantes', 'Despesa'], ['85', 'Compra de Insumos para Animais', 'Despesa'], ['730', 'Compra de Bovinos', 'Despesa'],
      ['735', 'Custos de Aquisição de Máq. e Impl. Agrícolas', 'Despesa'], ['1292', 'Compra de Material Siderúrgico', 'Despesa'], ['910', 'Ferragens', 'Despesa'],
      ['752', 'Custos na Aquisição de Benfeitorias e Instalações', 'Despesa'], ['875', 'Máquinas, Equip. - Conservação e Reparos', 'Despesa'], ['966', 'Energia Elétrica', 'Despesa'],
      ['1043', 'Impostos Municipais', 'Despesa'], ['1050', 'Impostos Estaduais', 'Despesa'], ['1057', 'Impostos Federais', 'Despesa'], ['931', 'Taxas Cartoriais', 'Despesa'],
      ['709', 'FGTS', 'Despesa'], ['719', 'INSS', 'Despesa'], ['721', 'Serviços de Terceiros (PJ)', 'Despesa'], ['224', 'Venda de Café', 'Receita'], ['238', 'Venda de Bovinos', 'Receita'],
    ] as const).map(([codigo, nome, classificacao]) => ({ codigo, nome, classificacao, tipo: 'A' })),
    // a classificação das compras é SÓ por NCM (o prefixo = capítulo/posição); a ordem é a da página antiga
    ncmRules: [
      ...regras('924', '00061', M.combustiveis, ['2710', '2707', '3811', '3824']),
      ...regras('722', '96337', M.adubos, ['3808']),
      ...regras('85', '00563', M.insumosAnimais, ['2309', '3002', '3004', '4106', '4201']),
      ...regras('730', '', M.bovinos, ['0102']),
      ...regras('735', '', M.maquinas, ['8701', '8432', '8430', '8467']),
      ...regras('784', '00066', M.pecas, ['7318', '7325', '7320', '7315', '7307', '8482', '8483', '8421', '8431', '8433', '8424', '8465', '8511', '8512', '8506', '8545', '8708', '8714', '4008', '4009', '4010', '4013', '4016', '8204', '5909']),
      ...regras('847', '00176', M.matConstrucao, ['2517', '2505', '6904', '4407', '7208', '8301', '8536', '8481', '3506', '3214']),
      ...regras('1292', '', M.generico, ['7204', '7214']),
      ...regras('722', '96337', M.adubos, ['31']),
      ...regras('812', '00044', M.usoConsumo, ['02', '04', '07', '08', '09', '15', '16', '17', '19', '20', '21', '22']),
      ...regras('812', '00044', M.usoConsumo, ['2711', '2828', '3304', '3402', '3503', '3809', '3923', '6403', '6206', '8516', '8517', '8418', '9401', '9403', '9404', '5705', '6115', '6116', '6302', '4823', '8523', '3215', '9603', '4015', '6401', '9020', '6307', '6203', '5407']),
      ...regras('847', '00176', M.matConstrucao, ['8205', '7317', '3208', '3917', '2523', '7116', '7217', '7306', '8302', '3925', '7209', '7308', '4403', '7216', '7019']),
      ...regras('784', '00066', M.pecas, ['9032', '8544', '8208', '2804', '4011', '8479', '8413', '8202', '8203', '8207', '7326', '7415', '8414', '4004']),
      ...regras('85', '00563', M.insumosAnimais, ['9018']),
      ...regras('735', '', M.maquinas, ['8716']),
    ],
    imoveis: [
      { codigo: '001', descricao: 'FAZENDA TABATINGA' }, { codigo: '002', descricao: 'FAZENDA SAO JOSE' }, { codigo: '003', descricao: 'FAZENDA GAMELEIRA' },
      { codigo: '004', descricao: 'ITABERABA FAZENDA BEM POSTA' }, { codigo: '005', descricao: 'FAZENDA ALEGRIA I' }, { codigo: '006', descricao: 'FAZENDA BOM JESUS DO MATO VERDE I-II' },
      { codigo: '007', descricao: 'FAZENDA UNIAO' }, { codigo: '008', descricao: 'FAZENDA CALIFORNIA' },
    ],
    // a IE do destinatário de cada fazenda (cruzada com a DANFE e confirmada pelo cliente)
    ieDest: [{ ie: '11288860080', imovel: '001' }, { ie: '11288860404', imovel: '007' }, { ie: '11288860242', imovel: '002' }],
    tipoDoc: [
      { codigo: '1', descricao: 'Nota Fiscal' }, { codigo: '2', descricao: 'Fatura' }, { codigo: '3', descricao: 'Recibo' },
      { codigo: '4', descricao: 'Contrato' }, { codigo: '5', descricao: 'Folha de Pagamento' }, { codigo: '6', descricao: 'Outros' },
    ],
    tipoLanc: [
      { codigo: '1', descricao: 'Receita da Atividade Rural' },
      { codigo: '2', descricao: 'Despesas de custeios e investimentos' },
      { codigo: '3', descricao: 'Receitas de produtos entregues no ano referente a adiantamentos de recursos' },
    ],
  };
}

/** A linha nova de cada lista (o "+ Novo"). */
export function itemEmBranco(lista: ListaDoLcdpr): Record<string, string> {
  switch (lista) {
    case 'planoContas': return { codigo: '', nome: '', classificacao: '', tipo: 'A' };
    case 'categorias': return { nome: '', conta: '', codHist: '', historico: '' };
    case 'ncmRules': return { prefixo: '', conta: '', codHist: '', historico: '' };
    case 'ieDest': return { ie: '', imovel: '' };
    default: return { codigo: '', descricao: '' };
  }
}
