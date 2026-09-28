import { describe, expect, it } from 'vitest';
import { conta, empresa, nota } from './__legado__/fixtures';
import { aoSair, gravarLancVista, gravarVerificacao, importarNotas, marcarAutomaticos, marcarNatureza } from './acoes';
import { verifChave } from './regras/conciliacao';
import { FILTRO_MOVIMENTO_VAZIO } from './tipos';

const agora = new Date(2026, 8, 28, 10, 0, 0);

describe('aoSair', () => {
  it('"Apagar ao sair" ligado: tira o balancete e registra exclusão automática', () => {
    const e = empresa({ contas: [conta('1', 'Caixa'), conta('2', 'Banco')] });
    const x = aoSair(e, agora);
    expect(x.contas).toEqual([]);
    expect(x.importHistorico).toEqual([{ ts: agora.toISOString(), tipo: 'Balancete', qtd: 2, acao: 'excluido', auto: true }]);
    expect(e.contas.length).toBe(2); // a de entrada não muda
  });
  it('desligado (ou sem balancete): não mexe', () => {
    const e = empresa({ contas: [conta('1', 'Caixa')], autoLimparBalancete: false });
    expect(aoSair(e, agora)).toBe(e);
    const vazia = empresa();
    expect(aoSair(vazia, agora)).toBe(vazia);
  });
});

describe('marcarNatureza', () => {
  it('desmarcar à mão entra nos recusados (a automática não volta)', () => {
    const e = empresa({ confMarcados: ['p||A'] });
    const x = marcarNatureza(e, 'p||A', false, 'A', agora);
    expect(x.confMarcados).toEqual([]);
    expect(x.confAutoRecusados).toEqual(['p||A']);
    expect(marcarAutomaticos(x, [{ chave: 'p||A', texto: 'A' }], agora).confMarcados).toEqual([]);
  });
  it('marcar não recusa', () => {
    const x = marcarNatureza(empresa(), 'p||A', true, 'A', agora);
    expect(x.confMarcados).toEqual(['p||A']);
    expect(x.confAutoRecusados).toEqual([]);
    expect(x.confHistorico[0]).toMatchObject({ acao: 'marcado', origem: 'manual' });
  });
});

describe('gravarVerificacao', () => {
  it('mesmo estado: devolve a mesma empresa', () => {
    const e = empresa();
    expect(gravarVerificacao(e, FILTRO_MOVIMENTO_VAZIO, '31105', null, 't', agora)).toBe(e);
  });
  it('grava o estado e registra na categoria verificação', () => {
    const x = gravarVerificacao(empresa(), FILTRO_MOVIMENTO_VAZIO, '31105', 'ok', 'Conta 31105 · relatório sem pendências', agora);
    const ch = verifChave(FILTRO_MOVIMENTO_VAZIO, '31105');
    expect(x.verifConta[ch]).toBe('ok');
    expect(x.confHistorico[0]).toMatchObject({ chave: 'verif|' + ch, categoria: 'verificacao', acao: 'marcado' });
  });
});

describe('importarNotas', () => {
  const e = empresa({ entradas: [nota('1102', '6', 1, '1'), nota('1102', '6', 2, '2')] });
  it('sobrepor registra quantas foram substituídas', () => {
    const x = importarNotas(e, 'entradas', [nota('1102', '6', 3, '3')], 1, 'sobrepor', agora);
    expect(x.entradas.length).toBe(1);
    expect(x.importHistorico[0]).toEqual({ ts: agora.toISOString(), tipo: 'Entradas', qtd: 1, acao: 'importado', modo: 'sobreposto', substituidas: 2 });
  });
  it('novas não tem modo', () => {
    const x = importarNotas(e, 'entradas', e.entradas, 0, 'novas', agora);
    expect(x.importHistorico[0].modo).toBeUndefined();
  });
});

describe('gravarLancVista', () => {
  const V = 'Venda de mercadoria adquirida ou recebida de terceiros';
  const e = empresa({ vendaVista: { ativo: true, lancs: { [V]: '1' } } });
  it('mesmo valor: não muda', () => {
    const r = gravarLancVista(e, V, 'vista', '1');
    expect(r.mudou).toBe(false);
    expect(r.empresa).toBe(e);
  });
  it('só dígitos; vazio remove', () => {
    const r = gravarLancVista(e, V, 'prazo', ' 2a ');
    expect(r.mudou).toBe(true);
    expect(r.empresa.vendaVista.prazo).toEqual({ [V]: '2' });
    expect(r.mensagem).toBe('Lançamento a prazo: 2.');
    const r2 = gravarLancVista(e, V, 'vista', '');
    expect(r2.empresa.vendaVista.lancs).toEqual({});
    expect(r2.mensagem).toBe('Lançamento à vista removido.');
  });
});
