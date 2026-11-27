import { describe, expect, it } from 'vitest';
import type { ChamadoNaEquipe, PessoaComSenha, RecebidoDoCliente } from './areaCliente';
import { comunicadoNoAr, contarFila, filaDaSolicitacao, filaDoHoje, filaPorResponsavel, resumoDoHoje, solicitacoesQueEsperam, ultimosRecebidos } from './hojeDaArea';

const agora = new Date('2026-11-26T15:00:00Z');
const cham = (id: string, situacao: ChamadoNaEquipe['situacao'], atualizadoEm: string, nota?: number): ChamadoNaEquipe => ({
  id, token: 't', codigos: [1], empresa: 'X', tipo: 'outro' as ChamadoNaEquipe['tipo'], titulo: id, situacao, mensagens: [], criadoEm: atualizadoEm, atualizadoEm,
  avaliacao: nota ? { nota, comentario: '', em: '2026-11-20T10:00:00Z' } : null, passos: {},
});
const rec = (id: string, recebidoEm: string, recusa = false): RecebidoDoCliente => ({
  id, token: 't', codigo: 1, empresa: 'X', nome: id, tipo: 'extrato', tamanho: 1, pastaDrive: '', arquivoDrive: '', recebidoEm, guia: '',
  ...(recusa ? { recusa: { motivo: 'm', por: 'p', em: recebidoEm } } : {}),
});

describe('o Hoje da Área do Cliente (26/11/2026)', () => {
  it('os números de cada cartão', () => {
    const r = resumoDoHoje({
      chamados: [cham('a', 'aberto', '2026-11-25'), cham('b', 'em andamento', '2026-11-24'), cham('c', 'concluido', '2026-11-20', 5)],
      recebidos: [rec('n', '2026-11-25T10:00:00Z'), rec('v', '2026-10-01T10:00:00Z'), rec('r', '2026-11-25T10:00:00Z', true)],
      comunicados: [{ id: '1', titulo: '', texto: '', alvo: { todos: true }, publicarEm: '2026-11-01', ate: '2026-12-01', por: '', atualizadoEm: '' }],
      links: [{ codigo: 1, token: 'x', atualizadoEm: '' }, { codigo: 2, token: 'y', atualizadoEm: '' }],
      pessoas: [{ id: 'p', codigo: 1, nome: '', email: '', ativo: true, situacao: 'erro', erro: '', criadoEm: '' } as PessoaComSenha],
      agora,
    });
    expect(r).toMatchObject({ pendentes: 2, semResposta: 1, arquivosNovos: 1, comunicadosNoAr: 1, comAcesso: 2, acessosComErro: 1 });
    expect(r.nota.total).toBe(1);
  });
  it('no ar: já começou e não acabou', () => {
    expect(comunicadoNoAr({ publicarEm: '2026-11-27', ate: '' }, '2026-11-26')).toBe(false);
    expect(comunicadoNoAr({ publicarEm: '2026-11-01', ate: '2026-11-25' }, '2026-11-26')).toBe(false);
    expect(comunicadoNoAr({ publicarEm: '2026-11-26', ate: '' }, '2026-11-26')).toBe(true);
  });
  it('quem espera há mais tempo primeiro; a sem resposta antes da em andamento', () => {
    const l = solicitacoesQueEsperam([cham('nova', 'aberto', '2026-11-26'), cham('velha', 'aberto', '2026-11-20'), cham('and', 'em andamento', '2026-11-10'), cham('ok', 'concluido', '2026-11-01')]);
    expect(l.map(c => c.id)).toEqual(['velha', 'nova', 'and']);
  });
  it('os últimos recebidos sem os recusados', () => {
    expect(ultimosRecebidos([rec('a', '2026-11-20'), rec('b', '2026-11-25'), rec('c', '2026-11-26', true)]).map(r => r.id)).toEqual(['b', 'a']);
  });
});

describe('a fila do Hoje (27/11/2026)', () => {
  const msg = (de: 'cliente' | 'escritorio', em: string) => ({ de, autor: de, texto: '', em });
  it('quem falou por último decide a fila; concluída sai', () => {
    expect(filaDaSolicitacao({ situacao: 'aberto', mensagens: [] })).toBe('equipe');
    expect(filaDaSolicitacao({ situacao: 'em andamento', mensagens: [msg('cliente', 'a'), msg('escritorio', 'b')] })).toBe('cliente');
    expect(filaDaSolicitacao({ situacao: 'respondido', mensagens: [msg('escritorio', 'a'), msg('cliente', 'b')] })).toBe('equipe');
    expect(filaDaSolicitacao({ situacao: 'concluido', mensagens: [] })).toBeNull();
  });
  it('a espera em dias, o tom, o arquivo sem aprovação para revisar, o mais antigo primeiro e a conta', () => {
    const a = { ...cham('a', 'aberto', '2026-11-22T15:00:00Z'), tipo: 'ferias' as ChamadoNaEquipe['tipo'] };
    const b = { ...cham('b', 'em andamento', '2026-11-20T10:00:00Z'), mensagens: [msg('escritorio', '2026-11-25T15:00:00Z')] };
    const aprovado = { ...rec('ok', '2026-11-25T10:00:00Z'), aprovado: { por: 'p', em: '2026-11-25T11:00:00Z' } };
    const itens = filaDoHoje({ chamados: [a, b], recebidos: [rec('novo', '2026-11-26T10:00:00Z'), aprovado, rec('velho', '2026-09-01T10:00:00Z')], agora });
    expect(itens.map(i => [i.id, i.fila, i.dias, i.tom, i.doDp])).toEqual([
      ['a', 'equipe', 4, 'atrasado', true],
      ['b', 'cliente', 1, 'ok', false],
      ['novo', 'revisar', 0, 'ok', false],
    ]);
    expect(contarFila(itens)).toEqual({ equipe: 1, cliente: 1, revisar: 1, atrasados: { equipe: 1, cliente: 0, revisar: 0 } });
    expect(filaPorResponsavel(itens, i => (i.doDp ? 'Savio' : i.id === 'b' ? 'Ana' : ''))).toEqual([
      { nome: 'Sem responsável', equipe: 0, cliente: 0, revisar: 1, atrasados: 0 },
      { nome: 'Ana', equipe: 0, cliente: 1, revisar: 0, atrasados: 0 },
      { nome: 'Savio', equipe: 1, cliente: 0, revisar: 0, atrasados: 1 },
    ]);
  });
});
