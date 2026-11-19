import { describe, expect, it } from 'vitest';
import {
  adicionarEnvelopes, anosDasCaixas, buscar, codigoDaCaixa, descartar, descarteLiberadoEm, devolver, emprestados, FILTRO_VAZIO, htmlDasEtiquetasDaCaixa, idDaCaixa,
  lerCaixa, linkDaCaixa, mesesDaCaixa, montarCaixa, mudarEnvelope, paraDescartar, paraOBanco, problemaDaCaixa, proximoNumero, removerEnvelope, retirar, rotuloDaCaixa,
  rotuloDaCompetencia, situacaoDaCaixa, tipoComEspacos, type Caixa, type RascunhoDaCaixa,
} from './index';
import { htmlDosEnvelopes } from '../tarefas/regras/etiquetasDoEnvelope';

const AGORA = '2026-11-19T12:00:00.000Z';
const rascunho = (r: Partial<RascunhoDaCaixa> = {}): RascunhoDaCaixa => ({
  codigo: 565, nome: 'EMPRESA EXEMPLO LTDA', tipo: 'PJ-F', departamento: 'Fiscal', ano: 2026, numero: 1, arquivadaEm: '2026-11-19', local: 'Estante B', observacoes: '', ...r,
});
const caixa = (r: Partial<RascunhoDaCaixa> = {}) => montarCaixa(rascunho(r), 'Ana', AGORA);
const comMeses = (c: Caixa, meses: number[]) => adicionarEnvelopes(c, meses.map(m => c.ano + '-' + String(m).padStart(2, '0')), c.departamento, '', 'Ana', AGORA).caixa;

describe('a caixa', () => {
  it('o código com três dígitos e o id pela empresa, ano, departamento e número', () => {
    expect(codigoDaCaixa(1)).toBe('001');
    expect(codigoDaCaixa(42)).toBe('042');
    expect(idDaCaixa({ codigo: 565, ano: 2026, departamento: 'Fiscal', numero: 1 })).toBe('565-2026-F-001');
    expect(idDaCaixa({ codigo: 565, ano: 2026, departamento: 'Pessoal', numero: 12 })).toBe('565-2026-P-012');
    expect(rotuloDaCaixa(caixa())).toBe('565 · 2026 · PJ-F · caixa 001');
  });

  it('o próximo número conta só a mesma empresa, ano e departamento', () => {
    const cs = [caixa(), caixa({ numero: 2 }), caixa({ ano: 2025, numero: 7 }), caixa({ departamento: 'Pessoal', tipo: 'PJ-P', numero: 5 })];
    expect(proximoNumero(cs, 565, 2026, 'Fiscal')).toBe(3);
    expect(proximoNumero(cs, 565, 2025, 'Fiscal')).toBe(8);
    expect(proximoNumero(cs, 565, 2024, 'Fiscal')).toBe(1);
    expect(proximoNumero(cs, 10, 2026, 'Fiscal')).toBe(1);
  });

  it('o rascunho: empresa, ano, número, data e caixa repetida', () => {
    const cs = [caixa()];
    expect(problemaDaCaixa(rascunho({ codigo: null }), cs, null, 2026)).toMatch(/empresa/);
    expect(problemaDaCaixa(rascunho({ ano: 2028 }), cs, null, 2026)).toMatch(/ano/);
    expect(problemaDaCaixa(rascunho({ numero: 0 }), cs, null, 2026)).toMatch(/001 a 999/);
    expect(problemaDaCaixa(rascunho({ arquivadaEm: '19/11/2026' }), cs, null, 2026)).toMatch(/data/);
    expect(problemaDaCaixa(rascunho(), cs, null, 2026)).toBe('Já existe a caixa 001 de 565 em 2026 (Fiscal).');
    // a mesma caixa sendo mudada não conta como repetida
    expect(problemaDaCaixa(rascunho({ local: 'Sala 2' }), cs, '565-2026-F-001', 2026)).toBe('');
    expect(problemaDaCaixa(rascunho({ numero: 2 }), cs, null, 2026)).toBe('');
  });

  it('mudar a caixa guarda os envelopes e as retiradas', () => {
    const c = comMeses(caixa(), [1, 2]);
    const r = retirar(c, { envelope: null }, 'Bia', 'Fiscalização', AGORA).caixa;
    const mudada = montarCaixa(rascunho({ local: 'Sala 2' }), 'Caio', AGORA, r);
    expect(mudada.local).toBe('Sala 2');
    expect(mudada.envelopes).toHaveLength(2);
    expect(mudada.retiradas).toHaveLength(1);
    expect(mudada.atualizadaPor).toBe('Caio');
  });
});

describe('os envelopes', () => {
  it('um por mês, em ordem, sem repetir o igual', () => {
    const c = caixa();
    const a = adicionarEnvelopes(c, ['2026-03', '2026-01', '2026-02', '2026-01'], 'Fiscal', '', 'Ana', AGORA);
    expect(a.novos).toBe(3);
    expect(a.caixa.envelopes.map(e => e.competencia)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(a.caixa.envelopes.map(e => e.id).sort()).toEqual(['e1', 'e2', 'e3']);
    const b = adicionarEnvelopes(a.caixa, ['2026-02', '2026-04'], 'Fiscal', '', 'Ana', AGORA);
    expect(b.novos).toBe(1);
    expect(b.repetidos).toEqual(['2026-02']);
    expect(b.caixa.envelopes.find(e => e.competencia === '2026-04')?.id).toBe('e4');
    // o mesmo mês com outra observação é outro envelope
    expect(adicionarEnvelopes(b.caixa, ['2026-02'], 'Fiscal', 'Notas de entrada', 'Ana', AGORA).novos).toBe(1);
    // competência que não vale fica de fora; o ano todo entra
    expect(adicionarEnvelopes(c, ['2026-13', 'abc', '2026'], 'Fiscal', 'DEFIS', 'Ana', AGORA).caixa.envelopes.map(e => e.competencia)).toEqual(['2026']);
  });

  it('os meses da caixa, curtos', () => {
    expect(mesesDaCaixa(comMeses(caixa(), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toBe('jan–dez');
    expect(mesesDaCaixa(comMeses(caixa(), [1, 3, 7]))).toBe('jan, mar, jul');
    expect(mesesDaCaixa(comMeses(caixa(), [4, 5]))).toBe('abr, mai');
    expect(mesesDaCaixa(caixa())).toBe('');
    expect(rotuloDaCompetencia('2026-03')).toBe('03/2026');
    expect(rotuloDaCompetencia('2026')).toBe('2026 (ano todo)');
  });

  it('mudar e tirar envelope; o retirado não sai', () => {
    const c = comMeses(caixa(), [1, 2]);
    const m = mudarEnvelope(c, 'e1', { observacao: '  Notas  ' }, 'Ana', AGORA);
    expect(m.envelopes.find(e => e.id === 'e1')?.observacao).toBe('Notas');
    const fora = retirar(c, { envelope: 'e2' }, 'Bia', '', AGORA).caixa;
    expect(removerEnvelope(fora, 'e2', 'Ana', AGORA).problema).toMatch(/devolução/);
    expect(removerEnvelope(fora, 'e1', 'Ana', AGORA).caixa.envelopes.map(e => e.id)).toEqual(['e2']);
    expect(removerEnvelope(c, 'x', 'Ana', AGORA).problema).toMatch(/não está/);
  });
});

describe('retirar e devolver', () => {
  it('a caixa inteira: retira, não retira de novo, devolve', () => {
    const c = comMeses(caixa(), [1]);
    expect(retirar(c, { envelope: null }, '  ', '', AGORA).problema).toMatch(/quem/);
    const r = retirar(c, { envelope: null }, 'Bia', 'Fiscalização', AGORA);
    expect(r.problema).toBe('');
    expect(situacaoDaCaixa(r.caixa)).toBe('retirada');
    expect(retirar(r.caixa, { envelope: null }, 'Caio', '', AGORA).problema).toMatch(/já está/);
    // com a caixa fora, o envelope também não sai
    expect(retirar(r.caixa, { envelope: 'e1' }, 'Caio', '', AGORA).problema).toMatch(/caixa inteira/);
    const d = devolver(r.caixa, { envelope: null }, 'Ana', '2026-11-20T10:00:00.000Z');
    expect(d.problema).toBe('');
    expect(situacaoDaCaixa(d.caixa)).toBe('no-lugar');
    expect(d.caixa.retiradas[0]).toMatchObject({ quem: 'Bia', motivo: 'Fiscalização', devolvidaPor: 'Ana', devolvidaEm: '2026-11-20T10:00:00.000Z' });
    expect(devolver(d.caixa, { envelope: null }, 'Ana', AGORA).problema).toMatch(/não está/);
    // a segunda retirada ganha outro id e o histórico fica
    const de2 = retirar(d.caixa, { envelope: null }, 'Caio', '', AGORA).caixa;
    expect(de2.retiradas.map(x => x.id)).toEqual(['r1', 'r2']);
  });

  it('um envelope: a caixa fica com envelope fora', () => {
    const c = comMeses(caixa(), [1, 2]);
    const r = retirar(c, { envelope: 'e2' }, 'Bia', '', AGORA);
    expect(situacaoDaCaixa(r.caixa)).toBe('envelope-fora');
    expect(retirar(r.caixa, { envelope: 'e2' }, 'Caio', '', AGORA).problema).toMatch(/já está/);
    expect(retirar(c, { envelope: 'x' }, 'Caio', '', AGORA).problema).toMatch(/não está/);
    expect(devolver(r.caixa, { envelope: 'e1' }, 'Ana', AGORA).problema).toMatch(/não está/);
    expect(situacaoDaCaixa(devolver(r.caixa, { envelope: 'e2' }, 'Ana', AGORA).caixa)).toBe('no-lugar');
  });

  it('os emprestados, o mais antigo primeiro, com os dias fora', () => {
    const a = retirar(comMeses(caixa(), [1]), { envelope: 'e1' }, 'Bia', '', '2026-11-10T12:00:00.000Z').caixa;
    const b = retirar(caixa({ numero: 2 }), { envelope: null }, 'Caio', '', '2026-11-01T12:00:00.000Z').caixa;
    const lista = emprestados([a, b, caixa({ numero: 3 })], new Date(AGORA));
    expect(lista.map(x => [x.caixa.numero, x.envelope?.id ?? null, x.dias])).toEqual([[2, null, 18], [1, 'e1', 9]]);
  });

  it('a caixa descartada não sai', () => {
    const c = { ...caixa({ ano: 2018 }), descartadaEm: '2026-01-02' };
    expect(retirar(c, { envelope: null }, 'Bia', '', AGORA).problema).toMatch(/descartada/);
  });
});

describe('a busca', () => {
  const cs = [
    comMeses(caixa(), [1, 2, 3]),
    comMeses(caixa({ ano: 2025 }), [5]),
    comMeses(caixa({ codigo: 56, nome: 'SÃO JOSÉ EXEMPLO', local: 'Sala 2' }), [3]),
    adicionarEnvelopes(caixa({ codigo: 10, nome: 'OUTRA EXEMPLO', departamento: 'Pessoal', tipo: 'PJ-P' }), ['2026-03'], 'Pessoal', 'Rescisão do João', 'Ana', AGORA).caixa,
    { ...caixa({ codigo: 7, nome: 'VELHA EXEMPLO', ano: 2015 }), descartadaEm: '2024-01-10' },
  ];

  it('o código é exato; o nome sem acento; mais novo primeiro', () => {
    expect(buscar(cs, { ...FILTRO_VAZIO, texto: '565' }).map(a => a.caixa.ano)).toEqual([2026, 2025]);
    expect(buscar(cs, { ...FILTRO_VAZIO, texto: '56' }).map(a => a.caixa.codigo)).toEqual([56]);
    expect(buscar(cs, { ...FILTRO_VAZIO, texto: 'sao jose' }).map(a => a.caixa.codigo)).toEqual([56]);
    expect(buscar(cs, { ...FILTRO_VAZIO, texto: 'sala 2' }).map(a => a.caixa.codigo)).toEqual([56]);
  });

  it('o mês acha a caixa e só o envelope dele', () => {
    const r = buscar(cs, { ...FILTRO_VAZIO, ano: 2026, mes: 3 });
    expect(r.map(a => a.caixa.codigo)).toEqual([10, 56, 565]);
    expect(r.find(a => a.caixa.codigo === 565)?.envelopes.map(e => e.competencia)).toEqual(['2026-03']);
    expect(buscar(cs, { ...FILTRO_VAZIO, texto: '565', mes: 5 }).map(a => a.caixa.ano)).toEqual([2025]);
  });

  it('a observação do envelope acha a caixa, com só esse envelope', () => {
    const r = buscar(cs, { ...FILTRO_VAZIO, texto: 'rescisao' });
    expect(r.map(a => [a.caixa.codigo, a.envelopes.length])).toEqual([[10, 1]]);
  });

  it('departamento, situação e as descartadas', () => {
    expect(buscar(cs, { ...FILTRO_VAZIO, departamento: 'Pessoal' }).map(a => a.caixa.codigo)).toEqual([10]);
    expect(buscar(cs, FILTRO_VAZIO).some(a => a.caixa.codigo === 7)).toBe(false);
    expect(buscar(cs, { ...FILTRO_VAZIO, situacao: 'descartada' }).map(a => a.caixa.codigo)).toEqual([7]);
    expect(buscar(cs, { ...FILTRO_VAZIO, situacao: '' })).toHaveLength(5);
    expect(anosDasCaixas(cs)).toEqual([2026, 2025, 2015]);
  });
});

describe('o descarte', () => {
  it('a partir do 1º de janeiro de ano + 1 + prazo do departamento', () => {
    expect(descarteLiberadoEm({ ano: 2020, departamento: 'Fiscal' })).toBe('2026-01-01');
    expect(descarteLiberadoEm({ ano: 2020, departamento: 'Pessoal' })).toBe('2031-01-01');
    expect(descarteLiberadoEm({ ano: 2020, departamento: 'Fiscal' }, { Fiscal: 6, 'Contábil': 10, Pessoal: 10 })).toBe('2027-01-01');
  });

  it('as que passaram do prazo; descartar pede tudo no lugar e o prazo vencido', () => {
    const velha = caixa({ ano: 2019 });
    const nova = caixa({ ano: 2021 });
    const cont = caixa({ ano: 2019, departamento: 'Contábil', tipo: 'PJ-C' });
    expect(paraDescartar([nova, cont, velha], '2026-11-19').map(c => c.ano)).toEqual([2019]);
    expect(descartar(nova, 'Admin', '2026-11-19').problema).toMatch(/01\/01\/2027/);
    expect(descartar(retirar(velha, { envelope: null }, 'Bia', '', AGORA).caixa, 'Admin', '2026-11-19').problema).toMatch(/devolução/);
    const d = descartar(velha, 'Admin', '2026-11-19');
    expect(d.problema).toBe('');
    expect(situacaoDaCaixa(d.caixa)).toBe('descartada');
    expect(paraDescartar([d.caixa], '2026-11-19')).toEqual([]);
    expect(descartar(d.caixa, 'Admin', '2026-11-19').problema).toMatch(/já foi/);
  });
});

describe('o banco', () => {
  it('ida e volta, e o que não é caixa fica de fora', () => {
    const c = retirar(comMeses(caixa(), [1, 2]), { envelope: 'e1' }, 'Bia', 'x', AGORA).caixa;
    const doc = paraOBanco(c);
    expect(doc.id).toBeUndefined();
    expect(lerCaixa(c.id, JSON.parse(JSON.stringify(doc)))).toEqual(c);
    expect(lerCaixa('x', { nome: 'sem código' })).toBeNull();
    const lida = lerCaixa('y', { codigo: 1, ano: 2026, numero: 1, departamento: 'Outro', envelopes: [{ id: 'e1', competencia: '2026-13' }, { id: 'e2', competencia: '2026-02' }, 'lixo'] });
    expect(lida?.departamento).toBe('Fiscal');
    expect(lida?.envelopes.map(e => e.id)).toEqual(['e2']);
  });

  it('o link do QR abre a caixa (e o envelope)', () => {
    expect(linkDaCaixa('https://nads.exemplo/', '565-2026-F-001')).toBe('https://nads.exemplo/tarefas/arquivo-fisico/caixas?caixa=565-2026-F-001');
    expect(linkDaCaixa('https://nads.exemplo', '565-2026-F-001', 'e3')).toBe('https://nads.exemplo/tarefas/arquivo-fisico/caixas?caixa=565-2026-F-001&envelope=e3');
  });
});

describe('as etiquetas', () => {
  it('duas caixas por folha, com o QR, o código, o tipo e o código da caixa', () => {
    const cs = [caixa({ observacoes: 'Notas <entrada>' }), caixa({ numero: 2 }), caixa({ numero: 3 })];
    const html = htmlDasEtiquetasDaCaixa({ caixas: cs, qr: { [cs[0].id]: '<svg id="qr1"></svg>' }, logo: { definicao: '<svg id="def"></svg>', uso: '<svg id="uso"></svg>' } });
    expect(html.match(/<section class="pagina">/g)).toHaveLength(2);
    expect(html.match(/class="cx"/g)).toHaveLength(3);
    expect(html).toContain('<svg id="qr1"></svg>');
    expect(html).toContain('PJ - F');
    expect(html).toContain('>001<');
    expect(html).toContain('19/11/2026');
    expect(html).toContain('Notas &lt;entrada&gt;');
    expect(tipoComEspacos('PF-P')).toBe('PF - P');
  });

  it('o envelope: o mês de cada etiqueta e o QR, sem mudar a do Cadastro', () => {
    const logo = { definicao: '', uso: '' };
    const doCadastro = htmlDosEnvelopes({ competencia: '2026-10', departamento: 'Fiscal', etiquetas: [{ codigo: 565, nome: 'X', caixa: 'PJ-F' }], logo });
    expect(doCadastro).toContain('MOVIMENTO 10/2026');
    expect(doCadastro).not.toContain('class="env-qr"');
    const doArquivo = htmlDosEnvelopes({ competencia: '2026-01', departamento: 'Fiscal', etiquetas: [{ codigo: 565, nome: 'X', caixa: 'PJ-F', competencia: '2026-03', qr: '<svg id="q"></svg>' }], logo });
    expect(doArquivo).toContain('MOVIMENTO 03/2026');
    expect(doArquivo).toContain('<div class="env-qr"><svg id="q"></svg></div>');
  });
});
