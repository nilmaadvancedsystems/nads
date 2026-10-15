// Os dados da DANFSe v2.0 (15/10/2026: "faz o danf poder ser baixado"): lê o XML da nota autorizada (o do portal nacional, com
// <NFSe><infNFSe>…<DPS>) e monta, já em texto, cada campo do documento auxiliar. Campo sem valor sai com "-", como no modelo
// do portal. Puro: o desenho do PDF fica no app.

/** A consulta pública da NFS-e Nacional: o QR code do documento aponta para ela com a chave de acesso. */
export const URL_CONSULTA_NFSE = 'https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=';

export const SEM_VALOR = '-';

export interface PessoaDanfse {
  documento: string;
  inscricaoMunicipal: string;
  nome: string;
  fone: string;
  municipio: string;
  ibgeCep: string;
  endereco: string;
  email: string;
}

export interface DadosDaDanfse {
  chave: string;
  /** o texto do QR code (a consulta pública com a chave) */
  urlDeConsulta: string;
  municipio: string;
  ambienteGerador: string;
  tipoAmbiente: string;
  numeroNfse: string;
  competencia: string;
  emitidaEm: string;
  numeroDps: string;
  serieDps: string;
  dpsEmitidaEm: string;
  emitente: string;
  situacao: string;
  finalidade: string;
  prestador: PessoaDanfse & { simples: string; regimeApuracao: string };
  tomador: PessoaDanfse;
  servico: {
    codigoTributacao: string;
    descricaoDoCodigo: string;
    descricao: string;
    nbs: string;
    local: string;
  };
  municipal: {
    tributacao: string;
    incidencia: string;
    regimeEspecial: string;
    imunidade: string;
    suspensao: string;
    processoSuspensao: string;
    beneficio: string;
    calculoBm: string;
    deducoes: string;
    descontoIncondicionado: string;
    baseDeCalculo: string;
    aliquota: string;
    retencao: string;
    issqn: string;
  };
  federal: { irrf: string; previdencia: string; sociais: string; pis: string; cofins: string; descricaoSociais: string };
  ibsCbs: {
    cst: string;
    operacao: string;
    exclusoes: string;
    baseAposExclusoes: string;
    reducao: string;
    aliquotaIbs: string;
    efetivaMunicipal: string;
    apuradoMunicipal: string;
    efetivaEstadual: string;
    apuradoEstadual: string;
    totalIbs: string;
    aliquotaCbs: string;
    efetivaCbs: string;
    apuradoCbs: string;
  };
  totais: { valorServico: string; descontoIncondicionado: string; descontoCondicionado: string; retencoes: string; liquido: string; ibsCbs: string; liquidoComIbsCbs: string };
  informacoes: string;
}

// ---------- leitura do XML (sem biblioteca: só o que a DANFSe precisa) ----------

interface No { nome: string; texto: string; filhos: No[] }

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodificar = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_t, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTIDADES[e.toLowerCase()]);

function ler(xml: string): No {
  const raiz: No = { nome: '', texto: '', filhos: [] };
  const pilha = [raiz];
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z_][\w.:-]*)[^>]*?(\/?)>|<[?!][^>]*>|([^<]+)/g;
  for (let m = re.exec(xml); m; m = re.exec(xml)) {
    const topo = pilha[pilha.length - 1];
    if (m[1] != null) topo.texto += m[1];
    else if (m[5] != null) topo.texto += decodificar(m[5]);
    else if (m[3]) {
      if (m[2]) { if (pilha.length > 1) pilha.pop(); continue; }
      const no: No = { nome: m[3].replace(/^.*:/, ''), texto: '', filhos: [] };
      topo.filhos.push(no);
      if (!m[4]) pilha.push(no);
    }
  }
  return raiz;
}

/** O primeiro nó no caminho (cada passo é filho direto do anterior); undefined se não existir. */
const achar = (no: No | undefined, ...caminho: string[]): No | undefined => caminho.reduce<No | undefined>((n, c) => n?.filhos.find(f => f.nome === c), no);
const texto = (no: No | undefined, ...caminho: string[]): string => (achar(no, ...caminho)?.texto || '').trim();
const ou = (v: string) => v || SEM_VALOR;

// ---------- formatos ----------

const so = (v: string) => v.replace(/\D/g, '');
const numero = (v: string): number | null => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "950.00" → "R$ 950,00" ('-' sem valor) */
const moeda = (v: string) => { const n = numero(v); return n == null ? SEM_VALOR : 'R$ ' + brl(n); };
/** "3.74" → "3,74%" ('-' sem valor) */
const percentual = (v: string) => { const n = numero(v); return n == null ? SEM_VALOR : brl(n) + '%'; };
/** AAAA-MM-DD → dd/mm/aaaa */
const dia = (v: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v); return m ? m[3] + '/' + m[2] + '/' + m[1] : SEM_VALOR; };
/** 2026-10-14T17:32:45-03:00 → 14/10/2026 17:32:45 (a hora como a prefeitura gravou, sem converter o fuso) */
const diaHora = (v: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})/.exec(v); return m ? m[3] + '/' + m[2] + '/' + m[1] + ' ' + m[4] : dia(v); };

function documento(d: string): string {
  const n = so(d);
  if (n.length === 14) return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (n.length === 11) return n.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return ou(d);
}
function fone(f: string): string {
  const n = so(f);
  if (n.length === 10) return n.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  if (n.length === 11) return n.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  return ou(f);
}
const cep = (c: string) => { const n = so(c); return n.length === 8 ? n.slice(0, 5) + '-' + n.slice(5) : ou(n); };

/** O código IBGE do município começa com o código da UF. */
const UF_DO_IBGE: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB',
  '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS',
  '51': 'MT', '52': 'GO', '53': 'DF',
};
export const ufDoIbge = (cMun: string) => UF_DO_IBGE[so(cMun).slice(0, 2)] || '';

// ---------- os nomes por extenso (tabelas da NFS-e Nacional) ----------

const SIMPLES: Record<string, string> = { '1': 'Não Optante', '2': 'Optante - Microempreendedor Individual (MEI)', '3': 'Optante - ME/EPP' };
const APURACAO_SN: Record<string, string> = {
  '1': 'Regime de apuração dos tributos federais e municipal pelo SN',
  '2': 'Regime de apuração dos tributos federais pelo SN e o ISSQN pela NFS-e conforme respectiva legislação municipal do tributo',
  '3': 'Regime de apuração dos tributos federais e municipal pela NFS-e conforme respectivas legislações federal e municipal de cada tributo',
};
const REGIME_ESPECIAL: Record<string, string> = { '0': 'Nenhum', '1': 'Ato Cooperado (Cooperativa)', '2': 'Estimativa', '3': 'Microempresa Municipal', '4': 'Notário ou Registrador', '5': 'Profissional Autônomo', '6': 'Sociedade de Profissionais' };
const TRIBUTACAO: Record<string, string> = { '1': 'Operação tributável', '2': 'Imunidade', '3': 'Exportação de serviço', '4': 'Não Incidência' };
const RETENCAO: Record<string, string> = { '1': 'Não Retido', '2': 'Retido pelo Tomador', '3': 'Retido pelo Intermediário' };
const IMUNIDADE: Record<string, string> = {
  '0': 'Imunidade (tipo não informado na nota de origem)', '1': 'Patrimônio, renda ou serviços, uns dos outros (CF88, Art 150, VI, a)',
  '2': 'Entidades religiosas e templos de qualquer culto (CF88, Art 150, VI, b)',
  '3': 'Partidos políticos, sindicatos de trabalhadores, instituições de educação e assistência social (CF88, Art 150, VI, c)',
  '4': 'Livros, jornais, periódicos e o papel destinado a sua impressão (CF88, Art 150, VI, d)',
  '5': 'Fonogramas e videofonogramas musicais produzidos no Brasil (CF88, Art 150, VI, e)',
};
const SUSPENSAO: Record<string, string> = { '1': 'Sim - Exigibilidade Suspensa por Decisão Judicial', '2': 'Sim - Exigibilidade Suspensa por Processo Administrativo' };
const EMITENTE: Record<string, string> = { '1': 'Prestador', '2': 'Tomador', '3': 'Intermediário' };

/** 171901 → 17.19.01 */
const codigoNacional = (c: string) => { const n = so(c); return n.length === 6 ? n.replace(/^(\d{2})(\d{2})(\d{2})$/, '$1.$2.$3') : ou(c); };

function endereco(logradouro: string, numero: string, complemento: string, bairro: string): string {
  const partes = [logradouro, numero, complemento, bairro].map(p => p.trim()).filter(Boolean);
  return partes.length ? partes.join(', ') : SEM_VALOR;
}

/**
 * Lê o XML da NFS-e autorizada e devolve os campos da DANFSe, já formatados.
 * `municipios`: código IBGE → nome, para o município do tomador (o XML só traz o código; os nomes do prestador, da prestação
 * e da incidência vêm no próprio XML). Sem o nome, sai o código.
 */
export function dadosDaDanfse(xml: string, municipios: Record<string, string> = {}): DadosDaDanfse {
  const nfse = achar(ler(xml), 'NFSe');
  const inf = achar(nfse, 'infNFSe');
  if (!inf) throw new Error('Não é o XML de uma NFS-e autorizada (faltou o infNFSe).');
  const dps = achar(inf, 'DPS', 'infDPS');
  const emit = achar(inf, 'emit');
  const prest = achar(dps, 'prest');
  const toma = achar(dps, 'toma');
  const vNota = achar(inf, 'valores');
  const vDps = achar(dps, 'valores');
  const trib = achar(vDps, 'trib');
  const tribMun = achar(trib, 'tribMun');
  const ibs = achar(dps, 'IBSCBS') || achar(inf, 'IBSCBS');

  // a chave de acesso é o Id do infNFSe sem o prefixo "NFS" (50 dígitos)
  const id = /<infNFSe\b[^>]*\sId="NFS(\d+)"/.exec(xml)?.[1] || '';

  const cMunEmit = texto(emit, 'enderNac', 'cMun');
  const ufEmit = texto(emit, 'enderNac', 'UF') || ufDoIbge(cMunEmit);
  const cLocPrest = texto(dps, 'serv', 'locPrest', 'cLocPrestacao');
  const cLocIncid = texto(inf, 'cLocIncid');
  const nomes: Record<string, string> = { ...municipios };
  for (const [cod, nome] of [[cMunEmit, texto(inf, 'xLocEmi')], [cLocPrest, texto(inf, 'xLocPrestacao')], [cLocIncid, texto(inf, 'xLocIncid')]]) if (cod && nome) nomes[cod] = nome;
  const cidadeUf = (cMun: string) => (cMun ? (nomes[cMun] || cMun) + ' / ' + (ufDoIbge(cMun) || SEM_VALOR) : SEM_VALOR);
  const cidadeUfPais = (cMun: string) => (cMun ? cidadeUf(cMun) + ' / BR' : SEM_VALOR);

  const cMunToma = texto(toma, 'end', 'endNac', 'cMun');
  const docToma = texto(toma, 'CNPJ') || texto(toma, 'CPF') || texto(toma, 'NIF');
  const opSimp = texto(prest, 'regTrib', 'opSimpNac');
  const vLiq = texto(vNota, 'vLiq') || texto(vDps, 'vServPrest', 'vServ');
  const vIbsCbs = texto(ibs, 'valores', 'vTotNF');
  const totTrib = achar(trib, 'totTrib');
  const infoComp = texto(dps, 'serv', 'infoCompl', 'xInfComp');
  const aprox = (nome: string) => { const v = texto(totTrib, 'vTotTrib', nome); return v ? moeda(v) : SEM_VALOR; };
  const liquido = numero(vLiq);

  return {
    chave: ou(id),
    urlDeConsulta: URL_CONSULTA_NFSE + id,
    municipio: ou(texto(inf, 'xLocEmi')) + (ufEmit ? ' - ' + ufEmit : ''),
    ambienteGerador: ou(texto(inf, 'ambGer')),
    tipoAmbiente: ou(texto(dps, 'tpAmb')),
    numeroNfse: ou(texto(inf, 'nNFSe')),
    competencia: dia(texto(dps, 'dCompet')),
    emitidaEm: diaHora(texto(inf, 'dhProc')),
    numeroDps: ou(texto(dps, 'nDPS')),
    serieDps: ou(texto(dps, 'serie')),
    dpsEmitidaEm: diaHora(texto(dps, 'dhEmi')),
    emitente: EMITENTE[texto(dps, 'tpEmit')] || SEM_VALOR,
    // cStat 100 = autorizada: no portal, "NFS-e Gerada"
    situacao: texto(inf, 'cStat') === '100' ? 'NFS-e Gerada' : ou(texto(inf, 'cStat')),
    finalidade: SEM_VALOR,
    prestador: {
      documento: documento(texto(emit, 'CNPJ') || texto(emit, 'CPF') || texto(prest, 'CNPJ')),
      inscricaoMunicipal: ou(texto(emit, 'IM') || texto(prest, 'IM')),
      nome: ou(texto(emit, 'xNome')),
      fone: fone(texto(emit, 'fone') || texto(prest, 'fone')),
      municipio: cidadeUf(cMunEmit),
      ibgeCep: ou(cMunEmit) + ' / ' + cep(texto(emit, 'enderNac', 'CEP')),
      endereco: endereco(texto(emit, 'enderNac', 'xLgr'), texto(emit, 'enderNac', 'nro'), texto(emit, 'enderNac', 'xCpl'), texto(emit, 'enderNac', 'xBairro')),
      email: ou(texto(emit, 'email') || texto(prest, 'email')),
      simples: SIMPLES[opSimp] || SEM_VALOR,
      regimeApuracao: opSimp === '3' ? APURACAO_SN[texto(prest, 'regTrib', 'regApTribSN')] || SEM_VALOR : SEM_VALOR,
    },
    tomador: {
      documento: documento(docToma),
      inscricaoMunicipal: ou(texto(toma, 'IM')),
      nome: ou(texto(toma, 'xNome')),
      fone: fone(texto(toma, 'fone')),
      municipio: cidadeUf(cMunToma),
      ibgeCep: ou(cMunToma) + ' / ' + cep(texto(toma, 'end', 'endNac', 'CEP')),
      endereco: endereco(texto(toma, 'end', 'xLgr'), texto(toma, 'end', 'nro'), texto(toma, 'end', 'xCpl'), texto(toma, 'end', 'xBairro')),
      email: ou(texto(toma, 'email')),
    },
    servico: {
      codigoTributacao: codigoNacional(texto(dps, 'serv', 'cServ', 'cTribNac')) + ' / ' + ou(texto(dps, 'serv', 'cServ', 'cTribMun')),
      descricaoDoCodigo: ou(texto(inf, 'xTribNac')),
      descricao: ou(texto(dps, 'serv', 'cServ', 'xDescServ')),
      nbs: ou(texto(dps, 'serv', 'cServ', 'cNBS')),
      local: cidadeUfPais(cLocPrest),
    },
    municipal: {
      tributacao: TRIBUTACAO[texto(tribMun, 'tribISSQN')] || SEM_VALOR,
      incidencia: cidadeUfPais(cLocIncid),
      regimeEspecial: REGIME_ESPECIAL[texto(prest, 'regTrib', 'regEspTrib')] || SEM_VALOR,
      imunidade: IMUNIDADE[texto(tribMun, 'tpImunidade')] || SEM_VALOR,
      suspensao: SUSPENSAO[texto(tribMun, 'exigSusp', 'tpSusp')] || 'Não',
      processoSuspensao: ou(texto(tribMun, 'exigSusp', 'nProcesso')),
      beneficio: ou(texto(tribMun, 'BM', 'nBM')),
      calculoBm: moeda(texto(vNota, 'vCalcBM') || texto(vNota, 'vCalcDR') || '0'),
      deducoes: moeda(texto(vDps, 'vDedRed', 'vDR') || '0'),
      descontoIncondicionado: moeda(texto(vDps, 'vDescCondIncond', 'vDescIncond')),
      baseDeCalculo: moeda(texto(vNota, 'vBC')),
      aliquota: percentual(texto(vNota, 'pAliqAplic') || texto(tribMun, 'pAliq')),
      retencao: RETENCAO[texto(tribMun, 'tpRetISSQN')] || SEM_VALOR,
      issqn: moeda(texto(vNota, 'vISSQN')),
    },
    federal: {
      irrf: moeda(texto(trib, 'tribFed', 'vRetIRRF')),
      previdencia: moeda(texto(trib, 'tribFed', 'vRetCP')),
      sociais: moeda(texto(trib, 'tribFed', 'vRetCSLL')),
      pis: moeda(texto(trib, 'tribFed', 'piscofins', 'vPis')),
      cofins: moeda(texto(trib, 'tribFed', 'piscofins', 'vCofins')),
      descricaoSociais: SEM_VALOR,
    },
    ibsCbs: {
      cst: ou(texto(ibs, 'valores', 'trib', 'gIBSCBS', 'CST')) + ' / ' + ou(texto(ibs, 'valores', 'trib', 'gIBSCBS', 'cClassTrib')),
      operacao: ou(texto(ibs, 'cIndOp')) + ' / ' + ou(texto(ibs, 'cLocalidadeIncid')) + ' / ' + ou(ufDoIbge(texto(ibs, 'cLocalidadeIncid'))),
      exclusoes: moeda('0'),
      baseAposExclusoes: moeda(texto(ibs, 'valores', 'trib', 'gIBSCBS', 'vBC') || '0'),
      reducao: '- / -',
      aliquotaIbs: percentual('0') + ' / ' + percentual('0'),
      efetivaMunicipal: percentual('0'),
      apuradoMunicipal: moeda('0'),
      efetivaEstadual: percentual('0'),
      apuradoEstadual: moeda('0'),
      totalIbs: moeda('0'),
      aliquotaCbs: percentual('0'),
      efetivaCbs: percentual('0'),
      apuradoCbs: moeda('0'),
    },
    totais: {
      valorServico: moeda(texto(vDps, 'vServPrest', 'vServ')),
      descontoIncondicionado: SEM_VALOR,
      descontoCondicionado: SEM_VALOR,
      retencoes: SEM_VALOR,
      liquido: moeda(vLiq),
      ibsCbs: moeda(vIbsCbs || '0'),
      liquidoComIbsCbs: liquido == null ? SEM_VALOR : moeda(String(Math.round((liquido + (numero(vIbsCbs) ?? 0)) * 100) / 100)),
    },
    informacoes: (infoComp ? 'Inf. Cont.: ' + infoComp + ' | ' : '')
      + 'Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012: Federais: ' + aprox('vTotTribFed') + '; Estaduais: ' + aprox('vTotTribEst') + '; Municipais: ' + aprox('vTotTribMun') + ';',
  };
}
