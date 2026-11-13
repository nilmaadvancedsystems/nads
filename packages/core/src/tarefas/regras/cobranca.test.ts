// A cobrança da tarefa delegada (13/11/2026: "um icone de sino, nas tarefas delegadas, para meio que 'Cobrar' a tarefa e
// cobrar atualizacoes, o usuario cobrado vai ter o botao, 'Responder cobranca'").
import { describe, expect, it } from 'vitest';
import {
  cobrancaAberta, comCobranca, deveResponderCobranca, historicoDaCobranca, historicoDaRespostaDaCobranca, notaDaCobranca, notaDaResposta,
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
