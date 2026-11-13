import { describe, expect, it } from 'vitest';
import * as r from './reunioes';
import type { Anexo } from './delegadas';

const SENIOR = { uid: 's', nome: 'Fernando' };
const DIRETOR = { uid: 'd', nome: 'Nilma' };
const CLARA = { uid: 'c', nome: 'Clara' };
const FELIPE = { uid: 'f', nome: 'Felipe' };
const EM = '2026-11-13T12:00:00.000Z';
const ANTES = '2026-11-14T08:00';
const DEPOIS = '2026-11-14T10:00';
const arquivo = (nome: string): Anexo => ({ id: nome, nome, extensao: 'pdf', tamanho: 10, em: EM, por: 'Fernando', partes: 1 });
const pedido = (p: Partial<r.PedidoDeReuniao> = {}): r.PedidoDeReuniao => ({ titulo: 'Fechamento', pauta: 'A pauta', quando: '2026-11-14T09:00', link: '', participantes: [CLARA, FELIPE], comDiretor: false, tipo: 'equipe', duracao: 60, ...p });

describe('reuniões', () => {
  it('o papel pelo nível', () => {
    expect(r.papelPeloNivel('senior')).toBe('pede');
    expect(r.papelPeloNivel('dono')).toBe('aprova');
    expect(r.papelPeloNivel('pleno')).toBe('participa');
  });

  it('o Diretor ou o Dono participa: pelo nível dos convidados', () => {
    const equipe = [{ uid: 'c', nivel: 'pleno' as const }, { uid: 'd', nivel: 'dono' as const }];
    expect(r.comDiretorEntre([CLARA, FELIPE], equipe)).toBe(false);
    expect(r.comDiretorEntre([CLARA, DIRETOR], equipe)).toBe(true);
  });

  it('confere o pedido', () => {
    expect(r.problemaDoPedido(pedido({ titulo: ' ' }))).toMatch(/título/);
    expect(r.problemaDoPedido(pedido({ quando: '2026-11-14' }))).toMatch(/dia e a hora/);
    expect(r.problemaDoPedido(pedido({ pauta: '' }))).toMatch(/pauta/);
    expect(r.problemaDoPedido(pedido({ duracao: 0 }))).toMatch(/duração/);
    expect(r.problemaDoPedido(pedido({ tipo: 'live' }))).toMatch(/link da LIVE/);
    expect(r.problemaDoPedido(pedido())).toBe('');
  });

  it('o link só na LIVE; a duração fica', () => {
    const equipe = r.nova(pedido({ link: 'https://meet.google.com/x' }), { id: '1', por: SENIOR, em: EM, direta: false });
    expect(equipe.link).toBeUndefined();
    expect(equipe.duracao).toBe(60);
    const live = r.nova(pedido({ tipo: 'live', link: 'https://meet.google.com/x' }), { id: '2', por: SENIOR, em: EM, direta: false });
    expect(live).toMatchObject({ tipo: 'live', link: 'https://meet.google.com/x' });
    expect(r.rotuloDaDuracao(90)).toBe('1 h 30 min');
  });

  it('a recusa pede a justificativa', () => {
    const x = r.nova(pedido(), { id: '1', por: SENIOR, em: EM, direta: false });
    expect(() => r.decidir(x, false, ' ', 'Nilma', EM)).toThrow(/justificativa/);
    expect(r.decidir(x, false, 'Sem sala livre', 'Nilma', EM)).toMatchObject({ status: 'recusada', observacao: 'Sem sala livre' });
  });

  it('a do Sênior: em análise → revisando → aprovada → em andamento → finalizada → concluída → encerrada', () => {
    let x = r.nova(pedido(), { id: '1', por: SENIOR, em: EM, direta: false });
    expect(x.status).toBe('em-analise');
    expect(r.ve(x, CLARA.uid, false)).toBe(true);
    expect(r.ve(x, 'outro', false)).toBe(false);
    expect(r.acoes(x, { uid: DIRETOR.uid, aprova: true }, ANTES)).toEqual(['revisar', 'aprovar', 'recusar']);
    x = r.revisar(x, '2026-11-14', DIRETOR.nome, EM);
    expect(x.status).toBe('revisando');
    x = r.decidir(x, true, ' Sala 2 ', DIRETOR.nome, EM);
    expect(x).toMatchObject({ status: 'aprovada', observacao: 'Sala 2', decididoPor: 'Nilma' });
    expect('prazoDaRevisao' in x).toBe(false);
    expect(r.statusDaReuniao(x, ANTES)).toBe('aprovada');
    expect(r.statusDaReuniao(x, DEPOIS)).toBe('em-andamento');
    expect(r.acoes(x, { uid: SENIOR.uid, aprova: false }, DEPOIS)).toEqual(['remarcar', 'anexar']);
    expect(() => r.finalizar(x, SENIOR.nome, EM)).toThrow(/Problema/);
    x = r.anexar(r.anexar(x, 'problema', arquivo('p.pdf'), SENIOR.nome, EM), 'solucao', arquivo('s.pdf'), SENIOR.nome, EM);
    expect(r.acoes(x, { uid: SENIOR.uid, aprova: false }, DEPOIS)).toContain('finalizar');
    x = r.finalizar(x, SENIOR.nome, EM);
    expect(x.status).toBe('finalizada');
    expect(r.acoes(x, { uid: CLARA.uid, aprova: false }, DEPOIS)).toEqual(['comentar']);
    x = r.comentar(x, CLARA, 'Boa', EM);
    expect(x.status).toBe('finalizada');
    expect(r.faltaComentar(x).map(p => p.nome)).toEqual(['Felipe']);
    x = r.comentar(x, FELIPE, 'Ajudou', EM);
    expect(x.status).toBe('concluida');
    expect(r.acoes(x, { uid: DIRETOR.uid, aprova: true }, DEPOIS)).toEqual(['encerrar']);
    expect(r.encerrar(x, DIRETOR.nome, EM).status).toBe('encerrada');
  });

  it('a do Diretor já entra aprovada, todos veem e, finalizada, cai em encerrada', () => {
    let x = r.nova(pedido({ participantes: [] }), { id: '2', por: DIRETOR, em: EM, direta: true });
    expect(x.status).toBe('aprovada');
    expect(r.ve(x, 'qualquer', false)).toBe(true);
    x = r.anexar(r.anexar(x, 'problema', arquivo('p.pdf'), DIRETOR.nome, EM), 'solucao', arquivo('s.pdf'), DIRETOR.nome, EM);
    expect(r.finalizar(x, DIRETOR.nome, EM).status).toBe('encerrada');
  });

  it('recusa com a observação e remarca', () => {
    const x = r.nova(pedido(), { id: '3', por: SENIOR, em: EM, direta: false });
    expect(r.decidir(x, false, 'Fica para dezembro', DIRETOR.nome, EM).status).toBe('recusada');
    const rem = r.remarcar(r.decidir(x, true, '', DIRETOR.nome, EM), '2026-11-20T14:00', SENIOR.nome, EM);
    expect(rem).toMatchObject({ status: 'remarcada', quando: '2026-11-20T14:00' });
    expect(r.statusDaReuniao(rem, '2026-11-20T14:00')).toBe('em-andamento');
  });
});

describe('a presença na reunião', () => {
  it('o convidado responde Vou ou Não vou; quem criou vê quem falta', () => {
    let x = r.decidir(r.nova(pedido(), { id: '9', por: SENIOR, em: EM, direta: false }), true, '', DIRETOR.nome, EM);
    expect(r.acoes(x, { uid: CLARA.uid, aprova: false }, ANTES)).toEqual(['confirmar']);
    expect(r.acoes(x, { uid: CLARA.uid, aprova: false }, DEPOIS)).toEqual([]);
    x = r.confirmarPresenca(x, CLARA, true, EM);
    x = r.confirmarPresenca(x, CLARA, false, EM);
    expect(x.presencas).toEqual([{ uid: 'c', nome: 'Clara', vai: false, em: EM }]);
    expect(r.semResposta(x).map(p => p.nome)).toEqual(['Felipe']);
    expect(() => r.confirmarPresenca(x, DIRETOR, true, EM)).toThrow(/convidado/);
  });
});
