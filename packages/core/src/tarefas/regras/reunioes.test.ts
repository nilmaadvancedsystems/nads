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

  it('a confirmação de presença só quando quem marca pede (18/11/2026)', () => {
    expect(r.nova(pedido(), { id: '1', por: SENIOR, em: EM, direta: false }).pedirPresenca).toBeUndefined();
    expect(r.nova(pedido({ pedirPresenca: true }), { id: '2', por: SENIOR, em: EM, direta: false }).pedirPresenca).toBe(true);
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
    // passou da hora sem Iniciar: continua aprovada, piscando no dia (24/11/2026)
    expect(r.statusDaReuniao(x, DEPOIS)).toBe('aprovada');
    expect(r.piscaNoDia(x, DEPOIS)).toBe(true);
    expect(r.acoes(x, { uid: SENIOR.uid, aprova: false }, '2026-11-13T18:00')).toEqual(['remarcar', 'cancelar']);
    expect(r.acoes(x, { uid: SENIOR.uid, aprova: false }, ANTES)).toEqual(['remarcar', 'cancelar', 'iniciar']);
    expect(r.acoes(x, { uid: CLARA.uid, aprova: false }, ANTES)).toEqual(['confirmar']);
    x = r.iniciar(x, SENIOR.nome, EM);
    expect(x.iniciadaEm).toBe(EM);
    expect(r.statusDaReuniao(x, ANTES)).toBe('em-andamento');
    expect(r.piscaNoDia(x, DEPOIS)).toBe(false);
    expect(r.iniciar(x, SENIOR.nome, 'outra')).toBe(x);
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
    expect(r.statusDaReuniao(rem, '2026-11-20T14:00')).toBe('remarcada');
    // iniciada e remarcada: volta a esperar o Iniciar no dia novo
    const iniciada = r.iniciar(rem, SENIOR.nome, EM);
    expect(r.statusDaReuniao(iniciada)).toBe('em-andamento');
    const deNovo = r.remarcar(iniciada, '2026-11-21T09:00', SENIOR.nome, EM);
    expect('iniciadaEm' in deNovo).toBe(false);
    expect(r.piscaNoDia(deNovo, '2026-11-21T07:00')).toBe(true);
    expect(r.piscaNoDia(deNovo, '2026-11-20T23:00')).toBe(false);
  });

  it('cancela antes de começar; remarcar guarda o dia de antes (24/11/2026)', () => {
    const x = r.decidir(r.nova(pedido(), { id: '5', por: SENIOR, em: EM, direta: false }), true, '', DIRETOR.nome, EM);
    expect(r.acoes(x, { uid: SENIOR.uid, aprova: false }, ANTES)).toEqual(['remarcar', 'cancelar', 'iniciar']);
    expect(r.acoes(x, { uid: CLARA.uid, aprova: false }, ANTES)).toEqual(['confirmar']);
    const c = r.cancelar(x, SENIOR.nome, '2026-11-14T10:00:00.000Z');
    expect(c).toMatchObject({ status: 'cancelada', canceladaEm: '2026-11-14T10:00:00.000Z' });
    expect(r.acoes(c, { uid: SENIOR.uid, aprova: false }, ANTES)).toEqual([]);
    expect(() => r.cancelar(r.iniciar(x, SENIOR.nome, EM), SENIOR.nome, EM)).toThrow(/não iniciada/);
    const agora = Date.parse('2026-11-14T10:00:00.000Z');
    expect(r.recente(c.canceladaEm, agora + 23 * 3600_000)).toBe(true);
    expect(r.recente(c.canceladaEm, agora + 25 * 3600_000)).toBe(false);
    const rem = r.remarcar(x, '2026-11-15T09:00', SENIOR.nome, EM);
    expect(rem).toMatchObject({ remarcadaDe: '2026-11-14T09:00', remarcadaEm: EM, quando: '2026-11-15T09:00' });
    expect('remarcadaDe' in r.remarcar(x, x.quando, SENIOR.nome, EM)).toBe(false);
  });

  it('só a aprovada é iniciada', () => {
    const x = r.nova(pedido(), { id: '4', por: SENIOR, em: EM, direta: false });
    expect(() => r.iniciar(x, SENIOR.nome, EM)).toThrow(/aprovada/);
    expect(r.piscaNoDia(x, '2026-11-14T07:00')).toBe(false);
  });
});

describe('a presença na reunião', () => {
  it('o convidado responde Vou ou Não vou; quem criou vê quem falta', () => {
    let x = r.decidir(r.nova(pedido(), { id: '9', por: SENIOR, em: EM, direta: false }), true, '', DIRETOR.nome, EM);
    expect(r.acoes(x, { uid: CLARA.uid, aprova: false }, ANTES)).toEqual(['confirmar']);
    expect(r.acoes(r.iniciar(x, SENIOR.nome, EM), { uid: CLARA.uid, aprova: false }, DEPOIS)).toEqual([]);
    x = r.confirmarPresenca(x, CLARA, true, EM);
    x = r.confirmarPresenca(x, CLARA, false, EM);
    expect(x.presencas).toEqual([{ uid: 'c', nome: 'Clara', vai: false, em: EM }]);
    expect(r.semResposta(x).map(p => p.nome)).toEqual(['Felipe']);
    expect(() => r.confirmarPresenca(x, DIRETOR, true, EM)).toThrow(/convidado/);
  });
});
