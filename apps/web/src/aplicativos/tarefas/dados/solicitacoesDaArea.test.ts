import { describe, expect, it } from 'vitest';
import type { ChamadoNaEquipe } from './areaCliente';
import {
  areaDoAnexo, bateNaBusca, contagemPorSituacao, estrelas, filtrarSolicitacoes, filtroInicial, grupoDoTipo, linhaDoAnexo,
  passosDaSolicitacao, textoDaResposta,
} from './solicitacoesDaArea';

const ch = (x: Partial<ChamadoNaEquipe>): ChamadoNaEquipe => ({
  id: 'c', token: 't', codigos: [10], empresa: 'PADARIA SÃO JOÃO', tipo: 'duvida', titulo: 'Uma dúvida', situacao: 'aberto',
  mensagens: [], criadoEm: '2026-11-01T10:00:00Z', atualizadoEm: '2026-11-01T10:00:00Z', avaliacao: null, passos: {}, ...x,
});

const lista = [
  ch({ id: 'a', tipo: 'admissao', titulo: 'Contratar ajudante', situacao: 'aberto', atualizadoEm: '2026-11-20T10:00:00Z' }),
  ch({ id: 'b', tipo: 'documento', titulo: 'Certidão negativa', situacao: 'respondido', codigos: [515], empresa: 'A7 MOBILE', atualizadoEm: '2026-11-25T10:00:00Z' }),
  ch({ id: 'c', tipo: 'ferias', titulo: 'Férias da Maria', situacao: 'concluido', atualizadoEm: '2026-11-10T10:00:00Z' }),
  ch({ id: 'd', tipo: 'outro', titulo: 'Outra coisa', situacao: 'em andamento', atualizadoEm: '2026-11-22T10:00:00Z' }),
];

describe('solicitações da Área do Cliente', () => {
  it('agrupa os tipos do DP', () => {
    expect(grupoDoTipo('admissao')).toBe('dp');
    expect(grupoDoTipo('demissao')).toBe('dp');
    expect(grupoDoTipo('documento')).toBe('documento');
    expect(grupoDoTipo('qualquer')).toBe('outro');
  });

  it('busca sem acento por empresa, assunto e código', () => {
    expect(bateNaBusca(lista[0]!, 'padaria sao')).toBe(true);
    expect(bateNaBusca(lista[1]!, 'certidao 515')).toBe(true);
    expect(bateNaBusca(lista[1]!, 'férias')).toBe(false);
  });

  it('filtra e põe as mais novas primeiro', () => {
    expect(filtrarSolicitacoes(lista, { situacao: 'todas', tipo: 'todos', busca: '' }).map(c => c.id)).toEqual(['b', 'd', 'a', 'c']);
    expect(filtrarSolicitacoes(lista, { situacao: 'todas', tipo: 'dp', busca: '' }).map(c => c.id)).toEqual(['a', 'c']);
    expect(filtrarSolicitacoes(lista, { situacao: 'abertas', tipo: 'todos', busca: '' }).map(c => c.id)).toEqual(['a']);
  });

  it('conta cada situação com o tipo e a busca', () => {
    expect(contagemPorSituacao(lista, { tipo: 'todos', busca: '' })).toEqual({ abertas: 1, andamento: 1, respondidas: 1, concluidas: 1, todas: 4 });
    expect(contagemPorSituacao(lista, { tipo: 'dp', busca: '' })).toEqual({ abertas: 1, andamento: 0, respondidas: 0, concluidas: 1, todas: 2 });
  });

  it('começa em Abertas só se houver alguma', () => {
    expect(filtroInicial(lista)).toBe('abertas');
    expect(filtroInicial([lista[1]!])).toBe('todas');
  });

  it('escolhe a área do anexo pelo tipo', () => {
    expect(areaDoAnexo('ferias')).toBe('dp');
    expect(areaDoAnexo('guia')).toBe('fiscal');
    expect(areaDoAnexo('documento')).toBe('societario');
  });

  it('monta o texto da resposta com a linha do anexo', () => {
    expect(textoDaResposta('  Segue.  ')).toBe('Segue.');
    expect(textoDaResposta('Segue.', 'cnd.pdf')).toBe('Segue.\n\n' + linhaDoAnexo('cnd.pdf'));
    expect(textoDaResposta('', 'cnd.pdf')).toBe(linhaDoAnexo('cnd.pdf'));
    expect(linhaDoAnexo('cnd.pdf')).toContain('Documentos › Do escritório');
  });

  it('lista os passos do DP e as estrelas', () => {
    const passos = passosDaSolicitacao(ch({ tipo: 'admissao', passos: { 'Pedido recebido': '2026-11-01' } }));
    expect(passos[0]).toEqual({ nome: 'Pedido recebido', feito: true });
    expect(passos.length).toBeGreaterThan(1);
    expect(passosDaSolicitacao(ch({ tipo: 'duvida' }))).toEqual([]);
    expect(estrelas(4)).toBe('★★★★☆');
  });
});
