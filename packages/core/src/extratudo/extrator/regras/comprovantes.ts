// Os comprovantes na Importação (Vitor, 26/10/2026: "quero baixar os comprovantes usando o algoritmo de buscar no Gmail… onde
// eu consigo puxar e visualizar"). O robô do arquivamento guarda cada comprovante em CONTÁBIL/EXTRATOS/<ano>/<mês>/COMPROVANTES
// (robo/arquivador-regras.js: a pasta COMPROVANTES do tipo COMPROVANTE); aqui, achar no mapa da pasta do cliente os de cada mês
// e o nome com que o comprovante vai para o Drive (o robô reconhece pelo conteúdo; o "COMPROVANTE" no nome ajuda).
import { nomeNorm } from '../../../formatos';
import type { ItemDrive } from '../../creditor/regras/drive';

/** Um comprovante que está no Drive. */
export interface ComprovanteNoDrive { id: string; nome: string; tamanho?: number; em?: string }

/**
 * Os comprovantes de cada mês ('aaaa-mm') na pasta do cliente: os arquivos de CONTÁBIL/EXTRATOS/<ano>/<mês>/COMPROVANTES (com
 * as subpastas). O mês pode ser "02" ou "02-2026"; sem a pasta, o mês fica vazio.
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
  const arquivos = (p: string): ItemDrive[] => (filhos.get(p) || []).flatMap(it => (it.t === 'd' ? arquivos(it.i) : [it]));
  for (const m of meses) {
    const [ano, mes] = m.split('-').map(Number);
    const doAno = pastas(extratos.i).find(it => nomeNorm(it.n).startsWith(String(ano)));
    const doMes = doAno && pastas(doAno.i).find(it => { const x = /^(\d{1,2})(\D|$)/.exec(it.n.trim()); return !!x && Number(x[1]) === mes; });
    const comp = doMes && pastas(doMes.i).find(it => nomeNorm(it.n) === 'comprovantes');
    if (!comp) continue;
    out[m] = arquivos(comp.i)
      .map(it => ({ id: it.i, nome: it.n, ...(it.s != null ? { tamanho: it.s } : {}), ...(it.m ? { em: it.m } : {}) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  return out;
}

/** O nome com que o comprovante vai para o Drive (o "COMPROVANTE" na frente, uma vez só). */
export function nomeDoComprovante(nome: string): string {
  const n = String(nome || 'comprovante.pdf').trim();
  return /^comprovante/i.test(n) ? n : 'COMPROVANTE - ' + n;
}
