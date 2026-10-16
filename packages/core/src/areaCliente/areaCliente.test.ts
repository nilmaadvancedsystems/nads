import { describe, expect, it } from 'vitest';
import { EMPRESAS } from '../empresas/lista';
import { ROTINA_DP } from '../tarefas/rotinas/dp';
import { ROTINA_FISCAL } from '../tarefas/rotinas/fiscal';
import { execucaoNova } from '../tarefas/regras/execucao';
import type { Execucao } from '../tarefas/tipos';
import {
  agendaDaExecucao, agendaDoMes, competenciaDoMesDeVencimento, chamadoDoCliente, erroDoEnvio, erroDoNovoChamado, guiaDoFgts, guiaPrecisaLiberar, guiasPorCompetencia, reciboDoEnvio,
  situacaoDaGuia, tituloDoChamado, valorEmReais, vencimentoDaEtapaNoMes, VENCIMENTOS, type PedidoFgtsInterno,
} from './index';

/** os campos internos que NUNCA podem sair nas projeções */
const INTERNOS = ['por', 'observacao', 'objecao', 'criadoPor', 'criadoPorUid', 'aviso', 'passos', 'erro', 'tentativas'];
/** todas as chaves de um valor (objetos e listas por dentro) */
function chaves(v: unknown, achadas = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach(x => chaves(x, achadas));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { achadas.add(k); chaves(x, achadas); }
  return achadas;
}
const semInternos = (v: unknown) => expect(INTERNOS.filter(k => chaves(v).has(k))).toEqual([]);

const HOJE = new Date(2026, 9, 16, 10, 0, 0); // sexta, 16/10/2026

const PEDIDO: PedidoFgtsInterno = {
  id: 'p1', competencia: '2026-09', status: 'pronto', modo: 'emitir', vencimento: '20/10/2026', valor: '1.917,42', numeroGuia: '123456789', aviso: '', pdfNome: 'fgts.pdf',
};
/** o pedido com tudo o que o robô guarda de interno (a projeção não pode vazar nada) */
const PEDIDO_COMPLETO = { ...PEDIDO, criadoPor: 'Clara', criadoPorUid: 'uid-1', erro: 'x', passos: [{ n: 1 }], tentativas: 2, por: 'Clara', observacao: 'obs', objecao: 'obj' };

describe('as guias', () => {
  it('a situação pela data: a vencer, vence hoje, vencida', () => {
    expect(situacaoDaGuia('17/10/2026', HOJE)).toBe('a vencer');
    expect(situacaoDaGuia('16/10/2026', HOJE)).toBe('vence hoje');
    expect(situacaoDaGuia('15/10/2026', HOJE)).toBe('vencida');
    // a hora do dia não muda nada
    expect(situacaoDaGuia('16/10/2026', new Date(2026, 9, 16, 23, 59))).toBe('vence hoje');
    expect(situacaoDaGuia('01/01/2027', HOJE)).toBe('a vencer');
  });
  it('o valor do robô vira número', () => {
    expect(valorEmReais('1.917,42')).toBe(1917.42);
    expect(valorEmReais('917,42')).toBe(917.42);
    expect(valorEmReais('')).toBeNaN();
  });
  it('a guia do FGTS pronta sai só com a lista branca de campos', () => {
    const g = guiaDoFgts(PEDIDO_COMPLETO, HOJE)!;
    expect(g).toEqual({ id: 'p1', tipo: 'FGTS', competencia: '2026-09', vencimento: '20/10/2026', valor: 1917.42, numero: '123456789', situacao: 'a vencer', temPdf: true });
    semInternos(g);
  });
  it('só pronto e de emitir: o ensaio e o que está na fila não saem', () => {
    expect(guiaDoFgts({ ...PEDIDO, modo: 'ensaio' }, HOJE)).toBeNull();
    expect(guiaDoFgts({ ...PEDIDO, status: 'trabalhando' }, HOJE)).toBeNull();
    expect(guiaDoFgts({ ...PEDIDO, status: 'erro' }, HOJE)).toBeNull();
  });
  it('com aviso espera o "Liberar" do escritório (e o aviso nunca sai)', () => {
    const comAviso = { ...PEDIDO, aviso: 'Débito antigo em aberto' };
    expect(guiaPrecisaLiberar(comAviso)).toBe(true);
    expect(guiaPrecisaLiberar(PEDIDO)).toBe(false);
    expect(guiaDoFgts(comAviso, HOJE)).toBeNull();
    const liberada = guiaDoFgts(comAviso, HOJE, true)!;
    expect(liberada.id).toBe('p1');
    semInternos(liberada);
    expect(JSON.stringify(liberada)).not.toContain('Débito');
  });
  it('sem número nem PDF', () => {
    const g = guiaDoFgts({ ...PEDIDO, numeroGuia: '', pdfNome: '' }, HOJE)!;
    expect(g.numero).toBeUndefined();
    expect(g.temPdf).toBe(false);
  });
  it('vencimento ou valor quebrado: não sai guia torta', () => {
    expect(guiaDoFgts({ ...PEDIDO, vencimento: '' }, HOJE)).toBeNull();
    expect(guiaDoFgts({ ...PEDIDO, valor: '' }, HOJE)).toBeNull();
  });
  it('agrupa por competência, a mais nova primeiro', () => {
    const a = guiaDoFgts(PEDIDO, HOJE)!;
    const b = { ...a, id: 'p0', competencia: '2026-08' };
    expect(guiasPorCompetencia([b, a]).map(g => g.competencia)).toEqual(['2026-09', '2026-08']);
  });
});

describe('a tabela de vencimentos', () => {
  const v = (etapa: string, competencia: string) => vencimentoDaEtapaNoMes(etapa, competencia);
  it('só tem etapas que existem nas rotinas', () => {
    const ids = new Set([...ROTINA_FISCAL.etapas, ...ROTINA_DP.etapas].map(e => e.id));
    for (const x of VENCIMENTOS) expect(ids.has(x.etapa), x.etapa).toBe(true);
  });
  it('DAS dia 20 do mês seguinte; domingo e sábado antecipam para sexta', () => {
    expect(v('fiscal-simples', '2026-09')).toBe('2026-10-20'); // terça
    expect(v('fiscal-simples', '2026-10')).toBe('2026-11-20'); // sexta
    expect(v('fiscal-simples', '2026-11')).toBe('2026-12-18'); // dia 20 é domingo
    expect(v('fiscal-simples', '2026-05')).toBe('2026-06-19'); // dia 20 é sábado
  });
  it('vira o ano: dezembro vence em janeiro', () => {
    expect(v('dp-fgts', '2026-12')).toBe('2027-01-20'); // quarta
  });
  it('DCTFWeb e S-1299 no dia 15 (antecipa); DARF e FGTS no dia 20', () => {
    expect(v('dp-dctfweb', '2026-08')).toBe('2026-09-15'); // terça
    expect(v('dp-dctfweb', '2026-10')).toBe('2026-11-13'); // dia 15 é domingo
    expect(v('dp-s1299', '2026-10')).toBe('2026-11-13');
    expect(v('dp-darf', '2026-11')).toBe('2026-12-18');
    expect(v('dp-fgts', '2026-11')).toBe('2026-12-18');
  });
  it('ICMS (dia 9) e ISS (dia 10) empurram para segunda quando caem no fim de semana', () => {
    expect(v('fiscal-icms', '2026-05')).toBe('2026-06-09'); // terça
    expect(v('fiscal-icms', '2026-07')).toBe('2026-08-10'); // dia 9 é domingo
    expect(v('fiscal-iss', '2026-09')).toBe('2026-10-12'); // dia 10 é sábado
  });
  it('PIS/COFINS no dia 25', () => {
    expect(v('fiscal-piscofins', '2026-09')).toBe('2026-10-23'); // dia 25 é domingo: antecipa
    expect(v('fiscal-piscofins-real', '2026-10')).toBe('2026-11-25'); // quarta
  });
  it('IRPJ/CSLL: o último dia útil do mês seguinte ao trimestre', () => {
    expect(v('fiscal-irpj-csll', '2026-09')).toBe('2026-10-30'); // 31/10 é sábado
    expect(v('fiscal-irpj-csll', '2026-12')).toBe('2027-01-29'); // 31/01/2027 é domingo
    expect(v('fiscal-irpj-csll', '2026-03')).toBe('2026-04-30'); // quinta
  });
  it('etapa fora da tabela não tem vencimento; competência torta também não', () => {
    expect(v('fiscal-conf-saidas', '2026-09')).toBeNull();
    expect(v('fiscal-simples', 'setembro')).toBeNull();
    expect(v('fiscal-simples', '2026-13')).toBeNull();
  });
});

describe('a agenda', () => {
  const simples = EMPRESAS.find(e => e.regime === 'Simples')!;
  const presumido = EMPRESAS.find(e => e.regime === 'Presumido')!;
  const EMPRESA = { nome: simples.nome, codigo: simples.codigo };

  it('sem execução ainda, as do mês ficam "a fazer"; o regime manda (Simples não tem ICMS nem PIS/COFINS)', () => {
    const itens = agendaDaExecucao(null, ROTINA_FISCAL, EMPRESA, '2026-09');
    expect(itens.map(i => i.id)).toEqual(['das']);
    expect(itens[0]).toEqual({ id: 'das', nome: 'DAS do Simples Nacional', vence: '2026-10-20', situacao: 'a fazer' });
  });
  it('etapa fora da tabela não aparece (conferência, importação, relatórios…)', () => {
    const ex: Execucao = { ...execucaoNova(presumido.nome, presumido.codigo, '2026-09', 'fiscal'), etapas: { 'fiscal-conf-saidas': { situacao: 'feita', por: 'Heverton', em: '2026-10-01T10:00:00.000Z' } } };
    const itens = agendaDaExecucao(ex, ROTINA_FISCAL, { nome: presumido.nome, codigo: presumido.codigo }, '2026-09');
    const nomes = itens.map(i => i.nome).join('|');
    expect(nomes).not.toMatch(/Saídas|Conferência|Importação|Relatório/);
    expect(itens.length).toBeGreaterThan(0);
    for (const i of itens) expect(VENCIMENTOS.some(x => x.id === i.id)).toBe(true);
  });
  it('feita → feito (com a data); pendente e interrompida → a fazer; dispensada → não se aplica', () => {
    const ex: Execucao = {
      ...execucaoNova('Empresa DP', 9999, '2026-09', 'dp'),
      etapas: {
        'dp-fgts': { situacao: 'feita', por: 'Clara', em: '2026-10-05T12:00:00.000Z', observacao: 'conferido' },
        'dp-darf': { situacao: 'interrompida', por: 'Clara', em: '2026-10-05T12:00:00.000Z', objecao: 'falta-folha' },
        'dp-dctfweb': { situacao: 'dispensada', por: 'Clara', em: '2026-10-05T12:00:00.000Z', objecao: 'nao-se-aplica' },
      },
    };
    const itens = agendaDaExecucao(ex, ROTINA_DP, { nome: 'Empresa DP', codigo: 9999 }, '2026-09');
    const por = (id: string) => itens.find(i => i.id === id)!;
    expect(por('fgts')).toEqual({ id: 'fgts', nome: 'FGTS', vence: '2026-10-20', situacao: 'feito', feitoEm: '2026-10-05T12:00:00.000Z' });
    expect(por('darf-inss').situacao).toBe('a fazer');
    expect(por('dctfweb').situacao).toBe('nao se aplica');
    expect(por('esocial').situacao).toBe('a fazer');
    semInternos(itens);
    // a agenda nunca mostra o id da etapa
    expect(JSON.stringify(itens)).not.toContain('dp-');
    expect(JSON.stringify(itens)).not.toContain('falta-folha');
  });
  it('a agenda de um mês é a competência do mês anterior (vira o ano)', () => {
    expect(competenciaDoMesDeVencimento('2026-10')).toBe('2026-09');
    expect(competenciaDoMesDeVencimento('2027-01')).toBe('2026-12');
  });
  it('junta os departamentos na ordem do vencimento', () => {
    const a = agendaDoMes('2026-09', [{ id: 'fgts', nome: 'FGTS', vence: '2026-10-20', situacao: 'a fazer' }], [{ id: 'dctfweb', nome: 'DCTFWeb', vence: '2026-10-15', situacao: 'feito' }]);
    expect(a.itens.map(i => i.id)).toEqual(['dctfweb', 'fgts']);
  });
});

describe('os chamados', () => {
  const INTERNO = {
    id: 'c1', tipo: 'ferias', titulo: 'Férias da Maria', situacao: 'respondido',
    criadoPor: 'Clara', criadoPorUid: 'uid-1', observacao: 'cobrar o RH', objecao: 'x', erro: '', tentativas: 0, passos: [], por: 'Clara', aviso: 'cuidado',
    mensagens: [
      { de: 'cliente', texto: 'Posso marcar férias em dezembro?', em: '2026-10-10T09:00:00.000Z', autor: 'José da Empresa', criadoPorUid: 'uid-9' },
      { de: 'escritorio', texto: 'Pode sim, mande a data.', em: '2026-10-10T10:00:00.000Z', autor: 'Clara Souza', por: 'Clara' },
      { de: 'escritorio', texto: 'nota só nossa', em: '2026-10-10T10:05:00.000Z', autor: 'Clara Souza', interna: true },
    ],
  };
  it('o autor do escritório vira "Escritório"; nenhum campo interno nem nota interna sai', () => {
    const c = chamadoDoCliente(INTERNO);
    expect(c).toEqual({
      id: 'c1', tipo: 'ferias', titulo: 'Férias da Maria', situacao: 'respondido',
      mensagens: [
        { de: 'cliente', autor: 'Você', texto: 'Posso marcar férias em dezembro?', em: '2026-10-10T09:00:00.000Z' },
        { de: 'escritorio', autor: 'Escritório', texto: 'Pode sim, mande a data.', em: '2026-10-10T10:00:00.000Z' },
      ],
    });
    semInternos(c);
    const texto = JSON.stringify(c);
    expect(texto).not.toContain('Clara');
    expect(texto).not.toContain('uid-');
    expect(texto).not.toContain('nota só nossa');
  });
  it('tipo e situação desconhecidos viram "outro" e "aberto"', () => {
    const c = chamadoDoCliente({ ...INTERNO, tipo: 'secreto', situacao: 'sei-la' });
    expect([c.tipo, c.situacao]).toEqual(['outro', 'aberto']);
  });
  it('o novo chamado: assunto e texto obrigatórios; o título sai da primeira linha', () => {
    expect(erroDoNovoChamado('', 'oi')).not.toBe('');
    expect(erroDoNovoChamado('duvida', '   ')).not.toBe('');
    expect(erroDoNovoChamado('duvida', 'Como emito a segunda via?')).toBe('');
    expect(tituloDoChamado('duvida', 'Como emito a segunda via?\nObrigado')).toBe('Como emito a segunda via?');
    expect(tituloDoChamado('duvida', 'a'.repeat(100))).toHaveLength(58);
  });
});

describe('os envios', () => {
  it('o recibo sai só com a lista branca', () => {
    const interno = { id: 'e1', nome: 'extrato.pdf', tipo: 'extrato', tamanho: 1000, recebidoEm: '2026-10-10T09:00:00.000Z', criadoPorUid: 'u', erro: 'x', tentativas: 3, passos: [] };
    const r = reciboDoEnvio(interno);
    expect(Object.keys(r).sort()).toEqual(['id', 'nome', 'recebidoEm', 'tamanho', 'tipo']);
    semInternos(r);
  });
  it('só PDF, JPG, PNG, XML e ZIP, até 15 MB', () => {
    expect(erroDoEnvio({ nome: 'extrato.PDF', tamanho: 1000 })).toBe('');
    expect(erroDoEnvio({ nome: 'notas.zip', tamanho: 1000 })).toBe('');
    expect(erroDoEnvio({ nome: 'virus.exe', tamanho: 1000 })).toMatch(/só aceitamos/);
    expect(erroDoEnvio({ nome: 'grande.pdf', tamanho: 16 * 1024 * 1024 })).toMatch(/15 MB/);
    expect(erroDoEnvio({ nome: 'vazio.pdf', tamanho: 0 })).toMatch(/vazio/);
  });
});
