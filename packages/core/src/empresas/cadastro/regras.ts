// Regras do cadastro da empresa: ler e montar o documento do banco, as contas bancárias (incluir, editar,
// encerrar), as contas padrão e o que os aplicativos leem daqui (o Extrator, os bancos da competência).
// Nada é apagado de onde já estava: enquanto a empresa não tem os bancos cadastrados, vale o que o Extrator
// usava (a lista provisória de empresas/bancos.ts e os bancos adicionados na tela dele).
import { nomeNorm } from '../../formatos';
import { cnpjFormatado, documentoValido } from './receita';
import { BANCOS_CONHECIDOS, bancosDaEmpresa, idDaConta, rotuloDaConta, type BancoDaEmpresa } from '../bancos';
import {
  type BancoDoRelatorio, BANCOS_DO_RELATORIO, type CadastroDaEmpresa, type EmprestimoDaEmpresa, type CampoContaPadrao, type ContaBancaria, type ContaDoPlano, type ContaPadraoDoPlano, type ContasPadrao, type PlanoDeContas, type RegistroCadastro, type Socio, type TipoContaBancaria, type DepartamentoDoResponsavel, type ParametrosDoDp, type ParametrosDoDpDoMes, DEPARTAMENTOS_DO_RESPONSAVEL, type TransferenciaDeResponsavel, type ArquivoDoFiscal, type DocumentosDoFiscal, type PlanilhaDoFiscal, type AntecipacaoDoFiscal,
  type ParametrosDoFiscal, type SegmentoFiscal, MAX_TEXTO_DO_FISCAL, PARAMETROS_FISCAIS, SEGMENTOS_FISCAIS,
} from './tipos';

/** Quantos registros do histórico ficam guardados (os mais novos). */
export const MAX_HISTORICO = 200;
/** Os limites da regra do banco (firestore.rules do Entregas, coleção `cadastro`). */
export const MAX_BANCOS = 60;
export const MAX_CONTAS_NO_PLANO = 5000;

export const CAMPOS_CONTA_PADRAO: readonly CampoContaPadrao[] = ['banco', 'juros', 'desconto', 'histPrincipal', 'histJuros', 'histDesconto', 'cartao'];
export const CONTAS_PADRAO_DO_PLANO: readonly ContaPadraoDoPlano[] = ['banco', 'juros', 'desconto', 'cartao'];
export const TIPOS_CONTA: readonly { id: TipoContaBancaria; rotulo: string }[] = [
  { id: 'corrente', rotulo: 'Conta corrente' },
  { id: 'aplicacao', rotulo: 'Aplicação' },
  { id: 'poupanca', rotulo: 'Poupança' },
  { id: 'outra', rotulo: 'Outra' },
];

/** O banco "Outro" (não está na lista de logos). */
export const BANCO_OUTRO: BancoDaEmpresa = { id: 'outro', nome: 'Outro banco' };

const texto = (v: unknown) => (v == null ? '' : String(v).trim());
const competencia = (v: unknown) => (/^\d{4}-\d{2}$/.test(texto(v)) ? texto(v) : undefined);
const opcional = (v: unknown) => texto(v) || undefined;

export function cadastroVazio(nome: string, codigo: number | null): CadastroDaEmpresa {
  return { nome, codigo, bancos: null, contasPadrao: null, historico: [] };
}

// ─── o documento do banco ───────────────────────────────────────────────────

function contaDoDocumento(v: unknown): ContaBancaria | null {
  const o = (v || {}) as Record<string, unknown>;
  const id = texto(o.id);
  const marca = texto(o.marca) || id;
  if (!id) return null;
  const tipo = TIPOS_CONTA.some(t => t.id === o.tipo) ? (o.tipo as TipoContaBancaria) : undefined;
  const c: ContaBancaria = { id, marca, nome: texto(o.nome) || nomeDoBanco(marca) };
  const extras: Partial<ContaBancaria> = {
    agencia: opcional(o.agencia), conta: opcional(o.conta), tipo, apelido: opcional(o.apelido),
    contaContabil: opcional(o.contaContabil), contaChequeEspecial: opcional(o.contaChequeEspecial), desde: competencia(o.desde), ate: competencia(o.ate),
  };
  for (const [k, val] of Object.entries(extras)) if (val !== undefined) (c as unknown as Record<string, unknown>)[k] = val;
  return c;
}

function contasPadraoDoDocumento(v: unknown): ContasPadrao | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const c = (o.contas || {}) as Record<string, unknown>;
  const n = (o.nomes || {}) as Record<string, unknown>;
  const contas: ContasPadrao['contas'] = {};
  const nomes: ContasPadrao['nomes'] = {};
  for (const k of CAMPOS_CONTA_PADRAO) if (texto(c[k])) contas[k] = texto(c[k]);
  for (const k of CONTAS_PADRAO_DO_PLANO) if (texto(n[k])) nomes[k] = texto(n[k]);
  return { contas, nomes };
}

function responsaveisDoDocumento(v: unknown): { responsaveis?: Partial<Record<DepartamentoDoResponsavel, string>> } {
  if (!v || typeof v !== 'object') return {};
  const o = v as Record<string, unknown>;
  const r: Partial<Record<DepartamentoDoResponsavel, string>> = {};
  for (const d of DEPARTAMENTOS_DO_RESPONSAVEL) if (texto(o[d.id])) r[d.id] = texto(o[d.id]);
  return Object.keys(r).length ? { responsaveis: r } : {};
}

function transferenciasDoDocumento(v: unknown): { transferencias?: Partial<Record<DepartamentoDoResponsavel, TransferenciaDeResponsavel>> } {
  if (!v || typeof v !== 'object') return {};
  const o = v as Record<string, unknown>;
  const r: Partial<Record<DepartamentoDoResponsavel, TransferenciaDeResponsavel>> = {};
  for (const d of DEPARTAMENTOS_DO_RESPONSAVEL) {
    const t = (o[d.id] || null) as Record<string, unknown> | null;
    if (!t || !texto(t.de) || !texto(t.para)) continue;
    r[d.id] = {
      de: texto(t.de), para: texto(t.para), pedidoPor: texto(t.pedidoPor), em: texto(t.em),
      ...(texto(t.aceiteDe) ? { aceiteDe: texto(t.aceiteDe) } : {}), ...(texto(t.aceitePara) ? { aceitePara: texto(t.aceitePara) } : {}),
      ...(texto(t.troca) ? { troca: texto(t.troca) } : {}),
    };
  }
  return Object.keys(r).length ? { transferencias: r } : {};
}

function dpDoDocumento(v: unknown): { dp?: ParametrosDoDp } {
  if (!v || typeof v !== 'object') return {};
  const o = v as Record<string, unknown>;
  const p: ParametrosDoDp = camposDoDp(o);
  if (o.porCompetencia && typeof o.porCompetencia === 'object') {
    const pc: Record<string, ParametrosDoDpDoMes> = {};
    for (const [k, x] of Object.entries(o.porCompetencia as Record<string, unknown>)) {
      if (!/^\d{4}-\d{2}$/.test(k) || !x || typeof x !== 'object') continue;
      const m = camposDoDp(x as Record<string, unknown>);
      if (Object.keys(m).length) pc[k] = m;
    }
    if (Object.keys(pc).length) p.porCompetencia = pc;
  }
  return Object.keys(p).length ? { dp: p } : {};
}

/** Os parâmetros do Fiscal do documento: só os conhecidos e do tipo certo (o resto fica de fora). */
function fiscalDoDocumento(v: unknown): { fiscal?: ParametrosDoFiscal } {
  if (!v || typeof v !== 'object') return {};
  const o = v as Record<string, unknown>;
  const p: ParametrosDoFiscal = {};
  for (const { id } of PARAMETROS_FISCAIS) if (typeof o[id] === 'boolean') p[id] = o[id] as boolean;
  if (Array.isArray(o.segmentos)) p.segmentos = SEGMENTOS_FISCAIS.map(s => s.id).filter(s => (o.segmentos as unknown[]).includes(s));
  for (const k of ['especificidades', 'observacoes'] as const) if (typeof o[k] === 'string') p[k] = (o[k] as string).slice(0, MAX_TEXTO_DO_FISCAL);
  return Object.keys(p).length ? { fiscal: p } : {};
}

function camposDoDp(o: Record<string, unknown>): ParametrosDoDpDoMes {
  const p: ParametrosDoDpDoMes = {};
  if (texto(o.movimento)) p.movimento = texto(o.movimento);
  if (Array.isArray(o.obrigacoes)) p.obrigacoes = o.obrigacoes.map(texto).filter(Boolean);
  if (typeof o.reinfAutorizada === 'boolean') p.reinfAutorizada = o.reinfAutorizada;
  if (typeof o.entrega === 'string') p.entrega = texto(o.entrega);
  if (typeof o.agrupamento === 'string') p.agrupamento = texto(o.agrupamento);
  return p;
}

/** O pagamento do pró-labore guardado (a conta do crédito, só dígitos; o dia útil, 1 a 5). */
function proLaboreDoDocumento(v: unknown): Pick<CadastroDaEmpresa, 'proLabore'> {
  if (!v || typeof v !== 'object') return {};
  const o = v as Record<string, unknown>;
  const conta = texto(o.contaCredito).replace(/\D/g, '');
  const dia = typeof o.diaUtil === 'number' && o.diaUtil >= 1 && o.diaUtil <= 5 ? Math.round(o.diaUtil) : 0;
  const p = { ...(conta ? { contaCredito: conta } : {}), ...(dia ? { diaUtil: dia } : {}) };
  return Object.keys(p).length ? { proLabore: p } : {};
}

// ─── os documentos do Fiscal (Heverton, 20/10/2026: "Cadastro = Fiscal (inserir)") ──────────────────────────────────

export const PLANILHAS_DO_FISCAL: readonly { id: PlanilhaDoFiscal; rotulo: string }[] = [
  { id: 'defis', rotulo: 'Planilha DEFIS' }, { id: 'fatorR', rotulo: 'Planilha Projeção Fator R' }, { id: 'rateio', rotulo: 'Planilha de Rateio' },
];
/** no máximo tantos documentos a mais por empresa (o documento do cadastro é lido inteiro pela lista) */
export const MAX_DOCUMENTOS_DO_FISCAL = 30;

function arquivoDoFiscalDoDocumento(v: unknown): ArquivoDoFiscal | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const link = texto(o.link).trim();
  return /^https:\/\//.test(link) ? { nome: texto(o.nome).trim().slice(0, 120), link: link.slice(0, 500), atualizadoEm: texto(o.atualizadoEm), por: texto(o.por) } : null;
}

function documentosFiscaisDoDocumento(v: unknown): { documentosFiscais?: DocumentosDoFiscal } {
  if (!v || typeof v !== 'object') return {};
  const o = v as Record<string, unknown>;
  const planilhas: Partial<Record<PlanilhaDoFiscal, ArquivoDoFiscal>> = {};
  const p = (o.planilhas && typeof o.planilhas === 'object' ? o.planilhas : {}) as Record<string, unknown>;
  for (const { id } of PLANILHAS_DO_FISCAL) { const a = arquivoDoFiscalDoDocumento(p[id]); if (a) planilhas[id] = a; }
  const outros = Array.isArray(o.outros) ? o.outros.map(arquivoDoFiscalDoDocumento).filter((a): a is ArquivoDoFiscal => !!a).slice(0, MAX_DOCUMENTOS_DO_FISCAL) : [];
  return Object.keys(planilhas).length || outros.length ? { documentosFiscais: { ...(Object.keys(planilhas).length ? { planilhas } : {}), ...(outros.length ? { outros } : {}) } } : {};
}

// ─── a antecipação do ICMS do ES (Heverton, 22/10/2026) ─────────────────────────────────────────────────────────────

/** no máximo tantas situações marcadas por empresa (as mais velhas saem; o documento do cadastro tem 1 MB) */
export const MAX_SITUACOES_DA_ANTECIPACAO = 3000;
const SITUACOES_VALIDAS = ['a-conferir', 'conferido', 'revisar', 'dispensado', 'nao-se-aplica'];

function antecipacaoDoDocumento(v: unknown): { antecipacaoIcmsEs?: AntecipacaoDoFiscal } {
  if (!v || typeof v !== 'object') return {};
  const o = v as Record<string, unknown>;
  const aliquota = typeof o.aliquota === 'number' && o.aliquota > 0 && o.aliquota < 100 ? o.aliquota : undefined;
  const situacoes: NonNullable<AntecipacaoDoFiscal['situacoes']> = {};
  const s = (o.situacoes && typeof o.situacoes === 'object' ? o.situacoes : {}) as Record<string, Record<string, unknown> | null>;
  for (const [id, m] of Object.entries(s)) {
    if (m && SITUACOES_VALIDAS.includes(texto(m.situacao)) && id.length <= 200) situacoes[id] = { situacao: texto(m.situacao), por: texto(m.por), em: texto(m.em) };
  }
  const a: AntecipacaoDoFiscal = { ...(aliquota != null ? { aliquota } : {}), ...(Object.keys(situacoes).length ? { situacoes } : {}) };
  return Object.keys(a).length ? { antecipacaoIcmsEs: a } : {};
}

/** A alíquota interna da antecipação (de 0,01 a 99,99%; vazio volta à padrão). Fica no histórico. */
export function definirAliquotaDaAntecipacao(c: CadastroDaEmpresa, aliquota: number | null, por: string, agora: Date): CadastroDaEmpresa | { erro: string } {
  if (aliquota != null && !(Number.isFinite(aliquota) && aliquota > 0 && aliquota < 100)) return { erro: 'A alíquota vai de 0,01 a 99,99%.' };
  const atual = c.antecipacaoIcmsEs?.aliquota ?? null;
  const nova = aliquota == null ? null : Math.round(aliquota * 100) / 100;
  if (atual === nova) return c;
  const a: AntecipacaoDoFiscal = { ...(c.antecipacaoIcmsEs || {}) };
  if (nova == null) delete a.aliquota; else a.aliquota = nova;
  return registrar({ ...c, antecipacaoIcmsEs: a }, por, agora, 'Antecipação ICMS-ES', 'Alíquota interna: ' + (nova == null ? 'a padrão' : String(nova).replace('.', ',') + '%'));
}

/**
 * A situação de uma linha da antecipação (sem o histórico: são muitas; a marca guarda quem e quando). As mais velhas
 * saem depois de MAX_SITUACOES_DA_ANTECIPACAO.
 */
export function marcarSituacaoDaAntecipacao(c: CadastroDaEmpresa, id: string, situacao: string, por: string, agora: Date): CadastroDaEmpresa {
  if (!SITUACOES_VALIDAS.includes(situacao) || !id || id.length > 200) return c;
  if (c.antecipacaoIcmsEs?.situacoes?.[id]?.situacao === situacao) return c;
  const situacoes = { ...(c.antecipacaoIcmsEs?.situacoes || {}), [id]: { situacao, por: por || '—', em: agora.toISOString() } };
  const ids = Object.keys(situacoes);
  if (ids.length > MAX_SITUACOES_DA_ANTECIPACAO) {
    ids.sort((x, y) => situacoes[x].em.localeCompare(situacoes[y].em));
    for (const velho of ids.slice(0, ids.length - MAX_SITUACOES_DA_ANTECIPACAO)) delete situacoes[velho];
  }
  return { ...c, antecipacaoIcmsEs: { ...(c.antecipacaoIcmsEs || {}), situacoes }, atualizadoEm: agora.toISOString() };
}

/** o link do Drive (ou de outro lugar seguro) que vale: https://; senão, o erro */
export function linkValido(link: string): string {
  const l = String(link || '').trim();
  if (!l) return 'Cole o link do arquivo.';
  if (!/^https:\/\/\S+$/.test(l)) return 'O link precisa começar com https:// (abra o arquivo no Drive e copie o link).';
  return '';
}

/** Põe, troca ou tira (link vazio) a planilha do Fiscal. Fica no histórico; link que não vale, o erro. */
export function definirPlanilhaDoFiscal(c: CadastroDaEmpresa, id: PlanilhaDoFiscal, link: string, por: string, agora: Date): CadastroDaEmpresa | { erro: string } {
  const rotulo = PLANILHAS_DO_FISCAL.find(x => x.id === id)?.rotulo || id;
  const l = String(link || '').trim();
  const atuais = { ...(c.documentosFiscais?.planilhas || {}) };
  if ((atuais[id]?.link || '') === l) return c;
  if (l) { const erro = linkValido(l); if (erro) return { erro }; atuais[id] = { nome: rotulo, link: l, atualizadoEm: agora.toISOString(), por: por || '—' }; } else delete atuais[id];
  const docs: DocumentosDoFiscal = { ...(c.documentosFiscais || {}), planilhas: atuais };
  return registrar({ ...c, documentosFiscais: docs }, por, agora, rotulo, l ? 'Link posto ou trocado' : 'Link tirado');
}

/** Acrescenta um documento da empresa (o nome e o link). Fica no histórico; sem nome ou link que não vale, o erro. */
export function acrescentarDocumentoDoFiscal(c: CadastroDaEmpresa, nome: string, link: string, por: string, agora: Date): CadastroDaEmpresa | { erro: string } {
  const n = String(nome || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!n) return { erro: 'Dê um nome ao documento (ex.: Contrato social).' };
  const erro = linkValido(link);
  if (erro) return { erro };
  const outros = [...(c.documentosFiscais?.outros || [])];
  if (outros.length >= MAX_DOCUMENTOS_DO_FISCAL) return { erro: 'Já são ' + MAX_DOCUMENTOS_DO_FISCAL + ' documentos: tire um antes.' };
  outros.push({ nome: n, link: String(link).trim(), atualizadoEm: agora.toISOString(), por: por || '—' });
  return registrar({ ...c, documentosFiscais: { ...(c.documentosFiscais || {}), outros } }, por, agora, 'Documento da empresa', n);
}

/** Tira um documento da empresa (pela posição). Fica no histórico. */
export function tirarDocumentoDoFiscal(c: CadastroDaEmpresa, indice: number, por: string, agora: Date): CadastroDaEmpresa {
  const outros = [...(c.documentosFiscais?.outros || [])];
  const [saiu] = outros.splice(indice, 1);
  if (!saiu) return c;
  return registrar({ ...c, documentosFiscais: { ...(c.documentosFiscais || {}), outros } }, por, agora, 'Documento da empresa', 'Tirado: ' + saiu.nome);
}

/** O documento `cadastro/{slug}` conferido (campo estranho ou vazio fica de fora). */
export function cadastroDoDocumento(nome: string, codigo: number | null, doc: Record<string, unknown> | null | undefined): CadastroDaEmpresa {
  if (!doc) return cadastroVazio(nome, codigo);
  const bancos = Array.isArray(doc.bancos) ? doc.bancos.map(contaDoDocumento).filter((c): c is ContaBancaria => !!c) : null;
  const historico = Array.isArray(doc.historico)
    ? (doc.historico as Record<string, unknown>[]).map(h => ({ ts: texto(h?.ts), por: texto(h?.por), acao: texto(h?.acao), detalhe: texto(h?.detalhe) })).filter(h => h.ts)
    : [];
  const pl = (doc.plano || null) as Record<string, unknown> | null;
  const plano = pl && typeof pl.contas === 'number' ? { contas: pl.contas, importadoEm: texto(pl.importadoEm) } : undefined;
  return {
    nome, codigo, bancos, contasPadrao: contasPadraoDoDocumento(doc.contasPadrao), historico, ...(plano ? { plano } : {}),
    ...(typeof doc.prestaServico === 'boolean' ? { prestaServico: doc.prestaServico } : {}),
    ...(typeof doc.cartaoEmpresarial === 'boolean' ? { cartaoEmpresarial: doc.cartaoEmpresarial } : {}),
    ...(typeof doc.vendeNoCartao === 'boolean' ? { vendeNoCartao: doc.vendeNoCartao } : {}),
    ...(typeof doc.credLiquidacao === 'boolean' ? { credLiquidacao: doc.credLiquidacao } : {}),
    ...relatoriosDoDocumento(doc.relatoriosDeLiquidacao),
    ...(typeof doc.emiteNotaHonorario === 'boolean' ? { emiteNotaHonorario: doc.emiteNotaHonorario } : {}),
    ...proLaboreDoDocumento(doc.proLabore),
    ...(REGIMES.includes(texto(doc.regime) as Regime) ? { regime: texto(doc.regime) } : {}),
    ...(/^(\d{11}|\d{14})$/.test(texto(doc.cnpj)) ? { cnpj: texto(doc.cnpj) } : {}),
    ...contatoDoDocumento(doc.contato),
    ...(Array.isArray(doc.emprestimos) ? { emprestimos: (doc.emprestimos as Record<string, unknown>[]).map(e => ({ numero: texto(e?.numero), banco: texto(e?.banco), desde: texto(e?.desde), ...(texto(e?.ate) ? { ate: texto(e?.ate) } : {}) })).filter(e => e.numero && e.banco) } : {}),
    ...(Array.isArray(doc.socios) ? { socios: (doc.socios as Record<string, unknown>[]).map(s => ({ nome: texto(s?.nome), cpf: texto(s?.cpf) })).filter(s => s.nome || s.cpf) } : {}), atualizadoEm: opcional(doc.atualizadoEm),
    ...responsaveisDoDocumento(doc.responsaveis), ...dpDoDocumento(doc.dp), ...fiscalDoDocumento(doc.fiscal), ...transferenciasDoDocumento(doc.transferencias),
    ...documentosFiscaisDoDocumento(doc.documentosFiscais),
    ...antecipacaoDoDocumento(doc.antecipacaoIcmsEs),
    ...(doc.nova && typeof doc.nova === 'object' && texto((doc.nova as Record<string, unknown>).regime)
      ? { nova: { regime: texto((doc.nova as Record<string, unknown>).regime), criadaEm: texto((doc.nova as Record<string, unknown>).criadaEm) } } : {}),
  };
}

/** O que vai para o banco (o que nunca foi cadastrado fica de fora, para não virar "cadastrado vazio"). */
export function documentoDoCadastro(c: CadastroDaEmpresa): Record<string, unknown> {
  return {
    nome: c.nome, codigo: c.codigo,
    ...(c.bancos ? { bancos: c.bancos } : {}),
    ...(c.contasPadrao ? { contasPadrao: c.contasPadrao } : {}),
    ...(c.plano ? { plano: c.plano } : {}),
    ...(typeof c.prestaServico === 'boolean' ? { prestaServico: c.prestaServico } : {}),
    ...(typeof c.cartaoEmpresarial === 'boolean' ? { cartaoEmpresarial: c.cartaoEmpresarial } : {}),
    ...(typeof c.vendeNoCartao === 'boolean' ? { vendeNoCartao: c.vendeNoCartao } : {}),
    ...(typeof c.credLiquidacao === 'boolean' ? { credLiquidacao: c.credLiquidacao } : {}),
    ...(c.relatoriosDeLiquidacao ? { relatoriosDeLiquidacao: c.relatoriosDeLiquidacao } : {}),
    ...(typeof c.emiteNotaHonorario === 'boolean' ? { emiteNotaHonorario: c.emiteNotaHonorario } : {}),
    ...(c.proLabore && (c.proLabore.contaCredito || c.proLabore.diaUtil) ? { proLabore: c.proLabore } : {}),
    ...(c.regime ? { regime: c.regime } : {}),
    ...(c.cnpj ? { cnpj: c.cnpj } : {}),
    ...(c.contato && (c.contato.email || c.contato.whatsapp) ? { contato: c.contato } : {}),
    ...(c.socios?.length ? { socios: c.socios } : {}),
    ...(c.emprestimos?.length ? { emprestimos: c.emprestimos } : {}),
    ...(c.responsaveis && Object.keys(c.responsaveis).length ? { responsaveis: c.responsaveis } : {}),
    ...(c.dp && Object.keys(c.dp).length ? { dp: c.dp } : {}),
    ...(c.fiscal && Object.keys(c.fiscal).length ? { fiscal: c.fiscal } : {}),
    ...(c.transferencias && Object.keys(c.transferencias).length ? { transferencias: c.transferencias } : {}),
    ...(c.nova ? { nova: c.nova } : {}),
    ...(c.documentosFiscais && (Object.keys(c.documentosFiscais.planilhas || {}).length || c.documentosFiscais.outros?.length) ? { documentosFiscais: c.documentosFiscais } : {}),
    ...(c.antecipacaoIcmsEs && (c.antecipacaoIcmsEs.aliquota != null || Object.keys(c.antecipacaoIcmsEs.situacoes || {}).length) ? { antecipacaoIcmsEs: c.antecipacaoIcmsEs } : {}),
    historico: c.historico.slice(0, MAX_HISTORICO),
    atualizadoEm: c.atualizadoEm || new Date().toISOString(),
  };
}

/** O documento `cadastro/{slug}/plano/atual` conferido (null = a empresa ainda não tem plano). */
export function planoDoDocumento(doc: Record<string, unknown> | null | undefined): PlanoDeContas | null {
  if (!doc || !Array.isArray(doc.contas)) return null;
  const contas = (doc.contas as Record<string, unknown>[])
    .map((c, i): ContaDoPlano => {
      const x: ContaDoPlano = { codigo: texto(c?.codigo), nome: texto(c?.nome), ordem: typeof c?.ordem === 'number' ? c.ordem : i };
      if (texto(c?.classificacao)) x.classificacao = texto(c.classificacao);
      if (texto(c?.grupo)) x.grupo = texto(c.grupo);
      if (c?.sintetica === true) x.sintetica = true;
      return x;
    })
    .filter(c => c.codigo)
    .sort((a, b) => a.ordem - b.ordem);
  if (!contas.length) return null;
  const p: PlanoDeContas = { contas, origem: doc.origem === 'balancete' ? 'balancete' : 'arquivo', importadoEm: texto(doc.importadoEm) || '' };
  if (texto(doc.arquivo)) p.arquivo = texto(doc.arquivo);
  if (texto(doc.por)) p.por = texto(doc.por);
  return p;
}

// ─── histórico ──────────────────────────────────────────────────────────────

function registrar(c: CadastroDaEmpresa, por: string, agora: Date, acao: string, detalhe: string): CadastroDaEmpresa {
  const r: RegistroCadastro = { ts: agora.toISOString(), por: por || '—', acao, detalhe };
  return { ...c, historico: [r, ...c.historico].slice(0, MAX_HISTORICO), atualizadoEm: r.ts };
}

/**
 * O CNPJ ou o CPF da empresa (Sávio, 20/10/2026: "alguns clientes estão sem CNPJ/CPF e não tem como cadastrar"): só os
 * números; vazio tira. Fica no histórico; sem mudança, devolve o mesmo; número que não confere, o erro.
 */
export function definirDocumento(c: CadastroDaEmpresa, documento: string, por: string, agora: Date): CadastroDaEmpresa | { erro: string } {
  const d = String(documento ?? '').replace(/\D/g, '');
  if ((c.cnpj || '') === d) return c;
  if (d && !documentoValido(d)) {
    return { erro: d.length === 14 ? 'CNPJ inválido: confira os números.' : d.length === 11 ? 'CPF inválido: confira os números.' : 'Digite os 14 números do CNPJ ou os 11 do CPF.' };
  }
  const resto: CadastroDaEmpresa = { ...c };
  delete resto.cnpj;
  return registrar(d ? { ...resto, cnpj: d } : resto, por, agora, 'Identificação', d ? (d.length === 11 ? 'CPF ' : 'CNPJ ') + cnpjFormatado(d) : 'Sem CNPJ/CPF');
}

/** Presta serviços: sim, não, ou volta a "não informado" (null). Fica no histórico; sem mudança, devolve o mesmo. */
export function definirPrestaServico(c: CadastroDaEmpresa, sim: boolean | null, por: string, agora: Date): CadastroDaEmpresa {
  if ((c.prestaServico ?? null) === sim) return c;
  const resto: CadastroDaEmpresa = { ...c };
  delete resto.prestaServico;
  const novo = sim == null ? resto : { ...resto, prestaServico: sim };
  return registrar(novo, por, agora, 'Presta serviços', sim == null ? 'Não informado' : sim ? 'Sim' : 'Não');
}

/**
 * Os sócios da empresa: o nome (sem espaço sobrando) e o CPF (só os dígitos); sem nome nem CPF fica de fora. Fica no
 * histórico; sem mudança, devolve o mesmo.
 */
export function definirSocios(c: CadastroDaEmpresa, socios: readonly Socio[], por: string, agora: Date): CadastroDaEmpresa {
  const novos = socios.map(s => ({ nome: s.nome.trim().replace(/\s+/g, ' '), cpf: s.cpf.replace(/\D/g, '') })).filter(s => s.nome || s.cpf);
  const chave = (l: readonly Socio[]) => l.map(s => s.nome + '#' + s.cpf).join('|');
  if (chave(novos) === chave(c.socios || [])) return c;
  const resto: CadastroDaEmpresa = { ...c };
  delete resto.socios;
  return registrar(novos.length ? { ...resto, socios: novos } : resto, por, agora, 'Sócios', novos.map(s => s.nome || s.cpf).join(', ') || 'Nenhum');
}

/**
 * Os empréstimos achados num razão, com o banco escolhido: entram no Cadastro (o mesmo contrato é atualizado, os outros
 * ficam). Igual ao que já está: não muda nada.
 */
export function registrarEmprestimos(c: CadastroDaEmpresa, itens: readonly EmprestimoDaEmpresa[], por: string, agora: Date): CadastroDaEmpresa {
  const atuais = c.emprestimos || [];
  const porNumero = new Map(atuais.map(e => [e.numero, e]));
  for (const e of itens) porNumero.set(e.numero, { numero: e.numero, banco: e.banco, desde: e.desde, ...(e.ate ? { ate: e.ate } : {}) });
  const novos = [...porNumero.values()].sort((a, b) => a.desde.localeCompare(b.desde) || a.numero.localeCompare(b.numero));
  const chave = (l: readonly EmprestimoDaEmpresa[]) => l.map(e => e.numero + '#' + e.banco + '#' + e.desde + '#' + (e.ate || '')).join('|');
  if (chave(novos) === chave(atuais)) return c;
  const mudaram = itens.filter(e => { const a = porNumero.get(e.numero); return a && chave([a]) !== chave(atuais.filter(x => x.numero === e.numero)); });
  return registrar({ ...c, emprestimos: novos }, por, agora, 'Empréstimos', mudaram.map(e => e.numero + ' (' + e.banco + ')').join(', ') || 'atualizados');
}

/** Quem cuida da empresa num departamento (vazio = ninguém). Igual ao que já está: não muda nada. */
export function definirResponsavel(c: CadastroDaEmpresa, dep: DepartamentoDoResponsavel, nome: string, por: string, agora: Date): CadastroDaEmpresa {
  const novo = texto(nome);
  if ((c.responsaveis?.[dep] || '') === novo) return c;
  const responsaveis = { ...(c.responsaveis || {}) };
  if (novo) responsaveis[dep] = novo; else delete responsaveis[dep];
  const rotulo = DEPARTAMENTOS_DO_RESPONSAVEL.find(d => d.id === dep)?.rotulo || dep;
  return registrar({ ...c, responsaveis }, por, agora, 'Responsável', rotulo + ': ' + (novo || 'ninguém'));
}

/** Muda parâmetros do DP (os que vierem); null tira o parâmetro (volta o da planilha do DP). */
const mesAno = (comp: string) => comp.slice(5, 7) + '/' + comp.slice(0, 4);

/**
 * Muda parâmetros do DP (null = volta o de antes). Com a competência (AAAA-MM), a mudança vale dela em diante (Vitor,
 * 07/10/2026: "configurações por competência"); sem ela, vale sempre (o que vinha antes das competências).
 */
export function definirParametrosDp(c: CadastroDaEmpresa, mudar: { [K in keyof ParametrosDoDpDoMes]?: ParametrosDoDpDoMes[K] | null }, por: string, agora: Date, competencia?: string): CadastroDaEmpresa {
  const dp: ParametrosDoDp = { ...(c.dp || {}) };
  const alvo: ParametrosDoDpDoMes = competencia ? { ...(dp.porCompetencia?.[competencia] || {}) } : dp;
  const partes: string[] = [];
  for (const [k, v] of Object.entries(mudar) as [keyof ParametrosDoDpDoMes, unknown][]) {
    if (v === undefined) continue;
    if (v === null) { delete alvo[k]; partes.push(k + ': o de antes'); continue; }
    (alvo as Record<string, unknown>)[k] = v;
    partes.push(k + ': ' + (Array.isArray(v) ? v.join(', ') || 'nenhuma' : typeof v === 'boolean' ? (v ? 'sim' : 'não') : String(v) || '—'));
  }
  if (!partes.length) return c;
  if (competencia) {
    const pc = { ...(dp.porCompetencia || {}) };
    if (Object.keys(alvo).length) pc[competencia] = alvo; else delete pc[competencia];
    if (Object.keys(pc).length) dp.porCompetencia = pc; else delete dp.porCompetencia;
  }
  return registrar({ ...c, dp }, por, agora, 'DP', (competencia ? 'a partir de ' + mesAno(competencia) + ': ' : '') + partes.join(' · '));
}

/** Tira o que foi mudado no DP: só o de uma competência, ou tudo (volta à planilha). */
export function voltarDpAPlanilha(c: CadastroDaEmpresa, por: string, agora: Date, competencia?: string): CadastroDaEmpresa {
  if (!c.dp) return c;
  if (competencia) {
    if (!c.dp.porCompetencia?.[competencia]) return c;
    const pc = { ...c.dp.porCompetencia };
    delete pc[competencia];
    const dp: ParametrosDoDp = { ...c.dp };
    if (Object.keys(pc).length) dp.porCompetencia = pc; else delete dp.porCompetencia;
    return registrar({ ...c, dp }, por, agora, 'DP', 'desfeito o de ' + mesAno(competencia));
  }
  const resto: CadastroDaEmpresa = { ...c };
  delete resto.dp;
  return registrar(resto, por, agora, 'DP', 'voltou à planilha');
}

/**
 * Muda parâmetros do Fiscal (29/10/2026). null = volta o da planilha. O texto vazio e a lista de segmentos vazia valem
 * como mudança (a pessoa apagou o que a planilha dizia). Fica no histórico; sem mudança, devolve o mesmo.
 */
export function definirParametrosFiscais(c: CadastroDaEmpresa, mudar: { [K in keyof ParametrosDoFiscal]?: ParametrosDoFiscal[K] | null }, por: string, agora: Date): CadastroDaEmpresa {
  const fiscal: ParametrosDoFiscal = { ...(c.fiscal || {}) };
  const partes: string[] = [];
  for (const [k, bruto] of Object.entries(mudar) as [keyof ParametrosDoFiscal, unknown][]) {
    if (bruto === undefined) continue;
    const nome = PARAMETROS_FISCAIS.find(p => p.id === k)?.rotulo || (k === 'segmentos' ? 'Segmento' : k === 'especificidades' ? 'Especificidades' : 'Observações');
    if (bruto === null) {
      if (!(k in fiscal)) continue;
      delete fiscal[k];
      partes.push(nome + ': o da planilha');
      continue;
    }
    const v = k === 'segmentos' ? SEGMENTOS_FISCAIS.map(s => s.id).filter(s => (bruto as SegmentoFiscal[]).includes(s))
      : typeof bruto === 'string' ? bruto.trim().slice(0, MAX_TEXTO_DO_FISCAL) : bruto;
    if (JSON.stringify(fiscal[k]) === JSON.stringify(v)) continue;
    (fiscal as Record<string, unknown>)[k] = v;
    partes.push(nome + ': ' + (Array.isArray(v) ? v.map(s => SEGMENTOS_FISCAIS.find(x => x.id === s)!.rotulo).join(', ') || 'nenhum'
      : typeof v === 'boolean' ? (v ? 'sim' : 'não') : String(v) || '—'));
  }
  if (!partes.length) return c;
  const novo: CadastroDaEmpresa = { ...c, fiscal };
  if (!Object.keys(fiscal).length) delete novo.fiscal;
  return registrar(novo, por, agora, 'Fiscal', partes.join(' · '));
}

/** Tira tudo o que foi mudado nos parâmetros do Fiscal (volta à planilha). */
export function voltarFiscalAPlanilha(c: CadastroDaEmpresa, por: string, agora: Date): CadastroDaEmpresa {
  if (!c.fiscal) return c;
  const resto: CadastroDaEmpresa = { ...c };
  delete resto.fiscal;
  return registrar(resto, por, agora, 'Fiscal', 'voltou à planilha');
}

const nomeIgual = (a: string, b: string) => texto(a).toLowerCase() === texto(b).toLowerCase();
const rotuloDoDep = (dep: DepartamentoDoResponsavel) => DEPARTAMENTOS_DO_RESPONSAVEL.find(d => d.id === dep)?.rotulo || dep;
const semTransferencia = (c: CadastroDaEmpresa, dep: DepartamentoDoResponsavel) => {
  const transferencias = { ...(c.transferencias || {}) };
  delete transferencias[dep];
  return transferencias;
};

/**
 * Pede a transferência da empresa de 'de' (o responsável de hoje) para 'para' (Vitor, 07/10/2026). Só vale com o aceite
 * dos dois: quem pede sendo o emitente ou o destinatário, o aceite dele já vai junto. Devolve o erro, se não der.
 */
export function pedirTransferencia(c: CadastroDaEmpresa, dep: DepartamentoDoResponsavel, de: string, para: string, por: string, agora: Date, troca?: string): ResultadoCadastro {
  const emitente = texto(de);
  const destino = texto(para);
  if (!emitente) return { cadastro: c, erro: 'A empresa ainda não tem responsável: escolha um direto.' };
  if (!destino) return { cadastro: c, erro: 'Escolha para quem transferir.' };
  if (nomeIgual(emitente, destino)) return { cadastro: c, erro: 'A empresa já é de ' + destino + '.' };
  if (c.transferencias?.[dep]) return { cadastro: c, erro: 'Já há uma transferência pedida desta empresa no ' + rotuloDoDep(dep) + '.' };
  const em = agora.toISOString();
  const t: TransferenciaDeResponsavel = {
    de: emitente, para: destino, pedidoPor: texto(por), em,
    ...(nomeIgual(por, emitente) ? { aceiteDe: em } : {}), ...(nomeIgual(por, destino) ? { aceitePara: em } : {}),
    ...(troca ? { troca } : {}),
  };
  const novo = registrar({ ...c, transferencias: { ...(c.transferencias || {}), [dep]: t } }, por, agora, 'Pediu transferência',
    rotuloDoDep(dep) + ': de ' + emitente + ' para ' + destino);
  return { cadastro: novo, erro: null };
}

/**
 * O emitente ou o destinatário responde ao pedido. Recusou: o pedido cai. Aceitou: marca o aceite dele; com os dois
 * aceites, o destinatário vira o responsável e o pedido sai. Quem não é nenhum dos dois não muda nada.
 */
export function responderTransferencia(c: CadastroDaEmpresa, dep: DepartamentoDoResponsavel, quem: string, aceita: boolean, agora: Date): CadastroDaEmpresa {
  const t = c.transferencias?.[dep];
  if (!t) return c;
  const ehDe = nomeIgual(quem, t.de);
  const ehPara = nomeIgual(quem, t.para);
  if (!ehDe && !ehPara) return c;
  const detalhe = rotuloDoDep(dep) + ': de ' + t.de + ' para ' + t.para;
  if (!aceita) return registrar({ ...c, transferencias: semTransferencia(c, dep) }, quem, agora, 'Recusou a transferência', detalhe);
  const em = agora.toISOString();
  const novo: TransferenciaDeResponsavel = { ...t, ...(ehDe ? { aceiteDe: em } : {}), ...(ehPara ? { aceitePara: em } : {}) };
  if (novo.aceiteDe && novo.aceitePara) {
    return registrar({ ...c, responsaveis: { ...(c.responsaveis || {}), [dep]: t.para }, transferencias: semTransferencia(c, dep) },
      quem, agora, 'Transferida', detalhe + ' (os dois aceitaram)');
  }
  return registrar({ ...c, transferencias: { ...(c.transferencias || {}), [dep]: novo } }, quem, agora, 'Aceitou a transferência', detalhe);
}

/** Quem pediu (ou um administrador) desiste do pedido. */
export function cancelarTransferencia(c: CadastroDaEmpresa, dep: DepartamentoDoResponsavel, por: string, agora: Date): CadastroDaEmpresa {
  const t = c.transferencias?.[dep];
  if (!t) return c;
  return registrar({ ...c, transferencias: semTransferencia(c, dep) }, por, agora, 'Cancelou a transferência', rotuloDoDep(dep) + ': de ' + t.de + ' para ' + t.para);
}

/** Falta o aceite de quem? (os nomes, emitente primeiro) */
export function faltamAceitar(t: TransferenciaDeResponsavel): string[] {
  return [...(t.aceiteDe ? [] : [t.de]), ...(t.aceitePara ? [] : [t.para])];
}

/** O que a pessoa tem para responder: as transferências em que ela é emitente ou destinatário e ainda não aceitou. */
export function transferenciasParaResponder(cadastros: Iterable<CadastroDaEmpresa>, quem: string): { cadastro: CadastroDaEmpresa; dep: DepartamentoDoResponsavel; t: TransferenciaDeResponsavel; papel: 'emitente' | 'destinatario' }[] {
  const lista: { cadastro: CadastroDaEmpresa; dep: DepartamentoDoResponsavel; t: TransferenciaDeResponsavel; papel: 'emitente' | 'destinatario' }[] = [];
  if (!texto(quem)) return lista;
  for (const c of cadastros) {
    for (const d of DEPARTAMENTOS_DO_RESPONSAVEL) {
      const t = c.transferencias?.[d.id];
      if (!t) continue;
      if (nomeIgual(quem, t.de) && !t.aceiteDe) lista.push({ cadastro: c, dep: d.id, t, papel: 'emitente' });
      else if (nomeIgual(quem, t.para) && !t.aceitePara) lista.push({ cadastro: c, dep: d.id, t, papel: 'destinatario' });
    }
  }
  return lista.sort((a, b) => a.t.em.localeCompare(b.t.em));
}

/** A empresa nova, cadastrada pelo nads: o código do ERP (se tiver), o nome e o regime. */
export function cadastrarEmpresa(nome: string, codigo: number | null, regime: string, por: string, agora: Date, cnpj = ''): CadastroDaEmpresa {
  const n = texto(nome).toUpperCase();
  const doc = String(cnpj).replace(/\D/g, '');
  return registrar({ ...cadastroVazio(n, codigo), nova: { regime: texto(regime), criadaEm: agora.toISOString() }, ...(doc.length === 14 ? { cnpj: doc } : {}) }, por, agora,
    'Cadastrou a empresa', (codigo != null ? codigo + ' · ' : '') + n + ' · ' + texto(regime) + (doc.length === 14 ? ' · CNPJ ' + doc : ''));
}

/** As empresas cadastradas pelo nads (para juntar à lista do escritório). */
export function empresasCadastradasNoNads(cadastros: Iterable<CadastroDaEmpresa>): { codigo: number | null; nome: string; regime: string }[] {
  const lista: { codigo: number | null; nome: string; regime: string }[] = [];
  for (const c of cadastros) if (c.nova) lista.push({ codigo: c.codigo, nome: c.nome, regime: c.nova.regime });
  return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Registra no histórico a troca do plano de contas (o plano mora em outro documento). */
export function registrarPlano(c: CadastroDaEmpresa, p: PlanoDeContas, por: string, agora: Date): CadastroDaEmpresa {
  const de = p.origem === 'balancete' ? 'de um balancete' : (p.arquivo ? 'de ' + p.arquivo : 'de um arquivo');
  const comResumo = { ...c, plano: { contas: p.contas.length, importadoEm: p.importadoEm } };
  return registrar(comResumo, por, agora, 'Importou o plano de contas', p.contas.length + ' contas ' + de);
}

// ─── contas bancárias ───────────────────────────────────────────────────────

export function nomeDoBanco(marca: string): string {
  return BANCOS_CONHECIDOS.find(b => b.id === marca)?.nome || (marca === 'outro' ? 'Outro banco' : marca);
}

/** "Sicoob · Ag. 3001 · C/C 12345-6" (o que tiver). */
export function descreverConta(c: Pick<ContaBancaria, 'nome' | 'agencia' | 'conta'>): string {
  const r = rotuloDaConta(c);
  return c.nome + (r ? ' · ' + r : '');
}

/** A conta vale na competência ('aaaa-mm')? */
export function contaValeNa(c: ContaBancaria, comp: string): boolean {
  return (!c.desde || c.desde <= comp) && (!c.ate || c.ate >= comp);
}

/** A conta está encerrada (hoje = a competência de referência)? */
export function contaEncerrada(c: ContaBancaria, hoje: string): boolean {
  return !!c.ate && c.ate < hoje;
}

/**
 * O ponto de partida da empresa que ainda não tem bancos cadastrados: a lista provisória (empresas/bancos.ts)
 * e os bancos que a pessoa já adicionou na tela do Extrator, com os mesmos ids (os arquivos importados
 * continuam na conta certa). A linha genérica "Banco" (empresa sem nada) não entra.
 */
export function pontoDePartida(codigo: number | null, adicionadosNoExtrator: readonly (BancoDaEmpresa & { desde?: string })[] = []): ContaBancaria[] {
  const lista: ContaBancaria[] = [];
  const todos: (BancoDaEmpresa & { desde?: string })[] = [...bancosDaEmpresa(codigo), ...adicionadosNoExtrator];
  for (const b of todos) {
    if (b.id === 'banco' || lista.some(x => x.id === b.id)) continue;
    const marca = b.marca || b.id;
    const c: ContaBancaria = { id: b.id, marca, nome: b.nome || nomeDoBanco(marca) };
    if (b.agencia) c.agencia = b.agencia;
    if (b.conta) c.conta = b.conta;
    const desde = competencia(b.desde);
    if (desde) c.desde = desde;
    lista.push(c);
  }
  return lista;
}

/** O que a pessoa preenche para incluir ou editar uma conta. */
export interface DadosDaConta {
  marca: string;
  agencia: string;
  conta: string;
  tipo?: TipoContaBancaria;
  apelido?: string;
  contaContabil?: string;
  desde?: string;
}

export interface ResultadoCadastro {
  cadastro: CadastroDaEmpresa;
  /** o motivo de não ter mudado (null = mudou) */
  erro: string | null;
}

/**
 * Inclui (id = null) ou edita uma conta. Ao editar, o id NÃO muda (os arquivos do Extrator ficam presos a ele),
 * mesmo que a agência ou a conta sejam corrigidas. Se a empresa ainda não tinha bancos, começa pelo ponto de partida.
 */
export function salvarConta(c: CadastroDaEmpresa, id: string | null, d: DadosDaConta, partida: readonly ContaBancaria[], por: string, agora: Date): ResultadoCadastro {
  const marca = texto(d.marca);
  const agencia = texto(d.agencia);
  const conta = texto(d.conta);
  if (!marca) return { cadastro: c, erro: 'Escolha o banco.' };
  const bancos = c.bancos ?? [...partida];
  const antes = id ? bancos.find(b => b.id === id) : undefined;
  if (id && !antes) return { cadastro: c, erro: 'Essa conta não está mais no cadastro.' };
  // a conta que já está sem número (veio do Extrator ou do ponto de partida) salva sem ele: a conta contábil, o tipo… (Vitor,
  // 20/10/2026: "não tá deixando eu salvar" a Caixa sem agência e conta). A nova, ou a que tinha número, precisa dos dois.
  const semNumero = !!antes && !texto(antes.agencia) && !texto(antes.conta) && !agencia && !conta;
  if (!semNumero && (!agencia || !conta)) return { cadastro: c, erro: 'Preencha a agência e a conta.' };
  if (d.desde && !competencia(d.desde)) return { cadastro: c, erro: 'A competência de início está inválida.' };
  const chave = idDaConta(marca, agencia, conta);
  const novoId = antes ? antes.id : chave;
  const repetida = !semNumero && bancos.some(b => b.id !== antes?.id && (b.id === chave || idDaConta(b.marca, b.agencia || '', b.conta || '') === chave));
  if (repetida) return { cadastro: c, erro: 'Essa conta já está cadastrada.' };
  const nova: ContaBancaria = semNumero ? { id: novoId, marca, nome: antes?.nome || nomeDoBanco(marca) } : { id: novoId, marca, nome: nomeDoBanco(marca), agencia, conta };
  if (d.tipo) nova.tipo = d.tipo;
  if (texto(d.apelido)) nova.apelido = texto(d.apelido);
  if (texto(d.contaContabil)) nova.contaContabil = texto(d.contaContabil);
  if (d.desde) nova.desde = d.desde;
  if (antes?.ate) nova.ate = antes.ate;
  if (antes?.contaChequeEspecial) nova.contaChequeEspecial = antes.contaChequeEspecial;
  const lista = antes ? bancos.map(b => (b.id === novoId ? nova : b)) : [...bancos, nova];
  if (lista.length > MAX_BANCOS) return { cadastro: c, erro: 'São no máximo ' + MAX_BANCOS + ' contas por empresa.' };
  return { cadastro: registrar({ ...c, bancos: lista }, por, agora, antes ? 'Editou conta' : 'Incluiu conta', descreverConta(nova)), erro: null };
}

/**
 * As contas contábeis de uma conta bancária, sem mexer no resto (a etapa Cheque especial, Vitor, 13/10/2026): o código da
 * conta do banco e o do cheque especial. Vazio = apaga; igual ao que estava = não muda.
 */
export function definirContasDoBanco(c: CadastroDaEmpresa, id: string, d: { contaContabil?: string; contaChequeEspecial?: string }, partida: readonly ContaBancaria[], por: string, agora: Date): ResultadoCadastro {
  const bancos = c.bancos ?? [...partida];
  const b = bancos.find(x => x.id === id);
  if (!b) return { cadastro: c, erro: 'Essa conta não está mais no cadastro.' };
  const nova: ContaBancaria = { ...b };
  const mudou: string[] = [];
  for (const k of ['contaContabil', 'contaChequeEspecial'] as const) {
    if (d[k] === undefined) continue;
    const v = texto(d[k]);
    if ((b[k] || '') === v) continue;
    if (v) nova[k] = v; else delete nova[k];
    mudou.push((k === 'contaContabil' ? 'conta contábil ' : 'cheque especial ') + (v || '(vazio)'));
  }
  if (!mudou.length) return { cadastro: c, erro: null };
  return { cadastro: registrar({ ...c, bancos: bancos.map(x => (x.id === id ? nova : x)) }, por, agora, 'Editou conta', descreverConta(nova) + ': ' + mudou.join(', ')), erro: null };
}

/** Encerra a conta depois da competência 'ate' (ela some das competências seguintes; as anteriores ficam). */
export function encerrarConta(c: CadastroDaEmpresa, id: string, ate: string, partida: readonly ContaBancaria[], por: string, agora: Date): ResultadoCadastro {
  if (!competencia(ate)) return { cadastro: c, erro: 'Escolha a última competência da conta.' };
  const bancos = c.bancos ?? [...partida];
  const b = bancos.find(x => x.id === id);
  if (!b) return { cadastro: c, erro: 'Essa conta não está mais no cadastro.' };
  if (b.desde && ate < b.desde) return { cadastro: c, erro: 'A conta começou depois dessa competência.' };
  const lista = bancos.map(x => (x.id === id ? { ...x, ate } : x));
  return { cadastro: registrar({ ...c, bancos: lista }, por, agora, 'Encerrou conta', descreverConta(b) + ' · última competência ' + ate.slice(5) + '/' + ate.slice(0, 4)), erro: null };
}

export function reabrirConta(c: CadastroDaEmpresa, id: string, partida: readonly ContaBancaria[], por: string, agora: Date): ResultadoCadastro {
  const bancos = c.bancos ?? [...partida];
  const b = bancos.find(x => x.id === id);
  if (!b) return { cadastro: c, erro: 'Essa conta não está mais no cadastro.' };
  const lista = bancos.map(x => { if (x.id !== id) return x; const resto = { ...x }; delete resto.ate; return resto; });
  return { cadastro: registrar({ ...c, bancos: lista }, por, agora, 'Reabriu conta', descreverConta(b)), erro: null };
}

/** Tira a conta do cadastro (para conta cadastrada por engano; a que existiu e fechou se encerra). */
export function excluirConta(c: CadastroDaEmpresa, id: string, partida: readonly ContaBancaria[], por: string, agora: Date): ResultadoCadastro {
  const bancos = c.bancos ?? [...partida];
  const b = bancos.find(x => x.id === id);
  if (!b) return { cadastro: c, erro: 'Essa conta não está mais no cadastro.' };
  return { cadastro: registrar({ ...c, bancos: bancos.filter(x => x.id !== id) }, por, agora, 'Excluiu conta', descreverConta(b)), erro: null };
}

/** Grava o ponto de partida como o cadastro da empresa (a pessoa confirmou a lista que veio do Extrator). */
export function confirmarPontoDePartida(c: CadastroDaEmpresa, partida: readonly ContaBancaria[], por: string, agora: Date): CadastroDaEmpresa {
  if (c.bancos) return c;
  return registrar({ ...c, bancos: [...partida] }, por, agora, 'Confirmou os bancos', partida.length ? partida.map(descreverConta).join('; ') : 'nenhum banco');
}

// ─── confirmar os bancos na Importação (Vitor, 21/10/2026) ──────────────────────
// "Na importação, quando o banco não está cadastrado, faz um procedimento na própria tela: o usuário confirmar os bancos e
// também colocar a conta contábil." A lista começa com o ponto de partida (o que o Extrator usava e o que o Entregas sabe).

/** Uma linha do "Confirme os bancos": a conta do ponto de partida (id; os arquivos já importados ficam nela) ou uma nova (null). */
export interface BancoParaConfirmar {
  id: string | null;
  marca: string;
  agencia: string;
  conta: string;
  contaContabil: string;
  /** a empresa tem este banco (entra no cadastro) */
  marcado: boolean;
}

/**
 * Grava os bancos marcados como o cadastro da empresa, cada um com a conta contábil (obrigatória; com o plano importado,
 * tem de ser uma conta dele que recebe lançamento). A conta do ponto de partida guarda o id; a nova precisa de agência e conta.
 * Com o plano vindo de um balancete, a conta que não está nele não trava (30/10/2026): o balancete só lista as contas com
 * saldo no mês, e o banco parado não aparece; fica o aviso leve da linha (avisoDaConta).
 */
export function confirmarBancos(c: CadastroDaEmpresa, linhas: readonly BancoParaConfirmar[], partida: readonly ContaBancaria[], plano: PlanoDeContas | null, por: string, agora: Date): ResultadoCadastro {
  if (c.bancos) return { cadastro: c, erro: 'Os bancos desta empresa já estão no Cadastro.' };
  const marcadas = linhas.filter(l => l.marcado);
  if (!marcadas.length) return { cadastro: c, erro: 'Marque os bancos que a empresa tem.' };
  const bancos: ContaBancaria[] = [];
  for (const l of marcadas) {
    const marca = texto(l.marca), agencia = texto(l.agencia), conta = texto(l.conta), contaContabil = texto(l.contaContabil);
    const antes = l.id ? partida.find(b => b.id === l.id) : undefined;
    const nome = antes?.nome || nomeDoBanco(marca);
    if (!marca) return { cadastro: c, erro: 'Escolha o banco.' };
    if (!antes && (!agencia || !conta)) return { cadastro: c, erro: nome + ': preencha a agência e a conta.' };
    if (!contaContabil) return { cadastro: c, erro: nome + ': informe a conta contábil.' };
    const aviso = avisoDaConta(contaContabil, plano);
    if (aviso && !foraDoBalancete(contaContabil, plano)) return { cadastro: c, erro: nome + ': ' + aviso };
    const id = antes ? antes.id : idDaConta(marca, agencia, conta);
    if (bancos.some(b => b.id === id)) return { cadastro: c, erro: nome + ': essa conta está duas vezes na lista.' };
    const nova: ContaBancaria = { ...(antes || { id, marca, nome }), id, contaContabil };
    if (agencia) nova.agencia = agencia; else delete nova.agencia;
    if (conta) nova.conta = conta; else delete nova.conta;
    bancos.push(nova);
  }
  if (bancos.length > MAX_BANCOS) return { cadastro: c, erro: 'Mais de ' + MAX_BANCOS + ' contas.' };
  return { cadastro: registrar({ ...c, bancos }, por, agora, 'Confirmou os bancos', bancos.map(b => descreverConta(b) + ' · conta ' + b.contaContabil).join('; ')), erro: null };
}

// os nomes que o banco costuma ter no plano de contas (a Caixa é "Caixa Econômica": "Caixa" sozinho é o caixa da empresa)
const NOMES_NO_PLANO: Record<string, string[]> = {
  'banco-do-brasil': ['banco do brasil', 'bco do brasil', 'bb'], bnb: ['banco do nordeste', 'bnb'], caixa: ['caixa economica', 'cef'],
  'mercado-pago': ['mercado pago'], c6: ['c6'], btg: ['btg'], itau: ['itau'],
};

/**
 * A conta contábil do banco pelo nome no plano (ex.: "Banco Nubank" para o Nubank): só quando uma conta que recebe
 * lançamento bate sozinha (a aplicação e a poupança ficam de fora). Sem plano, ou com mais de uma, nada (a pessoa escolhe).
 */
export function sugerirContaContabil(plano: PlanoDeContas | null, marca: string): string {
  if (!plano || !marca || marca === 'outro') return '';
  const nomes = NOMES_NO_PLANO[marca] || [nomeNorm(nomeDoBanco(marca))];
  const bate = (n: string) => nomes.some(t => (' ' + n + ' ').includes(' ' + t + ' '));
  const achadas = plano.contas.filter(k => !k.sintetica && bate(nomeNorm(k.nome)) && !/aplic|poupan|invest|cdb|rdb|fundo|consorc|emprest|financ|cartao|cheque/.test(nomeNorm(k.nome)));
  return achadas.length === 1 ? achadas[0].codigo : '';
}

// ─── o que o Extrator lê ────────────────────────────────────────────────────

const comoBancoDaEmpresa = (b: ContaBancaria): BancoDaEmpresa => {
  const r: BancoDaEmpresa = { id: b.id, nome: b.nome, marca: b.marca };
  if (b.agencia) r.agencia = b.agencia;
  if (b.conta) r.conta = b.conta;
  return r;
};

/**
 * As linhas de banco do Extrator na competência. Com os bancos cadastrados, são as contas do cadastro que
 * valem nela (nenhuma = a linha genérica "Banco"); sem cadastro, a lista provisória de antes.
 */
export function bancosDoCadastroNa(c: CadastroDaEmpresa | null, codigo: number | null, comp: string): BancoDaEmpresa[] {
  if (!c?.bancos) return bancosDaEmpresa(codigo);
  const valem = c.bancos.filter(b => contaValeNa(b, comp)).map(comoBancoDaEmpresa);
  return valem.length ? valem : bancosDaEmpresa(null);
}

/** O primeiro banco da empresa (os arquivos importados sem banco são dele), em qualquer competência. */
export function primeiroBancoDoCadastro(c: CadastroDaEmpresa | null, codigo: number | null): string {
  if (c?.bancos) return c.bancos[0]?.id ?? 'banco';
  return bancosDaEmpresa(codigo)[0].id;
}

// ─── contas padrão ──────────────────────────────────────────────────────────

export const ROTULO_CONTA_PADRAO: Record<CampoContaPadrao, string> = {
  banco: 'Conta do banco (liquidação de títulos)',
  juros: 'Juros recebidos',
  desconto: 'Descontos concedidos',
  histPrincipal: 'Histórico do principal',
  histJuros: 'Histórico dos juros',
  histDesconto: 'Histórico dos descontos',
  cartao: 'Cartão de crédito',
};

/** Grava uma conta padrão (vazio = volta ao padrão do aplicativo). Se for do plano, guarda o nome dela. */
export function definirContaPadrao(c: CadastroDaEmpresa, campo: CampoContaPadrao, codigo: string, plano: PlanoDeContas | null, por: string, agora: Date): CadastroDaEmpresa {
  const v = texto(codigo);
  const atual: ContasPadrao = c.contasPadrao ?? { contas: {}, nomes: {} };
  if ((atual.contas[campo] || '') === v && c.contasPadrao) return c;
  const contas = { ...atual.contas };
  const nomes = { ...atual.nomes };
  if (v) contas[campo] = v; else delete contas[campo];
  if ((CONTAS_PADRAO_DO_PLANO as readonly string[]).includes(campo)) {
    const k = campo as ContaPadraoDoPlano;
    const noPlano = v ? contaNoPlano(plano, v) : null;
    if (noPlano) nomes[k] = noPlano.nome; else delete nomes[k];
  }
  const detalhe = ROTULO_CONTA_PADRAO[campo] + ': ' + (v || 'padrão do aplicativo');
  return registrar({ ...c, contasPadrao: { contas, nomes } }, por, agora, 'Mudou conta padrão', detalhe);
}

/**
 * Os cartões da empresa e a liquidação de cobrança (o Creditor): tem cartão empresarial / vende no cartão / recebe
 * CRÉD.LIQ.COBRANÇA — sim, não, ou volta a "não informado" (null).
 */
export function definirCartao(c: CadastroDaEmpresa, campo: 'cartaoEmpresarial' | 'vendeNoCartao' | 'credLiquidacao', sim: boolean | null, por: string, agora: Date): CadastroDaEmpresa {
  if ((c[campo] ?? null) === sim) return c;
  const resto: CadastroDaEmpresa = { ...c };
  delete resto[campo];
  const novo = sim == null ? resto : { ...resto, [campo]: sim };
  return registrar(novo, por, agora, campo === 'cartaoEmpresarial' ? 'Cartão empresarial' : campo === 'vendeNoCartao' ? 'Vende no cartão' : 'Liquidação de cobrança (Creditor)', sim == null ? 'Não informado' : sim ? 'Sim' : 'Não');
}

// ─── contato (o e-mail e o WhatsApp do Mandei) ──────────────────────────────

/** O e-mail tem cara de e-mail. */
export function emailValido(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
}

/** O WhatsApp só com os números; com DDD são 10 ou 11 dígitos (com o 55 na frente, 12 ou 13). '' = inválido. */
export function whatsappLimpo(numero: string): string {
  const d = numero.replace(/\D/g, '');
  return d.length >= 10 && d.length <= 13 ? d : '';
}

function contatoDoDocumento(v: unknown): Pick<CadastroDaEmpresa, 'contato'> {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const email = texto(o.email);
  const whatsapp = texto(o.whatsapp);
  return email || whatsapp ? { contato: { ...(email ? { email } : {}), ...(whatsapp ? { whatsapp } : {}) } } : {};
}

/**
 * Grava o e-mail ou o WhatsApp da empresa (vazio = tira). O WhatsApp fica só com os números. Valor inválido não grava
 * (quem chama avisa).
 */
export function definirContato(c: CadastroDaEmpresa, campo: 'email' | 'whatsapp', valor: string, por: string, agora: Date): CadastroDaEmpresa {
  const v = campo === 'whatsapp' ? (valor.trim() ? whatsappLimpo(valor) : '') : valor.trim();
  if (valor.trim() && (campo === 'email' ? !emailValido(v) : !v)) return c;
  if ((c.contato?.[campo] || '') === v) return c;
  const contato = { ...(c.contato || {}) };
  if (v) contato[campo] = v; else delete contato[campo];
  const resto: CadastroDaEmpresa = { ...c };
  delete resto.contato;
  const novo = contato.email || contato.whatsapp ? { ...resto, contato } : resto;
  return registrar(novo, por, agora, campo === 'email' ? 'E-mail da empresa' : 'WhatsApp da empresa', v || 'Tirou');
}

/** O escritório emite nota de honorário para a empresa: sim, não, ou volta a "não informado" (null). */
/** Os bancos do relatório de liquidação, do documento (só os conhecidos, sem repetir). */
function relatoriosDoDocumento(v: unknown): Pick<CadastroDaEmpresa, 'relatoriosDeLiquidacao'> {
  if (!Array.isArray(v)) return {};
  return { relatoriosDeLiquidacao: BANCOS_DO_RELATORIO.map(b => b.id).filter(id => v.includes(id)) };
}

/** Marca ou desmarca um banco do relatório de liquidação (o Creditor). Registra no histórico. */
export function definirRelatorioDeLiquidacao(c: CadastroDaEmpresa, banco: BancoDoRelatorio, marcado: boolean, por: string, agora: Date): CadastroDaEmpresa {
  const atual = c.relatoriosDeLiquidacao || [];
  if (atual.includes(banco) === marcado) return c;
  const novos = BANCOS_DO_RELATORIO.map(b => b.id).filter(id => (id === banco ? marcado : atual.includes(id)));
  const nome = BANCOS_DO_RELATORIO.find(b => b.id === banco)?.nome || banco;
  return registrar({ ...c, relatoriosDeLiquidacao: novos }, por, agora, 'Relatório de liquidação (Creditor)', nome + (marcado ? ': sim' : ': não'));
}

export function definirNotaDeHonorario(c: CadastroDaEmpresa, sim: boolean | null, por: string, agora: Date): CadastroDaEmpresa {
  if ((c.emiteNotaHonorario ?? null) === sim) return c;
  const resto: CadastroDaEmpresa = { ...c };
  delete resto.emiteNotaHonorario;
  const novo = sim == null ? resto : { ...resto, emiteNotaHonorario: sim };
  return registrar(novo, por, agora, 'Nota de honorário', sim == null ? 'Não informado' : sim ? 'Sim' : 'Não');
}

/** Guarda a conta do crédito e/ou o dia útil do pagamento do pró-labore (o vazio tira). Registra no histórico. */
export function definirPagamentoDoProLabore(c: CadastroDaEmpresa, mudar: { contaCredito?: string; diaUtil?: number }, por: string, agora: Date): CadastroDaEmpresa {
  const atual = c.proLabore || {};
  const novo: { contaCredito?: string; diaUtil?: number } = { ...atual };
  if (mudar.contaCredito !== undefined) {
    const cod = mudar.contaCredito.replace(/\D/g, '');
    if (cod) novo.contaCredito = cod; else delete novo.contaCredito;
  }
  if (mudar.diaUtil !== undefined) novo.diaUtil = Math.min(5, Math.max(1, Math.round(mudar.diaUtil) || 5));
  if (novo.contaCredito === atual.contaCredito && novo.diaUtil === atual.diaUtil) return c;
  const resto: CadastroDaEmpresa = { ...c };
  delete resto.proLabore;
  const com = Object.keys(novo).length ? { ...resto, proLabore: novo } : resto;
  const detalhe = [novo.contaCredito ? 'crédito ' + novo.contaCredito : 'sem a conta do crédito', (novo.diaUtil || 5) + 'º dia útil'].join(' · ');
  return registrar(com, por, agora, 'Pagamento do pró-labore', detalhe);
}

/** Os regimes da empresa (os da lista do escritório). */
export const REGIMES = ['Simples', 'MEI', 'Presumido', 'Real', 'Isentas', 'Física', 'Domésticas'] as const;
export type Regime = (typeof REGIMES)[number];

/** O regime que vale: o do cadastro, o da empresa cadastrada pelo nads ou nenhum (então vale o da lista). */
export function regimeDoCadastro(c: Pick<CadastroDaEmpresa, 'regime' | 'nova'>): string {
  return c.regime || c.nova?.regime || '';
}

/** Escolhe o regime (null = volta para o da lista do escritório). Registra no histórico. */
export function definirRegime(c: CadastroDaEmpresa, regime: Regime | null, por: string, agora: Date): CadastroDaEmpresa {
  if ((c.regime ?? null) === regime) return c;
  const resto: CadastroDaEmpresa = { ...c };
  delete resto.regime;
  const novo = regime == null ? resto : { ...resto, regime };
  return registrar(novo, por, agora, 'Regime', (c.regime || 'Da lista') + ' → ' + (regime || 'Da lista'));
}

/**
 * Troca as contas padrão de uma vez (quem grava é outro aplicativo, como o Creditor ao confirmar as contas).
 * Nada mudou = o mesmo cadastro (não grava à toa); mudou = registra quais campos.
 */
export function comContasPadrao(c: CadastroDaEmpresa, novas: ContasPadrao, por: string, agora: Date): CadastroDaEmpresa {
  const antes = c.contasPadrao ?? { contas: {}, nomes: {} };
  const mudaram = CAMPOS_CONTA_PADRAO.filter(k => !(k === 'cartao' && novas.contas.cartao === undefined) && (antes.contas[k] || '') !== (novas.contas[k] || ''));
  const nomesMudaram = CONTAS_PADRAO_DO_PLANO.some(k => !(k === 'cartao' && novas.contas.cartao === undefined) && (antes.nomes[k] || '') !== (novas.nomes[k] || ''));
  if (c.contasPadrao && !mudaram.length && !nomesMudaram) return c;
  const contas: ContasPadrao['contas'] = {};
  const nomes: ContasPadrao['nomes'] = {};
  for (const k of CAMPOS_CONTA_PADRAO) if (texto(novas.contas[k])) contas[k] = texto(novas.contas[k]);
  for (const k of CONTAS_PADRAO_DO_PLANO) if (texto(novas.nomes[k])) nomes[k] = texto(novas.nomes[k]);
  // a conta do cartão é do Cartões, não do Creditor: quem não mandou ela (undefined) não a apaga
  if (novas.contas.cartao === undefined && antes.contas.cartao) { contas.cartao = antes.contas.cartao; if (antes.nomes.cartao) nomes.cartao = antes.nomes.cartao; }
  const detalhe = mudaram.length ? mudaram.map(k => ROTULO_CONTA_PADRAO[k] + ': ' + (contas[k] || 'padrão do aplicativo')).join('; ') : 'nomes das contas conferidos';
  return registrar({ ...c, contasPadrao: { contas, nomes } }, por, agora, 'Mudou conta padrão', detalhe);
}

/**
 * A conta não está no plano, e o plano veio de um balancete: o balancete só lista as contas com saldo no mês, então ela
 * pode existir e só estar sem saldo (30/10/2026). Não trava nada; o aviso é leve.
 */
export function foraDoBalancete(codigo: string | undefined, plano: PlanoDeContas | null): boolean {
  return !!codigo && plano?.origem === 'balancete' && !contaNoPlano(plano, codigo);
}

/**
 * Aviso de uma conta usada no cadastro que não bate com o plano atual (null = tudo certo ou sem plano). Com o plano do
 * balancete, a conta que não está nele é só "sem saldo neste balancete" (foraDoBalancete): aviso leve, não erro.
 */
export function avisoDaConta(codigo: string | undefined, plano: PlanoDeContas | null, nomeAntes?: string): string | null {
  if (!codigo || !plano) return null;
  const c = contaNoPlano(plano, codigo);
  if (!c && plano.origem === 'balancete') return 'A conta ' + codigo + ' está sem saldo neste balancete (ele só lista as contas com saldo no mês): confira se é ela mesma.';
  if (!c) return 'A conta ' + codigo + ' não está no plano de contas.';
  if (c.sintetica) return 'A conta ' + codigo + ' é sintética (não recebe lançamento).';
  if (nomeAntes && nomeNorm(nomeAntes) !== nomeNorm(c.nome)) return 'Mudou de nome no plano: era "' + nomeAntes + '".';
  return null;
}

// ─── plano de contas ────────────────────────────────────────────────────────

export function contaNoPlano(plano: PlanoDeContas | null, codigo: string): ContaDoPlano | null {
  const v = texto(codigo);
  return (v && plano?.contas.find(c => c.codigo === v)) || null;
}

/** Contas do plano que batem com o texto: código ou classificação que começa com ele, ou o nome. */
export function buscarNoPlano(contas: readonly ContaDoPlano[], q: string, soAnaliticas = false): ContaDoPlano[] {
  const t = texto(q);
  const base = soAnaliticas ? contas.filter(c => !c.sintetica) : contas;
  if (!t) return [...base];
  const n = nomeNorm(t);
  const peso = (c: ContaDoPlano) => (c.codigo === t ? 0 : c.codigo.startsWith(t) ? 1 : c.classificacao?.startsWith(t) ? 2 : 3);
  return base
    .filter(c => c.codigo.startsWith(t) || !!c.classificacao?.startsWith(t) || (!!n && nomeNorm(c.nome).includes(n)))
    .sort((a, b) => peso(a) - peso(b) || a.ordem - b.ordem);
}

export interface ResumoDoPlano { total: number; analiticas: number; grupos: { grupo: string; qtd: number }[] }

export function resumoDoPlano(contas: readonly ContaDoPlano[]): ResumoDoPlano {
  const grupos = new Map<string, number>();
  for (const c of contas) if (c.grupo) grupos.set(c.grupo, (grupos.get(c.grupo) || 0) + 1);
  return { total: contas.length, analiticas: contas.filter(c => !c.sintetica).length, grupos: [...grupos].map(([grupo, qtd]) => ({ grupo, qtd })) };
}

/** O que muda ao trocar o plano: contas novas, que saem e que mudam de nome; e as usadas no cadastro que somem. */
export interface MudancaDoPlano { novas: number; saem: number; renomeadas: number; usadasQueSaem: string[] }

export function compararPlanos(antes: PlanoDeContas | null, depois: readonly ContaDoPlano[], c: CadastroDaEmpresa): MudancaDoPlano {
  const velhas = new Map((antes?.contas || []).map(x => [x.codigo, x.nome]));
  const novas = new Set(depois.map(x => x.codigo));
  const usadas = [
    ...(c.bancos || []).filter(b => b.contaContabil).map(b => ({ codigo: b.contaContabil as string, onde: descreverConta(b) })),
    ...CONTAS_PADRAO_DO_PLANO.filter(k => c.contasPadrao?.contas[k]).map(k => ({ codigo: c.contasPadrao?.contas[k] as string, onde: ROTULO_CONTA_PADRAO[k] })),
  ];
  return {
    novas: depois.filter(x => !velhas.has(x.codigo)).length,
    saem: [...velhas.keys()].filter(k => !novas.has(k)).length,
    renomeadas: depois.filter(x => velhas.has(x.codigo) && nomeNorm(velhas.get(x.codigo)) !== nomeNorm(x.nome)).length,
    usadasQueSaem: usadas.filter(u => !novas.has(u.codigo)).map(u => u.codigo + ' (' + u.onde + ')'),
  };
}
