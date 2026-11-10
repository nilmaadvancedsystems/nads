// A leitura guardada junto com a planilha de onde veio (Vitor, 10/11/2026: "tem bugs que foram removidos de uma empresa que
// aparece em outras"). O balancete dinâmico e os razões ficavam guardados já lidos, sem o arquivo: a correção do leitor só
// valia para a empresa que importava de novo. Com as linhas da planilha junto (a fonte), quem lê o guardado relê com o
// leitor de agora. A assinatura é a da leitura que a fonte deu: a leitura mexida depois (um mês tirado, um razão juntado)
// não bate com ela e fica como está.
import * as XLSX from 'xlsx';
import { lerBalanceteDinamico, type BalanceteDinamico } from './extratudo/clientes';
import { lerRazao as lerRazaoDasLinhas, lerRazaoDoArquivo, type RazaoDaConta } from './tarefas/regras/razao';

export type TipoDaFonte = 'razao' | 'dinamico';

export interface FonteDaLeitura {
  tipo: TipoDaFonte;
  /** as linhas da planilha, como o leitor recebe */
  linhas: unknown[][];
  /** a assinatura da leitura que estas linhas deram */
  assinatura: string;
}

export type ComFonte<T> = T & { fonte: FonteDaLeitura };

/** O texto curto que muda quando a leitura muda (o tamanho e um hash do JSON). */
function assinatura(v: unknown): string {
  const s = JSON.stringify(v) ?? '';
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return s.length + ':' + (h >>> 0).toString(36);
}

/** O que o leitor produz (sem o que o app põe depois, como a conta e a fonte). */
function daLeitura(tipo: TipoDaFonte, x: Record<string, unknown>): unknown {
  return tipo === 'razao'
    ? [x.lancamentos, x.saldoInicial, x.saldoFinal, x.inicio, x.fim]
    : [x.meses, x.linhas];
}

/** Até onde a planilha vai junto (em letras do JSON): o dinâmico enorme (o da 450, com 12 mil contas) não cabe no navegador. */
const LIMITE_DA_FONTE = 1_500_000;

function comFonte<T extends object>(tipo: TipoDaFonte, lido: T, linhas: unknown[][]): T | ComFonte<T> {
  if ((JSON.stringify(linhas) ?? '').length > LIMITE_DA_FONTE) return lido;
  return { ...lido, fonte: { tipo, linhas, assinatura: assinatura(daLeitura(tipo, lido as Record<string, unknown>)) } };
}

/** O razão do XLS da conciliação do Alterdata, com a planilha junto (para reler depois). */
export function lerRazao(buf: ArrayBuffer, nomeDoArquivo = ''): RazaoDaConta | ComFonte<RazaoDaConta> {
  const r = lerRazaoDoArquivo(buf, nomeDoArquivo);
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array', raw: true });
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null, blankrows: false });
  return comFonte('razao', r, linhas);
}

/** O balancete dinâmico das linhas da planilha (conferencia.lerPlanilha), com elas junto. */
export function lerDinamico(linhas: readonly (readonly unknown[])[]): BalanceteDinamico | ComFonte<BalanceteDinamico> {
  return comFonte('dinamico', lerBalanceteDinamico(linhas), linhas.map(l => [...l]));
}

function releu(o: Record<string, unknown>, f: FonteDaLeitura): Record<string, unknown> | null {
  if (assinatura(daLeitura(f.tipo, o)) !== f.assinatura) return null;
  const novo = (f.tipo === 'razao' ? lerRazaoDasLinhas(f.linhas) : lerBalanceteDinamico(f.linhas)) as unknown as Record<string, unknown>;
  const a = assinatura(daLeitura(f.tipo, novo));
  if (a === f.assinatura) return null;
  return { ...o, ...novo, ...(f.tipo === 'razao' && o.conta ? { conta: o.conta } : {}), fonte: { ...f, assinatura: a } };
}

const ehFonte = (f: unknown): f is FonteDaLeitura => !!f && typeof f === 'object' && ((f as FonteDaLeitura).tipo === 'razao' || (f as FonteDaLeitura).tipo === 'dinamico')
  && Array.isArray((f as FonteDaLeitura).linhas) && typeof (f as FonteDaLeitura).assinatura === 'string';

/**
 * O valor guardado com cada leitura (o razão, o dinâmico) refeita pelo leitor de agora, em qualquer lugar dele (até 6
 * níveis). O que não mudou volta igual (o mesmo objeto); a leitura que não dá para refazer fica como estava.
 */
export function relerLeituras<T>(v: T, fundo = 0): T {
  if (!v || typeof v !== 'object' || fundo > 6) return v;
  if (Array.isArray(v)) {
    let mudou = false;
    const out = v.map(x => { const y = relerLeituras(x, fundo + 1); if (y !== x) mudou = true; return y; });
    return (mudou ? out : v) as T;
  }
  const o = v as Record<string, unknown>;
  if (ehFonte(o.fonte)) {
    try { return (releu(o, o.fonte) ?? v) as T; } catch { return v; }
  }
  let novo: Record<string, unknown> | null = null;
  for (const k of Object.keys(o)) {
    const x = o[k];
    if (!x || typeof x !== 'object') continue;
    const y = relerLeituras(x, fundo + 1);
    if (y !== x) (novo = novo || { ...o })[k] = y;
  }
  return (novo ?? v) as T;
}
