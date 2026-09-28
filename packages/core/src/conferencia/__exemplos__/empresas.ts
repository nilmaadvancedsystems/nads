// Dados de EXEMPLO da cópia (nads). Tudo inventado: nomes "EXEMPLO…", CNPJs de teste,
// valores gerados. Nenhum dado de cliente real, nada lido do banco.
// Os saldos do balancete são calculados a partir das notas, para o Relatório mostrar
// os casos de verdade: conta Ok, diferença, "Conferido" (energia) e vínculo no Passivo.
import { comp } from '../../formatos';
import type { Conta, Empresa, EmpresaDaLista, Grupo, Nota, NotaServico } from '../tipos';
import { agruparTotaisPorNatureza, comTipo } from '../regras/cfop';
import { empresaNova } from '../regras/empresa';

export const EMPRESAS_EXEMPLO: EmpresaDaLista[] = [
  { codigo: 901, nome: 'EXEMPLO COMERCIO DE ALIMENTOS LTDA', regime: 'Simples' },
  { codigo: 902, nome: 'EXEMPLO SERVICOS MEDICOS LTDA', regime: 'Presumido' },
  { codigo: 903, nome: 'EXEMPLO EMPRESA NOVA LTDA', regime: 'Simples' },
];

const CNPJ = (n: number) => String(11222333000100 + n * 101).padStart(14, '0');
const CPF = (n: number) => String(10020030040 + n * 7).padStart(11, '0');

function nota(cfop: string, lanc: string, valor: number, numero: string, nome: string, data: string, doc = ''): Nota {
  return { cfop, lanc, valor, numero, nome, data, desc: '', doc, exportado: 'Sim', comp: comp(data) };
}

function serv(numero: string, nome: string, data: string, valor: number, lanc: string, iss = 0): NotaServico {
  return { data, comp: comp(data), numero, lanc, codPart: '', cnpj: CNPJ(+numero % 50), nome, valor, iss, issRet: 0, exportado: 'Sim' };
}

function conta(codigo: string, nome: string, grupo: Grupo, dc: 'D' | 'C', ordem: number, sintetica = false): Conta {
  return { codigo, nome, grupo, dc, valor: 0, ordem, sintetica };
}

/** Saldo de cada conta = soma das notas das naturezas ligadas a ela + um ajuste (a "diferença"). */
function fecharSaldos(e: Empresa, ajustes: Record<string, number>): void {
  const grupos = agruparTotaisPorNatureza(comTipo(e.entradas, e.saidas));
  const porConta: Record<string, number> = {};
  for (const k of Object.keys(e.naturezaConta)) {
    const cs = ([] as string[]).concat(e.naturezaConta[k]);
    const g = grupos[k];
    if (!g || !cs.length) continue;
    // natureza ligada a várias contas: a primeira leva o valor (as outras entram no mesmo componente)
    porConta[cs[0]] = (porConta[cs[0]] || 0) + g.itens.reduce((s, n) => s + n.valor, 0);
  }
  for (const c of e.contas) {
    if (c.sintetica) continue;
    const base = porConta[c.codigo];
    c.valor = Math.round(((base ?? c.valor) + (ajustes[c.codigo] || 0)) * 100) / 100;
  }
}

// ---------------------------------------------------------------------------
// 901 — comércio: entradas, saídas, tomados; não presta serviço
// ---------------------------------------------------------------------------
function comercio(): Empresa {
  const e = empresaNova('EXEMPLO COMERCIO DE ALIMENTOS LTDA');
  e.prestaServico = false;
  e.autoLimparBalancete = false;
  e.contas = [
    conta('10000', 'ATIVO', 'Ativo', 'D', 0, true),
    conta('11101', 'Caixa Geral', 'Ativo', 'D', 1),
    conta('11201', 'Banco Conta Movimento', 'Ativo', 'D', 2),
    conta('20000', 'PASSIVO', 'Passivo', 'C', 3, true),
    conta('21101', 'Fornecedores', 'Passivo', 'C', 4),
    conta('21401', 'Telefone a Pagar', 'Passivo', 'C', 5),
    conta('30000', 'DESPESAS', 'Despesa', 'D', 6, true),
    conta('31105', 'Energia Elétrica', 'Despesa', 'D', 7),
    conta('31109', 'Telefone', 'Despesa', 'D', 8),
    conta('31110', 'Internet', 'Despesa', 'D', 9),
    conta('31122', 'Materiais para Uso e Consumo', 'Despesa', 'D', 10),
    conta('31201', 'Honorários Contábeis', 'Despesa', 'D', 11),
    conta('31130', 'Serviços de Terceiros', 'Despesa', 'D', 12),
    conta('66005', 'Compras de Mercadorias à Prazo', 'Despesa', 'D', 13),
    conta('66006', 'Compras de Mercadorias à Vista', 'Despesa', 'D', 14),
    conta('66015', 'Fretes e Carretos', 'Despesa', 'D', 15),
    conta('40000', 'RECEITAS', 'Receita', 'C', 16, true),
    conta('40104', 'Revenda de Mercadorias', 'Receita', 'C', 17),
    conta('40107', 'Venda de Mercadorias com ST', 'Receita', 'C', 18),
    conta('40150', 'Bonificações Concedidas', 'Receita', 'C', 19),
    conta('40203', '(-) Devoluções de Vendas', 'Receita', 'D', 20),
  ];
  const ent: Nota[] = [];
  const fornecedores = ['DISTRIBUIDORA ALFA DE ALIMENTOS LTDA', 'ATACADO BETA LTDA', 'LATICINIOS GAMA LTDA', 'BEBIDAS DELTA LTDA'];
  let num = 4101;
  for (const mes of ['07', '08']) {
    for (let i = 0; i < 7; i++) {
      const cf = i % 3 === 2 ? '2102' : i % 4 === 3 ? '1403' : '1102';
      // uma nota de agosto com o lançamento trocado: fica "fora do padrão"
      const lanc = mes === '08' && i === 4 ? '00182' : '00006';
      ent.push(nota(cf, lanc, 1850.4 + i * 733.15 + (mes === '08' ? 412.9 : 0), String(num++), fornecedores[i % 4], (3 + i * 3) + '/' + mes + '/2026', CNPJ(i)));
    }
    ent.push(nota('1353', '00014', 380 + (mes === '08' ? 95.5 : 0), String(num++), 'TRANSPORTADORA EPSILON LTDA', '12/' + mes + '/2026', CNPJ(9)));
    ent.push(nota('1353', '00014', 215.3, String(num++), 'TRANSPORTADORA EPSILON LTDA', '24/' + mes + '/2026', CNPJ(9)));
    ent.push(nota('1253', '00040', 942.17 + (mes === '08' ? 61.2 : 0), String(num++), 'COMPANHIA ENERGETICA EXEMPLO', '10/' + mes + '/2026', CNPJ(11)));
    ent.push(nota('1556', '00215', 188.9, String(num++), 'PAPELARIA ZETA LTDA', '15/' + mes + '/2026', CNPJ(12)));
    ent.push(nota('1202', '00667', 96.4, String(num++), 'MERCEARIA ETA LTDA', '20/' + mes + '/2026', CNPJ(13)));
  }
  const sai: Nota[] = [];
  let ns = 9001;
  for (const mes of ['07', '08']) {
    for (let i = 0; i < 12; i++) {
      const cpf = i % 3 === 0;
      const nome = cpf ? (i % 2 ? 'CONSUMIDOR FINAL' : 'MARIA DE EXEMPLO') : ['MERCEARIA ETA LTDA', 'PADARIA THETA LTDA', 'RESTAURANTE IOTA LTDA'][i % 3];
      sai.push(nota(i === 11 ? '6102' : '5102', cpf ? '00001' : '00001', 640 + i * 318.35 + (mes === '08' ? 250 : 0), String(ns++), nome, (2 + i * 2) + '/' + mes + '/2026', cpf ? CPF(i) : CNPJ(20 + i)));
    }
    sai.push(nota('5405', '00227', 1320.75 + (mes === '08' ? 210 : 0), String(ns++), 'PADARIA THETA LTDA', '18/' + mes + '/2026', CNPJ(31)));
    sai.push(nota('5910', '00260', 145, String(ns++), 'RESTAURANTE IOTA LTDA', '22/' + mes + '/2026', CNPJ(32)));
  }
  sai.push(nota('5202', '00031', 210.6, String(ns), 'ATACADO BETA LTDA', '26/08/2026', CNPJ(1)));
  e.entradas = ent;
  e.saidas = sai;
  e.servTomados = [
    serv('3301', 'TELEFONIA KAPPA S.A.', '05/07/2026', 189.9, '38'),
    serv('3302', 'TELEFONIA KAPPA S.A.', '05/08/2026', 189.9, '38'),
    serv('7701', 'PROVEDOR LAMBDA INTERNET LTDA', '08/07/2026', 129.9, '52'),
    serv('7702', 'PROVEDOR LAMBDA INTERNET LTDA', '08/08/2026', 129.9, '527'),
    serv('1201', 'NILMA CONTABILIDADE LTDA', '10/07/2026', 1100, '42'),
    serv('1202', 'NILMA CONTABILIDADE LTDA', '10/08/2026', 1100, '42'),
    serv('5501', 'DEDETIZADORA MU LTDA', '19/07/2026', 350, '527'),
    serv('5502', 'SISTEMAS NU SOFTWARE LTDA', '28/08/2026', 249, '503'),
  ];
  e.naturezaConta = {
    'Compra para comercialização': ['66005', '66006'],
    'Frete Comercial (entrada)': ['66015'],
    'Compra de energia elétrica por estabelecimento comercial': ['31105'],
    'Uso e Consumo': ['31122'],
    'Devolução de venda de mercadoria adquirida ou recebida de terceiros': ['40203'],
    'Venda de mercadoria adquirida ou recebida de terceiros': ['40104'],
    'Venda de mercadoria, adquirida ou recebida de terceiros, na condição de contribuinte-substituído': ['40107'],
    // vínculo errado vindo de antes (conta do Passivo): a linha fica vermelha no Relatório
    'Devolução de compra para comercialização': ['21101'],
    'serv|tomados|*': ['31130'],
    'serv|tomados|cat:telefone': ['31109'],
    'serv|tomados|cat:internet': ['31110'],
    'serv|tomados|cat:sistemas': ['31130'],
  };
  e.naoContabil = { 'Remessa em bonificação, doação ou brinde': true };
  e.servCat = {
    tomados: {
      'telefonia kappa s a': { cat: 'telefone', nome: 'TELEFONIA KAPPA S.A.' },
      'provedor lambda internet ltda': { cat: 'internet', nome: 'PROVEDOR LAMBDA INTERNET LTDA' },
    },
  };
  // saldos: compras batem; frete com diferença; energia com diferença pequena (pode ficar "Conferido");
  // vendas batem; ST com diferença; uso e consumo bate
  fecharSaldos(e, { 66015: -95.5, 31105: 61.2, 40107: 210 });
  const set = (c: string, v: number) => { const x = e.contas.find(a => a.codigo === c); if (x) x.valor = v; };
  set('11101', 15230.44); set('11201', 48711.09); set('21401', 189.9);
  set('31109', 379.8); set('31110', 259.8); set('31201', 2200); set('31130', 599);
  e.balanceteAssinatura = Object.fromEntries(e.contas.map(c => [c.codigo, c.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()]));
  e.balanceteAssinaturaTs = '2026-09-02T13:10:00.000Z';
  e.importHistorico = [
    { ts: '2026-09-02T13:10:00.000Z', tipo: 'Balancete', qtd: e.contas.length, acao: 'importado' },
    { ts: '2026-09-02T13:12:00.000Z', tipo: 'Entradas', qtd: ent.length, acao: 'importado' },
    { ts: '2026-09-02T13:13:00.000Z', tipo: 'Saídas', qtd: sai.length, acao: 'importado' },
    { ts: '2026-09-02T13:15:00.000Z', tipo: 'Serviços tomados', qtd: e.servTomados.length, acao: 'importado' },
  ];
  e.dp = [
    { lanc: '00006', conta: '66005', nome: 'Compras de Mercadorias à Prazo', dc: 'D', travado: true },
    { lanc: '00014', conta: '66015', nome: 'Fretes e Carretos', dc: 'D', travado: true },
  ];
  return e;
}

// ---------------------------------------------------------------------------
// 902 — serviços médicos: prestados + tomados + poucas entradas
// ---------------------------------------------------------------------------
function servicos(): Empresa {
  const e = empresaNova('EXEMPLO SERVICOS MEDICOS LTDA');
  e.prestaServico = true;
  e.autoLimparBalancete = true;
  e.contas = [
    conta('11101', 'Caixa Geral', 'Ativo', 'D', 0),
    conta('31105', 'Energia Elétrica', 'Despesa', 'D', 1),
    conta('31109', 'Telefone', 'Despesa', 'D', 2),
    conta('31201', 'Honorários Contábeis', 'Despesa', 'D', 3),
    conta('31130', 'Serviços de Terceiros', 'Despesa', 'D', 4),
    conta('31122', 'Materiais para Uso e Consumo', 'Despesa', 'D', 5),
    conta('40301', 'Receita de Serviços Médicos', 'Receita', 'C', 6),
  ];
  const clientes = ['PLANO DE SAUDE OMICRON S.A.', 'HOSPITAL PI LTDA', 'CLINICA RHO LTDA'];
  e.servPrestados = [];
  let n = 501;
  for (const mes of ['07', '08']) for (let i = 0; i < 6; i++) {
    e.servPrestados.push(serv(String(n++), clientes[i % 3], (4 + i * 4) + '/' + mes + '/2026', 4200 + i * 915.5, i === 5 && mes === '08' ? '527' : '160', Math.round((4200 + i * 915.5) * 0.02 * 100) / 100));
  }
  e.servTomados = [
    serv('3401', 'TELEFONIA KAPPA S.A.', '05/07/2026', 99.9, '38'),
    serv('3402', 'TELEFONIA KAPPA S.A.', '05/08/2026', 99.9, '38'),
    serv('1301', 'NILMA CONTABILIDADE LTDA', '10/08/2026', 1450, '42'),
    serv('6601', 'LAVANDERIA SIGMA LTDA', '14/08/2026', 380, '527'),
  ];
  e.entradas = [
    nota('1556', '00215', 312.45, '8801', 'DISTRIBUIDORA TAU HOSPITALAR LTDA', '09/07/2026', CNPJ(40)),
    nota('1556', '00215', 288.1, '8802', 'DISTRIBUIDORA TAU HOSPITALAR LTDA', '11/08/2026', CNPJ(40)),
  ];
  e.naturezaConta = {
    'serv|prestados|*': ['40301'],
    'serv|tomados|*': ['31130'],
    'serv|tomados|cat:telefone': ['31109'],
    'serv|tomados|cat:honorario': ['31201'],
    'Uso e Consumo': ['31122'],
  };
  e.servCat = { tomados: { 'telefonia kappa s a': { cat: 'telefone', nome: 'TELEFONIA KAPPA S.A.' } } };
  const soma = (l: { valor: number }[]) => Math.round(l.reduce((s, x) => s + x.valor, 0) * 100) / 100;
  const set = (c: string, v: number) => { const x = e.contas.find(a => a.codigo === c); if (x) x.valor = v; };
  set('11101', 3120.5); set('31105', 0);
  set('40301', soma(e.servPrestados) - 915.5);
  set('31109', 199.8); set('31201', 1450); set('31130', 380); set('31122', soma(e.entradas));
  e.importHistorico = [
    { ts: '2026-09-03T11:00:00.000Z', tipo: 'Balancete', qtd: e.contas.length, acao: 'importado' },
    { ts: '2026-09-03T11:02:00.000Z', tipo: 'Serviços prestados', qtd: e.servPrestados.length, acao: 'importado' },
    { ts: '2026-09-03T11:03:00.000Z', tipo: 'Serviços tomados', qtd: e.servTomados.length, acao: 'importado' },
  ];
  return e;
}

/** As empresas de exemplo, já prontas (903 vem vazia, pra testar a primeira abertura). */
export function empresasDeExemplo(): Empresa[] {
  return [comercio(), servicos()];
}
