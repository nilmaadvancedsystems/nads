// Gravar só o que mudou na execução (30/10/2026, revisão dos dados): a tela calcula a execução nova a partir da cópia que
// tinha (fazer, dispensar, informarValor…) e o banco regravava o documento inteiro; duas gravações seguidas a partir da
// mesma cópia (os números da conferência informados um atrás do outro) ficavam só com a última, e o "Não se aplica" ou o
// "Desmarcar", que esperam a janela de confirmação, apagavam o que tinha chegado com a janela aberta. Aqui (TypeScript
// puro) a diferença entre a cópia de onde a mudança partiu e a execução nova, campo a campo, e como pôr essa diferença
// sobre a execução como está agora. O banco grava só esses campos (dados/tarefas.firestore.ts).
import type { Execucao } from '../tipos';

/**
 * Um campo da execução que mudou. caminho: o campo (['periodo']) ou o campo e a chave dentro dele (['etapas', 'extratos'],
 * ['valores', 'fiscalXmls']). valor: põe (substitui o que estiver lá); apagar: tira; juntar/tirar: os itens de uma lista
 * (semMovimento, adicionadas, retiradas), sem mexer nos outros.
 */
export type MudancaDaExecucao =
  | { caminho: string[]; valor: unknown }
  | { caminho: string[]; apagar: true }
  | { caminho: string[]; juntar: string[] }
  | { caminho: string[]; tirar: string[] };

const ehMapa = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Igual por conteúdo (a ordem das chaves não conta: o banco devolve como quer). */
export function igualPorConteudo(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => igualPorConteudo(x, b[i]));
  }
  if (ehMapa(a) && ehMapa(b)) {
    const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b).filter(k => b[k] !== undefined);
    return ka.length === kb.length && ka.every(k => igualPorConteudo(a[k], b[k]));
  }
  return false;
}

const listaDeTexto = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');

/**
 * O que mudou de `antes` (a cópia de onde a mudança partiu) para `depois`: os mapas (etapas, valores) chave por chave, as
 * listas de texto item por item e o resto campo a campo. Vazio = nada mudou.
 */
export function diferencaDaExecucao(antes: Execucao, depois: Execucao): MudancaDaExecucao[] {
  const a = antes as unknown as Record<string, unknown>, d = depois as unknown as Record<string, unknown>;
  const mudancas: MudancaDaExecucao[] = [];
  for (const campo of [...new Set([...Object.keys(a), ...Object.keys(d)])]) {
    const va = a[campo], vd = d[campo];
    if (igualPorConteudo(va, vd)) continue;
    if ((ehMapa(va) || va === undefined) && (ehMapa(vd) || vd === undefined)) {
      const ma = va || {}, md = vd || {};
      for (const k of [...new Set([...Object.keys(ma), ...Object.keys(md)])]) {
        if (igualPorConteudo(ma[k], md[k])) continue;
        mudancas.push(md[k] === undefined ? { caminho: [campo, k], apagar: true } : { caminho: [campo, k], valor: md[k] });
      }
      continue;
    }
    if ((listaDeTexto(va) || va === undefined) && (listaDeTexto(vd) || vd === undefined)) {
      const la = va || [], ld = vd || [];
      const juntar = ld.filter(x => !la.includes(x)), tirar = la.filter(x => !ld.includes(x));
      // as duas coisas no mesmo campo não vão numa gravação só: aí a lista inteira
      if (juntar.length && tirar.length) mudancas.push({ caminho: [campo], valor: ld });
      else if (juntar.length) mudancas.push({ caminho: [campo], juntar });
      else if (tirar.length) mudancas.push({ caminho: [campo], tirar });
      // só a ordem mudou (ou a lista sumiu vazia): nada a gravar
      continue;
    }
    mudancas.push(vd === undefined ? { caminho: [campo], apagar: true } : { caminho: [campo], valor: vd });
  }
  return mudancas;
}

/** A execução como está agora com as mudanças por cima (o que o banco vai ter depois de gravar). */
export function aplicarDiferenca(atual: Execucao, mudancas: readonly MudancaDaExecucao[]): Execucao {
  const r = { ...atual } as unknown as Record<string, unknown>;
  for (const m of mudancas) {
    const [campo, chave] = m.caminho;
    if (chave !== undefined) {
      const mapa = { ...(ehMapa(r[campo]) ? r[campo] : {}) };
      if ('apagar' in m) delete mapa[chave];
      else if ('valor' in m) mapa[chave] = m.valor;
      r[campo] = mapa;
      continue;
    }
    if ('apagar' in m) delete r[campo];
    else if ('valor' in m) r[campo] = m.valor;
    else {
      const lista = listaDeTexto(r[campo]) ? r[campo] : [];
      r[campo] = 'juntar' in m ? [...lista, ...m.juntar.filter(x => !lista.includes(x))] : lista.filter(x => !m.tirar.includes(x));
    }
  }
  return r as unknown as Execucao;
}
