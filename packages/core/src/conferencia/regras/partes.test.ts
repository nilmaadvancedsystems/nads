import { describe, expect, it } from 'vitest';
import { assinaturaDaLista, dividirParaGravar, juntarPartes, LIMITE_DOCUMENTO, marcadorDe, novaVersao, partesVelhas, tamanhoDoDocumento, tamanhoNoFirestore, TAMANHO_PARTE, TAMANHO_SEGURO } from './partes';

// uma nota de saída como as do posto (237): ~200 bytes no Firestore
const nota = (i: number) => ({ cfop: '5656', lanc: '00182', valor: 10 + i, numero: String(100000 + i), nome: 'CONSUMIDOR FINAL', data: '05/09/2026', desc: 'Venda de combustível ou lubrificante', doc: '', exportado: 'Sim', comp: '2026-09' });
const empresa = (saidas: number, entradas = 0) => ({
  nome: 'POSTO DE COMBUSTIVEIS BERIZAL LTDA',
  contas: [{ codigo: '10101', nome: 'Caixa', grupo: 'Ativo', dc: 'D', valor: 100, ordem: 1 }],
  saidas: Array.from({ length: saidas }, (_, i) => nota(i)),
  entradas: Array.from({ length: entradas }, (_, i) => nota(i + 1e6)),
  importHistorico: [{ ts: '2026-10-27T10:00:00Z', tipo: 'Saídas', qtd: saidas, acao: 'importado' }],
});
const ID = 'posto-de-combustiveis-berizal-ltda';

describe('tamanho no Firestore', () => {
  it('conta como o Firestore', () => {
    expect(tamanhoNoFirestore('abc')).toBe(4);
    expect(tamanhoNoFirestore('é')).toBe(3);
    expect(tamanhoNoFirestore(1.5)).toBe(8);
    expect(tamanhoNoFirestore(true)).toBe(1);
    expect(tamanhoNoFirestore(null)).toBe(1);
    expect(tamanhoNoFirestore({ a: 'x', b: [1, 2] })).toBe(2 + 2 + 2 + 16);
    expect(tamanhoNoFirestore({ a: undefined })).toBe(0);
  });
});

describe('empresa grande em partes', () => {
  it('empresa pequena: o documento inteiro, sem partes nem marcador (o conferencia.html antigo continua lendo)', () => {
    const e = empresa(100);
    const r = dividirParaGravar({ ...e, notasEmPartes: { versao: 'velha', campos: {} } }, ID, 'v1');
    expect(r.partes).toEqual([]);
    expect(r.principal.notasEmPartes).toBeUndefined();
    expect((r.principal.saidas as unknown[]).length).toBe(100);
  });

  it('o caso da 237: saídas que passariam de 1 MiB vão para partes; tudo volta igual ao juntar', () => {
    const e = empresa(12000, 300);
    expect(tamanhoDoDocumento(e, ID)).toBeGreaterThan(LIMITE_DOCUMENTO); // é isso que o banco recusava
    const r = dividirParaGravar(e, ID, 'v2');
    expect(tamanhoDoDocumento(r.principal, ID)).toBeLessThanOrEqual(TAMANHO_SEGURO);
    expect(r.principal.saidas).toEqual([]);
    expect((r.principal.entradas as unknown[]).length).toBe(300); // a lista pequena fica no principal
    expect(r.principal.contas).toEqual(e.contas);
    expect(r.partes.length).toBeGreaterThan(1);
    for (const p of r.partes) expect(tamanhoNoFirestore(p)).toBeLessThanOrEqual(TAMANHO_PARTE + 1000);
    expect(marcadorDe(r.principal)).toEqual({ versao: 'v2', campos: { saidas: { partes: r.partes.length, qtd: 12000 } } });
    const junto = juntarPartes(r.principal, [...r.partes].reverse());
    expect(junto).toEqual(e);
  });

  it('não junta pela metade: parte faltando, contagem errada ou de outra versão → espera (null)', () => {
    const r = dividirParaGravar(empresa(12000), ID, 'v3');
    expect(juntarPartes(r.principal, r.partes.slice(1))).toBeNull();
    expect(juntarPartes(r.principal, r.partes.map(p => ({ ...p, versao: 'v2' })))).toBeNull();
    const menos = r.partes.map((p, i) => (i === 0 ? { ...p, itens: p.itens.slice(1) } : p));
    expect(juntarPartes(r.principal, menos)).toBeNull();
  });

  it('apaga só as partes mais velhas que a gravação (a de outra aba, mais nova, fica)', () => {
    const v1 = novaVersao(1_000, 'aa'), v2 = novaVersao(2_000, 'bb'), v3 = novaVersao(3_000, 'cc');
    expect(v1 < v2 && v2 < v3).toBe(true);
    expect(novaVersao(1_000, 'a-b_c')).toBe('0000000rsabc');
    expect(partesVelhas(v2, [{ id: 'a', versao: v1 }, { id: 'b', versao: v2 }, { id: 'c', versao: v3 }, { id: 'd' }])).toEqual(['a', 'd']);
  });

  it('assinatura muda quando a lista muda', () => {
    const a = [nota(1), nota(2)];
    expect(assinaturaDaLista(a)).toBe(assinaturaDaLista(structuredClone(a)));
    expect(assinaturaDaLista(a)).not.toBe(assinaturaDaLista([nota(1), nota(3)]));
  });

  it('documento sem marcador junta como está', () => {
    expect(juntarPartes({ nome: 'X', saidas: [1] }, [])).toEqual({ nome: 'X', saidas: [1] });
  });
});
