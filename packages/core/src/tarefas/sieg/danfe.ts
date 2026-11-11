// A nota original pelo XML inteiro (23/10/2026: "eu queria realmente ver a nota, com produtos e tal, a nota original"; a
// 2ª etapa do espelho da nota). Puro, sem DOM (roda no navegador e nos testes): as tags lidas por expressão, só as da
// NF-e/NFC-e (modelo 55 e 65). Dá o que a DANFE mostra: a identificação, o emitente, o destinatário, os produtos (código,
// descrição, NCM, CST/CSOSN, CFOP, unidade, quantidade, valores e impostos), os totais, o transporte, as faturas, o
// pagamento, as informações complementares e o protocolo. O desenho da DANFE é um só, o PDF idêntico ao do portal do SIEG
// (apps/web .../fiscal/partes/danfePdf.ts; 11/11/2026: o HTML de imprimir saiu, "quero que todas as maneiras de puxar danfe saia igual").

export interface PessoaDaDanfe { nome: string; fantasia: string; doc: string; ie: string; endereco: string; municipio: string; uf: string; cep: string; fone: string }
export interface ItemDaDanfe {
  n: number; codigo: string; descricao: string; ncm: string; cest: string; cst: string; cfop: string; unidade: string;
  quantidade: number; valorUnitario: number; valor: number; desconto: number;
  bcIcms: number; aliqIcms: number; icms: number; st: number; ipi: number; aliqIpi: number; infAdic: string;
}
export interface Danfe {
  chave: string; modelo: string; numero: string; serie: string; emissao: string; saidaEntrada: string;
  /** 0 = entrada, 1 = saída */
  tipo: 'entrada' | 'saida';
  natureza: string;
  emitente: PessoaDaDanfe; destinatario: PessoaDaDanfe;
  itens: ItemDaDanfe[];
  totais: { bcIcms: number; icms: number; bcSt: number; st: number; produtos: number; frete: number; seguro: number; desconto: number; outras: number; ipi: number; nota: number; tributos: number };
  transporte: { modalidade: string; nome: string; doc: string; placa: string; volumes: string; pesoBruto: number; pesoLiquido: number };
  faturas: { numero: string; vencimento: string; valor: number }[];
  pagamentos: { forma: string; valor: number }[];
  informacoes: string; fisco: string;
  protocolo: { numero: string; data: string } | null;
}

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodificar = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTIDADES[e] ?? m);
/** o conteúdo da primeira tag (com ou sem prefixo de namespace) */
function tag(x: string, nome: string): string {
  const m = new RegExp('<(?:\\w+:)?' + nome + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?' + nome + '>').exec(x);
  return m ? m[1] : '';
}
const texto = (x: string, nome: string) => decodificar(tag(x, nome).trim());
/** todos os blocos da tag */
function blocos(x: string, nome: string): string[] {
  const re = new RegExp('<(?:\\w+:)?' + nome + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?' + nome + '>', 'g');
  return [...x.matchAll(re)].map(m => m[1]);
}
const num = (x: string, nome: string) => { const v = Number(tag(x, nome).trim()); return Number.isFinite(v) ? v : 0; };
/** dd/mm/aaaa (e a hora, se tem) da data do XML (2026-09-29T10:15:00-03:00) */
function data(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(s.trim());
  return m ? m[3] + '/' + m[2] + '/' + m[1] + (m[4] ? ' ' + m[4] + ':' + m[5] : '') : s.trim();
}

function pessoa(x: string, endereco: string): PessoaDaDanfe {
  const e = tag(x, endereco);
  const rua = [texto(e, 'xLgr'), texto(e, 'nro'), texto(e, 'xCpl')].filter(Boolean).join(', ');
  return {
    nome: texto(x, 'xNome'), fantasia: texto(x, 'xFant'), doc: texto(x, 'CNPJ') || texto(x, 'CPF') || texto(x, 'idEstrangeiro'), ie: texto(x, 'IE'),
    endereco: [rua, texto(e, 'xBairro')].filter(Boolean).join(' · '), municipio: texto(e, 'xMun'), uf: texto(e, 'UF'), cep: texto(e, 'CEP'), fone: texto(e, 'fone'),
  };
}

const MODALIDADE_DO_FRETE: Record<string, string> = {
  '0': 'Por conta do emitente', '1': 'Por conta do destinatário', '2': 'Por conta de terceiros', '3': 'Próprio, do emitente', '4': 'Próprio, do destinatário', '9': 'Sem frete',
};
const FORMA_DE_PAGAMENTO: Record<string, string> = {
  '01': 'Dinheiro', '02': 'Cheque', '03': 'Cartão de crédito', '04': 'Cartão de débito', '05': 'Crédito loja', '10': 'Vale alimentação', '11': 'Vale refeição',
  '12': 'Vale presente', '13': 'Vale combustível', '15': 'Boleto', '16': 'Depósito', '17': 'PIX', '18': 'Transferência', '19': 'Fidelidade', '90': 'Sem pagamento', '99': 'Outros',
};

/** a nota do XML (null = não é NF-e nem NFC-e) */
export function danfeDoXml(xml: string): Danfe | null {
  const inf = /<(?:\w+:)?infNFe\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?infNFe>/.exec(xml);
  if (!inf) return null;
  const x = inf[2];
  const ide = tag(x, 'ide');
  const icmsTot = tag(tag(x, 'total'), 'ICMSTot');
  const transp = tag(x, 'transp');
  const transporta = tag(transp, 'transporta');
  const vol = blocos(transp, 'vol');
  const prot = tag(xml, 'infProt');
  const itens: ItemDaDanfe[] = [...x.matchAll(/<(?:\w+:)?det\s+nItem="(\d+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?det>/g)].map(m => {
    const d = m[2];
    const prod = tag(d, 'prod');
    const imp = tag(d, 'imposto');
    const icms = tag(imp, 'ICMS');
    const ipi = tag(imp, 'IPI');
    return {
      n: Number(m[1]), codigo: texto(prod, 'cProd'), descricao: texto(prod, 'xProd'), ncm: texto(prod, 'NCM'), cest: texto(prod, 'CEST'),
      cst: (texto(icms, 'orig') || '') + (texto(icms, 'CST') || texto(icms, 'CSOSN')), cfop: texto(prod, 'CFOP'), unidade: texto(prod, 'uCom'),
      quantidade: num(prod, 'qCom'), valorUnitario: num(prod, 'vUnCom'), valor: num(prod, 'vProd'), desconto: num(prod, 'vDesc'),
      bcIcms: num(icms, 'vBC'), aliqIcms: num(icms, 'pICMS'), icms: num(icms, 'vICMS'), st: num(icms, 'vICMSST'), ipi: num(ipi, 'vIPI'), aliqIpi: num(ipi, 'pIPI'),
      infAdic: texto(d, 'infAdProd'),
    };
  });
  return {
    chave: ((/Id="NFe(\d{44})"/.exec(inf[1])) || [])[1] || '',
    modelo: texto(ide, 'mod'), numero: texto(ide, 'nNF'), serie: texto(ide, 'serie'),
    emissao: data(texto(ide, 'dhEmi') || texto(ide, 'dEmi')), saidaEntrada: data(texto(ide, 'dhSaiEnt') || texto(ide, 'dSaiEnt')),
    tipo: texto(ide, 'tpNF') === '0' ? 'entrada' : 'saida',
    natureza: texto(ide, 'natOp'),
    emitente: pessoa(tag(x, 'emit'), 'enderEmit'), destinatario: pessoa(tag(x, 'dest'), 'enderDest'),
    itens,
    totais: {
      bcIcms: num(icmsTot, 'vBC'), icms: num(icmsTot, 'vICMS'), bcSt: num(icmsTot, 'vBCST'), st: num(icmsTot, 'vST'), produtos: num(icmsTot, 'vProd'),
      frete: num(icmsTot, 'vFrete'), seguro: num(icmsTot, 'vSeg'), desconto: num(icmsTot, 'vDesc'), outras: num(icmsTot, 'vOutro'), ipi: num(icmsTot, 'vIPI'),
      nota: num(icmsTot, 'vNF'), tributos: num(icmsTot, 'vTotTrib'),
    },
    transporte: {
      modalidade: MODALIDADE_DO_FRETE[texto(transp, 'modFrete')] || texto(transp, 'modFrete'), nome: texto(transporta, 'xNome'), doc: texto(transporta, 'CNPJ') || texto(transporta, 'CPF'),
      placa: texto(tag(transp, 'veicTransp'), 'placa'),
      volumes: vol.map(v => [texto(v, 'qVol'), texto(v, 'esp'), texto(v, 'marca')].filter(Boolean).join(' ')).filter(Boolean).join('; '),
      pesoBruto: vol.reduce((s, v) => s + num(v, 'pesoB'), 0), pesoLiquido: vol.reduce((s, v) => s + num(v, 'pesoL'), 0),
    },
    faturas: blocos(tag(x, 'cobr'), 'dup').map(d => ({ numero: texto(d, 'nDup'), vencimento: data(texto(d, 'dVenc')), valor: num(d, 'vDup') })),
    pagamentos: blocos(tag(x, 'pag'), 'detPag').map(p => ({ forma: FORMA_DE_PAGAMENTO[texto(p, 'tPag')] || texto(p, 'tPag'), valor: num(p, 'vPag') })),
    informacoes: texto(tag(x, 'infAdic'), 'infCpl'), fisco: texto(tag(x, 'infAdic'), 'infAdFisco'),
    protocolo: prot ? { numero: texto(prot, 'nProt'), data: data(texto(prot, 'dhRecbto')) } : null,
  };
}

/** a chave em grupos de 4 (como na DANFE) */
export const chaveEmGrupos = (ch: string) => ch.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
/** o CNPJ ou o CPF com a máscara */
export function docFormatado(d: string): string {
  const s = d.replace(/\D/g, '');
  if (s.length === 14) return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (s.length === 11) return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return d;
}
