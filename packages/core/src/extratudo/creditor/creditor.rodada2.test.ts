// 2ª rodada do Creditor: o aprendizado da conta do cliente (aprender e reaplicar, conflitos, nome parecido, ordem), a junção de
// relatórios sem o nosso número e o cruzamento com a mesma NF em clientes diferentes. A 1ª rodada cobriu números e leitura. Dados
// fictícios, sementes fixas.
import { describe, expect, it } from 'vitest';
import { contaAprendida, decisoesAprendidas, aprender, clientesDoDocumento, chaveDoCliente, mesmosClientes, type ClientesAprendidos } from './regras/aprendizado';
import { juntarSemRepetir, soOsTitulosDoMes } from './regras/automatico';
import { cruzarPeloBalancete, mesmoNomeDeCliente } from './regras/clientes';
import { cruzar, pendentes, type Cruzamento, type Decisao } from './regras/cruzamento';
import { gerarLancamentos } from './regras/lancamentos';
import { CONTAS_PADRAO, type Grupo, type LinhaSistema, type RelatorioBanco, type Titulo } from './tipos';
import { lerRelatorioPlanilha, TOTAIS_VAZIOS } from './arquivos/banco';

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
function embaralhar<T>(r: Sorte, xs: readonly T[]): T[] {
  const o = [...xs];
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}

const AGORA = new Date('2026-11-10T12:00:00Z');
const titulo = (id: number, sacado: string, nf = String(4000 + id), valor = 100, extra: Partial<Titulo> = {}): Titulo => ({ id, sacado, nossoNumero: '0001' + (100000 + id), nf, valor, mora: 0, desconto: 0, outros: 0, liquidacao: '05/01/2026', cobrado: valor, ...extra });
const naoAchou = (t: Titulo): Cruzamento => ({ tituloId: t.id, situacao: 'nao-encontrada', linha: null, valorBanco: t.valor, valorSistema: null, nota: '' });
const achou = (t: Titulo, conta: string): Cruzamento => ({ tituloId: t.id, situacao: 'ok', linha: { linha: 1, nf: t.nf, cliente: t.sacado, contrapartida: conta, historico: '', valor: t.valor }, valorBanco: t.valor, valorSistema: t.valor, nota: '' });
const conta = (a: ClientesAprendidos, s: string) => contaAprendida(a, s)?.conta ?? null;

describe('aprender e reaplicar', () => {
  it('o cliente conciliado uma vez resolve a próxima NF que não está no sistema; os lançamentos saem com a conta dele', () => {
    const t1 = titulo(1, 'MERCADO BOM PRECO LTDA');
    const a = aprender({}, [t1], [achou(t1, '11201')], {}, AGORA);
    const t2 = titulo(2, 'mercado  bom  preço ltda', '5000');
    const c2 = [naoAchou(t2)];
    const d = decisoesAprendidas([t2], c2, a, {});
    expect(d[2]).toEqual({ tipo: 'manual', contrapartida: '11201', historico: '' });
    expect(pendentes(c2, d)).toEqual([]);
    expect(gerarLancamentos([t2], c2, d, CONTAS_PADRAO).map(l => l.credito)).toEqual(['11201']);
  });

  it('a decisão da pessoa vence o aprendido; o que veio do sistema não vira decisão', () => {
    const a: ClientesAprendidos = { 'alfa comercio': { conta: '111', nome: 'ALFA COMERCIO', em: '' } };
    const t = titulo(1, 'ALFA COMERCIO');
    expect(decisoesAprendidas([t], [naoAchou(t)], a, { 1: { tipo: 'manual', contrapartida: '222', historico: '' } })).toEqual({});
    expect(decisoesAprendidas([t], [achou(t, '999')], a, {})).toEqual({});
  });

  it('aprender de novo o mesmo não muda o guardado (não grava à toa); a conta nova substitui a antiga', () => {
    const t = titulo(1, 'ALFA COMERCIO');
    const a = aprender({}, [t], [achou(t, '111')], {}, AGORA);
    const b = aprender(a, [t], [achou(t, '111')], {}, new Date('2027-01-01T00:00:00Z'));
    expect(mesmosClientes(a, b)).toBe(true);
    const c = aprender(a, [t], [achou(t, '222')], {}, AGORA);
    expect(conta(c, 'ALFA COMERCIO')).toBe('222');
  });

  it('excluído, sem conta e decisão inválida não ensinam; o estado anterior não é alterado', () => {
    const t = titulo(1, 'ALFA COMERCIO');
    const antes: ClientesAprendidos = { 'beta': { conta: '9', nome: 'BETA', em: '' } };
    const copia = JSON.stringify(antes);
    expect(aprender(antes, [t], [achou(t, '111')], { 1: { tipo: 'excluir' } }, AGORA)).toEqual(antes);
    expect(aprender(antes, [t], [naoAchou(t)], {}, AGORA)).toEqual(antes);
    expect(aprender(antes, [t], [naoAchou(t)], { 1: { tipo: 'manual', contrapartida: '  ', historico: '' } }, AGORA)).toEqual(antes);
    expect(JSON.stringify(antes)).toBe(copia);
  });

  it('guardado e relido no documento, igual', () => {
    const t = titulo(1, 'AÇOUGUE SÃO JOSÉ');
    const a = aprender({}, [t], [achou(t, '111')], {}, AGORA);
    expect(clientesDoDocumento(JSON.parse(JSON.stringify({ clientes: a })))).toEqual(a);
    expect(chaveDoCliente('AÇOUGUE  SÃO-JOSÉ')).toBe(chaveDoCliente('acougue sao jose'));
  });

  it('o nome que é propriedade do objeto não quebra nem contamina', () => {
    for (const nome of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      const t = titulo(1, nome);
      const a = aprender({}, [t], [achou(t, '111')], {}, AGORA);
      expect(conta(a, nome)).toBe('111');
      expect(({} as Record<string, unknown>).conta).toBeUndefined();
    }
  });
});

describe('a ordem do aprendizado', () => {
  it('clientes diferentes: a ordem de ensinar não muda o que ficou', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = semente(seed);
      const pares = Array.from({ length: entre(r, 2, 12) }, (_, i) => titulo(i + 1, 'CLIENTE NUMERO ' + (i + 10)));
      const contas = new Map(pares.map(t => [t.id, String(entre(r, 11000, 11999))]));
      const em = (ts: Titulo[]) => ts.reduce<ClientesAprendidos>((a, t) => aprender(a, [t], [achou(t, contas.get(t.id) as string)], {}, AGORA), {});
      expect(mesmosClientes(em(pares), em(embaralhar(r, pares)))).toBe(true);
    }
  });

  it('o mesmo cliente com duas contas no mesmo arquivo: fica a do último título (o novo substitui)', () => {
    const t1 = titulo(1, 'ALFA'), t2 = titulo(2, 'ALFA');
    const a = aprender({}, [t1, t2], [achou(t1, '1'), achou(t2, '2')], {}, AGORA);
    expect(conta(a, 'ALFA')).toBe('2');
  });
  it.todo('PENDENTE (regra): o mesmo sacado com contas diferentes no mesmo arquivo (filiais); hoje a última substitui e pode resolver sozinha a NF seguinte no fluxo com o arquivo do sistema');
});

describe('a regra aprendida para nome parecido', () => {
  const A = (m: Record<string, string>): ClientesAprendidos => Object.fromEntries(Object.entries(m).map(([n, c]) => [chaveDoCliente(n), { conta: c, nome: n, em: '' }]));

  it('o nome cortado pelo banco acha o cliente (no fim, mesmo no meio da palavra; ou o nome sem a primeira palavra)', () => {
    const a = A({ 'MERCADO BOM PRECO LTDA': '111' });
    expect(conta(a, 'MERCADO BOM PREC')).toBe('111');
    expect(conta(a, 'MERCADO BOM PRECO')).toBe('111');
    expect(conta(A({ 'MERCADO BOM PRECO': '222' }), 'MERCADO BOM PRECO LTDA')).toBe('222');
    expect(conta(A({ 'REDE MERCADO BOM': '333' }), 'MERCADO BOM')).toBe('333');
  });

  it('o pedaço no meio de outra palavra não é o mesmo cliente', () => {
    expect(conta(A({ 'SUPERMERCADO BOM PRECO': '111' }), 'MERCADO BOM PRECO')).toBeNull();
    expect(conta(A({ 'MERCADO BOM PRECO': '111' }), 'SUPERMERCADO BOM PRECO')).toBeNull();
    expect(conta(A({ 'TOTAL ATACADO': '111' }), 'SUPERTOTAL ATACADO')).toBeNull();
  });

  it('dois parecidos com contas diferentes não decidem; com a mesma conta, decidem', () => {
    expect(conta(A({ 'ALFA COMERCIO MATRIZ': '1', 'ALFA COMERCIO FILIAL': '2' }), 'ALFA COMERCIO')).toBeNull();
    expect(conta(A({ 'ALFA COMERCIO MATRIZ': '1', 'ALFA COMERCIO FILIAL': '1' }), 'ALFA COMERCIO')).toBe('1');
  });

  it('nome curto (menos de 6 letras) só pelo nome exato', () => {
    expect(conta(A({ 'BETA': '1' }), 'BETA ATACADO')).toBeNull();
    expect(conta(A({ 'BETA': '1' }), 'beta')).toBe('1');
  });

  it('o nome vazio ou só com símbolos não acha ninguém', () => {
    const a = A({ 'ALFA COMERCIO': '1' });
    expect(contaAprendida(a, '')).toBeNull();
    expect(contaAprendida(a, '  .- ')).toBeNull();
  });

  it('o arquivo do sistema: a NF que não está lá não pega a conta de um nome que só contém o outro no meio da palavra', () => {
    const sistema: LinhaSistema[] = [{ linha: 1, nf: '9999', cliente: 'SUPERMERCADO BOM PRECO', contrapartida: '700', historico: '', valor: 10 }];
    const [c] = cruzar([titulo(1, 'MERCADO BOM PRECO', '5000')], sistema);
    expect(c.situacao).toBe('nao-encontrada');
    const sistema2: LinhaSistema[] = [{ linha: 1, nf: '9999', cliente: 'REDE MERCADO BOM PRECO', contrapartida: '700', historico: '', valor: 10 }];
    expect(cruzar([titulo(1, 'MERCADO BOM PRECO', '5000')], sistema2)[0].linha?.contrapartida).toBe('700');
  });
});

describe('a conta pelo balancete com o aprendido', () => {
  const clientes = [{ codigo: '1', nome: 'MERCADO SÃO JOSÉ LTDA' }, { codigo: '2', nome: 'MEDEIROS E MOURA LTDA' }, { codigo: '3', nome: 'MEDEIROS E MOURA LTDA' }];

  it('nome com acento, caixa e espaços: a conta do balancete', () => {
    for (const nome of ['MERCADO SAO JOSE', 'mercado são josé', 'MERCADO  SAO   JOSE LTDA']) {
      expect(mesmoNomeDeCliente(nome, 'MERCADO SÃO JOSÉ LTDA')).toBe(true);
      const [c] = cruzarPeloBalancete([titulo(1, nome)], clientes, {});
      expect(c.linha?.contrapartida, nome).toBe('1');
    }
  });

  it('aprendido vence o nome; filiais de nome igual perguntam e o aprendido vira só a sugestão', () => {
    const a: ClientesAprendidos = { 'mercado sao jose ltda': { conta: '77', nome: 'MERCADO SAO JOSE', em: '' }, 'medeiros e moura ltda': { conta: '3', nome: 'MEDEIROS', em: '' } };
    const [um] = cruzarPeloBalancete([titulo(1, 'MERCADO SAO JOSE LTDA')], clientes, a);
    expect([um.situacao, um.linha?.contrapartida, um.aprendida]).toEqual(['ok', '77', true]);
    const [filial] = cruzarPeloBalancete([titulo(2, 'MEDEIROS E MOURA LTDA')], clientes, a);
    expect(filial.situacao).toBe('nao-encontrada');
    expect(filial.opcoes?.map(o => o.codigo)).toEqual(['2', '3']);
    expect(filial.nota).toContain('Da última vez: 3');
  });

  it('a conta escolhida para a filial fica aprendida e a pergunta continua (não decide sozinha)', () => {
    const t = titulo(1, 'MEDEIROS E MOURA LTDA');
    const cs = cruzarPeloBalancete([t], clientes, {});
    const d: Record<number, Decisao> = { 1: { tipo: 'manual', contrapartida: '3', historico: '' } };
    const a = aprender({}, [t], cs, d, AGORA);
    expect(conta(a, t.sacado)).toBe('3');
    expect(cruzarPeloBalancete([titulo(2, 'MEDEIROS E MOURA LTDA')], clientes, a)[0].situacao).toBe('nao-encontrada');
  });
});

describe('a mesma NF em clientes diferentes, no arquivo do sistema', () => {
  const sistema: LinhaSistema[] = [
    { linha: 1, nf: '500', cliente: 'ALFA COMERCIO', contrapartida: 'A', historico: '', valor: 100 },
    { linha: 2, nf: '500', cliente: 'BETA ATACADO', contrapartida: 'B', historico: '', valor: 100 },
  ];
  it('o mesmo valor: o nome desempata, na ordem que as linhas vierem', () => {
    for (const s of [sistema, [...sistema].reverse()]) {
      expect(cruzar([titulo(1, 'BETA ATACADO', '500')], s)[0].linha?.contrapartida).toBe('B');
      expect(cruzar([titulo(1, 'ALFA COMERCIO', '500')], s)[0].linha?.contrapartida).toBe('A');
    }
  });
  it('a série no número ("500/2", "000500") é a mesma NF', () => {
    expect(cruzar([titulo(1, 'BETA ATACADO', '000500/2')], sistema)[0].linha?.contrapartida).toBe('B');
  });
  it.todo('PENDENTE (regra): a mesma NF com o valor batendo em outro cliente e o nome batendo no título: hoje o valor vence o nome');
});

const grupo = (id: number, titulos: Titulo[]): Grupo => ({ id, titulos, impresso: { ...TOTAIS_VAZIOS }, registros: null });
const rel = (ts: Titulo[]): RelatorioBanco => ({ grupos: [grupo(1, ts)], totalGeral: { ...TOTAIS_VAZIOS }, registrosGeral: null, ignorados: 0, avisos: [] });
const semNosso = (t: Titulo): Titulo => ({ ...t, nossoNumero: '' });

describe('juntar relatórios', () => {
  it('dividido em dois arquivos dá os mesmos títulos e os mesmos lançamentos que um só', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = semente(seed * 3);
      const ts = Array.from({ length: entre(r, 2, 20) }, (_, i) => titulo(i + 1, 'CLIENTE ' + i, undefined, entre(r, 1, 5000), { liquidacao: String(entre(r, 1, 28)).padStart(2, '0') + '/01/2026' }));
      const corte = entre(r, 1, ts.length - 1);
      const sobra = entre(r, 0, corte - 1);
      const j = juntarSemRepetir([rel(ts.slice(0, corte)), rel(ts.slice(sobra))]).relatorio;
      const out = j.grupos.flatMap(g => g.titulos);
      expect(new Set(out.map(t => t.nossoNumero))).toEqual(new Set(ts.map(t => t.nossoNumero)));
      expect(out.length).toBe(ts.length);
    }
  });

  it('no Importar automático, só os títulos do mês: o anexo de outro período não entra inteiro (11/11/2026)', () => {
    const r = rel([titulo(1, 'A', '4001', 100, { liquidacao: '05/08/2026' }), titulo(2, 'B', '4002', 100, { liquidacao: '03/10/2026' }), titulo(3, 'C', '4003', 100, { liquidacao: '31/08/2026' })]);
    expect(soOsTitulosDoMes(r, '2026-08').grupos.flatMap(g => g.titulos).map(t => t.nf)).toEqual(['4001', '4003']);
    expect(soOsTitulosDoMes(r, '2026-09').grupos).toEqual([]);
    const so = rel([titulo(1, 'A', '4001', 100, { liquidacao: '05/08/2026' })]);
    expect(soOsTitulosDoMes(so, '2026-08')).toBe(so);
  });

  it('reimportar o mesmo arquivo não repete título', () => {
    const r = rel([titulo(1, 'A'), titulo(2, 'B')]);
    const j = juntarSemRepetir([r, r]);
    expect(j.relatorio.grupos.flatMap(g => g.titulos).length).toBe(2);
    expect(j.usados).toEqual([0]);
  });

  it('relatórios sem o nosso número: títulos diferentes de mesma data e valor não se perdem; o mesmo título conta uma vez', () => {
    const a = semNosso(titulo(1, 'ALFA', '5001')), b = semNosso(titulo(1, 'BETA', '5002'));
    expect(juntarSemRepetir([rel([a]), rel([b])]).relatorio.grupos.flatMap(g => g.titulos).map(t => t.nf).sort()).toEqual(['5001', '5002']);
    const c = semNosso(titulo(2, 'ALFA', '5001'));
    expect(juntarSemRepetir([rel([a]), rel([c])]).relatorio.grupos.flatMap(g => g.titulos).length).toBe(1);
  });

  it('com o nosso número: é ele que identifica, mesmo com a NF escrita diferente', () => {
    const a = titulo(1, 'ALFA', '5001'), b = { ...titulo(1, 'ALFA', '005001') };
    expect(juntarSemRepetir([rel([a]), rel([b])]).relatorio.grupos.flatMap(g => g.titulos).length).toBe(1);
  });

  it('dois títulos iguais no mesmo arquivo continuam dois (o arquivo manda; a repetição é entre arquivos)', () => {
    const a = semNosso(titulo(1, 'ALFA', '5001')), b = semNosso(titulo(2, 'ALFA', '5001'));
    expect(juntarSemRepetir([rel([a, b])]).relatorio.grupos.flatMap(g => g.titulos).length).toBe(2);
  });
});

describe('a planilha do relatório com cabeçalho repetido e linhas em branco', () => {
  const buf = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;
  it('o cabeçalho de cada página e as linhas vazias não viram título nem separam grupo', () => {
    const cab = 'Sacado;Nosso Numero;Seu Numero;Valor;Dt. Liquidacao';
    const csv = [cab, 'ALFA;11;4001;10,00;05/01/2026', '', ';;;;', cab, 'BETA;12;4002;20,00;05/01/2026', 'Total de Valores do grupo;;;30,00;'].join('\r\n');
    const r = lerRelatorioPlanilha(buf(csv), 'a.csv');
    expect(r.grupos.length).toBe(1);
    expect(r.grupos[0].titulos.map(t => t.nf)).toEqual(['4001', '4002']);
  });
  it('o csv em Windows-1252 chega com os acentos', () => {
    const texto = 'Sacado;Seu Número;Valor;Dt. Liquidação\nAÇOUGUE SÃO JOSÉ;4001;10,00;05/01/2026\n';
    const bytes = Uint8Array.from([...texto].map(c => c.charCodeAt(0)));
    expect(lerRelatorioPlanilha(bytes.buffer, 'a.csv').grupos[0].titulos[0].sacado).toBe('AÇOUGUE SÃO JOSÉ');
  });
});
