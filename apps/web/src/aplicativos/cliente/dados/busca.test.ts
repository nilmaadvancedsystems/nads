import { describe, expect, it } from 'vitest';
import { buscarNaArea, indiceDaBusca, normalizar } from './busca';

const indice = indiceDaBusca({
  abas: [{ id: 'inicio', rotulo: 'Visão geral', icone: 'home' }, { id: 'guias', rotulo: 'Guias e obrigações', icone: 'recibo' }],
  guias: [{ id: 'g1', nome: 'FGTS', competencia: '2026-10', vencimento: '16/11/2026', situacao: 'a vencer' }],
  documentos: [{ chave: 'd1', nome: 'Folha de pagamento 10-2026', detalhe: '10/2026', pasta: 'Folha e DP' }, { chave: 'd2', nome: 'Guia FGTS 10/2026', detalhe: 'vence em 16/11', pasta: 'Guias' }],
  chamados: [{ id: 'c1', titulo: 'Dúvida sobre as férias do João', situacao: 'Respondida' }],
  funcionarios: [{ id: 'f1', nome: 'João Pereira', ativo: true }],
});

describe('a busca geral (13/11/2026)', () => {
  it('sem acento e sem maiúscula, todas as palavras', () => {
    expect(normalizar('  Férias JOÃO ')).toBe('ferias joao');
    const r = buscarNaArea(indice, 'joao');
    expect(r.map(g => [g.grupo, g.itens.map(i => i.titulo)])).toEqual([
      ['Solicitações', ['Dúvida sobre as férias do João']],
      ['Funcionários', ['João Pereira']],
    ]);
    expect(buscarNaArea(indice, 'ferias joao')[0].itens[0].pedido).toEqual({ chamado: 'c1' });
  });
  it('o título que começa com o termo vem primeiro; cada coisa leva a aba e o pedido', () => {
    const r = buscarNaArea(indice, 'fgts');
    expect(r.map(g => g.grupo)).toEqual(['Guias', 'Documentos']);
    expect(r[1].itens[0]).toMatchObject({ ir: 'documentos', pedido: { busca: 'Guia FGTS 10/2026' } });
    expect(buscarNaArea(indice, 'folha')[0].itens[0].titulo).toBe('Folha de pagamento 10-2026');
  });
  it('vazio: só as telas; o limite por grupo', () => {
    expect(buscarNaArea(indice, '').map(g => g.grupo)).toEqual(['Telas']);
    expect(buscarNaArea(indice, '2026', 1).every(g => g.itens.length <= 1)).toBe(true);
    expect(buscarNaArea(indice, 'xyz')).toEqual([]);
  });
});
