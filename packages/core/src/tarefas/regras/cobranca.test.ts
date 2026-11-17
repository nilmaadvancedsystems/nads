// A cobrança da tarefa delegada (13/11/2026: "um icone de sino, nas tarefas delegadas, para meio que 'Cobrar' a tarefa e
// cobrar atualizacoes, o usuario cobrado vai ter o botao, 'Responder cobranca'").
import { describe, expect, it } from 'vitest';
import {
  adiamentoDaCobranca, andamentoDaCobranca, cobrancaAberta, cobrancaAdiadaAte, cobrancasRecebidas, comCobranca, deveMostrarCobranca, deveResponderCobranca, dicaDaCobranca,
  historicoDaCobranca, historicoDoAdiamento, lerTarefa, notaDoAdiamento, problemaDoAdiamento, retornosDasCobrancas, textoDoPassoDaCobranca, historicoDaRespostaDaCobranca, notaDaCobranca, notaDaResposta,
  podeCobrar, problemaDaCobranca, problemaDaResposta, TEXTO_DA_COBRANCA, ultimaResposta, type TarefaDelegada,
} from './delegadas';

const vitor = { uid: 'v', nome: 'Vitor' };
const clara = { uid: 'c', nome: 'Clara' };

function tarefa(o: Partial<TarefaDelegada> = {}): TarefaDelegada {
  return {
    id: 't1', numero: 1, titulo: 'Conferir', descricao: '', cliente: null, clientes: [], prioridade: 'normal', prazo: '', prazoHora: '',
    status: 'pendente', criadaPor: vitor, responsavel: clara, criadaEm: '2026-11-13T10:00:00.000Z', concluidaEm: '',
    atualizadaEm: '2026-11-13T10:00:00.000Z', pareceres: [], historico: [], anexos: [], ...o,
  };
}

const cobrar = (t: TarefaDelegada, texto = '', em = '2026-11-13T11:00:00.000Z') =>
  comCobranca(t, notaDaCobranca(texto, 'Vitor', em), historicoDaCobranca('Vitor', em, 'Clara'));
const responder = (t: TarefaDelegada, texto: string, em = '2026-11-13T12:00:00.000Z') =>
  comCobranca(t, notaDaResposta(texto, 'Clara', em), historicoDaRespostaDaCobranca('Clara', em));

describe('cobrar a tarefa delegada', () => {
  it('quem delegou cobra; quem faz, não; a encerrada e a de si mesmo, não', () => {
    expect(podeCobrar(tarefa(), 'v')).toBe(true);
    expect(podeCobrar(tarefa(), 'c')).toBe(false);
    expect(podeCobrar(tarefa({ status: 'concluida' }), 'v')).toBe(false);
    expect(podeCobrar(tarefa({ responsavel: vitor }), 'v')).toBe(false);
    expect(problemaDaCobranca(tarefa({ status: 'cancelada' }), 'v')).toBe('A tarefa já foi encerrada.');
  });

  it('sem texto, vai o de sempre; a cobrança fica aberta e quem faz tem de responder', () => {
    const t = cobrar(tarefa());
    expect(cobrancaAberta(t)?.texto).toBe(TEXTO_DA_COBRANCA);
    expect(t.historico.at(-1)?.texto).toBe('Cobrou uma atualização de Clara');
    expect(deveResponderCobranca(t, 'c')).toBe(true);
    expect(deveResponderCobranca(t, 'v')).toBe(false);
    // não cobra de novo enquanto espera a resposta
    expect(podeCobrar(t, 'v')).toBe(false);
    expect(problemaDaCobranca(t, 'v')).toBe('Já tem uma cobrança esperando a resposta.');
  });

  it('a resposta fecha a cobrança; quem cobrou vê a resposta e pode cobrar de novo', () => {
    const t = responder(cobrar(tarefa(), 'E aí?'), '  Falta o extrato do Sicoob.  ');
    expect(cobrancaAberta(t)).toBeNull();
    expect(ultimaResposta(t)?.texto).toBe('Falta o extrato do Sicoob.');
    expect(deveResponderCobranca(t, 'c')).toBe(false);
    expect(podeCobrar(t, 'v')).toBe(true);
    // a cobrança nova esconde a resposta velha
    expect(ultimaResposta(cobrar(t))).toBeNull();
  });

  it('a resposta precisa de texto, de quem faz e de uma cobrança aberta', () => {
    const t = cobrar(tarefa());
    expect(problemaDaResposta(t, 'c', '   ')).toBe('Escreva a resposta: como está a tarefa.');
    expect(problemaDaResposta(t, 'v', 'ok')).toBe('Só quem faz a tarefa responde à cobrança.');
    expect(problemaDaResposta(tarefa(), 'c', 'ok')).toBe('Não tem cobrança esperando resposta.');
    expect(problemaDaResposta(t, 'c', 'ok')).toBe('');
  });

  it('o parecer comum no meio não abre nem fecha a cobrança', () => {
    const comum = { por: 'Clara', em: '2026-11-13T11:30:00.000Z', texto: 'Um parecer' };
    const t = cobrar(tarefa());
    expect(cobrancaAberta({ pareceres: [...t.pareceres, comum] })?.tipo).toBe('cobranca');
    expect(cobrancaAberta({ pareceres: [comum] })).toBeNull();
  });
});

// 16/11/2026: "O cobrar atualizacoes tbm não ta funcionando": a leitura do banco jogava fora o tipo do parecer
describe('a cobrança lida do banco e nas Notificações', () => {
  it('lerTarefa guarda o tipo da cobrança e da resposta (o parecer comum fica sem)', () => {
    const t = cobrar(tarefa());
    const { id, ...doc } = { ...t, pareceres: [...t.pareceres, { por: 'Clara', em: '2026-11-13T11:30:00.000Z', texto: 'Comum' }] };
    const lida = lerTarefa(id, doc as unknown as Record<string, unknown>);
    expect(lida.pareceres.map(p => p.tipo)).toEqual(['cobranca', undefined]);
    expect('tipo' in lida.pareceres[1]).toBe(false);
    expect(deveResponderCobranca(lida, 'c')).toBe(true);
    expect(podeCobrar(lida, 'v')).toBe(false);
    expect(lerTarefa(id, { ...doc, pareceres: [{ por: 'X', em: '', texto: 'a', tipo: 'outro' }] } as unknown as Record<string, unknown>).pareceres[0]).toEqual({ por: 'X', em: '', texto: 'a' });
  });

  it('cobrancasRecebidas: só as de quem faz, a mais nova primeiro, e só a última sem resposta fica aberta', () => {
    const t = cobrar(responder(cobrar(tarefa()), 'Falta pouco.'), '', '2026-11-14T09:00:00.000Z');
    const outra = cobrar(tarefa({ id: 't2' }), '', '2026-11-13T15:00:00.000Z');
    const r = cobrancasRecebidas([t, outra, tarefa({ id: 't3' })], 'c');
    expect(r.map(x => [x.tarefa.id, x.nota.em, x.aberta])).toEqual([
      ['t1', '2026-11-14T09:00:00.000Z', true], ['t2', '2026-11-13T15:00:00.000Z', true], ['t1', '2026-11-13T11:00:00.000Z', false],
    ]);
    expect(cobrancasRecebidas([t], 'v')).toEqual([]);
    expect(cobrancasRecebidas([t], '')).toEqual([]);
  });

  it('a dica do Cobrada diz quem cobrou e quando', () => {
    expect(dicaDaCobranca({ por: 'Vitor' }, '16/11/2026, 10:30')).toBe('Vitor cobrou uma atualização em 16/11/2026, 10:30. Abra a tarefa e responda.');
  });
});

// 16/11/2026: "Deixa com a opção 'Mais 5 minutos, + 10minutos'… mas que tenha uma justificativa escrita"
describe('mais tempo para responder à cobrança', () => {
  const adiar = (t: TarefaDelegada, minutos: number, texto: string, em: string) =>
    comCobranca(t, notaDoAdiamento(minutos, texto, 'Clara', em), historicoDoAdiamento('Clara', em, minutos));
  const as = (h: string) => new Date('2026-11-13T' + h + ':00.000Z');

  it('pede justificativa, 5 ou 10 minutos, só quem faz e só com a cobrança aberta', () => {
    const t = cobrar(tarefa());
    expect(problemaDoAdiamento(t, 'c', 5, '   ')).toBe('Escreva a justificativa: por que precisa de mais tempo.');
    expect(problemaDoAdiamento(t, 'c', 7, 'Fechando')).toBe('Escolha mais 5 ou mais 10 minutos.');
    expect(problemaDoAdiamento(t, 'v', 5, 'Fechando')).toBe('Só quem faz a tarefa pede mais tempo.');
    expect(problemaDoAdiamento(tarefa(), 'c', 5, 'Fechando')).toBe('Não tem cobrança esperando resposta.');
    expect(problemaDoAdiamento(t, 'c', 10, 'Fechando')).toBe('');
  });

  it('a janela some durante o tempo pedido e volta quando ele acaba; a cobrança continua aberta', () => {
    const t = adiar(cobrar(tarefa()), 10, ' Estou no telefone com o cliente. ', '2026-11-13T11:05:00.000Z');
    expect(cobrancaAberta(t)?.tipo).toBe('cobranca');
    expect(adiamentoDaCobranca(t)).toMatchObject({ minutos: 10, texto: 'Estou no telefone com o cliente.' });
    expect(cobrancaAdiadaAte(t)).toBe('2026-11-13T11:15:00.000Z');
    expect(deveMostrarCobranca(t, 'c', as('11:10'))).toBe(false);
    expect(deveMostrarCobranca(t, 'c', as('11:15'))).toBe(true);
    expect(problemaDoAdiamento(t, 'c', 5, 'De novo', as('11:10'))).toBe('O tempo pedido ainda não acabou.');
    expect(problemaDoAdiamento(t, 'c', 5, 'De novo', as('11:16'))).toBe('');
    expect(deveMostrarCobranca(t, 'v', as('11:20'))).toBe(false);
  });

  it('a resposta fecha a cobrança e o adiamento junto; a lida do banco guarda os minutos', () => {
    const t = responder(adiar(cobrar(tarefa()), 5, 'Já volto', '2026-11-13T11:05:00.000Z'), 'Pronto.', '2026-11-13T11:08:00.000Z');
    expect(adiamentoDaCobranca(t)).toBeNull();
    expect(cobrancaAdiadaAte(t)).toBe('');
    expect(andamentoDaCobranca(t).map(textoDoPassoDaCobranca)).toEqual([
      'Vitor cobrou uma atualização: ' + TEXTO_DA_COBRANCA, 'Clara pediu mais 5 minutos: Já volto', 'Clara respondeu: Pronto.',
    ]);
    const { id, ...doc } = t;
    expect(lerTarefa(id, doc as unknown as Record<string, unknown>).pareceres[1]).toEqual({ por: 'Clara', em: '2026-11-13T11:05:00.000Z', texto: 'Já volto', tipo: 'adiamento', minutos: 5 });
  });

  it('quem cobrou recebe os pedidos de mais tempo e as respostas, o mais novo primeiro', () => {
    const t = responder(adiar(cobrar(tarefa()), 5, 'Já volto', '2026-11-13T11:05:00.000Z'), 'Pronto.', '2026-11-13T11:08:00.000Z');
    expect(retornosDasCobrancas([t], 'v').map(x => x.nota.tipo)).toEqual(['resposta', 'adiamento']);
    expect(retornosDasCobrancas([t], 'c')).toEqual([]);
  });
});
