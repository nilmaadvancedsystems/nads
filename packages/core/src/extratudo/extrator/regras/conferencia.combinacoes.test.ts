// Combinações da conferência extrato × razão, do banco no período e do cheque especial (semente fixa, sem dado de cliente).
import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, EmpresaExtrator, Lancamento, LancamentoDoArquivo } from '../tipos';
import { lancamentosDoChequeEspecial } from './chequeEspecial';
import { conferir, totais } from './conferencia';
import { conferenciaDoBanco, chequeEspecialNoRazao, situacaoDoBancoNoPeriodo } from './situacaoDoBanco';

function sorteador(semente: number) {
  let s = semente >>> 0;
  const n = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  return { n, ate: (m: number) => Math.floor(n() * m), de: <T,>(l: readonly T[]) => l[Math.floor(n() * l.length)] };
}
const soma = (l: { valor: number }[]) => l.reduce((t, x) => t + x.valor, 0);
const doArq = (l: Lancamento[], lado: 'banco' | 'sistema'): LancamentoDoArquivo[] => l.map((x, i) => ({ ...x, id: lado + ':' + i, idArquivo: lado, lado }));
const ultimoDia = (mes: string) => { const [a, m] = mes.split('-').map(Number); return new Date(Date.UTC(a, m, 0)).getUTCDate(); };
function doMes(semente: number, mes: string, qtd = 30): Lancamento[] {
  const r = sorteador(semente);
  const fim = ultimoDia(mes);
  return Array.from({ length: qtd }, (_, i) => {
    const c = r.n() < 0.1 ? 1 : 1 + r.ate(10 ** (1 + r.ate(8)));
    return { data: mes + '-' + String(1 + r.ate(fim)).padStart(2, '0'), valor: r.n() < 0.5 ? c : -c, historico: 'CLIENTE ALFA ' + i + ' PAGAMENTO ' + (i % 5) };
  }).sort((a, b) => a.data.localeCompare(b.data));
}
const arq = (id: string, lado: 'banco' | 'sistema', banco: string, lancamentos: Lancamento[], saldoAnterior?: number): ArquivoImportado => ({ id, lado, nome: id, importadoEm: '2026-11-09T12:00:00Z', modo: 'primeira', banco, lancamentos, ...(saldoAnterior != null ? { saldoAnterior } : {}) });
const emp = (arquivos: ArquivoImportado[]): EmpresaExtrator => ({ nome: 'X', auditoria: [], arquivos });

describe('conferir', () => {
  it('cada lançamento em uma linha só, com a soma dos dois lados preservada', () => {
    for (let s = 1; s <= 60; s++) {
      const r = sorteador(s);
      const ext = doMes(s, '2026-02');
      const raz = ext.map(l => {
        const x = r.n();
        return x < 0.1 ? { ...l, valor: l.valor + 1 + r.ate(1000) } : x < 0.2 ? { ...l, data: '2026-02-' + String(1 + r.ate(28)).padStart(2, '0') } : x < 0.3 ? { ...l, valor: -l.valor } : l;
      }).filter(() => r.n() > 0.1);
      raz.push({ data: '2026-02-10', valor: -123, historico: 'SO NO RAZAO' });
      const c = conferir(doArq(ext, 'banco'), doArq(raz, 'sistema'));
      const usadosE = c.linhas.filter(l => l.extrato).map(l => l.extrato!.id);
      const usadosR = c.linhas.filter(l => l.sistema).map(l => l.sistema!.id);
      expect(new Set(usadosE).size).toBe(usadosE.length);
      expect(new Set(usadosR).size).toBe(usadosR.length);
      expect(usadosE.length).toBe(ext.length);
      expect(usadosR.length).toBe(raz.length);
      const contagem = c.linhas.reduce<Record<string, number>>((t, l) => ({ ...t, [l.situacao]: (t[l.situacao] || 0) + 1 }), {});
      for (const k of Object.keys(contagem)) expect(c.contagem[k as 'ok']).toBe(contagem[k]);
    }
  });
  it('extrato igual ao razão: tudo conferido', () => {
    for (let s = 1; s <= 40; s++) {
      const ext = doMes(s, '2026-01');
      const c = conferir(doArq(ext, 'banco'), doArq(ext, 'sistema'));
      expect([c.contagem.ok, c.contagem.faltando, c.contagem.amais, c.contagem.diferente, c.contagem.duplicado, c.sistemaInvertido]).toEqual([ext.length, 0, 0, 0, 0, false]);
    }
  });
  it('razão com todos os sinais trocados: inverte e confere', () => {
    for (let s = 1; s <= 40; s++) {
      const ext = doMes(s, '2026-01');
      const c = conferir(doArq(ext, 'banco'), doArq(ext.map(l => ({ ...l, valor: -l.valor })), 'sistema'));
      expect([c.sistemaInvertido, c.contagem.ok]).toEqual([true, ext.length]);
    }
  });
  it('a ordem das linhas de entrada não muda o resultado', () => {
    for (let s = 1; s <= 40; s++) {
      const ext = doMes(s, '2026-03');
      const raz = ext.slice(0, -3).concat({ data: '2026-03-15', valor: 77, historico: 'A MAIS' });
      const a = conferir(doArq(ext, 'banco'), doArq(raz, 'sistema'));
      const b = conferir(doArq(ext.slice().reverse(), 'banco'), doArq(raz.slice().reverse(), 'sistema'));
      expect(b.contagem, 'semente ' + s).toEqual(a.contagem);
    }
  });
  it('a conferência guarda a contrapartida e o texto do banco do razão', () => {
    const raz: LancamentoDoArquivo[] = [{ id: 's:0', idArquivo: 's', lado: 'sistema', data: '2026-01-05', valor: 100, historico: 'Fornecedor', conta: '123', complemento: 'PIX FULANO' }];
    const c = conferir(doArq([{ data: '2026-01-05', valor: 100, historico: 'PIX' }], 'banco'), raz);
    expect([c.linhas[0].sistema?.conta, c.linhas[0].sistema?.complemento]).toEqual(['123', 'PIX FULANO']);
    const so = conferir([], raz);
    expect([so.linhas[0].sistema?.conta, so.linhas[0].sistema?.complemento]).toEqual(['123', 'PIX FULANO']);
  });
  it('totais: entradas + saídas = líquido, sem erro de arredondamento', () => {
    for (let s = 1; s <= 30; s++) {
      const l = doMes(s, '2026-01', 200);
      const t = totais(l);
      expect(t.entradas + t.saidas).toBe(t.liquido);
      expect(t.liquido).toBe(soma(l));
      expect(Number.isInteger(t.liquido)).toBe(true);
    }
  });
});

describe('cheque especial do banco: gerar, lançar no razão e conferir', () => {
  const CB = '1.1', CC = '2.1';
  /** o ajuste e o estorno como linhas do razão (ajuste: D banco = entrada), em centavos sem erro */
  const comoRazao = (l: { data: Date; debito: string; credito: string; valor: number; historico: string }): Lancamento => {
    const iso = l.data.getFullYear() + '-' + String(l.data.getMonth() + 1).padStart(2, '0') + '-' + String(l.data.getDate()).padStart(2, '0');
    const c = Math.round(l.valor * 100);
    expect(Math.abs(l.valor * 100 - c)).toBeLessThan(1e-6);
    return { data: iso, valor: l.debito === CB ? c : -c, historico: 'CHEQUE ESPECIAL ' + l.historico };
  };
  /** extrato em que o saldo oscila em volta de zero: dias negativos, zero exato, negativo nas pontas */
  function extrato(semente: number, meses: string[]): { ext: Lancamento[]; abertura: number } {
    const r = sorteador(semente);
    const ext: Lancamento[] = [];
    const abertura = r.n() < 0.5 ? -(1 + r.ate(50000)) : r.ate(50000);
    let saldo = abertura;
    for (const m of meses) {
      for (let d = 1; d <= ultimoDia(m); d += 1 + r.ate(3)) {
        const data = m + '-' + String(d).padStart(2, '0');
        const n = 1 + r.ate(3);
        for (let i = 0; i < n; i++) {
          // às vezes zera o saldo no centavo; às vezes joga para o negativo
          const v = r.n() < 0.12 && saldo !== 0 ? -saldo : (r.n() < 0.5 ? 1 : -1) * (1 + r.ate(80000));
          if (!v) continue;
          ext.push({ data, valor: v, historico: 'OPERACAO ' + data + ' ' + i });
          saldo += v;
        }
      }
    }
    return { ext, abertura };
  }
  const mesesCasos = [['2026-01'], ['2026-02'], ['2024-02'], ['2025-12', '2026-01'], ['2026-01', '2026-02', '2026-03']];

  it('o razão com o ajuste e o estorno gerados fica ok, sem pendência', () => {
    for (let s = 1; s <= 80; s++) {
      const meses = mesesCasos[s % mesesCasos.length];
      const { ext, abertura } = extrato(s * 31, meses);
      const e0 = emp([arq('e', 'banco', 'b', ext, abertura), arq('r', 'sistema', 'b', ext)]);
      const antes = conferenciaDoBanco(e0, 'b', 'b', meses);
      expect(antes.completo).toBe(true);
      expect(antes.pendencias).toEqual([]);
      if (!antes.faltamCheque.length) continue;
      const gerados = lancamentosDoChequeEspecial(e0, 'b', 'b', meses, antes.faltamCheque, CB, CC);
      const ajustes = gerados.filter(l => l.tipo === 'Ajuste'), estornos = gerados.filter(l => l.tipo === 'Estorno');
      expect(ajustes.length).toBe(antes.faltamCheque.length);
      expect(estornos.length).toBe(ajustes.length);
      // ajuste + estorno somam zero, e cada ajuste é o saldo negativo do dia
      expect(soma(gerados.map(comoRazao))).toBe(0);
      expect(ajustes.map(a => Math.round(a.valor * 100)).sort((x, y) => x - y)).toEqual(antes.faltamCheque.map(f => -f.saldo).sort((x, y) => x - y));
      const fimDoPeriodo = meses[meses.length - 1];
      const razao = [...ext, ...gerados.map(comoRazao).filter(l => l.data.slice(0, 7) <= fimDoPeriodo)];
      const e1 = emp([arq('e', 'banco', 'b', ext, abertura), arq('r', 'sistema', 'b', razao.sort((a, b) => a.data.localeCompare(b.data)))]);
      const depois = conferenciaDoBanco(e1, 'b', 'b', meses);
      expect(depois.pendencias.flatMap(p => p.linhas.map(l => l.situacao + ' ' + l.data)), 'semente ' + s).toEqual([]);
      expect(depois.faltamCheque.map(f => f.data), 'semente ' + s).toEqual([]);
      expect(situacaoDoBancoNoPeriodo(e1, 'b', 'b', meses).tipo).toBe('ok');
    }
  });
  it('saldo zero exato não pede cheque; negativo de 0,01 pede', () => {
    const l = [{ data: '2026-01-05', valor: -1000, historico: 'A' }, { data: '2026-01-06', valor: -1, historico: 'B' }, { data: '2026-01-07', valor: 1, historico: 'C' }];
    const e = emp([arq('e', 'banco', 'b', l, 1000), arq('r', 'sistema', 'b', l)]);
    expect(conferenciaDoBanco(e, 'b', 'b', ['2026-01']).negativos).toEqual([{ data: '2026-01-06', saldo: -1 }]);
  });
  it('sem saldo anterior, sem negativo inventado; mês faltando não dá ok', () => {
    const l = [{ data: '2026-01-05', valor: 1000, historico: 'A' }];
    const e = emp([arq('e', 'banco', 'b', l), arq('r', 'sistema', 'b', l)]);
    expect(conferenciaDoBanco(e, 'b', 'b', ['2026-01']).negativos).toEqual([]);
    expect(conferenciaDoBanco(e, 'b', 'b', ['2026-01', '2026-02']).completo).toBe(false);
    expect(conferenciaDoBanco(emp([arq('e', 'banco', 'b', l)]), 'b', 'b', ['2026-01']).completo).toBe(false);
  });
  it('vários bancos: o cheque de um não cobre o outro', () => {
    const ext = [{ data: '2026-01-28', valor: -1000, historico: 'A' }];
    const c = { data: '2026-01-28', valor: 1000, historico: 'CHEQUE ESPECIAL 92029' };
    const e = emp([arq('e1', 'banco', 'b1', ext), arq('r1', 'sistema', 'b1', [...ext, c]), arq('e2', 'banco', 'b2', ext), arq('r2', 'sistema', 'b2', ext)]);
    expect(conferenciaDoBanco(e, 'b1', 'b1', ['2026-01']).faltamCheque).toEqual([]);
    expect(conferenciaDoBanco(e, 'b2', 'b1', ['2026-01']).faltamCheque.map(f => f.saldo)).toEqual([-1000]);
  });
  it('ajustes repetidos do mesmo valor em dias seguidos: cada um com o seu estorno', () => {
    const neg = [{ data: '2026-01-05', saldo: -500 }, { data: '2026-01-06', saldo: -500 }, { data: '2026-01-07', saldo: -500 }];
    const sobras = doArq([
      { data: '2026-01-05', valor: 500, historico: 'A' }, { data: '2026-01-06', valor: -500, historico: 'E' }, { data: '2026-01-06', valor: 500, historico: 'A' },
      { data: '2026-01-07', valor: -500, historico: 'E' }, { data: '2026-01-07', valor: 500, historico: 'A' }, { data: '2026-01-08', valor: -500, historico: 'E' },
    ], 'sistema');
    const r = chequeEspecialNoRazao(neg, sobras, '2026-01-31');
    expect([r.linhas.size, r.cobertos.size]).toEqual([6, 3]);
  });
  it('o que o razão lançou e estornou no mesmo dia só se anula na mesma contrapartida', () => {
    const base = { data: '2026-01-05', historico: 'X' };
    // três iguais: o razão com contrapartida (Alterdata) só não é tratado como invertido quando o próprio arquivo mostra
    const extrato = [1000, 2000, 3000].map(valor => ({ data: '2026-01-05', valor, historico: 'PIX ' + valor }));
    const r = (conta1: string, conta2: string): Lancamento[] => [...extrato, { ...base, valor: 700, historico: 'TED', conta: conta1 }, { ...base, valor: -700, historico: 'DEV TED', conta: conta2 }];
    const pendentes = (raz: Lancamento[]) => conferenciaDoBanco(emp([arq('e', 'banco', 'b', extrato), arq('r', 'sistema', 'b', raz)]), 'b', 'b', ['2026-01']).pendencias.flatMap(p => p.linhas).length;
    expect(pendentes(r('100', '100'))).toBe(0);
    expect(pendentes(r('100', '200'))).toBe(2);
  });
  it('o cheque especial só no complemento (o razão do Alterdata: o histórico é o nome da conta) conta como cheque especial', () => {
    const extrato = [{ data: '2026-01-05', valor: 1000, historico: 'PIX' }, { data: '2026-01-06', valor: 2000, historico: 'TED' }, { data: '2026-01-20', valor: -10, historico: 'TARIFA' }];
    const par: Lancamento[] = [{ data: '2026-01-10', valor: 300, historico: 'Bancos Conta Movimento', complemento: 'CHEQUE ESPECIAL ajuste', conta: '500' }, { data: '2026-01-12', valor: -300, historico: 'Bancos Conta Movimento', complemento: 'CHEQUE ESPECIAL estorno', conta: '500' }];
    const r = conferenciaDoBanco(emp([arq('e', 'banco', 'b', extrato), arq('r', 'sistema', 'b', [...extrato, ...par])]), 'b', 'b', ['2026-01']);
    expect(r.pendencias).toEqual([]);
  });
});
