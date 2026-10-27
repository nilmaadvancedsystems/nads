// Os comprovantes na Importação (Vitor, 26/10/2026: "quero baixar os comprovantes usando o algoritmo de buscar no Gmail… onde
// eu consigo puxar e visualizar"). O robô do arquivamento guarda cada comprovante em CONTÁBIL/EXTRATOS/<ano>/<mês>/COMPROVANTES
// (robo/arquivador-regras.js: a pasta COMPROVANTES do tipo COMPROVANTE); aqui, achar no mapa da pasta do cliente os de cada mês
// e o nome com que o comprovante vai para o Drive (o robô reconhece pelo conteúdo; o "COMPROVANTE" no nome ajuda).
import { nomeNorm } from '../../../formatos';
import type { ItemDrive } from '../../creditor/regras/drive';
import { bancoDoTexto } from '../../conversor/regras/arquivo';

/** Um comprovante que está no Drive; banco: o da subpasta (COMPROVANTES/BRADESCO) ou do nome ('' = não diz). */
export interface ComprovanteNoDrive { id: string; nome: string; banco: string; tamanho?: number; em?: string }

/**
 * Os comprovantes de cada mês ('aaaa-mm') na pasta do cliente: os arquivos de CONTÁBIL/EXTRATOS/<ano>/<mês>/COMPROVANTES (com
 * as subpastas, uma por banco: COMPROVANTES/BRADESCO). O mês pode ser "02" ou "02-2026"; sem a pasta, o mês fica vazio.
 */
export function comprovantesNoDrive(itens: readonly ItemDrive[], raiz: string | null, meses: readonly string[]): Record<string, ComprovanteNoDrive[]> {
  const out: Record<string, ComprovanteNoDrive[]> = {};
  for (const m of meses) out[m] = [];
  if (!raiz) return out;
  const filhos = new Map<string, ItemDrive[]>();
  for (const it of itens) filhos.set(it.p, [...(filhos.get(it.p) || []), it]);
  const pastas = (p: string) => (filhos.get(p) || []).filter(it => it.t === 'd');
  const pasta = (p: string, nome: string) => pastas(p).find(it => nomeNorm(it.n) === nome) || null;
  const contabil = pasta(raiz, 'contabil');
  const extratos = contabil && pasta(contabil.i, 'extratos');
  if (!extratos) return out;
  // os arquivos com o banco da primeira subpasta (ou, direto em COMPROVANTES, o do nome)
  const arquivos = (p: string, banco: string | null): { it: ItemDrive; banco: string }[] => (filhos.get(p) || [])
    .flatMap(it => (it.t === 'd' ? arquivos(it.i, banco ?? bancoDoTexto(it.n)) : [{ it, banco: banco ?? bancoDoTexto(it.n) }]));
  for (const m of meses) {
    const [ano, mes] = m.split('-').map(Number);
    const doAno = pastas(extratos.i).find(it => nomeNorm(it.n).startsWith(String(ano)));
    const doMes = doAno && pastas(doAno.i).find(it => { const x = /^(\d{1,2})(\D|$)/.exec(it.n.trim()); return !!x && Number(x[1]) === mes; });
    const comp = doMes && pastas(doMes.i).find(it => nomeNorm(it.n) === 'comprovantes');
    if (!comp) continue;
    out[m] = arquivos(comp.i, null)
      .map(({ it, banco }) => ({ id: it.i, nome: it.n, banco, ...(it.s != null ? { tamanho: it.s } : {}), ...(it.m ? { em: it.m } : {}) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  return out;
}

/** Os comprovantes de um banco (alvo: o nome que o conversor conhece, ex. 'Bradesco'); os sem banco vão para o único banco. */
export function comprovantesDoBanco(lista: readonly ComprovanteNoDrive[], alvo: string, unicoBanco: boolean): ComprovanteNoDrive[] {
  return lista.filter(c => (alvo && c.banco === alvo) || (!c.banco && unicoBanco));
}

/**
 * O mês do comprovante ('aaaa-mm'), entre os meses do período (Vitor, 27/10/2026: "Upar todos no Drive", vários arquivos de uma
 * vez, cada um no seu mês): a primeira data do nome ("Comprovante 02-06-2026 13h05.pdf"; ou o "06-2026") que cai no período;
 * sem ela, a primeira data do texto do PDF que cai. null = não deu para saber.
 */
export function mesDoComprovante(nome: string, texto: string, meses: readonly string[]): string | null {
  const noPeriodo = (a: number, m: number) => { const x = a + '-' + String(m).padStart(2, '0'); return meses.includes(x) ? x : null; };
  const datas = (t: string) => {
    const out: string[] = [];
    const re = /(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2})(?!\d)|(?<!\d)(20\d{2})-(\d{2})-(\d{2})(?!\d)/g;
    let m;
    while ((m = re.exec(t))) {
      const x = m[3] ? noPeriodo(Number(m[3]), Number(m[2])) : noPeriodo(Number(m[4]), Number(m[5]));
      if (x) out.push(x);
    }
    return out;
  };
  const doNome = datas(nome)[0];
  if (doNome) return doNome;
  const mesAno = /(?<!\d)(\d{2})[-_.](20\d{2})(?!\d)/.exec(nome);
  const peloMes = mesAno && noPeriodo(Number(mesAno[2]), Number(mesAno[1]));
  return peloMes || datas(texto)[0] || null;
}

/** O nome com que o comprovante vai para o Drive: o "COMPROVANTE" e o banco na frente (o robô do arquivamento acha a pasta). */
export function nomeDoComprovante(nome: string, banco = ''): string {
  const n = String(nome || 'comprovante.pdf').trim();
  const b = banco && !new RegExp(banco.replace(/[^a-z0-9]/gi, '.'), 'i').test(n) ? banco.toUpperCase() + ' - ' : '';
  return /^comprovante/i.test(n) ? (b ? 'COMPROVANTE - ' + b + n : n) : 'COMPROVANTE - ' + b + n;
}
