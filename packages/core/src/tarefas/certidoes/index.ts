// As certidões emitidas pelo robô (27/11/2026, o dono: "certidões digitais"; a municipal de Taiobeiras primeiro). O robô
// (robo/certidoes.js) emite no portal, lê o texto da certidão aqui, guarda o resumo por empresa (certidoes/{código}) e deixa o
// PDF na entrada do arquivador, que já arquiva em SOCIETÁRIO\CERTIDÕES\<ÓRGÃO>; a Área do Cliente e a tarefa de renovar já
// vêm de lá. tarefas.certidoes.*

const MESES = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
const DIA_MS = 86_400_000;

const normal = (t: string) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/�/g, '?').replace(/\s+/g, ' ').toUpperCase().trim();
const dois = (n: number) => String(n).padStart(2, '0');
const iso = (d: number, m: number, a: number) => a + '-' + dois(m) + '-' + dois(d);

/** 'aaaa-mm-dd' + n dias */
export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d) + dias * DIA_MS).toISOString().slice(0, 10);
}

export interface CertidaoLida {
  orgao: 'municipal';
  /** o número da certidão ("3530/2026") */
  numero: string | null;
  /** só os números */
  cnpj: string | null;
  nome: string | null;
  /** 'aaaa-mm-dd' */
  emitidaEm: string;
  validadeDias: number | null;
  /** 'aaaa-mm-dd' (emitida + validade) */
  vence: string | null;
  /** a chave de validação da web */
  chave: string | null;
  /** negativa (nada devido) ou positiva (há débito: vira pendência para o responsável) */
  negativa: boolean;
}

/**
 * A certidão da Prefeitura de Taiobeiras pelo texto da página (o portal GPI abre a certidão em HTML; conferida em
 * 27/11/2026). O texto: "PREFEITURA MUNICIPAL DE TAIOBEIRAS … CERTIDÃO NEGATIVA DE DÉBITOS Nº 3530/2026 … <NOME> CPF/CNPJ:
 * 03.238.183/0001-76 … não existe nesta repartição qualquer dívida … Chave de Validação WEB: a8c901d2 Prefeitura Municipal
 * de Taiobeiras, sexta-feira, 27 de novembro de 2026 VALIDADE: 90 dias". null = não é a certidão (sem a data de emissão).
 */
export function certidaoMunicipalDoTexto(texto: string): CertidaoLida | null {
  const u = normal(texto);
  if (!/PREFEITURA MUNICIPAL/.test(u) || !/CERTID.O/.test(u)) return null;
  const em = /PREFEITURA MUNICIPAL DE [A-Z ]+,\s*(?:[A-Z-]+,\s*)?(\d{1,2}) DE ([A-Z]+) DE (20\d{2})/.exec(u);
  const mes = em ? MESES.indexOf(em[2]) + 1 : 0;
  if (!em || !mes) return null;
  const emitidaEm = iso(Number(em[1]), mes, Number(em[3]));
  const validade = /VALIDADE:?\s*(\d{1,3})\s*DIAS/.exec(u);
  const ate = /VALID[AO]\s*AT[E?]\s*:?\s*(\d{2})\/(\d{2})\/(20\d{2})/.exec(u);
  const validadeDias = validade ? Number(validade[1]) : null;
  const numero = /CERTID.O[A-Z ]*?N.?\s*:?\s*(\d+\/20\d{2})/.exec(u);
  const doc = /CPF\/CNPJ:?\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11,14})/.exec(u);
  const nome = /(?:QUE|CERTIFICO, PARA OS DEVIDOS? FINS QUE):?\s*(.+?)\s+CPF\/CNPJ/.exec(u);
  const chave = /CHAVE DE VALIDA..O(?: WEB)?:?\s*([A-Z0-9]{6,12})/.exec(u);
  const positiva = /CERTID.O POSITIVA|CONSTA(M)? (DEBITO|DIVIDA)|EXISTE(M)? (O|OS)? ?(SEGUINTE|DEBITO)/.test(u) && !/NAO EXISTE NESTA REPARTI..O QUALQUER DIVIDA/.test(u);
  return {
    orgao: 'municipal',
    numero: numero ? numero[1] : null,
    cnpj: doc ? doc[1].replace(/\D/g, '') : null,
    nome: nome ? nome[1].slice(0, 200) : null,
    emitidaEm,
    validadeDias,
    vence: ate ? iso(Number(ate[1]), Number(ate[2]), Number(ate[3])) : validadeDias ? somarDias(emitidaEm, validadeDias) : null,
    chave: chave ? chave[1].toLowerCase() : null,
    negativa: !positiva && /NEGATIVA|NAO EXISTE NESTA REPARTI..O QUALQUER DIVIDA/.test(u),
  };
}

/** "CND - MUNICIPAL - Venc. 25.02.2027.pdf" (o padrão das certidões nas pastas; o arquivador lê o órgão e o vencimento) */
export function nomeDoPdfDaCertidao(c: Pick<CertidaoLida, 'vence' | 'emitidaEm' | 'negativa'> & { orgao?: OrgaoDaCertidao }): string {
  const [a, m, d] = String(c.vence || c.emitidaEm).split('-');
  const tipo = c.orgao === 'fgts' ? 'CRF - FGTS' : c.orgao === 'estadual' ? 'CND - ESTADUAL' : c.orgao === 'trabalhista' ? 'CNDT - TRABALHISTA' : 'CND - MUNICIPAL';
  return tipo + ' - Venc. ' + d + '.' + m + '.' + a + (c.negativa ? '' : ' (POSITIVA)') + '.pdf';
}

export type OrgaoDaCertidao = 'municipal' | 'fgts' | 'estadual' | 'trabalhista';

/**
 * O Certificado de Regularidade do FGTS (CRF) pelo texto da página de impressão da Caixa (consulta-crf.caixa.gov.br,
 * conferida em 27/11/2026): "Certificado de Regularidade do FGTS - CRF Inscrição: 03.238.183/0001-76 Razão social: <NOME>
 * … certifica que, nesta data, a empresa acima identificada encontra-se em situação regular … Validade: 09/11/2026 a
 * 08/12/2026 Certificado Número: 2026110918270860683753 Informação obtida em 27/11/2026 15:48:55". null = não é o CRF.
 * O CRF só sai para a empresa regular (negativa = true sempre; a irregular nem chega aqui).
 */
export function certidaoFgtsDoTexto(texto: string): (Omit<CertidaoLida, 'orgao'> & { orgao: 'fgts' }) | null {
  const u = normal(texto);
  if (!/CERTIFICADO DE REGULARIDADE DO FGTS/.test(u)) return null;
  const val = /VALIDADE:?\s*(\d{2})\/(\d{2})\/(20\d{2})\s*A\s*(\d{2})\/(\d{2})\/(20\d{2})/.exec(u);
  if (!val) return null;
  const doc = /INSCRI..O:?\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11,14})/.exec(u);
  const nome = /RAZ.O SOCIAL:?\s*(.+?)\s+(?:ENDERE.O|A CAIXA)/.exec(u);
  const numero = /CERTIFICADO N.MERO:?\s*(\d{10,30})/.exec(u);
  return {
    orgao: 'fgts',
    numero: numero ? numero[1] : null,
    cnpj: doc ? doc[1].replace(/\D/g, '') : null,
    nome: nome ? nome[1].slice(0, 200) : null,
    emitidaEm: iso(Number(val[1]), Number(val[2]), Number(val[3])),
    validadeDias: null,
    vence: iso(Number(val[4]), Number(val[5]), Number(val[6])),
    chave: null,
    negativa: /SITUA..O REGULAR/.test(u),
  };
}

/**
 * A Certidão de Débitos Tributários (CDT) de Minas Gerais pelo texto (cdt.fazenda.mg.gov.br, pelo Login Único com o
 * certificado do escritório; 27/11/2026). O formato ainda não foi visto por dentro (o portal só abre com o certificado):
 * a leitura procura os rótulos de costume das certidões (a emissão, a validade "válida até" ou "validade", o número e o
 * CNPJ) e deve ser conferida com a primeira certidão real. null = não é a CDT (sem a validade).
 */
export function certidaoEstadualDoTexto(texto: string): (Omit<CertidaoLida, 'orgao'> & { orgao: 'estadual' }) | null {
  const u = normal(texto);
  if (!/CERTID.O/.test(u) || !/(MINAS GERAIS|FAZENDA|ESTADO)/.test(u)) return null;
  const data = (re: RegExp) => { const m = re.exec(u); return m ? iso(Number(m[1]), Number(m[2]), Number(m[3])) : null; };
  const vence = data(/V.LIDA AT.:?\s*(\d{2})\/(\d{2})\/(20\d{2})/) || data(/VALIDADE:?\s*(?:AT.\s*)?(\d{2})\/(\d{2})\/(20\d{2})/)
    || data(/VALIDADE:?\s*\d{2}\/\d{2}\/20\d{2}\s*A\s*(\d{2})\/(\d{2})\/(20\d{2})/);
  if (!vence) return null;
  const emitidaEm = data(/(?:EMITIDA EM|DATA DE EMISS.O|EMISS.O:?|EXPEDIDA EM)\s*:?\s*(\d{2})\/(\d{2})\/(20\d{2})/) || vence;
  const doc = /CNPJ(?:\/CPF)?:?\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})/.exec(u);
  const numero = /(?:N.MERO|CERTID.O N.?)\s*:?\s*([0-9./-]{5,30})/.exec(u);
  return {
    orgao: 'estadual',
    numero: numero ? numero[1] : null,
    cnpj: doc ? doc[1].replace(/\D/g, '') : null,
    nome: null,
    emitidaEm,
    validadeDias: null,
    vence,
    chave: null,
    negativa: !/POSITIVA/.test(u) || /POSITIVA COM EFEITO(S)? DE NEGATIVA/.test(u),
  };
}

/**
 * A Certidão Negativa de Débitos Trabalhistas (CNDT, cndt-certidao.tst.jus.br; 27/11/2026, semiautomática: alguém da equipe
 * digita o captcha no nads). O texto de costume: "CERTIDÃO NEGATIVA DE DÉBITOS TRABALHISTAS Nome: <NOME> (MATRIZ E FILIAIS)
 * CNPJ: 99.888.777/0001-66 Certidão nº: 12345678/2026 Expedição: 27/11/2026, às 15:00:00 Validade: 26/05/2027 - 180 (cento
 * e oitenta) dias". A positiva com efeito de negativa conta como negativa. null = não é a CNDT (sem a validade).
 */
export function certidaoTrabalhistaDoTexto(texto: string): (Omit<CertidaoLida, 'orgao'> & { orgao: 'trabalhista' }) | null {
  const u = normal(texto);
  if (!/DEBITOS TRABALHISTAS/.test(u)) return null;
  const data = (re: RegExp) => { const m = re.exec(u); return m ? iso(Number(m[1]), Number(m[2]), Number(m[3])) : null; };
  const vence = data(/VALIDADE:?\s*(\d{2})\/(\d{2})\/(20\d{2})/);
  if (!vence) return null;
  const doc = /CNPJ:?\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})/.exec(u);
  const numero = /CERTID.O N.?\s*:?\s*(\d+\/20\d{2})/.exec(u);
  const nome = /NOME:?\s*(.+?)\s+(?:\(MATRIZ|CNPJ)/.exec(u);
  return {
    orgao: 'trabalhista',
    numero: numero ? numero[1] : null,
    cnpj: doc ? doc[1].replace(/\D/g, '') : null,
    nome: nome ? nome[1].slice(0, 200) : null,
    emitidaEm: data(/EXPEDI..O:?\s*(\d{2})\/(\d{2})\/(20\d{2})/) || vence,
    validadeDias: null,
    vence,
    chave: null,
    negativa: /CERTID.O NEGATIVA DE DEBITOS TRABALHISTAS/.test(u) || /POSITIVA COM EFEITO(S)? DE NEGATIVA/.test(u),
  };
}

/** quantos dias antes de vencer o robô pede a nova, por órgão (o CRF novo só sai quando o anterior vence) */
export const ANTECEDENCIA_POR_ORGAO: Record<OrgaoDaCertidao, number> = { municipal: 10, fgts: 1, estadual: 10, trabalhista: 10 };

/** o que o robô guarda por empresa: certidoes/{código} { municipal: { … } } */
export interface CertidaoDaEmpresa {
  numero: string | null;
  emitidaEm: string;
  vence: string | null;
  chave: string | null;
  negativa: boolean;
  /** quando o robô emitiu (ISO) */
  consultadoEm: string;
}
export interface CertidoesDaEmpresa {
  codigo: number;
  municipal?: CertidaoDaEmpresa;
  /** a prefeitura não tem a empresa no cadastro (não tentar de novo até alguém pedir pela Central) */
  municipalSemCadastro?: string;
  /** o CRF do FGTS (27/11/2026) */
  fgts?: CertidaoDaEmpresa;
  /** a Caixa não tem a empresa como empregadora (não tentar de novo até alguém pedir pela Central) */
  fgtsSemCadastro?: string;
  /** a CDT de Minas (27/11/2026) */
  estadual?: CertidaoDaEmpresa;
  estadualSemCadastro?: string;
  /** a CNDT do TST (27/11/2026) */
  trabalhista?: CertidaoDaEmpresa;
  trabalhistaSemCadastro?: string;
}

/** quantos dias antes de vencer o robô tira a nova */
export const ANTECEDENCIA_DIAS = 10;

/**
 * As empresas do lote do dia: as ativas com CNPJ, sem a certidão municipal ou com ela vencendo em até ANTECEDENCIA_DIAS
 * dias; de fora, as que a prefeitura não conhece e as que já estão na fila. Primeiro as que nunca tiveram, depois as que
 * vencem antes.
 */
export function certidoesParaPedir(p: {
  empresas: readonly { codigo: number; nome: string; cnpj: string }[];
  resumos: ReadonlyMap<number, CertidoesDaEmpresa>;
  naFila: ReadonlySet<number>;
  hoje: string;
  limite: number;
  /** o órgão (sem ele, a municipal) */
  orgao?: OrgaoDaCertidao;
}): { status: 'pendente'; orgao: OrgaoDaCertidao; cnpj: string; codigo: number; empresa: string }[] {
  const orgao: OrgaoDaCertidao = p.orgao || 'municipal';
  const limiar = somarDias(p.hoje, orgao === 'municipal' ? ANTECEDENCIA_DIAS : ANTECEDENCIA_POR_ORGAO[orgao]);
  const atual = (r: CertidoesDaEmpresa | undefined) => r?.[orgao];
  const semCadastro = (r: CertidoesDaEmpresa | undefined) => (orgao === 'fgts' ? r?.fgtsSemCadastro : orgao === 'estadual' ? r?.estadualSemCadastro : orgao === 'trabalhista' ? r?.trabalhistaSemCadastro : r?.municipalSemCadastro);
  return p.empresas
    .filter(e => /^\d{14}$/.test(String(e.cnpj)) && e.codigo > 0 && !p.naFila.has(e.codigo))
    .map(e => ({ e, r: p.resumos.get(e.codigo) }))
    .filter(({ r }) => !semCadastro(r) && (!atual(r)?.vence || String(atual(r)?.vence) <= limiar))
    .sort((a, b) => String(atual(a.r)?.vence || '').localeCompare(String(atual(b.r)?.vence || '')) || a.e.codigo - b.e.codigo)
    .slice(0, p.limite)
    .map(({ e }) => ({ status: 'pendente' as const, orgao, cnpj: String(e.cnpj), codigo: e.codigo, empresa: String(e.nome || '').slice(0, 200) }));
}
