import { describe, expect, it } from 'vitest';
import type { Papel } from '../usuarios/tipos';
import { delegacaoNova, lerDelegacao, quemRecebeOFeedback, textoDaDelegacao } from './delegacao';

const pessoa = (uid: string, nome: string, papeis: Papel[], ativo = true, email = uid + '@nilma.local') => ({ uid, nome, email, ativo, papeis });

const equipe = [
  pessoa('v', 'Vitor', ['staff', 'contabil', 'desenvolvedor']),
  pessoa('g', 'Gustavo', ['staff', 'admin', 'desenvolvedor']),
  pessoa('c', 'Clara', ['staff', 'contabil']),
  pessoa('x', 'Antigo', ['staff', 'desenvolvedor'], false),
  pessoa('r', 'Xereta', ['staff', 'desenvolvedor'], true, 'fiscal.xereta@nilma.local'),
];

describe('delegar a solicitação dos Feedbacks', () => {
  it('só quem tem a função de desenvolvedor, ativo e fora das contas reservadas, em ordem de nome', () => {
    expect(quemRecebeOFeedback(equipe)).toEqual([{ uid: 'g', nome: 'Gustavo' }, { uid: 'v', nome: 'Vitor' }]);
    expect(quemRecebeOFeedback([pessoa('c', 'Clara', ['staff'])])).toEqual([]);
  });

  it('grava para quem, quem passou e quando; recusa quem não é desenvolvedor', () => {
    const podem = quemRecebeOFeedback(equipe);
    const agora = new Date('2026-11-16T15:30:00.000Z');
    expect(delegacaoNova({ uid: 'v', nome: ' Vitor ' }, podem, 'Gustavo', agora)).toEqual({ uid: 'v', nome: 'Vitor', por: 'Gustavo', em: '2026-11-16T15:30:00.000Z' });
    expect(() => delegacaoNova({ uid: 'c', nome: 'Clara' }, podem, 'Gustavo', agora)).toThrow(/desenvolvedor/);
    expect(() => delegacaoNova({ uid: '', nome: '' }, podem, 'Gustavo', agora)).toThrow();
  });

  it('lê do banco só a delegação com uid e nome', () => {
    expect(lerDelegacao({ uid: 'v', nome: 'Vitor', por: 'Gustavo', em: '2026-11-16T15:30:00.000Z' })).toEqual({ uid: 'v', nome: 'Vitor', por: 'Gustavo', em: '2026-11-16T15:30:00.000Z' });
    expect(lerDelegacao({ uid: 'v', nome: 'Vitor' })).toEqual({ uid: 'v', nome: 'Vitor', por: '', em: '' });
    expect(lerDelegacao(undefined)).toBeNull();
    expect(lerDelegacao({ uid: 'v' })).toBeNull();
    expect(lerDelegacao('Vitor')).toBeNull();
  });

  it('o texto da janela: "Delegada a Fulano", com quem passou e quando', () => {
    expect(textoDaDelegacao(null)).toBeNull();
    const t = textoDaDelegacao({ uid: 'v', nome: 'Vitor', por: 'Gustavo', em: '2026-11-16T15:30:00.000Z' });
    expect(t?.titulo).toBe('Delegada a Vitor');
    expect(t?.detalhe).toMatch(/^por Gustavo em 16\/11/);
    expect(textoDaDelegacao({ uid: 'v', nome: 'Vitor', por: '', em: '' })).toEqual({ titulo: 'Delegada a Vitor', detalhe: '' });
  });
});
