// Ações sobre a empresa do Extrator (funções puras: empresa → empresa nova), como na Conferência.
// Importar (primeira vez, apenas novas ou sobrepor), excluir um arquivo e o que as telas leem.
import { normalizarTexto } from '../../../formatos';
import type { ArquivoImportado, ArquivoLido, EmpresaExtrator, Lado, LancamentoDoArquivo, Lancamento, ModoImportacao, RegistroAuditoria } from '../tipos';
import { dataBR } from './texto';

export function empresaNova(nome: string): EmpresaExtrator {
  return { nome, arquivos: [], auditoria: [] };
}

/** Garante os campos (dado antigo ou incompleto). */
export function normalizarEmpresa(e: Partial<EmpresaExtrator> & { nome: string }): EmpresaExtrator {
  return {
    nome: e.nome, arquivos: Array.isArray(e.arquivos) ? e.arquivos : [], auditoria: Array.isArray(e.auditoria) ? e.auditoria : [],
    ...(Array.isArray(e.bancos) && e.bancos.length ? { bancos: e.bancos } : {}),
  };
}

/** Todos os lançamentos de um lado, com o endereço de cada um. */
export function lancamentosDe(e: EmpresaExtrator, lado: Lado): LancamentoDoArquivo[] {
  const r: LancamentoDoArquivo[] = [];
  for (const a of e.arquivos) {
    if (a.lado !== lado) continue;
    a.lancamentos.forEach((l, i) => r.push({ ...l, id: a.id + ':' + i, idArquivo: a.id, lado }));
  }
  return r;
}

/** Primeira e última data de uma lista ('aaaa-mm-dd'). */
export function periodo(l: { data: string }[]): { de: string; ate: string } | null {
  if (!l.length) return null;
  let de = l[0].data, ate = l[0].data;
  for (const x of l) { if (x.data < de) de = x.data; if (x.data > ate) ate = x.data; }
  return { de, ate };
}

export function rotuloPeriodo(p: { de: string; ate: string } | null): string {
  if (!p) return '—';
  return p.de === p.ate ? dataBR(p.de) : dataBR(p.de) + ' a ' + dataBR(p.ate);
}

/** Competências ('aaaa-mm') com lançamento, em ordem. */
export function competencias(e: EmpresaExtrator): string[] {
  const s = new Set<string>();
  for (const a of e.arquivos) for (const l of a.lancamentos) s.add(l.data.slice(0, 7));
  return [...s].sort();
}

/** Os arquivos lidos batem com o que já existe (mesmas datas ou mesmo nome)? Aí pergunta o modo. */
export function jaTemNoPeriodo(e: EmpresaExtrator, lado: Lado, lidos: ArquivoLido[]): number {
  const existentes = lancamentosDe(e, lado);
  let qtd = 0;
  for (const l of lidos) {
    const p = periodo(l.lancamentos);
    if (!p) continue;
    qtd += existentes.filter(x => x.data >= p.de && x.data <= p.ate).length;
    if (!qtd && e.arquivos.some(a => a.lado === lado && a.nome === l.nome)) qtd = 1;
  }
  return qtd;
}

const chave = (x: Lancamento) => x.data + '|' + x.valor + '|' + normalizarTexto(x.historico);

/**
 * O que de `novos` ainda não existe em `velhos` (mesma data, valor e histórico). Conta repetições:
 * dois lançamentos iguais no arquivo e um guardado → entra um.
 */
export function soNovos(velhos: Lancamento[], novos: Lancamento[]): Lancamento[] {
  const conta = new Map<string, number>();
  for (const x of velhos) conta.set(chave(x), (conta.get(chave(x)) || 0) + 1);
  return novos.filter(x => {
    const n = conta.get(chave(x)) || 0;
    if (n) { conta.set(chave(x), n - 1); return false; }
    return true;
  });
}

export interface ResultadoImportacao {
  empresa: EmpresaExtrator;
  gravados: number;
  jaExistiam: number;
  substituidos: number;
  arquivos: number;
}

/**
 * Importa os arquivos lidos (os que têm erro ou nenhum lançamento ficam de fora).
 * - primeira: grava tudo;
 * - novas: grava só o que ainda não existe no lado (soNovos), arquivo sem nada novo não entra;
 * - sobrepor: apaga o que existe nas datas dos arquivos novos e grava tudo.
 * `ids` dá o id de cada arquivo novo (quem chama decide: relógio, contador…).
 */
export function importar(e: EmpresaExtrator, lado: Lado, lidos: ArquivoLido[], modo: ModoImportacao | 'primeira', agora: Date, ids: () => string): ResultadoImportacao {
  const bons = lidos.filter(l => !l.erro && l.lancamentos.length);
  let arquivos = e.arquivos.slice();
  let substituidos = 0;
  if (modo === 'sobrepor') {
    const faixas = bons.map(l => periodo(l.lancamentos)!);
    const dentro = (d: string) => faixas.some(f => d >= f.de && d <= f.ate);
    arquivos = arquivos
      .map(a => {
        if (a.lado !== lado) return a;
        const fica = a.lancamentos.filter(x => !dentro(x.data));
        substituidos += a.lancamentos.length - fica.length;
        return fica.length === a.lancamentos.length ? a : { ...a, lancamentos: fica };
      })
      .filter(a => a.lancamentos.length);
  }
  let base: Lancamento[] = modo === 'novas' ? arquivos.filter(a => a.lado === lado).flatMap(a => a.lancamentos) : [];
  let gravados = 0, jaExistiam = 0, novosArquivos = 0;
  for (const l of bons) {
    let lanc = l.lancamentos;
    if (modo === 'novas') {
      const nv = soNovos(base, lanc);
      jaExistiam += lanc.length - nv.length;
      base = base.concat(nv);
      lanc = nv;
    }
    if (!lanc.length) continue;
    const a: ArquivoImportado = { id: ids(), lado, nome: l.nome, importadoEm: agora.toISOString(), modo, lancamentos: lanc };
    arquivos.push(a);
    gravados += lanc.length;
    novosArquivos++;
  }
  const detalhe = bons.map(l => l.nome).join(', ') + ' · ' + gravados + ' gravado(s)' +
    (jaExistiam ? ' · ' + jaExistiam + ' já existiam' : '') + (substituidos ? ' · ' + substituidos + ' substituído(s)' : '') +
    (modo === 'novas' ? ' · apenas novas' : modo === 'sobrepor' ? ' · sobreposto' : '');
  const reg: RegistroAuditoria = { ts: agora.toISOString(), acao: lado === 'banco' ? 'Importou extrato' : 'Importou lançamentos do sistema', detalhe, tom: 'ok' };
  return { empresa: { ...e, arquivos, auditoria: [reg, ...e.auditoria] }, gravados, jaExistiam, substituidos, arquivos: novosArquivos };
}

export function excluirArquivo(e: EmpresaExtrator, id: string, agora: Date): EmpresaExtrator {
  const a = e.arquivos.find(x => x.id === id);
  if (!a) return e;
  const reg: RegistroAuditoria = {
    ts: agora.toISOString(), acao: 'Excluiu arquivo', tom: 'bad',
    detalhe: (a.lado === 'banco' ? 'Extrato: ' : 'Sistema: ') + a.nome + ' · ' + a.lancamentos.length + ' lançamento(s)',
  };
  return { ...e, arquivos: e.arquivos.filter(x => x.id !== id), auditoria: [reg, ...e.auditoria] };
}

/** Auditoria, mais novo primeiro. */
export function linhasAuditoria(e: EmpresaExtrator): RegistroAuditoria[] {
  return e.auditoria.slice().sort((a, b) => b.ts.localeCompare(a.ts));
}
