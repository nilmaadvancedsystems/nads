// As guias do SCI Report 24h na Área do Cliente (24/11/2026; o dono: "teria como usar a area do cliente do nads e apenas
// consumir a api do sci report?" e, entre o robô de hora em hora e a busca na hora, "gostei mais do b por ser mantido
// frequentemente"). Funções puras, sem rede: quem fala com a SCI recebe o "buscar" de fora (sciReportCliente.ts).
//
// A API (portal-dev.sci.com.br, OpenAPI de 12/11/2026):
//   - login: POST {SCI_AUTH}/api/v1/auth/credencial/login, Basic (Token de Parceiro : Token de Cliente) → JWT de 1 hora;
//     POST /api/v1/auth/refresh com o JWT → outro JWT. O Token de Cliente é o da CONTABILIDADE (Módulo Administrador).
//   - GET {SCI_RELATORIO}/api/v1/publicados/busca: as publicações (impostos) da empresa, paginadas (10 a 200 por página);
//   - GET /api/v1/empresa/busca?numeroDocumento=: o código da empresa no SCI pelo CNPJ;
//   - PUT /api/v1/publicados/visualiza?publicadoId=: a URL TEMPORÁRIA do PDF. Com o token da contabilidade não marca como
//     visto no SCI. O "visualiza/{hash}" (sem login, hash = base64 de usuarioId:publicadosId) NÃO é usado.
// "Pagamento informado" é o que o cliente (ou o escritório) registrou no SCI Report, não a confirmação do banco.
import { situacaoDaGuia, ROTULO_DA_SITUACAO_DA_GUIA, type GuiaDoCliente, type SituacaoDaGuia, type TipoDeGuia } from './guias';

export const SCI_AUTH = 'https://api-auth.sci.com.br';
export const SCI_RELATORIO = 'https://api-relatorio.sci.com.br';
/** o maior lote que a busca aceita por página */
export const SCI_POR_PAGINA = 200;
/** renova o JWT quando faltar menos que isto (ele vale 1 hora) */
export const SCI_MARGEM_DO_JWT_MS = 5 * 60 * 1000;
/** quantas competências a Área mostra (a do mês e as anteriores) */
export const SCI_MESES_NA_AREA = 3;

type Solto = Record<string, unknown>;
const objeto = (v: unknown): Solto | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Solto) : null);
const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const numero = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : NaN;
};
const inteiro = (v: unknown) => { const n = numero(v); return Number.isInteger(n) ? n : NaN; };
const sim = (v: unknown) => v === true || v === 1 || v === '1' || v === 'true';
const digitos = (v: unknown) => texto(v).replace(/\D/g, '');

/** 'aaaa-mm-dd' ou 'aaaa-mm-dd hh:mm:ss' (como a SCI manda) → 'dd/mm/aaaa'; '' se não for data. */
export function dataDoSci(v: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/.exec(texto(v));
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return '';
  return m[3] + '/' + m[2] + '/' + m[1];
}

// ---------------------------------- autenticação ----------------------------------

/** O JWT em uso e quando ele vence (ms desde 1970). */
export interface SessaoDoSci { token: string; expiraEm: number }

/** A resposta do login ou do refresh ({ token, validade em segundos }) → a sessão; null se não veio token. */
export function lerLoginDoSci(resposta: unknown, agora: number): SessaoDoSci | null {
  const r = objeto(resposta);
  const token = texto(r?.token);
  if (!token) return null;
  const validade = numero(r?.validade);
  return { token, expiraEm: agora + (validade > 0 ? validade : 3600) * 1000 };
}

/** O JWT ainda serve sem renovar (falta mais que a margem). */
export function sessaoDoSciVale(s: SessaoDoSci | null, agora: number): s is SessaoDoSci {
  return !!s && s.expiraEm - agora > SCI_MARGEM_DO_JWT_MS;
}

/** O JWT ainda é aceito (dá para pedir o refresh em vez de mandar os tokens de novo). */
export function sessaoDoSciAindaAceita(s: SessaoDoSci | null, agora: number): s is SessaoDoSci {
  return !!s && s.expiraEm > agora;
}

// ---------------------------------- empresas ----------------------------------

export interface EmpresaDoSci { empresaId: number; nome: string; cnpj: string }

/** A resposta de /empresa/busca → as empresas (só as com código e documento). */
export function lerEmpresasDoSci(resposta: unknown): EmpresaDoSci[] {
  const lista = objeto(resposta)?.empresas;
  if (!Array.isArray(lista)) return [];
  const saida: EmpresaDoSci[] = [];
  for (const x of lista) {
    const e = objeto(x);
    const empresaId = inteiro(e?.empresaId);
    const cnpj = digitos(e?.numeroDocumento);
    if (Number.isInteger(empresaId) && empresaId > 0 && cnpj) saida.push({ empresaId, nome: texto(e?.nome), cnpj });
  }
  return saida;
}

/**
 * O código no SCI da empresa deste CNPJ (ou CPF). A busca da SCI é por "parte do documento": aqui só vale o documento
 * inteiro e igual. Mais de uma empresa com o mesmo documento é dúvida: null (melhor não mostrar a guia de outra).
 */
export function empresaDoSciPeloDocumento(empresas: EmpresaDoSci[], documento: string): number | null {
  const d = digitos(documento);
  if (d.length !== 14 && d.length !== 11) return null;
  const iguais = [...new Set(empresas.filter(e => e.cnpj === d).map(e => e.empresaId))];
  return iguais.length === 1 ? iguais[0] : null;
}

// ---------------------------------- publicações (as guias) ----------------------------------

/** Uma publicação do SCI Report como a busca devolve: só os campos que o nads usa. */
export interface PublicacaoDoSci {
  publicadosId: number;
  empresaId: number;
  /** 'aaaa-mm' (mês 13, o ajuste do fim do ano, vira dezembro) */
  competencia: string;
  tipo: string;
  relatorioId: string;
  nomeRelatorio: string;
  descricao: string;
  /** 'dd/mm/aaaa' ou '' */
  vencimento: string;
  valor: number;
  /** destinada a um funcionário (holerite e afins): não é guia da empresa */
  individual: boolean;
  visualizado: boolean;
  /** 'dd/mm/aaaa' da primeira vez que alguém da empresa abriu, ou '' */
  vistoEm: string;
  /** 'dd/mm/aaaa' ou '' */
  pagamentoEm: string;
  valorPago: number;
}

export interface PaginaDoSci<T> { itens: T[]; paginaAtual: number; ultimaPagina: number }

function competenciaDoSci(mes: unknown, ano: unknown): string {
  const m = inteiro(mes);
  const a = inteiro(ano);
  if (!(a >= 2000 && a <= 2100) || !(m >= 1 && m <= 13)) return '';
  return a + '-' + String(Math.min(m, 12)).padStart(2, '0');
}

/** Uma linha de publicados.dados → a publicação; null se faltar o essencial (código, empresa, competência). */
export function lerPublicacaoDoSci(x: unknown): PublicacaoDoSci | null {
  const p = objeto(x);
  if (!p) return null;
  const publicadosId = inteiro(p.publicadosId);
  const empresaId = inteiro(p.empresaId);
  const competencia = competenciaDoSci(p.mesRef, p.anoRef);
  if (!(publicadosId > 0) || !(empresaId > 0) || !competencia) return null;
  const valor = numero(p.valor);
  const valorPago = numero(p.valorPagamento);
  return {
    publicadosId, empresaId, competencia,
    tipo: texto(p.tipo), relatorioId: texto(p.relatorioId), nomeRelatorio: texto(p.nomeRelatorio), descricao: texto(p.descricao),
    vencimento: dataDoSci(p.dataVencimento),
    valor: Number.isFinite(valor) ? valor : 0,
    individual: sim(p.individual),
    visualizado: sim(p.visualizado),
    vistoEm: dataDoSci(p.dataHoraPrimeiraVisualizacao),
    pagamentoEm: dataDoSci(p.dataPagamento),
    valorPago: Number.isFinite(valorPago) ? valorPago : 0,
  };
}

/** A resposta de /publicados/busca → a página (o que vier torto é descartado, não quebra). */
export function lerPaginaDePublicados(resposta: unknown): PaginaDoSci<PublicacaoDoSci> {
  const pub = objeto(objeto(resposta)?.publicados);
  const dados = Array.isArray(pub?.dados) ? pub.dados : [];
  const itens = dados.map(lerPublicacaoDoSci).filter((p): p is PublicacaoDoSci => !!p);
  const paginaAtual = inteiro(pub?.paginaAtual);
  const ultimaPagina = inteiro(pub?.ultimaPagina);
  return { itens, paginaAtual: paginaAtual > 0 ? paginaAtual : 1, ultimaPagina: ultimaPagina > 0 ? ultimaPagina : 1 };
}

/** 'aaaa-mm' → 'mm/aaaa' (o formato da referência na busca). */
const referenciaDoSci = (competencia: string) => competencia.slice(5, 7) + '/' + competencia.slice(0, 4);

/** As competências que a Área mostra: da de `meses - 1` meses atrás até a do mês de hoje ('aaaa-mm'). */
export function janelaDoSci(hoje: Date, meses = SCI_MESES_NA_AREA): { de: string; ate: string } {
  const comp = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  return { de: comp(new Date(hoje.getFullYear(), hoje.getMonth() - Math.max(1, meses) + 1, 1)), ate: comp(hoje) };
}

/**
 * A consulta de /publicados/busca: os IMPOSTOS de uma empresa entre duas competências, sem os individuais (de
 * funcionário). Com `publicadosId`, só aquela publicação (a conferência antes de abrir o PDF).
 */
export function consultaDePublicados(p: { empresaId: number; de: string; ate: string; pagina?: number; publicadosId?: number }): string {
  const q = new URLSearchParams({
    tipoDocumento: 'imposto', status: 'todos', empresaId: String(p.empresaId),
    referenciaInicial: referenciaDoSci(p.de), referenciaFinal: referenciaDoSci(p.ate),
    individual: 'false', page: String(p.pagina ?? 1), registrosPorPagina: String(SCI_POR_PAGINA),
  });
  if (p.publicadosId) q.set('publicadosId', String(p.publicadosId));
  return q.toString();
}

// ---------------------------------- o que o cliente vê ----------------------------------

export type SituacaoDaGuiaDoSci = SituacaoDaGuia | 'pagamento informado';
export const ROTULO_DA_SITUACAO_DO_SCI: Record<SituacaoDaGuiaDoSci, string> = { ...ROTULO_DA_SITUACAO_DA_GUIA, 'pagamento informado': 'Pagamento informado' };

/** Uma guia do SCI Report na Área do Cliente. LISTA BRANCA: só estes campos saem da função para o navegador. */
export interface GuiaDoSciReport {
  /** o publicadosId (é por ele que o PDF é pedido) */
  id: string;
  /** o nome do relatório no SCI Report (DAS, DARF…), ou a descrição */
  nome: string;
  /** 'aaaa-mm' */
  competencia: string;
  /** 'dd/mm/aaaa' */
  vencimento: string;
  valor: number;
  situacao: SituacaoDaGuiaDoSci;
  /** 'dd/mm/aaaa', quando o pagamento foi informado no SCI Report */
  pagamentoEm?: string;
  valorPago?: number;
}

/** A publicação → a guia que o cliente vê; null para a de funcionário ou a sem vencimento (não é guia de imposto). */
export function guiaDoSciReport(p: PublicacaoDoSci, hoje: Date): GuiaDoSciReport | null {
  if (p.individual || !p.vencimento) return null;
  const nome = p.nomeRelatorio || p.descricao || 'Guia';
  const base = { id: String(p.publicadosId), nome, competencia: p.competencia, vencimento: p.vencimento, valor: p.valor };
  if (p.pagamentoEm) return { ...base, situacao: 'pagamento informado', pagamentoEm: p.pagamentoEm, ...(p.valorPago > 0 ? { valorPago: p.valorPago } : {}) };
  return { ...base, situacao: situacaoDaGuia(p.vencimento, hoje) };
}

/** As publicações → as guias do cliente, sem repetir, as em aberto primeiro e, dentro delas, as que vencem antes. */
export function guiasDoSciReport(publicacoes: PublicacaoDoSci[], hoje: Date): GuiaDoSciReport[] {
  const porId = new Map<string, GuiaDoSciReport>();
  for (const p of publicacoes) { const g = guiaDoSciReport(p, hoje); if (g) porId.set(g.id, g); }
  const dia = (v: string) => v.slice(6) + v.slice(3, 5) + v.slice(0, 2);
  const paga = (g: GuiaDoSciReport) => (g.situacao === 'pagamento informado' ? 1 : 0);
  return [...porId.values()].sort((a, b) => paga(a) - paga(b) || dia(a.vencimento).localeCompare(dia(b.vencimento)) || a.nome.localeCompare(b.nome));
}

/** A resposta de /publicados/visualiza → a URL temporária do PDF ('' se não veio uma https). */
export function urlDoPdfDoSci(resposta: unknown): string {
  const url = texto(objeto(resposta)?.urlPdf);
  return /^https:\/\/[^\s]+$/.test(url) ? url : '';
}

// ---------------------------------- quem pode ver ----------------------------------

/** O documento do link (areasCliente/{token}), como a função o lê pelo Admin SDK. */
export interface LinkDaArea { existe: boolean; exigeSenha?: boolean; codigos?: number[] }
/** As permissões do login do cliente (as mesmas que a regra do banco confere: { cliente: true, a: [tokens] }). */
export interface LoginDaArea { cliente?: boolean; a?: string[] }
export type AcessoDaArea = 'liberado' | 'link invalido' | 'precisa entrar';

/**
 * A mesma porta das regras do banco para o espelho: o link tem de existir (40 letras hexadecimais) e, com "Exigir senha",
 * o login tem de ser de cliente e ter este link. A função confere isto ANTES de perguntar qualquer coisa à SCI.
 */
export function acessoDaArea(token: string, link: LinkDaArea | null, login: LoginDaArea | null): AcessoDaArea {
  if (!/^[0-9a-f]{40}$/.test(token) || !link?.existe) return 'link invalido';
  if (link.exigeSenha !== true) return 'liberado';
  return login?.cliente === true && Array.isArray(login.a) && login.a.includes(token) ? 'liberado' : 'precisa entrar';
}

// ---------------------------------- como guia normal da Área ----------------------------------
// (26/11/2026; o dono: "tem que aparecer como um documento normal do nads, nao separado, tem que parecer que sci report nem
// existe para o usuario") a guia do SCI Report entra na lista de guias da Área como qualquer outra: o tipo pelo nome
// (DARF PIS, DAS, FGTS…), o "Ver" abre o PDF na mesma janela e a paga vai para Pagas. A que o nads já mandou (o mesmo
// vencimento e o mesmo valor) não aparece duas vezes.

/** o prefixo do id da guia do SCI Report na lista da Área ("sci-123456"): é por ele que o PDF vem da função */
export const PREFIXO_DA_GUIA_DO_SCI = 'sci-';
/** o publicadosId da guia da lista, ou '' se ela não veio do SCI Report */
export function publicadosIdDaGuia(id: string): string {
  return id.startsWith(PREFIXO_DA_GUIA_DO_SCI) && /^\d{1,12}$/.test(id.slice(PREFIXO_DA_GUIA_DO_SCI.length)) ? id.slice(PREFIXO_DA_GUIA_DO_SCI.length) : '';
}

/** O tipo da guia pelo nome do modelo no SCI Report ("DARF PIS" → DARF/PIS; "DAS - Simples Nacional" → DAS). */
export function tipoDaGuiaDoSci(nome: string): { tipo: TipoDeGuia; tributo?: string } {
  const n = String(nome ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  const darf = /^DARF\b[\s\-–:]*(.*)$/.exec(n);
  if (darf) return darf[1].trim() ? { tipo: 'DARF', tributo: darf[1].trim().replace(/\s+/g, ' ').slice(0, 30) } : { tipo: 'DARF' };
  if (/\bDCTF ?WEB\b/.test(n)) return { tipo: 'DARF', tributo: 'DCTFWeb' };
  if (/^DAS\b|SIMPLES NACIONAL/.test(n)) return { tipo: 'DAS' };
  if (/\bFGTS\b/.test(n)) return { tipo: 'FGTS' };
  if (/^DAE\b|\bICMS\b/.test(n)) return { tipo: 'DAE' };
  if (/^DAM\b|\bISS\b/.test(n)) return { tipo: 'DAM' };
  return { tipo: 'outra' };
}

/** Uma guia paga que veio do SCI Report (o cliente informou o pagamento lá), no formato da aba Pagas. */
export interface PagaDoSci { id: string; tipo: TipoDeGuia; nome: string; competencia: string; valor: number; pagoEm: string }

/**
 * As guias do SCI Report como guias normais da Área: as em aberto vão para a lista (id "sci-…", com PDF) e as com
 * pagamento informado para as pagas. A que já está na lista do nads (o mesmo vencimento e o mesmo valor) fica de fora.
 */
export function guiasDoSciNaArea(sci: readonly GuiaDoSciReport[], existentes: readonly Pick<GuiaDoCliente, 'vencimento' | 'valor'>[]): { aPagar: GuiaDoCliente[]; pagas: PagaDoSci[] } {
  const ja = new Set(existentes.map(g => g.vencimento + '|' + Math.round(g.valor * 100)));
  const aPagar: GuiaDoCliente[] = [];
  const pagas: PagaDoSci[] = [];
  for (const g of sci) {
    if (ja.has(g.vencimento + '|' + Math.round(g.valor * 100))) continue;
    const { tipo, tributo } = tipoDaGuiaDoSci(g.nome);
    const id = PREFIXO_DA_GUIA_DO_SCI + g.id;
    if (g.situacao === 'pagamento informado') {
      const nome = tipo === 'outra' ? g.nome : tipo === 'DARF' && tributo ? 'DARF ' + tributo : ROTULO_CURTO[tipo];
      pagas.push({ id, tipo, nome, competencia: g.competencia, valor: g.valorPago ?? g.valor, pagoEm: g.pagamentoEm ?? g.vencimento });
      continue;
    }
    aPagar.push({ id, tipo, ...(tributo ? { tributo } : {}), competencia: g.competencia, vencimento: g.vencimento, valor: g.valor, situacao: g.situacao, temPdf: true, ...(tipo === 'outra' ? { nome: g.nome } : {}) });
  }
  return { aPagar, pagas };
}
const ROTULO_CURTO: Record<TipoDeGuia, string> = { FGTS: 'FGTS', DAS: 'DAS', DAE: 'DAE', DARF: 'DARF', DAM: 'DAM', HON: 'Honorários', outra: 'Guia' };
