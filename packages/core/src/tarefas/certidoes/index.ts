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
export function nomeDoPdfDaCertidao(c: Pick<CertidaoLida, 'vence' | 'emitidaEm' | 'negativa'>): string {
  const [a, m, d] = String(c.vence || c.emitidaEm).split('-');
  return 'CND - MUNICIPAL - Venc. ' + d + '.' + m + '.' + a + (c.negativa ? '' : ' (POSITIVA)') + '.pdf';
}

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
}): { status: 'pendente'; orgao: 'municipal'; cnpj: string; codigo: number; empresa: string }[] {
  const limiar = somarDias(p.hoje, ANTECEDENCIA_DIAS);
  return p.empresas
    .filter(e => /^\d{14}$/.test(String(e.cnpj)) && e.codigo > 0 && !p.naFila.has(e.codigo))
    .map(e => ({ e, r: p.resumos.get(e.codigo) }))
    .filter(({ r }) => !r?.municipalSemCadastro && (!r?.municipal?.vence || r.municipal.vence <= limiar))
    .sort((a, b) => String(a.r?.municipal?.vence || '').localeCompare(String(b.r?.municipal?.vence || '')) || a.e.codigo - b.e.codigo)
    .slice(0, p.limite)
    .map(({ e }) => ({ status: 'pendente' as const, orgao: 'municipal' as const, cnpj: String(e.cnpj), codigo: e.codigo, empresa: String(e.nome || '').slice(0, 200) }));
}
