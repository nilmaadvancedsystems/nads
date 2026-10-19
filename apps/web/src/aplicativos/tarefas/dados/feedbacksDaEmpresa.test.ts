import { describe, expect, it } from 'vitest';
import { criarFeedbacksDaEmpresaMemoria } from './feedbacksDaEmpresa';

describe('os feedbacks da empresa de exemplo (memória)', () => {
  const repo = (quem = 'Vitor') => criarFeedbacksDaEmpresaMemoria(() => quem);
  const tresM = '3m-empreendimentos-florestais-ltda';

  it('começa com feedbacks abertos e um resolvido, e diz quem está', () => {
    const r = repo();
    expect(r.eu()).toEqual({ uid: 'Vitor', nome: 'Vitor' });
    expect(r.daEmpresa(tresM).lista).toHaveLength(3);
    expect(r.abertos().lista.every(f => !f.resolvido)).toBe(true);
    expect(r.abertos().lista.some(f => f.empresa === tresM && f.prioridade === 'alta')).toBe(true);
  });

  it('enviar põe o feedback aberto, em nome de quem está; resolver e reabrir; apagar', async () => {
    const r = repo('Fernando');
    await r.enviar({ empresa: 'a7-mobile-ltda', codigo: 515, texto: 'Cliente manda as notas por foto', prioridade: 'alta' });
    const [novo] = r.daEmpresa('a7-mobile-ltda').lista;
    expect(novo).toMatchObject({ autorUid: 'Fernando', autorNome: 'Fernando', resolvido: false, prioridade: 'alta', codigo: 515 });
    expect(r.abertos().lista.some(f => f.id === novo.id)).toBe(true);

    await r.resolver(novo.id, true);
    const resolvido = r.daEmpresa('a7-mobile-ltda').lista[0];
    expect(resolvido).toMatchObject({ resolvido: true, resolvidoPor: 'Fernando' });
    expect(resolvido.resolvidoEm).not.toBe('');
    expect(r.abertos().lista.some(f => f.id === novo.id)).toBe(false);

    await r.resolver(novo.id, false);
    expect(r.daEmpresa('a7-mobile-ltda').lista[0]).toMatchObject({ resolvido: false, resolvidoPor: '', resolvidoEm: '' });

    await r.apagar(novo.id);
    expect(r.daEmpresa('a7-mobile-ltda').lista).toHaveLength(0);
  });

  it('a lista é a mesma enquanto nada muda (a tela não redesenha à toa) e avisa quem ouve', async () => {
    const r = repo();
    expect(r.daEmpresa(tresM)).toBe(r.daEmpresa(tresM));
    let avisos = 0;
    const parar = r.assinar(() => { avisos++; });
    await r.enviar({ empresa: tresM, codigo: 462, texto: 'Outro', prioridade: 'baixa' });
    expect(avisos).toBe(1);
    expect(r.daEmpresa(tresM).lista).toHaveLength(4);
    parar();
  });

  it('sem ninguém escolhido, não envia', async () => {
    await expect(repo('').enviar({ empresa: tresM, codigo: 462, texto: 'x', prioridade: 'baixa' })).rejects.toThrow();
  });
});
