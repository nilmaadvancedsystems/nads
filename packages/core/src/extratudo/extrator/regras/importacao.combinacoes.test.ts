// Combinações de importar, excluir mês, cortar, tirar sobreposição, reler e o movimento do extrato (semente fixa, sem dado
// de cliente). Invariantes: a soma não muda, importar de novo não muda nada, a ordem dos arquivos não muda o resultado.
import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, ArquivoLido, EmpresaExtrator, Lancamento } from '../tipos';
import { bancoDoArquivo } from './bancos';
import { caberNoBanco, empresaNova, excluirMesesDoArquivo, importar, lancamentosDe, leituraCobreOArquivo, pedacosPorMes, relerExtrato, soNovos, tirarSobreposicaoDosExtratos } from './importacao';
import { movimentoDoExtrato } from './movimento';

function sorteador(semente: number) {
  let s = semente >>> 0;
  const n = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  return { n, ate: (m: number) => Math.floor(n() * m), de: <T,>(l: readonly T[]) => l[Math.floor(n() * l.length)] };
}
const AGORA = new Date('2026-11-09T12:00:00Z');
const soma = (l: { valor: number }[]) => l.reduce((t, x) => t + x.valor, 0);
const chave = (l: Lancamento) => l.data + '|' + l.valor + '|' + l.historico;
const multiconjunto = (l: Lancamento[]) => l.map(chave).sort();
const embaralhar = <T,>(l: T[], semente: number) => { const r = sorteador(semente); const c = l.slice(); for (let i = c.length - 1; i > 0; i--) { const j = r.ate(i + 1); [c[i], c[j]] = [c[j], c[i]]; } return c; };
const ultimoDia = (mes: string) => { const [a, m] = mes.split('-').map(Number); return new Date(Date.UTC(a, m, 0)).getUTCDate(); };

/** Lançamentos de um mês: dias sorteados, com repetidos no mesmo dia e valores de 0,01 a milhões. */
function doMes(semente: number, mes: string, qtd = 25): Lancamento[] {
  const r = sorteador(semente);
  const fim = ultimoDia(mes);
  const out: Lancamento[] = [];
  for (let i = 0; i < qtd; i++) {
    const c = r.n() < 0.15 ? 1 : 1 + r.ate(10 ** (1 + r.ate(9)));
    const dia = r.n() < 0.2 ? fim : 1 + r.ate(fim);
    out.push({ data: mes + '-' + String(dia).padStart(2, '0'), valor: r.n() < 0.5 ? c : -c, historico: 'OPERACAO ' + mes + ' ' + i });
  }
  // um repetido de propósito (a mesma data, valor e histórico)
  out.push({ ...out[0] });
  return out.sort((a, b) => a.data.localeCompare(b.data));
}
const lido = (nome: string, lancamentos: Lancamento[], saldoAnterior?: number): ArquivoLido => ({ nome, lancamentos, erro: null, ...(saldoAnterior != null ? { saldoAnterior } : {}) });
const MESES = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2024-02'];
function gerarIds() { let n = 0; return () => 'a' + ++n; }
const emp = (arquivos: ArquivoImportado[]): EmpresaExtrator => ({ nome: 'X', auditoria: [], arquivos });

describe('importar', () => {
  for (const lado of ['banco', 'sistema'] as const) {
    it(lado + ': primeira grava tudo; apenas novas, de novo, não grava nada; sobrepor, de novo, fica igual', () => {
      for (let s = 1; s <= 30; s++) {
        const arquivos = MESES.map((m, i) => lido(m + '.pdf', doMes(s * 13 + i, m)));
        const r1 = importar(empresaNova('X'), lado, arquivos, 'primeira', AGORA, gerarIds());
        const todos = arquivos.flatMap(a => a.lancamentos);
        expect(r1.gravados).toBe(todos.length);
        expect(multiconjunto(lancamentosDe(r1.empresa, lado))).toEqual(multiconjunto(todos));
        const r2 = importar(r1.empresa, lado, arquivos, 'novas', AGORA, gerarIds());
        expect(r2.gravados).toBe(0);
        expect(r2.jaExistiam).toBe(todos.length);
        expect(multiconjunto(lancamentosDe(r2.empresa, lado))).toEqual(multiconjunto(todos));
        const r3 = importar(r2.empresa, lado, arquivos, 'sobrepor', AGORA, gerarIds());
        const r4 = importar(r3.empresa, lado, arquivos, 'sobrepor', AGORA, gerarIds());
        expect(multiconjunto(lancamentosDe(r4.empresa, lado))).toEqual(multiconjunto(lancamentosDe(r3.empresa, lado)));
        expect(soma(lancamentosDe(r4.empresa, lado))).toBe(soma(todos));
      }
    });
    it(lado + ': a ordem dos arquivos não muda o que fica', () => {
      for (let s = 1; s <= 20; s++) {
        const arquivos = MESES.map((m, i) => lido(m + '.pdf', doMes(s * 7 + i, m)));
        const a = importar(empresaNova('X'), lado, arquivos, 'primeira', AGORA, gerarIds());
        const b = importar(empresaNova('X'), lado, embaralhar(arquivos, s), 'primeira', AGORA, gerarIds());
        expect(multiconjunto(lancamentosDe(a.empresa, lado))).toEqual(multiconjunto(lancamentosDe(b.empresa, lado)));
      }
    });
  }
  it('apenas novas conta as repetições: dois iguais no arquivo e um guardado, entra um', () => {
    const l: Lancamento = { data: '2026-01-05', valor: 1, historico: 'RENDIMENTO' };
    expect(soNovos([l], [l, l])).toEqual([l]);
    expect(soNovos([l, l], [l, l])).toEqual([]);
    expect(soNovos([], [l, l])).toEqual([l, l]);
    expect(soNovos([{ ...l, historico: 'OUTRO' }], [l], true)).toEqual([]);
    expect(soNovos([{ ...l, historico: 'OUTRO' }], [l], false)).toEqual([l]);
  });
  it('o arquivo sem lançamento ou com erro fica de fora', () => {
    const r = importar(empresaNova('X'), 'banco', [{ nome: 'a', lancamentos: [], erro: null }, { nome: 'b', lancamentos: [{ data: '2026-01-01', valor: 1, historico: 'X' }], erro: 'ruim' }], 'primeira', AGORA, gerarIds());
    expect([r.gravados, r.arquivos, r.empresa.arquivos.length]).toEqual([0, 0, 0]);
  });
});

describe('cortar e excluir mês', () => {
  function arquivo(s: number, meses: string[], saldoAnterior = s * 1234 - 50000): ArquivoImportado {
    return { id: 'x', lado: 'banco', nome: 'x.pdf', importadoEm: AGORA.toISOString(), modo: 'primeira', banco: 'b', saldoAnterior, lancamentos: meses.flatMap((m, i) => doMes(s + i, m)) };
  }
  const MESES4 = ['2025-12', '2026-01', '2026-02', '2026-03'];
  it('pedaços por mês: a soma não muda e cada saldo anterior é o de antes mais o movimento', () => {
    for (let s = 1; s <= 40; s++) {
      const a = arquivo(s, MESES4);
      const p = pedacosPorMes(a);
      expect(p.length).toBe(4);
      expect(soma(p.flatMap(x => x.lancamentos))).toBe(soma(a.lancamentos));
      for (let i = 1; i < p.length; i++) expect(p[i].saldoAnterior).toBe((p[i - 1].saldoAnterior as number) + soma(p[i - 1].lancamentos));
    }
  });
  it('excluir um mês: o que fica tem o saldo certo e a soma dos meses que ficaram', () => {
    for (let s = 1; s <= 40; s++) {
      const a = arquivo(s, MESES4);
      const tirar = MESES4[s % 4];
      const r = excluirMesesDoArquivo(emp([a]), 'x', [tirar], AGORA);
      const ficou = r.arquivos.flatMap(x => x.lancamentos);
      expect(ficou.some(l => l.data.startsWith(tirar))).toBe(false);
      expect(soma(ficou)).toBe(soma(a.lancamentos.filter(l => !l.data.startsWith(tirar))));
      for (const p of r.arquivos) {
        const m = p.lancamentos[0].data.slice(0, 7);
        expect(p.saldoAnterior).toBe((a.saldoAnterior as number) + soma(a.lancamentos.filter(l => l.data.slice(0, 7) < m)));
      }
      // tirar tudo tira o arquivo; mês que não existe no arquivo não muda nada
      expect(excluirMesesDoArquivo(emp([a]), 'x', MESES4, AGORA).arquivos).toEqual([]);
      expect(excluirMesesDoArquivo(emp([a]), 'x', ['2020-01'], AGORA).arquivos).toEqual([a]);
    }
  });
  it('arquivo grande demais: cortado, cada pedaço cabe e nada se perde', () => {
    for (const qtd of [30000, 90000]) {
      const lancamentos: Lancamento[] = Array.from({ length: qtd }, (_, i) => ({ data: '2026-0' + (1 + (i % 3)) + '-' + String(1 + (i % 28)).padStart(2, '0'), valor: i % 2 ? i : -i - 1, historico: 'H'.repeat(30) + i }));
      const a: ArquivoImportado = { id: 'g', lado: 'sistema', nome: 'g.xls', importadoEm: AGORA.toISOString(), modo: 'primeira', saldoAnterior: 77, lancamentos };
      const p = caberNoBanco(a);
      expect(p.flatMap(x => x.lancamentos).length).toBe(qtd);
      expect(soma(p.flatMap(x => x.lancamentos))).toBe(soma(lancamentos));
      for (const x of p) expect(new TextEncoder().encode(JSON.stringify(x)).length).toBeLessThanOrEqual(700000);
      expect(new Set(p.map(x => x.id)).size).toBe(p.length);
    }
  });
});

describe('tirar a sobreposição entre extratos', () => {
  const arq = (id: string, banco: string, lancamentos: Lancamento[], extra: Partial<ArquivoImportado> = {}): ArquivoImportado => ({ id, lado: 'banco', nome: id, importadoEm: AGORA.toISOString(), modo: 'primeira', banco, lancamentos, ...extra });
  const virada = (s: number) => {
    const jan = doMes(s, '2026-01'), fev = doMes(s + 1, '2026-02');
    // a página da virada nos dois PDFs: o último dia de janeiro no de fevereiro e o primeiro de fevereiro no de janeiro
    const de31 = jan.filter(l => l.data === '2026-01-31');
    const de1 = fev.filter(l => l.data === '2026-02-01');
    return { jan, fev, a: arq('a', 'b', [...jan, ...de1]), b: arq('b', 'b', [...de31, ...fev]) };
  };
  const banco = (a: ArquivoImportado) => bancoDoArquivo(a, 'b');
  const dataEValor = (l: Lancamento[]) => l.map(x => x.data + '|' + x.valor).sort();
  it('o que estava nos dois fica uma vez só, em qualquer ordem; rodar de novo não tira mais nada', () => {
    for (let s = 1; s <= 60; s++) {
      const { jan, fev, a, b } = virada(s * 3);
      const certo = dataEValor([...jan, ...fev]);
      for (const ordem of [[a, b], [b, a]]) {
        const r = tirarSobreposicaoDosExtratos(emp(ordem), banco, AGORA);
        expect(dataEValor(r.empresa.arquivos.flatMap(x => x.lancamentos))).toEqual(certo);
        expect(tirarSobreposicaoDosExtratos(r.empresa, banco, AGORA).tirados).toBe(0);
      }
    }
  });
  it('os bancos não se misturam: o mesmo dia e valor em bancos diferentes fica nos dois', () => {
    const l = [{ data: '2026-01-05', valor: 100, historico: 'X' }];
    expect(tirarSobreposicaoDosExtratos(emp([arq('a', 'b1', l), arq('b', 'b2', l)]), a => a.banco as string, AGORA).tirados).toBe(0);
  });
  it('o razão não é tocado', () => {
    const l = [{ data: '2026-01-05', valor: 100, historico: 'X' }];
    expect(tirarSobreposicaoDosExtratos(emp([arq('a', 'b', l, { lado: 'sistema' }), arq('b', 'b', l, { lado: 'sistema' })]), banco, AGORA).tirados).toBe(0);
  });
});

describe('movimento do extrato', () => {
  const arq = (id: string, lancamentos: Lancamento[], saldoAnterior?: number, banco = 'b'): ArquivoImportado => ({ id, lado: 'banco', nome: id, importadoEm: AGORA.toISOString(), modo: 'primeira', banco, lancamentos, ...(saldoAnterior != null ? { saldoAnterior } : {}) });
  it('saldo corrido = abertura + soma, em toda competência, em qualquer ordem dos arquivos', () => {
    for (let s = 1; s <= 40; s++) {
      const meses = ['2025-12', '2026-01', '2026-02', '2026-03'];
      const ab = s % 4 === 0 ? 0 : s % 2 ? -s * 777 : s * 3333;
      const arquivos = meses.map((m, i) => arq('a' + i, doMes(s * 5 + i, m), i === 0 ? ab : undefined));
      const todos = arquivos.flatMap(a => a.lancamentos);
      for (const ordem of [arquivos, arquivos.slice().reverse(), embaralhar(arquivos, s)]) {
        for (const m of meses) {
          const r = movimentoDoExtrato(emp(ordem), 'b', 'b', m);
          const antes = soma(todos.filter(l => l.data.slice(0, 7) < m));
          const doMesM = todos.filter(l => l.data.startsWith(m));
          expect(r.abertura).toBe(ab);
          expect(r.saldoAnterior).toBe(ab + antes);
          expect(r.linhas.length).toBe(doMesM.length);
          expect(r.linhas[r.linhas.length - 1].saldo).toBe(ab + antes + soma(doMesM));
          expect(r.entradas + r.saidas).toBe(soma(doMesM));
          expect(r.mesesAntes).toBe(m !== meses[0]);
        }
      }
    }
  });
  it('sem saldo anterior: conta de zero', () => {
    const r = movimentoDoExtrato(emp([arq('a', [{ data: '2026-01-05', valor: -100, historico: 'X' }])]), 'b', 'b', '2026-01');
    expect([r.abertura, r.saldoAnterior, r.linhas[0].saldo]).toEqual([null, 0, -100]);
  });
  it('dois extratos começam no mesmo dia e só um traz o saldo anterior: ele abre a conta, em qualquer ordem', () => {
    const a = arq('a', [{ data: '2026-01-05', valor: -100, historico: 'X' }]);
    const b = arq('b', [{ data: '2026-01-05', valor: -7, historico: 'Y' }], 5000);
    for (const ordem of [[a, b], [b, a]]) expect(movimentoDoExtrato(emp(ordem), 'b', 'b', '2026-01').abertura).toBe(5000);
  });
  it('outro banco não entra na conta', () => {
    const a = arq('a', [{ data: '2026-01-05', valor: -100, historico: 'X' }], 10);
    const c = arq('c', [{ data: '2026-01-05', valor: 999, historico: 'Y' }], 77, 'outro');
    const r = movimentoDoExtrato(emp([c, a]), 'b', 'b', '2026-01');
    expect([r.abertura, r.linhas.length, r.linhas[0].saldo]).toEqual([10, 1, -90]);
  });
});

describe('reler o extrato gravado com o ano errado (o OCR leu 2026 como 2028)', () => {
  const lanc = (data: string, valor: number, historico = 'X'): Lancamento => ({ data, valor, historico });
  const velho = (id: string, lancamentos: Lancamento[], extra: Partial<ArquivoImportado> = {}): ArquivoImportado => ({ id, lado: 'banco', nome: id + '.pdf', importadoEm: '2026-10-20T17:35:30Z', modo: 'primeira', banco: 'b', leitor: 9, drive: { id: 'd', nome: 'x.pdf' }, lancamentos, ...extra });
  const novos: ArquivoLido = { nome: 'x.pdf', erro: null, saldoAnterior: 100, lancamentos: [lanc('2026-01-05', 1000, 'A'), lanc('2026-01-06', -500, 'B'), lanc('2026-01-07', 300, 'C')] };

  it('a leitura nova cobre o arquivo, mesmo sem os meses que ainda não aconteceram', () => {
    const a = velho('a', [lanc('2028-01-05', 1000), lanc('2028-01-06', -500), lanc('2028-01-07', 300), lanc('2086-01-07', 300), lanc('2086-01-08', 300), lanc('2086-01-09', 300)]);
    expect(leituraCobreOArquivo(a, novos)).toBe(true);
  });
  it('um mês real sem leitura nova continua barrando a troca', () => {
    const a = velho('a', [lanc('2025-12-05', 1000), lanc('2025-12-06', -500), lanc('2025-12-07', 300), lanc('2028-01-05', 1000)]);
    expect(leituraCobreOArquivo(a, novos)).toBe(false);
  });
  it('o arquivo só com o ano errado fica com a leitura nova, com as datas certas', () => {
    const a = velho('a', [lanc('2028-01-05', 1000), lanc('2028-01-06', -500), lanc('2086-01-07', 300)]);
    const r = relerExtrato(emp([a]), 'a', novos, AGORA);
    expect(r.arquivos[0].lancamentos.map(l => l.data)).toEqual(['2026-01-05', '2026-01-06', '2026-01-07']);
    expect(r.arquivos[0].leitor).toBeGreaterThan(9);
    expect(r.arquivos[0].saldoAnterior).toBe(100);
  });
  it('o mês certo junto com o errado: fica tudo da leitura nova, e o saldo anterior é o do PDF', () => {
    const a = velho('a', [lanc('2026-01-31', 7, 'S'), lanc('2027-12-20', 1000), lanc('2028-01-06', -500)]);
    const r = relerExtrato(emp([a]), 'a', { ...novos, lancamentos: [lanc('2025-12-31', 7, 'S'), ...novos.lancamentos] }, AGORA);
    expect(r.arquivos[0].lancamentos.map(l => l.data)).toEqual(['2025-12-31', '2026-01-05', '2026-01-06', '2026-01-07']);
    expect(r.arquivos[0].saldoAnterior).toBe(100);
  });
  it('o pedaço com o ano errado cujo movimento já está em outro extrato some, e fica no histórico', () => {
    const a = velho('a', [lanc('2028-01-05', 1000), lanc('2028-01-06', -500), lanc('2028-01-07', 300)]);
    const bom = velho('bom', novos.lancamentos.map(l => ({ ...l, historico: 'outro texto ' + l.valor })), { leitor: 12 });
    const r = relerExtrato(emp([a, bom]), 'a', novos, AGORA);
    expect(r.arquivos.map(x => x.id)).toEqual(['bom']);
    expect(r.auditoria[0].acao).toBe('Releu o extrato');
    expect(r.auditoria[0].detalhe).toContain('ano errado');
  });
  it('a leitura com erro ou vazia nunca apaga o arquivo com o ano errado', () => {
    const a = velho('a', [lanc('2028-01-05', 1000)]);
    expect(relerExtrato(emp([a]), 'a', { nome: 'x', erro: 'ruim', lancamentos: [] }, AGORA).arquivos.map(x => x.id)).toEqual(['a']);
    expect(relerExtrato(emp([a]), 'a', { nome: 'x', erro: null, lancamentos: [] }, AGORA).arquivos.map(x => x.id)).toEqual(['a']);
  });
  it('mês de verdade continua filtrando: a leitura nova que traz outro mês não entra', () => {
    const a = velho('a', [lanc('2026-01-05', 1)]);
    const r = relerExtrato(emp([a]), 'a', { ...novos, lancamentos: [lanc('2026-01-05', 1000), lanc('2026-02-05', 9)] }, AGORA);
    expect(r.arquivos[0].lancamentos.map(l => l.data)).toEqual(['2026-01-05']);
  });
  it('o lançamento da página da virada que a leitura nova traz com outro histórico fica uma vez só depois da limpeza', () => {
    const a = velho('a', [lanc('2026-01-31', 500, 'NOME NO PDF DE JANEIRO'), lanc('2026-01-20', 300, 'P')]);
    const b = velho('b', [lanc('2026-01-31', 500, 'NOME NO PDF DE FEVEREIRO')], { leitor: 12 });
    const r = relerExtrato(emp([a, b]), 'a', { nome: 'x', erro: null, lancamentos: [lanc('2026-01-31', 500, 'OUTRO TEXTO AINDA'), lanc('2026-01-20', 300, 'P')] }, AGORA);
    const limpo = tirarSobreposicaoDosExtratos(r, x => bancoDoArquivo(x, 'b'), AGORA).empresa;
    expect(limpo.arquivos.flatMap(x => x.lancamentos).map(l => l.data + '|' + l.valor).sort()).toEqual(['2026-01-20|300', '2026-01-31|500']);
  });
});
