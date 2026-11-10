// Testes combinatórios da etapa Clientes/Fornecedores: laços determinísticos (semente fixa), dados fictícios. Cruzam o balancete
// dinâmico em todos os formatos de número e de sinal com o razão (parcial, adiantamento, virada de ano, fora de ordem) e o
// fechamento. Invariantes: nenhum centavo com erro, soma do detalhe = total, nada perdido ou duplicado, independe da ordem.
import { vi, describe, expect, it } from 'vitest';
import type { LancamentoDoRazao, RazaoDaConta } from '../../tarefas/regras/razao';
import {
  adiantamentoNoDinamico, chaveDoItem, clientesDoDinamico, comBaixa, comLancamentoDigitado, conferirFechamento, conferirRazaoDoCliente, credoresNoPeriodo, dinamicoDoRobo,
  faltaDaNota, lerBalanceteDinamico, mesesFaltandoNoRazao, razaoDaMarca, razoesPedidos, resultadoErradoNoDinamico, semLancamentoDigitado, sugestoesDeBaixa, temContaDebaixo,
  textoDaMensagem, tipoDoRazao, type BalanceteDinamico, type ContaDoBalanceteDoRobo, type LadoDaConta, type LancamentoDoBanco, type LinhaDinamico,
} from './index';

// laços com milhares de combinações: com a suíte inteira rodando, os 5 s de sempre não bastam
vi.setConfig({ testTimeout: 60000 });

function semente(inicial: number): () => number {
  let s = inicial | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Sorte = () => number;
const entre = (r: Sorte, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const um = <T,>(r: Sorte, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
function embaralhar<T>(r: Sorte, xs: readonly T[]): T[] {
  const o = [...xs];
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}
/** valores em centavos: de R$ 0,01 a milhões, com os que dão erro de ponto flutuante (0,07 · 100 etc.) */
const CENTAVOS = [1, 2, 7, 29, 57, 99, 100, 101, 1005, 1115, 123456, 99999, 100000, 1000001, 123456789, 999999999];
const proximoMes = (m: string) => { const [a, x] = m.split('-').map(Number); return x === 12 ? (a + 1) + '-01' : a + '-' + String(x + 1).padStart(2, '0'); };
const mesesDesde = (m: string, n: number) => { const o = [m]; while (o.length < n) o.push(proximoMes(o[o.length - 1])); return o; };
const mesNoCabecalho = (m: string) => m.slice(5) + '/' + m.slice(0, 4);

// ─── o dinâmico gerado ───────────────────────────────────────────────────────

interface ContaGerada { codigo: string; classificacao: string; descricao: string; ant: number; c: Record<string, number> }

const NOMES = ['MERCADO BOM PREÇO LTDA', 'JOÃO & FILHOS', 'AÇOUGUE SÃO JOSÉ', 'MERCADO BOM PREÇO LTDA', 'ANA  MARIA   SOUZA', 'PADARIA ÁGUA BOA ME', 'Comércio Ítalo Ltda'];

/** Um plano que fecha em cada mês (centavos, devedor +, credor −): clientes e fornecedores em qualquer lado, as sintéticas somadas. */
function planoFechado(r: Sorte, meses: readonly string[]): ContaGerada[] {
  const nClientes = entre(r, 1, 8), nFornecedores = entre(r, 1, 8);
  const analiticas: ContaGerada[] = [];
  const conta = (codigo: string, classificacao: string, descricao: string, f: () => number): ContaGerada => {
    const c: ContaGerada = { codigo, classificacao, descricao, ant: f(), c: Object.fromEntries(meses.map(m => [m, f()])) };
    analiticas.push(c);
    return c;
  };
  // o saldo do lado certo, do errado ou zerado
  const saldo = (certo: 1 | -1) => () => { const k = r(); return k < 0.25 ? 0 : (k < 0.45 ? -certo : certo) * um(r, CENTAVOS); };
  for (let i = 1; i <= nClientes; i++) conta('11' + String(i).padStart(3, '0'), '1.1.2.01.' + String(i).padStart(3, '0'), um(r, NOMES), saldo(1));
  for (let i = 1; i <= nFornecedores; i++) conta('21' + String(i).padStart(3, '0'), '2.1.1.01.' + String(i).padStart(3, '0'), um(r, NOMES), saldo(-1));
  conta('10101', '1.1.1.01.001', 'Caixa Geral', () => 900000000000 + entre(r, 0, 99999));
  conta('31101', '3.1.1.01.001', 'Venda de Serviços', () => -(500000000 + entre(r, 1, 99999)));
  conta('41101', '4.1.1.01.001', 'Aluguéis', () => entre(r, 1, 99999999));
  // o patrimônio líquido fecha cada mês e o saldo anterior
  const soma = (f: (c: ContaGerada) => number) => analiticas.reduce((t, c) => t + f(c), 0);
  analiticas.push({ codigo: '24101', classificacao: '2.4.1.01.001', descricao: 'Lucros acumulados', ant: -soma(c => c.ant), c: Object.fromEntries(meses.map(m => [m, -soma(c => c.c[m])])) });
  const sinteticas: [string, string, string][] = [
    ['1', '1', 'ATIVO'], ['111', '1.1.1', 'DISPONÍVEL'], ['1101', '1.1.1.01', 'CAIXA E EQUIVALENTES'], ['112', '1.1.2', 'CRÉDITOS'], ['1150', '1.1.2.01', 'CLIENTES'],
    ['2', '2', 'PASSIVO'], ['2110', '2.1.1', 'CIRCULANTE'], ['2111', '2.1.1.01', 'FORNECEDORES'], ['2400', '2.4.1', 'PATRIMÔNIO LÍQUIDO'], ['2401', '2.4.1.01', 'RESERVAS'],
    ['3', '3', 'RECEITAS'], ['311', '3.1.1', 'OPERACIONAIS'], ['3111', '3.1.1.01', 'MERCADO INTERNO'],
    ['4', '4', 'CUSTOS E DESPESAS'], ['411', '4.1.1', 'ADMINISTRATIVAS'], ['4111', '4.1.1.01', 'OCUPAÇÃO'],
  ];
  const com = (cl: string, f: (c: ContaGerada) => number) => analiticas.filter(c => c.classificacao.startsWith(cl + '.')).reduce((t, c) => t + f(c), 0);
  const todas = [...analiticas, ...sinteticas.map(([codigo, classificacao, descricao]): ContaGerada => ({
    codigo, classificacao, descricao, ant: com(classificacao, c => c.ant), c: Object.fromEntries(meses.map(m => [m, com(classificacao, c => c.c[m])])),
  }))];
  return todas.sort((a, b) => a.classificacao.localeCompare(b.classificacao, 'pt-BR', { numeric: true }));
}

const milhar = (centavos: number, sepMilhar: string, sepDec: string) => {
  const inteiro = String(Math.floor(Math.abs(centavos) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, sepMilhar);
  return inteiro + sepDec + String(Math.abs(centavos) % 100).padStart(2, '0');
};
const sinalNaFrente = (c: number, s: string) => (c < 0 ? '-' + s : s);
/** o mesmo valor de todos os jeitos que a planilha pode trazer (com raw: false, o número sai como o formato da célula manda) */
const FORMATOS: Record<string, (c: number) => unknown> = {
  numero: c => c / 100,
  pontoCru: c => sinalNaFrente(c, String(Math.abs(c) / 100)),
  br: c => sinalNaFrente(c, milhar(c, '.', ',')),
  brSemMilhar: c => sinalNaFrente(c, milhar(c, '', ',')),
  enUS: c => sinalNaFrente(c, milhar(c, ',', '.')),
  parenteses: c => (c < 0 ? '(' + milhar(c, '.', ',') + ')' : milhar(c, '.', ',')),
  parentesesEn: c => (c < 0 ? '(' + milhar(c, ',', '.') + ')' : milhar(c, ',', '.')),
  menosNoFim: c => milhar(c, '.', ',') + (c < 0 ? '-' : ''),
  reais: c => sinalNaFrente(c, 'R$ ' + milhar(c, '.', ',')),
  reaisDepois: c => (c < 0 ? 'R$ -' : 'R$ ') + milhar(c, '.', ','),
  dc: c => milhar(c, '.', ',') + (c < 0 ? ' C' : ' D'),
  espacoDuro: c => sinalNaFrente(c, milhar(c, '.', ',')) + ' ',
};
type ModoDoSinal = 'sempre' | 'natureza' | 'invertido';
const noModo = (modo: ModoDoSinal, cl: string, v: number) => (modo === 'invertido' ? -v : modo === 'natureza' && /^[23]/.test(cl) ? -v : v);

function linhasDaPlanilha(r: Sorte, contas: readonly ContaGerada[], meses: readonly string[], modo: ModoDoSinal, fmt: (c: number) => unknown, comAnterior: boolean, ordemDosMeses: readonly string[]): unknown[][] {
  const celula = (cl: string, v: number) => fmt(noModo(modo, cl, v));
  void meses; void r;
  return [
    ['Relatório fictício'], [],
    ['Código', 'Classificação', 'Descrição', ...(comAnterior ? ['Saldo Anterior'] : []), ...ordemDosMeses.map(mesNoCabecalho)],
    ...contas.map(c => [c.codigo, c.classificacao, c.descricao, ...(comAnterior ? [celula(c.classificacao, c.ant)] : []), ...ordemDosMeses.map(m => celula(c.classificacao, c.c[m]))]),
    ['', '', 'TOTAIS', 1, 2],
  ];
}

const semMenosZero = (v: number) => expect(Object.is(v, -0)).toBe(false);

describe('o balancete dinâmico em todos os formatos', () => {
  const modos: ModoDoSinal[] = ['sempre', 'natureza', 'invertido'];
  const nomesDosFormatos = Object.keys(FORMATOS);
  for (const modo of modos) {
    for (const f of nomesDosFormatos) {
      it(modo + ' × ' + f + ': cada saldo no centavo, sem perder conta', () => {
        for (let seed = 1; seed <= 12; seed++) {
          const r = semente(seed * 7919 + modos.indexOf(modo));
          const meses = mesesDesde(um(r, ['2025-11', '2025-12', '2026-01', '2026-09']), entre(r, 1, 14));
          const contas = planoFechado(r, meses);
          const comAnterior = r() < 0.7;
          const ordem = r() < 0.4 ? embaralhar(r, meses) : meses;
          const d = lerBalanceteDinamico(linhasDaPlanilha(r, contas, meses, modo, FORMATOS[f], comAnterior, ordem));
          expect(d.meses).toEqual(meses);
          expect(d.linhas.map(l => l.codigo)).toEqual(contas.map(c => c.codigo));
          d.linhas.forEach((l, i) => {
            const g = contas[i];
            expect(l.saldoAnterior).toBe(comAnterior ? g.ant / 100 : 0);
            semMenosZero(l.saldoAnterior);
            for (const m of meses) { expect(l.saldos[m], g.descricao + ' ' + m).toBe(g.c[m] / 100); semMenosZero(l.saldos[m]); }
          });
        }
      });
    }
  }

  it('os traços e o que não é número valem zero; "1.234.567" (milhar, sem centavos) não vira zero', () => {
    const cab = ['Código', 'Classificação', 'Descrição', '01/2026'];
    const d = lerBalanceteDinamico([cab, ['1', '1.1', 'A', '-'], ['2', '1.2', 'B', ' - '], ['3', '1.3', 'C', 'n/d'], ['4', '1.4', 'D', '1.234.567'], ['5', '1.5', 'E', '1.234'], ['6', '1.6', 'F', '1234.5'], ['7', '1.7', 'G', '0,07']]);
    expect(d.linhas.map(l => l.saldos['2026-01'])).toEqual([0, 0, 0, 1234567, 1234, 1234.5, 0.07]);
  });

  it('número da planilha com erro de ponto flutuante chega limpo', () => {
    const d = lerBalanceteDinamico([['Código', 'Classificação', 'Descrição', 'Saldo Anterior', '01/2026'], ['1', '1.1', 'A', 0.1 + 0.2, 1234.5600000000002]]);
    expect(d.linhas[0].saldoAnterior).toBe(0.3);
    expect(d.linhas[0].saldos['2026-01']).toBe(1234.56);
  });

  it('o mês no cabeçalho como data do Excel (número de série ou Date) e mês inválido fora', () => {
    const jan26 = 46023, fev26 = 46054;
    const d = lerBalanceteDinamico([['Código', 'Classificação', 'Descrição', jan26, new Date(2026, 1, 15), '13/2026'], ['1', '1.1', 'A', 10, 20, 30]]);
    expect(d.meses).toEqual(['2026-01', '2026-02']);
    expect(d.linhas[0].saldos).toEqual({ '2026-01': 10, '2026-02': 20 });
    const so = lerBalanceteDinamico([['Código', 'Classificação', 'Descrição', fev26], ['1', '1.1', 'A', 5]]);
    expect(so.meses).toEqual(['2026-02']);
  });

  it('mês repetido no cabeçalho não duplica o mês', () => {
    const d = lerBalanceteDinamico([['Código', 'Classificação', 'Descrição', '01/2026', '01/2026'], ['1', '1.1', 'A', 10, 10]]);
    expect(d.meses).toEqual(['2026-01']);
  });

  it('sem cabeçalho ou sem mês: erro, não um balancete vazio', () => {
    expect(() => lerBalanceteDinamico([['a', 'b']])).toThrow(/cabeçalho/);
    expect(() => lerBalanceteDinamico([['Código', 'Classificação', 'Descrição', 'Janeiro']])).toThrow(/meses/);
  });
});

describe('clientes e fornecedores do dinâmico', () => {
  it('sintética × analítica, nomes repetidos, soma do detalhe = sintética, credores e fechamento', () => {
    for (let seed = 1; seed <= 120; seed++) {
      const r = semente(seed);
      const meses = mesesDesde(um(r, ['2025-10', '2025-12', '2026-01']), entre(r, 1, 13));
      const contas = planoFechado(r, meses);
      const d = lerBalanceteDinamico(linhasDaPlanilha(r, contas, meses, um(r, ['sempre', 'natureza', 'invertido'] as const), FORMATOS.br, true, meses));
      const ult = meses[meses.length - 1];
      for (const [lado, prefixo, sinal] of [['clientes', '1.1.2.01.', 1], ['fornecedores', '2.1.1.01.', -1]] as [LadoDaConta, string, number][]) {
        const verdade = contas.filter(c => c.classificacao.startsWith(prefixo));
        for (const m of meses) {
          const lista = clientesDoDinamico(d, m, lado);
          expect(lista.map(c => c.codigo)).toEqual(verdade.map(c => c.codigo));
          lista.forEach((c, i) => { expect(c.saldo).toBe(sinal * verdade[i].c[m] / 100 || 0); semMenosZero(c.saldo); expect(c.nome).not.toMatch(/\s{2}/); });
          // a soma do detalhe = a sintética
          const sint = d.linhas.find(l => l.classificacao === prefixo.slice(0, -1))!;
          expect(Math.round(lista.reduce((t, c) => t + c.saldo, 0) * 100)).toBe(Math.round(sinal * sint.saldos[m] * 100) || 0);
          for (const l of d.linhas) if (l.classificacao === prefixo.slice(0, -1)) expect(temContaDebaixo(d, l)).toBe(true);
        }
        const credores = verdade.filter(c => meses.some(m => sinal * c.c[m] < 0)).map(c => c.codigo);
        expect(credoresNoPeriodo(d, ult, lado).map(c => c.codigo)).toEqual(credores);
        const fech = conferirFechamento(d, meses);
        expect(fech.map(p => p.id)).not.toContain('balancete');
        expect((fech.find(p => p.id === lado)?.contas || []).map(c => c.conta)).toEqual(credores);
      }
      // idempotente: de novo, igual
      expect(conferirFechamento(d, meses)).toEqual(conferirFechamento(lerBalanceteDinamico(linhasDaPlanilha(r, contas, meses, 'sempre', FORMATOS.numero, true, meses)), meses));
    }
  });

  it('mês fora do dinâmico: zero, sem inventar saldo; credoresNoPeriodo não passa do mês', () => {
    const d = lerBalanceteDinamico([['Código', 'Classificação', 'Descrição', '01/2026', '02/2026'],
      ['1', '1.1.2.01', 'CLIENTES', -5, 5], ['2', '1.1.2.01.001', 'CLIENTE A', -5, 5]]);
    expect(clientesDoDinamico(d, '2027-01').map(c => c.saldo)).toEqual([0]);
    expect(credoresNoPeriodo(d, '2025-12').length).toBe(0);
    expect(credoresNoPeriodo(d, '2026-01').map(c => c.saldos)).toEqual([[{ mes: '2026-01', saldo: -5 }]]);
  });

  it('colunas de mês fora de ordem não mudam o "mês de antes" do adiantamento (o primeiro mês olha o saldo anterior)', () => {
    const d = lerBalanceteDinamico([['Código', 'Classificação', 'Descrição', 'Saldo Anterior', '03/2026', '01/2026', '02/2026'],
      ['9', '1.1.5.01', 'Adiantamento a fornecedores', 100, 0, 0, 0]]);
    expect(adiantamentoNoDinamico(d, ['2026-01', '2026-02', '2026-03'], 'fornecedores').com).toEqual(['2026-01']);
  });

  it('o cliente (ou fornecedor) chamado "CAIXA …" é da etapa dele, não o Caixa; a Caixa Econômica não é o caixa', () => {
    const d: BalanceteDinamico = { meses: ['2026-01'], linhas: [
      { codigo: '1', classificacao: '1', descricao: 'ATIVO', saldoAnterior: 0, saldos: { '2026-01': 0 } },
      { codigo: '100', classificacao: '1.1.1.01', descricao: 'CAIXA', saldoAnterior: 0, saldos: { '2026-01': 10 } },
      { codigo: '101', classificacao: '1.1.1.01.001', descricao: 'Caixa Geral', saldoAnterior: 0, saldos: { '2026-01': -10 } },
      { codigo: '102', classificacao: '1.1.1.02', descricao: 'BANCOS', saldoAnterior: 0, saldos: { '2026-01': 10 } },
      { codigo: '103', classificacao: '1.1.1.02.001', descricao: 'Caixa Econômica Federal', saldoAnterior: 0, saldos: { '2026-01': 10 } },
      { codigo: '200', classificacao: '1.1.2.01', descricao: 'CLIENTES', saldoAnterior: 0, saldos: { '2026-01': 7 } },
      { codigo: '201', classificacao: '1.1.2.01.001', descricao: 'CAIXA ESCOLAR ESTADUAL', saldoAnterior: 0, saldos: { '2026-01': -7 } },
      { codigo: '300', classificacao: '2.1.1.01', descricao: 'FORNECEDORES', saldoAnterior: 0, saldos: { '2026-01': -7 } },
      { codigo: '301', classificacao: '2.1.1.01.001', descricao: 'CAIXA ECONOMICA FEDERAL', saldoAnterior: 0, saldos: { '2026-01': -7 } },
    ] };
    expect(tipoDoRazao(d, '101')).toBe('caixa');
    expect(tipoDoRazao(d, '103')).toBe(null);
    expect(tipoDoRazao(d, '201')).toBe('cliente');
    expect(tipoDoRazao(d, '301')).toBe('fornecedor');
    expect(razoesPedidos(d).map(x => x.codigo)).toEqual(['101']);
    const f = conferirFechamento(d, ['2026-01']);
    expect(f.find(p => p.id === 'caixa')?.contas.map(c => c.conta)).toEqual(['101']);
  });

  it('o cliente com nome de banco no Ativo não aparece como "Banco credor"', () => {
    const d: BalanceteDinamico = { meses: ['2026-01'], linhas: [
      { codigo: '200', classificacao: '1.1.2.01', descricao: 'CLIENTES', saldoAnterior: 0, saldos: { '2026-01': -7 } },
      { codigo: '201', classificacao: '1.1.2.01.001', descricao: 'INTER MODAS LTDA', saldoAnterior: 0, saldos: { '2026-01': -7 } },
      { codigo: '102', classificacao: '1.1.1.02', descricao: 'CONTAS CORRENTES', saldoAnterior: 0, saldos: { '2026-01': -3 } },
      { codigo: '103', classificacao: '1.1.1.02.001', descricao: 'Banco Sicoob', saldoAnterior: 0, saldos: { '2026-01': -3 } },
    ] };
    const f = conferirFechamento(d, ['2026-01']);
    expect(f.find(p => p.id === 'bancos')?.contas.map(c => c.conta)).toEqual(['103']);
    expect(f.find(p => p.id === 'clientes')?.contas.map(c => c.conta)).toEqual(['201']);
  });

  it('o plano com Custos e Despesas em dois grupos de cima confere os dois', () => {
    const l = (codigo: string, classificacao: string, descricao: string, s: number): LinhaDinamico => ({ codigo, classificacao, descricao, saldoAnterior: 0, saldos: { '2026-01': s } });
    const d: BalanceteDinamico = { meses: ['2026-01'], linhas: [
      l('3', '3', 'RECEITAS', -10), l('31', '3.1', 'Vendas', -10),
      l('4', '4', 'CUSTOS', 5), l('41', '4.1', 'Custo das mercadorias', 5),
      l('5', '5', 'DESPESAS', -2), l('51', '5.1', 'Telefone', -2),
    ] };
    expect(resultadoErradoNoDinamico(d, ['2026-01']).map(x => x.codigo)).toEqual(['51']);
  });

  it('mês sem movimento não falta no razão; o que mexeu e não tem lançamento falta, na virada de ano também', () => {
    const d = lerBalanceteDinamico([['Código', 'Classificação', 'Descrição', 'Saldo Anterior', '12/2025', '01/2026', '02/2026'], ['7', '1.1', 'X', 100, 100, 150, 150]]);
    expect(mesesFaltandoNoRazao(d, '7', { lancamentos: [] }, ['2025-12', '2026-01', '2026-02'])).toEqual(['2026-01']);
    expect(mesesFaltandoNoRazao(d, '7', { lancamentos: [{ data: '2026-01-02' }] }, ['2025-12', '2026-01', '2026-02'])).toEqual([]);
  });
});

describe('o dinâmico do robô', () => {
  it('mês a mês, a conta que não veio fica com o saldo de antes; independe da ordem dos meses', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const r = semente(seed + 1000);
      const meses = mesesDesde('2025-11', entre(r, 1, 8));
      const codigos = Array.from({ length: entre(r, 1, 10) }, (_, i) => String(100 + i));
      const porMes = meses.map(mes => ({ mes, contas: codigos.filter(() => r() < 0.7).map((codigo): ContaDoBalanceteDoRobo => ({ codigo, nome: 'Conta ' + codigo, classificacao: '1.1.' + codigo, anterior: um(r, CENTAVOS) / 100, anteriorDc: um(r, ['D', 'C']), saldo: r() < 0.2 ? 0 : um(r, CENTAVOS) / 100, dc: um(r, ['D', 'C']) })) }));
      const { d } = dinamicoDoRobo(embaralhar(r, porMes));
      expect(d.meses).toEqual(meses);
      for (const l of d.linhas) {
        let esperado = l.saldoAnterior;
        for (const m of porMes) {
          const c = m.contas.find(x => x.codigo === l.codigo);
          if (c) esperado = (c.dc === 'C' ? -c.saldo : c.saldo) || 0;
          expect(l.saldos[m.mes]).toBe(esperado);
          semMenosZero(l.saldos[m.mes]);
        }
      }
      expect(dinamicoDoRobo(porMes).d).toEqual(d);
    }
  });

  it('12 meses com dezenas de milhares de contas não trava (a empresa com 12.902 contas)', () => {
    const contas = Array.from({ length: 30000 }, (_, i): ContaDoBalanceteDoRobo => ({ codigo: String(i), nome: 'C' + i, classificacao: '1.1.' + i, anterior: 1, anteriorDc: 'D', saldo: 2, dc: 'D' }));
    const inicio = Date.now();
    const { d } = dinamicoDoRobo(mesesDesde('2026-01', 12).map(mes => ({ mes, contas })));
    expect(d.linhas.length).toBe(30000);
    expect(Date.now() - inicio).toBeLessThan(30000);
  }, 120000);
});

// ─── o razão gerado ──────────────────────────────────────────────────────────

const DOCS = ['12345678000195', '11222333/0001-44', '11.222.333/0001-44', '12345678901', '123.456.789-01'];
const novaData = (r: Sorte, mes: string) => mes + '-' + String(entre(r, 1, 28)).padStart(2, '0');

interface Evento { data: string; valor: number; historico: string; c?: string }
interface ModeloDoRazao { eventos: Evento[]; abertos: Map<string, number>; meses: string[] }

/** As notas e os pagamentos (valor em centavos no sinal do Alterdata do cliente: venda −, recebimento +). */
function modeloDoRazao(r: Sorte): ModeloDoRazao {
  const meses = mesesDesde(um(r, ['2025-11', '2025-12', '2026-01']), entre(r, 1, 6));
  const eventos: Evento[] = [];
  const abertos = new Map<string, number>();
  const n = entre(r, 1, 12);
  for (let i = 0; i < n; i++) {
    const nf = String(1000 + i * 37);
    const v = Math.max(5, um(r, CENTAVOS));
    const mes = um(r, meses);
    const dataVenda = novaData(r, mes);
    const zeros = r() < 0.3 ? '000000000' : '';
    eventos.push({ data: dataVenda, valor: -v, historico: 'Pelas vendas conf. Nota Fiscal nº - ' + zeros + nf + '-' + um(r, DOCS) + '-CLIENTE FICTICIO' });
    // recebido em até 3 vezes (pagamento parcial, à vista ou o adiantamento: antes da nota)
    let resta = v;
    const partes = entre(r, 0, 3);
    for (let k = 1; k <= partes && resta > 0; k++) {
      const p = k === partes && r() < 0.5 ? resta : Math.max(1, Math.floor(resta * r()));
      resta -= p;
      const data = r() < 0.2 ? dataVenda : novaData(r, um(r, meses));
      const zerosRec = r() < 0.2 ? '000' : '';
      eventos.push({ data, valor: p, historico: um(r, ['Recebimento de clientes ' + zerosRec + nf + ' -DUP.00' + k, 'Recebimento de clientes ' + zerosRec + nf + '/00' + k + ' - CLIENTE FICTICIO']), c: 'Banco' });
    }
    if (resta > 0) abertos.set(nf, resta);
  }
  return { eventos, abertos, meses };
}

/** Os lançamentos com o Saldo corrido, na ordem das datas (a venda antes do recebimento do mesmo dia, ou não). */
function razaoDoModelo(m: ModeloDoRazao, saldoInicial: number, sinal: 1 | -1 = 1, ordem?: (e: Evento[]) => Evento[]): RazaoDaConta {
  const em = (ordem || (e => [...e].sort((a, b) => a.data.localeCompare(b.data))))(m.eventos);
  let s = saldoInicial * sinal;
  const trocar = (h: string) => (sinal === 1 ? h : h.replace('Pelas vendas', 'Pela compra').replace('Recebimento de clientes', 'Pagamento a fornecedores'));
  const lancamentos: LancamentoDoRazao[] = em.map(e => { s += sinal * e.valor; return { data: e.data, contrapartida: '10503', nomeContrapartida: e.c || 'Receita', valor: sinal * e.valor / 100, codigoHistorico: '', historico: trocar(e.historico), saldo: s / 100 }; });
  return { lancamentos, saldoInicial: saldoInicial * sinal / 100, saldoFinal: s / 100, inicio: lancamentos[0]?.data || '', fim: lancamentos[lancamentos.length - 1]?.data || '' };
}

const naoInterno = <T extends { interno?: boolean }>(xs: T[]) => xs.filter(x => !x.interno);

describe('o razão do cliente e do fornecedor', () => {
  it('notas em aberto, saldo e relação no centavo; nos dois lados; virada de ano', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = semente(seed * 13);
      const m = modeloDoRazao(r);
      const fim = m.meses[m.meses.length - 1];
      for (const [lado, sinal] of [['clientes', 1], ['fornecedores', -1]] as [LadoDaConta, 1 | -1][]) {
        const razao = razaoDoModelo(m, 0, sinal);
        const c = conferirRazaoDoCliente(razao, fim, lado);
        expect(Object.fromEntries(c.emAberto.map(n => [n.nf, Math.round(n.aberto * 100)]))).toEqual(Object.fromEntries(m.abertos));
        expect(c.aMais).toEqual([]);
        expect(c.semNota).toEqual([]);
        expect(c.emAberto.map(n => n.data)).toEqual([...c.emAberto.map(n => n.data)].sort());
        const soma = [...m.abertos.values()].reduce((t, v) => t + v, 0);
        expect(c.saldo, 'seed ' + seed).toBe(soma / 100);
        expect(c.saldoDoRazao).toBe(soma / 100);
        const marca = razaoDaMarca('a.xls', c, lado);
        expect(Math.round(naoInterno(marca.itens).reduce((t, i) => t + i.valor, 0) * 100)).toBe(soma);
        for (const i of marca.itens) expect(i.valor).toBe(Math.round(i.valor * 100) / 100);
      }
    }
  });

  it('a nota já paga antes da emissão (adiantamento, ou o recebimento na frente da nota no mesmo dia) não fica em aberto nem solta', () => {
    const h = (nf: string) => 'Pelas vendas conf. Nota Fiscal nº - ' + nf + '-11222333000144-CLIENTE';
    const razao = (ls: [string, number, string][]): RazaoDaConta => { let s = 0; const lancamentos = ls.map(([data, valor, historico]) => { s += valor; return { data, contrapartida: '1', nomeContrapartida: 'Banco', valor, codigoHistorico: '', historico, saldo: s }; }); return { lancamentos, saldoInicial: 0, saldoFinal: s, inicio: '', fim: '' }; };
    for (const r of [
      razao([['2026-01-05', 100, 'Recebimento de clientes 9078 -DUP.001'], ['2026-01-10', -100, h('9078')]]),
      razao([['2026-01-05', 100, 'Recebimento de clientes 9078 -DUP.001'], ['2026-01-05', -100, h('9078')]]),
    ]) {
      const c = conferirRazaoDoCliente(r, '2026-01');
      expect(c.emAberto).toEqual([]);
      expect(c.semNota).toEqual([]);
      expect(c.saldo).toBe(0);
    }
  });

  it('o resultado não depende da ordem da grade (exportada pelo Valor); a nota fica com a data da venda', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = semente(seed * 31);
      const m = modeloDoRazao(r);
      const fim = m.meses[m.meses.length - 1];
      const certo = conferirRazaoDoCliente(razaoDoModelo(m, 0), fim);
      const pelaOrdemDoValor = conferirRazaoDoCliente(razaoDoModelo(m, 0, 1, e => [...e].sort((a, b) => a.valor - b.valor)), fim);
      expect(pelaOrdemDoValor.saldo).toBe(certo.saldo);
      expect(pelaOrdemDoValor.saldoDoRazao).toBe(certo.saldoDoRazao);
      expect(new Map(pelaOrdemDoValor.emAberto.map(n => [n.nf, [n.aberto, n.data]]))).toEqual(new Map(certo.emAberto.map(n => [n.nf, [n.aberto, n.data]])));
      expect(pelaOrdemDoValor.semNota).toEqual([]);
    }
  });

  it('duas vezes, o mesmo resultado (idempotente) e o razão de entrada intacto', () => {
    const m = modeloDoRazao(semente(77));
    const razao = razaoDoModelo(m, -5000);
    const copia = JSON.stringify(razao);
    const fim = m.meses[m.meses.length - 1];
    expect(conferirRazaoDoCliente(razao, fim)).toEqual(conferirRazaoDoCliente(razao, fim));
    expect(JSON.stringify(razao)).toBe(copia);
  });

  it('o recorte do mês: o que vem depois do fim do mês não conta, e o saldo é o do último lançamento até ali', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const r = semente(seed * 41);
      const m = modeloDoRazao(r);
      const corte = m.meses[entre(r, 0, m.meses.length - 1)];
      const razao = razaoDoModelo(m, 0);
      const ate = razao.lancamentos.filter(l => l.data <= corte + '-31');
      const c = conferirRazaoDoCliente(razao, corte);
      const esperado = -Math.round(ate.reduce((t, l) => t + l.valor * 100, 0)) || 0;
      expect(Math.round(c.saldo * 100)).toBe(esperado);
      expect(c.saldoDoRazao).toBe(ate.length ? (-ate[ate.length - 1].saldo || 0) : null);
    }
  });

  it('saldo anterior (devedor e credor), o recebimento sem nota paga o de antes e o saldo fecha com o razão', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = semente(seed * 53);
      const m = modeloDoRazao(r);
      const anterior = um(r, [0, 1, 150, 1000000, -150, -1000000]);
      const fim = m.meses[m.meses.length - 1];
      // os lançamentos soltos que pagam o de antes (ou sobram)
      m.eventos.push({ data: fim + '-27', valor: um(r, [1, 100, 150, 20000]), historico: 'Transferência Pix recebida', c: 'Banco Z' });
      for (const [lado, sinal] of [['clientes', 1], ['fornecedores', -1]] as [LadoDaConta, 1 | -1][]) {
        if (lado === 'fornecedores') continue; // o histórico solto do fornecedor é outro caso
        const c = conferirRazaoDoCliente(razaoDoModelo(m, -anterior, sinal), fim, lado);
        expect(c.anterior).toBe(anterior / 100);
        semMenosZero(c.anterior);
        expect(c.saldo).toBe(c.saldoDoRazao);
        expect(Math.round(c.pagaAnterior.reduce((t, x) => t + x.valor, 0) * 100)).toBeLessThanOrEqual(Math.max(0, anterior));
      }
    }
  });

  it('saldo credor do cliente e devedor do fornecedor: a nota a mais aparece como a mais, e a relação soma o saldo', () => {
    const lado = ([['clientes', 1], ['fornecedores', -1]] as [LadoDaConta, 1 | -1][]);
    for (const [l, sinal] of lado) {
      const m: ModeloDoRazao = { meses: ['2026-01'], abertos: new Map(), eventos: [
        { data: '2026-01-02', valor: -1000, historico: 'Pelas vendas conf. Nota Fiscal nº - 501-11222333000144-C' },
        { data: '2026-01-03', valor: 1500, historico: 'Recebimento de clientes 501 -DUP.001', c: 'Banco' },
      ] };
      const c = conferirRazaoDoCliente(razaoDoModelo(m, 0, sinal), '2026-01', l);
      expect(c.emAberto).toEqual([]);
      expect(c.aMais.map(n => n.aberto)).toEqual([-5]);
      expect(c.saldo).toBe(-5);
      expect(razaoDaMarca('x', c, l).itens.map(i => [i.status, i.valor])).toEqual([['pagamento', -5]]);
    }
  });

  it('o mesmo recebimento no Caixa e no Banco conta uma vez e aparece como duplicidade', () => {
    const m: ModeloDoRazao = { meses: ['2026-01'], abertos: new Map(), eventos: [
      { data: '2026-01-02', valor: -1000, historico: 'Pelas vendas conf. Nota Fiscal nº - 501-11222333000144-C' },
      { data: '2026-01-03', valor: 400, historico: 'Recebimento de clientes 501 -DUP.001', c: 'Banco' },
      { data: '2026-01-03', valor: 400, historico: 'Recebimento de clientes 501 -DUP.001', c: 'Caixa' },
    ] };
    const c = conferirRazaoDoCliente(razaoDoModelo(m, 0), '2026-01');
    expect(c.emAberto.map(n => n.aberto)).toEqual([6]);
    expect(c.duplicados.map(d => [d.nf, d.valor, d.contas.length])).toEqual([['501', 4, 2]]);
    expect(c.saldo).toBe(6);
  });

  it('o estorno e o lançamento solto sem nota não perdem centavo no saldo', () => {
    const m: ModeloDoRazao = { meses: ['2026-01'], abertos: new Map(), eventos: [
      { data: '2026-01-02', valor: -1000, historico: 'Pelas vendas conf. Nota Fiscal nº - 501-11222333000144-C' },
      { data: '2026-01-03', valor: 1000, historico: 'Recebimento de clientes 501 -DUP.001', c: 'Banco' },
      { data: '2026-01-04', valor: -1000, historico: 'Estorno de recebimento de clientes 501', c: 'Banco' },
      { data: '2026-01-05', valor: -7, historico: 'Ajuste de centavos', c: 'Banco' },
    ] };
    const c = conferirRazaoDoCliente(razaoDoModelo(m, 0), '2026-01');
    expect(c.saldo).toBe(10.07);
    expect(c.saldoDoRazao).toBe(10.07);
  });

  it('a venda para pessoa física com o CPF pontuado também é nota', () => {
    const m: ModeloDoRazao = { meses: ['2026-01'], abertos: new Map(), eventos: [{ data: '2026-01-02', valor: -1000, historico: 'Venda conf. Nota Fiscal nº - 501-123.456.789-01-MARIA' }] };
    expect(conferirRazaoDoCliente(razaoDoModelo(m, 0), '2026-01').emAberto.map(n => n.nf)).toEqual(['501']);
  });

  it('o recebimento com os zeros na frente acha a nota de serviço', () => {
    const m: ModeloDoRazao = { meses: ['2026-01'], abertos: new Map(), eventos: [
      { data: '2026-01-02', valor: -1000, historico: 'Pelos Serviços Prestados conf. Nota Fiscal nº - 000000000000123-11222333000144-X' },
      { data: '2026-01-03', valor: 1000, historico: 'Recebimento de clientes 000000000000123 - X', c: 'Banco' },
    ] };
    const c = conferirRazaoDoCliente(razaoDoModelo(m, 0), '2026-01');
    expect(c.emAberto).toEqual([]);
    expect(c.semNota).toEqual([]);
    const f = conferirRazaoDoCliente(razaoDoModelo(m, 0, -1), '2026-01', 'fornecedores');
    expect(f.saldo).toBe(0);
  });
});

describe('o que vai na marca do cliente', () => {
  it('digitar e tirar devolve a relação como estava, mesmo com dois iguais', () => {
    const l = { data: '2026-01-05', nf: '77', descricao: 'x', valor: 12.34, status: 'aberto' as const };
    const um_ = comLancamentoDigitado(undefined, l, 100);
    const dois = comLancamentoDigitado(um_, l, 100);
    expect(dois.notas.length).toBe(2);
    const tirou = semLancamentoDigitado(dois, chaveDoItem(dois.itens[0]))!;
    expect(tirou.itens.length).toBe(1);
    expect(tirou.notas.length).toBe(1);
    expect(semLancamentoDigitado(tirou, chaveDoItem(tirou.itens[0]))).toBeUndefined();
  });

  it('a mensagem não interpreta "$" da observação, do nome ou da empresa', () => {
    const t = textoDaMensagem('{empresa} {lista}', "A$&B", '01/2026', [{ codigo: '1', nome: "X$'Y", saldo: 10, obs: 'custou $& e $1' }]);
    expect(t).toContain('A$&B');
    expect(t).toContain("X$'Y");
    expect(t).toContain('custou $& e $1');
  });

  it('aceitar uma baixa duas vezes não paga duas vezes; desfazer volta ao que faltava', () => {
    const l: LancamentoDoBanco = { data: '2026-01-05', valor: 300, historico: 'PIX', banco: 'Sicoob' };
    const a = comBaixa(undefined, 'k', l, true);
    const b = comBaixa(a, 'k', l, true);
    expect(b).toEqual(a);
    expect(faltaDaNota(5, b!.k)).toBe(200);
    expect(comBaixa(b, 'k', l, false)).toBeUndefined();
    expect(faltaDaNota(5, undefined)).toBe(500);
  });
});

describe('a sugestão de baixa', () => {
  const banco = (r: Sorte, n: number): LancamentoDoBanco[] => Array.from({ length: n }, () => ({
    data: novaData(r, um(r, ['2025-12', '2026-01', '2026-02'])), valor: (r() < 0.5 ? 1 : -1) * Math.max(1, um(r, CENTAVOS)),
    historico: um(r, ['PIX RECEBIDO CLIENTE ALFA', 'DEP CHEQUE', 'TED ALFA COMERCIO', 'TARIFA', 'PAGTO BOLETO']), banco: 'Sicoob',
  }));
  it('só no sentido certo, sem depósito de cheque, no limite, e não mexe no que entrou', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = semente(seed * 97);
      const ls = banco(r, entre(r, 0, 40));
      const copia = JSON.stringify(ls);
      const sentido = um(r, [1, -1] as const);
      const valor = Math.abs(um(r, ls.length ? ls : [{ valor: 100 } as LancamentoDoBanco]).valor) / 100;
      const nota = { data: '2026-01-02', valor, vendido: valor * 2 };
      const s = sugestoesDeBaixa(nota, 'ALFA COMERCIO LTDA', ls, sentido);
      expect(s.length).toBeLessThanOrEqual(5);
      for (const x of s) { expect(Math.sign(x.valor)).toBe(sentido); expect(x.historico).not.toMatch(/DEP CHEQUE/); }
      expect(JSON.stringify(ls)).toBe(copia);
      expect(sugestoesDeBaixa(nota, 'ALFA COMERCIO LTDA', ls, sentido)).toEqual(s);
    }
  });
});

describe('tipoDoRazao: a obrigação pelo nome, o caixa depois da seção', () => {
  const cab = ['Código', 'Classificação', 'Descrição', 'Saldo Anterior', '10/2026'];
  const d = lerBalanceteDinamico([cab,
    [1, '2', 'PASSIVO', 0, 0], [2, '2.1', 'CIRCULANTE', 0, 0], [3, '2.1.03', 'CONTAS A PAGAR', 0, 0],
    [4, '2.1.03.001', 'SALARIOS A PAGAR', 0, -10], [5, '2.1.03.002', 'HONORARIOS A PAGAR', 0, -10], [6, '2.1.03.003', 'FGTS A RECOLHER', 0, -10],
    [7, '2.1.03.004', 'INSS A RECOLHER', 0, -10], [8, '2.1.03.005', 'PRO-LABORE A PAGAR', 0, -10], [9, '2.1.03.006', 'SIMPLES NACIONAL A RECOLHER', 0, -10],
    [10, '2.1.04', 'FORNECEDORES', 0, 0], [11, '2.1.04.001', 'CAIXA ECONOMICA FEDERAL', 0, -10], [12, '2.1.04.002', 'ALFA COMERCIO', 0, -10],
    [13, '1', 'ATIVO', 0, 0], [14, '1.1', 'DISPONIVEL', 0, 0], [15, '1.1.01', 'CAIXA GERAL', 0, 10], [16, '1.1.02', 'CONTAS A RECEBER', 0, 0], [17, '1.1.02.001', 'CAIXA ESCOLAR ALFA', 0, 10],
  ]);
  it.each([
    ['4', 'salarios'], ['5', 'honorarios'], ['6', 'fgts'], ['7', 'inss'], ['8', 'prolabore'], ['9', 'simples'],
  ])('a obrigação %s debaixo de "CONTAS A PAGAR" continua sendo %s, e o razão é pedido', (codigo, tipo) => {
    expect(tipoDoRazao(d, codigo)).toBe(tipo);
    expect(razoesPedidos(d).some(r => r.codigo === codigo)).toBe(true);
  });
  it.each([['11', 'fornecedor'], ['12', 'fornecedor'], ['15', 'caixa'], ['17', 'cliente']])('a conta %s é %s (CAIXA ESCOLAR é cliente, CAIXA ECONOMICA fornecedor)', (codigo, tipo) => {
    expect(tipoDoRazao(d, codigo)).toBe(tipo);
  });
});

describe('o número do balancete com só ponto', () => {
  const saldo = (v: unknown) => lerBalanceteDinamico([['Código', 'Classificação', 'Descrição', 'Saldo Anterior', '10/2026'], ['1', '1.1', 'A', 0, v]]).linhas[0].saldos['2026-10'];
  it.each([['0.125', 0.13], ['0.500', 0.5], ['1.234', 1234], ['100.000', 100000], ['1.234.567', 1234567], ['1234.56', 1234.56]])('%s vale %d', (v, n) => {
    expect(saldo(v)).toBe(n);
  });
});
