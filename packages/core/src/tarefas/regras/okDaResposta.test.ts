// O ok na resposta da cobrança (24/11/2026): quem cobrou dá o ok e quem respondeu fica sabendo.
import { describe, expect, it } from 'vitest';
import { comCobranca, historicoDaRespostaDaCobranca, historicoDoOk, notaDaCobranca, notaDaResposta, notaDoOk, okDaResposta, oksRecebidos, podeDarOk, ultimaResposta, type TarefaDelegada } from './delegadas';

const EU = { uid: 'eu', nome: 'Pessoa Que Delega' };
const ANA = { uid: 'a', nome: 'Ana Exemplo' };
const base: TarefaDelegada = {
  id: '1', numero: 1, titulo: 'Tarefa', descricao: '', cliente: null, clientes: [], prioridade: 'normal', prazo: '', prazoHora: '',
  status: 'andamento', criadaPor: EU, responsavel: ANA, criadaEm: 'a', concluidaEm: '', atualizadaEm: 'a', pareceres: [], historico: [], anexos: [],
};

describe('o ok na resposta', () => {
  it('só quem cobrou, depois da resposta, uma vez', () => {
    let t = comCobranca(base, notaDaCobranca('', EU.nome, '1'), historicoDaRespostaDaCobranca(EU.nome, '1'));
    expect(podeDarOk(t, EU.uid)).toBe(false);
    t = comCobranca(t, notaDaResposta('Feito o cliente', ANA.nome, '2'), historicoDaRespostaDaCobranca(ANA.nome, '2'));
    expect(podeDarOk(t, ANA.uid)).toBe(false);
    expect(podeDarOk(t, EU.uid)).toBe(true);
    t = comCobranca(t, notaDoOk(EU.nome, '3'), historicoDoOk(EU.nome, '3'));
    expect(okDaResposta(t)?.por).toBe(EU.nome);
    expect(ultimaResposta(t)?.texto).toBe('Feito o cliente');
    expect(podeDarOk(t, EU.uid)).toBe(false);
    expect(oksRecebidos([t], ANA.uid).map(x => x.nota.texto)).toEqual(['Viu a resposta e deu ok']);
    // cobrou de novo: o ok de antes não vale para a próxima resposta
    t = comCobranca(t, notaDaCobranca('', EU.nome, '4'), historicoDaRespostaDaCobranca(EU.nome, '4'));
    expect(okDaResposta(t)).toBeNull();
  });
});
