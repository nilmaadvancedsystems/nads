// A nota original pelo XML inteiro (23/10/2026: "eu queria realmente ver a nota, com produtos e tal, a nota original"; a
// 2ª etapa do espelho da nota). Puro, sem DOM (roda no navegador e nos testes): as tags lidas por expressão, só as da
// NF-e/NFC-e (modelo 55 e 65). Dá o que a DANFE mostra: a identificação, o emitente, o destinatário, os produtos (código,
// descrição, NCM, CST/CSOSN, CFOP, unidade, quantidade, valores e impostos), os totais, o transporte, as faturas, o
// pagamento, as informações complementares e o protocolo. E o documento para imprimir, no desenho da DANFE (A4 em pé).

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

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 4 });

/** o documento para imprimir, no desenho da DANFE (A4 em pé; o cabeçalho dos produtos se repete em cada página) */
export function htmlDaDanfe(d: Danfe): string {
  const campo = (rotulo: string, valor: string, cls = '') => `<div class="c ${cls}"><span>${esc(rotulo)}</span><b>${esc(valor) || '&nbsp;'}</b></div>`;
  const e = d.emitente, q = d.destinatario, t = d.totais;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>DANFE ${esc(d.numero)} - ${esc(e.nome)}</title>
<style>
  @page{size:A4;margin:7mm}
  :root{color-scheme:light}
  *{box-sizing:border-box}
  html,body{margin:0;background:#fff}
  body{font-family:Arial,Helvetica,sans-serif;color:#000;font-size:7pt}
  .linha{display:flex;border:.25mm solid #000;border-bottom:none}
  .linha:last-of-type{border-bottom:.25mm solid #000}
  .c{flex:1;padding:.8mm 1.2mm;border-right:.25mm solid #000;min-width:0}
  .c:last-child{border-right:none}
  .c span{display:block;font-size:5.5pt;text-transform:uppercase}
  .c b{display:block;font-size:7.5pt;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .w2{flex:2}.w3{flex:3}.w4{flex:4}
  h2{font-size:7pt;margin:2.5mm 0 .8mm;text-transform:uppercase}
  .topo{display:flex;border:.25mm solid #000}
  .topo>div{padding:2mm;border-right:.25mm solid #000}
  .topo>div:last-child{border-right:none}
  .emit{flex:3}.emit b{font-size:10pt}
  .danfe{flex:1.3;text-align:center}.danfe b{font-size:12pt;display:block}
  .chave{flex:3}.chave b{font-size:8.5pt;letter-spacing:.3pt}
  table{width:100%;border-collapse:collapse}
  thead{display:table-header-group}
  th,td{border:.25mm solid #000;padding:.6mm .8mm;font-size:6.2pt;vertical-align:top}
  th{font-size:5.5pt;text-transform:uppercase}
  td.n{text-align:right;white-space:nowrap}
  tr{break-inside:avoid}
  .info{border:.25mm solid #000;padding:1.5mm;min-height:18mm;white-space:pre-wrap;font-size:6.5pt}
</style></head><body>
<div class="topo">
  <div class="emit"><b>${esc(e.nome)}</b><br>${esc(e.endereco)}<br>${esc([e.municipio, e.uf].filter(Boolean).join(' - '))}${e.cep ? ' · CEP ' + esc(e.cep) : ''}${e.fone ? '<br>Fone ' + esc(e.fone) : ''}</div>
  <div class="danfe"><b>DANFE</b>Documento auxiliar da nota fiscal eletrônica<br><br>${d.tipo === 'entrada' ? '0 - ENTRADA' : '1 - SAÍDA'}<br><br><b>Nº ${esc(d.numero)}</b>Série ${esc(d.serie)}</div>
  <div class="chave"><span>CHAVE DE ACESSO</span><br><b>${esc(chaveEmGrupos(d.chave))}</b><br><br>Consulta de autenticidade no portal nacional da NF-e (www.nfe.fazenda.gov.br/portal) ou no site da SEFAZ autorizadora</div>
</div>
<div class="linha">${campo('Natureza da operação', d.natureza, 'w3')}${campo('Protocolo de autorização de uso', d.protocolo ? d.protocolo.numero + ' - ' + d.protocolo.data : '', 'w2')}</div>
<div class="linha">${campo('Inscrição estadual', e.ie)}${campo('CNPJ / CPF', docFormatado(e.doc))}</div>
<h2>Destinatário / remetente</h2>
<div class="linha">${campo('Nome / razão social', q.nome, 'w4')}${campo('CNPJ / CPF', docFormatado(q.doc), 'w2')}${campo('Data da emissão', d.emissao)}</div>
<div class="linha">${campo('Endereço', q.endereco, 'w4')}${campo('CEP', q.cep)}${campo('Data da saída/entrada', d.saidaEntrada)}</div>
<div class="linha">${campo('Município', q.municipio, 'w3')}${campo('UF', q.uf)}${campo('Fone', q.fone)}${campo('Inscrição estadual', q.ie, 'w2')}</div>
${d.faturas.length ? `<h2>Fatura / duplicatas</h2><div class="linha">${d.faturas.map(f => campo(f.numero + ' · venc. ' + f.vencimento, 'R$ ' + brl(f.valor))).join('')}</div>` : ''}
<h2>Cálculo do imposto</h2>
<div class="linha">${campo('Base de cálculo do ICMS', brl(t.bcIcms))}${campo('Valor do ICMS', brl(t.icms))}${campo('Base de cálculo do ICMS ST', brl(t.bcSt))}${campo('Valor do ICMS ST', brl(t.st))}${campo('Valor total dos produtos', brl(t.produtos))}</div>
<div class="linha">${campo('Valor do frete', brl(t.frete))}${campo('Valor do seguro', brl(t.seguro))}${campo('Desconto', brl(t.desconto))}${campo('Outras despesas', brl(t.outras))}${campo('Valor do IPI', brl(t.ipi))}${campo('Valor total da nota', brl(t.nota))}</div>
<h2>Transportador / volumes transportados</h2>
<div class="linha">${campo('Razão social', d.transporte.nome, 'w3')}${campo('Frete por conta', d.transporte.modalidade, 'w2')}${campo('Placa', d.transporte.placa)}${campo('CNPJ / CPF', docFormatado(d.transporte.doc), 'w2')}</div>
<div class="linha">${campo('Volumes', d.transporte.volumes, 'w3')}${campo('Peso bruto', d.transporte.pesoBruto ? qtd(d.transporte.pesoBruto) : '')}${campo('Peso líquido', d.transporte.pesoLiquido ? qtd(d.transporte.pesoLiquido) : '')}</div>
<h2>Dados dos produtos / serviços</h2>
<table><thead><tr><th>Código</th><th>Descrição do produto / serviço</th><th>NCM</th><th>CST</th><th>CFOP</th><th>Un.</th><th>Quant.</th><th>V. unit.</th><th>V. total</th><th>BC ICMS</th><th>V. ICMS</th><th>V. IPI</th><th>Alíq. ICMS</th><th>Alíq. IPI</th></tr></thead>
<tbody>${d.itens.map(i => `<tr><td>${esc(i.codigo)}</td><td>${esc(i.descricao)}${i.infAdic ? '<br><i>' + esc(i.infAdic) + '</i>' : ''}</td><td>${esc(i.ncm)}</td><td>${esc(i.cst)}</td><td>${esc(i.cfop)}</td><td>${esc(i.unidade)}</td><td class="n">${qtd(i.quantidade)}</td><td class="n">${brl(i.valorUnitario)}</td><td class="n">${brl(i.valor)}</td><td class="n">${brl(i.bcIcms)}</td><td class="n">${brl(i.icms)}</td><td class="n">${brl(i.ipi)}</td><td class="n">${qtd(i.aliqIcms)}</td><td class="n">${qtd(i.aliqIpi)}</td></tr>`).join('')}</tbody></table>
<h2>Dados adicionais</h2>
<div class="info">${esc([d.informacoes, d.fisco].filter(Boolean).join('\n'))}</div>
</body></html>`;
}
