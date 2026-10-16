// O documento lcdpr/config do banco do Entregas, lido e gravado com os MESMOS campos da página antiga (ela continua
// funcionando junto e grava o documento inteiro): config, categorias, planoContas, ncmRules, imoveis, ieDest, tipoDoc e
// tipoLanc. Campo que não está no documento fica com o padrão (como o bootstrapCloud de lá). E o backup em JSON.
import { configPadrao } from './padrao';
import { CAMPOS_DA_CONFIG, type ConfigGeral, type ConfigLcdpr } from './tipos';

const texto = (v: unknown) => (v == null ? '' : String(v));
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** uma lista de objetos com estes campos, todos em texto */
function lista<K extends string>(v: unknown, campos: readonly K[]): Record<K, string>[] {
  if (!Array.isArray(v)) return [];
  return v.map(item => { const o = obj(item); return Object.fromEntries(campos.map(k => [k, texto(o[k])])) as Record<K, string>; });
}

const CAMPOS_GERAL: readonly (keyof ConfigGeral)[] = ['cpfProdutor', 'contaCredoraPadrao', 'imovelPadrao', 'tipoDocPadrao', 'tipoLancPadrao', 'categoriaFretesCTe'];
const LISTAS = {
  categorias: ['nome', 'conta', 'codHist', 'historico'],
  planoContas: ['codigo', 'nome', 'classificacao', 'tipo'],
  ncmRules: ['prefixo', 'conta', 'codHist', 'historico'],
  imoveis: ['codigo', 'descricao'],
  ieDest: ['ie', 'imovel'],
  tipoDoc: ['codigo', 'descricao'],
  tipoLanc: ['codigo', 'descricao'],
} as const;

/** Os campos que vieram (do banco ou de um backup) por cima de `base`: o que veio troca o campo inteiro. */
export function configDoDocumento(d: unknown, base: ConfigLcdpr = configPadrao()): ConfigLcdpr {
  const o = obj(d);
  const c: ConfigLcdpr = { ...base };
  if (o.config !== undefined) { const g = obj(o.config); c.config = Object.fromEntries(CAMPOS_GERAL.map(k => [k, texto(g[k])])) as unknown as ConfigGeral; }
  if (o.categorias !== undefined) c.categorias = lista(o.categorias, LISTAS.categorias);
  if (o.planoContas !== undefined) c.planoContas = lista(o.planoContas, LISTAS.planoContas);
  if (o.ncmRules !== undefined) c.ncmRules = lista(o.ncmRules, LISTAS.ncmRules);
  if (o.imoveis !== undefined) c.imoveis = lista(o.imoveis, LISTAS.imoveis);
  if (o.ieDest !== undefined) c.ieDest = lista(o.ieDest, LISTAS.ieDest);
  if (o.tipoDoc !== undefined) c.tipoDoc = lista(o.tipoDoc, LISTAS.tipoDoc);
  if (o.tipoLanc !== undefined) c.tipoLanc = lista(o.tipoLanc, LISTAS.tipoLanc);
  return c;
}

/** O documento para gravar: os 8 campos, na ordem da página antiga (cópias soltas, sem nada a mais). */
export function documentoDaConfig(c: ConfigLcdpr): Record<(typeof CAMPOS_DA_CONFIG)[number], unknown> {
  return JSON.parse(JSON.stringify(Object.fromEntries(CAMPOS_DA_CONFIG.map(k => [k, c[k]])))) as Record<(typeof CAMPOS_DA_CONFIG)[number], unknown>;
}

export const NOME_DO_BACKUP = 'backup_importador_lcdpr.json';

/** O backup (o mesmo JSON da página antiga). */
export const backupDaConfig = (c: ConfigLcdpr) => JSON.stringify(documentoDaConfig(c), null, 2);

/** As regras de um backup por cima das atuais (só os 8 campos); texto que não é backup dá erro. */
export function configDoBackup(textoDoArquivo: string, atual: ConfigLcdpr): ConfigLcdpr {
  let d: unknown;
  try { d = JSON.parse(textoDoArquivo); } catch (e) { throw new Error('o arquivo não é um JSON (' + (e as Error).message + ')', { cause: e }); }
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('o arquivo não é um backup do LCDPR');
  if (!CAMPOS_DA_CONFIG.some(k => (d as Record<string, unknown>)[k] !== undefined)) throw new Error('o arquivo não tem nenhuma regra do LCDPR');
  return configDoDocumento(d, atual);
}
