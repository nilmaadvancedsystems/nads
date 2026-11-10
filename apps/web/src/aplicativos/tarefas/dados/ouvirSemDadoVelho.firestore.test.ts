import { describe, expect, it, vi } from 'vitest';
import { criarFiltroDeFotos } from './ouvirSemDadoVelho.firestore';

type F = { metadata: { fromCache: boolean }; docChanges?: () => unknown[]; exists?: () => boolean; data?: () => unknown };
const consulta = (fromCache: boolean, mudancas = 1): F => ({ metadata: { fromCache }, docChanges: () => Array(mudancas).fill(0) });
const documento = (fromCache: boolean, v: unknown): F => ({ metadata: { fromCache }, exists: () => true, data: () => ({ v }) });

function montar(online = true) {
  const chegaram: F[] = [];
  let agendado: (() => void) | null = null;
  const cancelar = vi.fn(() => { agendado = null; });
  const f = criarFiltroDeFotos<F>(s => chegaram.push(s), {
    esperaMs: 10, agendar: g => { agendado = g; return 1; }, cancelar, online: () => online,
  });
  return { f, chegaram, cancelar, disparar: () => agendado?.() };
}

describe('o cache local não põe dado velho na tela', () => {
  it('segura a foto só do cache e entrega a do servidor', () => {
    const { f, chegaram, cancelar } = montar();
    const velha = consulta(true), nova = consulta(false, 0);
    f.chegou(velha);
    expect(chegaram).toEqual([]);
    f.chegou(nova);
    expect(chegaram).toEqual([nova]);
    expect(cancelar).toHaveBeenCalled();
  });
  it('sem mudança nenhuma, a primeira foto do servidor chega mesmo assim', () => {
    const { f, chegaram } = montar();
    f.chegou(consulta(true));
    f.chegou(consulta(false, 0));
    expect(chegaram).toHaveLength(1);
  });
  it('depois da primeira, a consulta só avisa quando os dados mudam', () => {
    const { f, chegaram } = montar();
    f.chegou(consulta(false));
    f.chegou(consulta(false, 0));
    f.chegou(consulta(true, 0));
    expect(chegaram).toHaveLength(1);
    f.chegou(consulta(false, 2));
    expect(chegaram).toHaveLength(2);
  });
  it('o documento só avisa quando o conteúdo muda', () => {
    const { f, chegaram } = montar();
    f.chegou(documento(true, 'velho'));
    expect(chegaram).toHaveLength(0);
    f.chegou(documento(false, 'novo'));
    f.chegou(documento(false, 'novo'));
    expect(chegaram).toHaveLength(1);
    f.chegou(documento(false, 'outro'));
    expect(chegaram).toHaveLength(2);
  });
  it('sem rede, entrega o guardado na hora', () => {
    const { f, chegaram } = montar(false);
    f.chegou(consulta(true));
    expect(chegaram).toHaveLength(1);
  });
  it('rede ligada sem o servidor responder: entrega o guardado depois da espera, uma vez', () => {
    const { f, chegaram, disparar } = montar();
    const primeira = consulta(true), segunda = consulta(true);
    f.chegou(primeira);
    f.chegou(segunda);
    expect(chegaram).toEqual([]);
    disparar();
    expect(chegaram).toEqual([segunda]);
    f.chegou(consulta(false, 0));
    expect(chegaram).toHaveLength(1);
  });
  it('parou de ouvir: o relógio não entrega mais nada', () => {
    const { f, chegaram, cancelar } = montar();
    f.chegou(consulta(true));
    f.parar();
    expect(cancelar).toHaveBeenCalled();
    expect(chegaram).toEqual([]);
  });
});
