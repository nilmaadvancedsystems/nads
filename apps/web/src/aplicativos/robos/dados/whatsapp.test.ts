import { robos } from '@nads/core';
import { describe, expect, it } from 'vitest';
// as regras do WhatsApp do robô (robo/whatsapp-regras.js) e a leitura do nads (core/robos/whatsapp.ts): o que o robô grava
// em robo/estado.whatsapp tem de voltar igual na tela, e a trava e o freio não podem afrouxar sem ninguém ver
// @ts-expect-error: o robô é CommonJS sem tipos (robo/ fica fora do app)
import roboImportado from '../../../../../../robo/whatsapp-regras.js';

type Solto = Record<string, unknown>;
const R = roboImportado as {
  LIBERADO_PARA_CLIENTES: boolean; NUMEROS_DE_TESTE: string[]; LIMITE_POR_HORA: number; LIMITE_POR_DIA: number; INTERVALO_MIN_MS: number; INTERVALO_MAX_MS: number;
  numeroDoWhatsApp(t: unknown): string; numeroFormatado(n: string): string;
  motivoParaNaoMandar(p: Solto, cliente: Solto | null, o?: { liberado?: boolean; teste?: string[] }): string;
  motivoDoFreio(enviados: number[], agora: number): string;
  esperaAntesDeMandar(ultimo: number, agora: number, sorteio: number): number;
  estadoParaOBanco(e: Solto, agora: number): Solto;
  podeComandar(u: Solto | null): boolean;
};

const AGORA = Date.parse('2026-11-12T15:00:00.000Z');
const MIN = 60000;
const ESCRITORIO = '553891383638';
const CLIENTE = { nome: 'Padaria Boa', telefone: '(38) 99999-1234' };

describe('a trava do robô', () => {
  it('vem fechada: só o WhatsApp do escritório', () => {
    expect(R.LIBERADO_PARA_CLIENTES).toBe(false);
    expect(R.NUMEROS_DE_TESTE).toEqual([ESCRITORIO]);
  });

  it('o número de teste passa sem cliente; o do cliente, só liberado e se for o do cadastro', () => {
    expect(R.motivoParaNaoMandar({ para: ESCRITORIO, texto: 'oi' }, null)).toBe('');
    expect(R.motivoParaNaoMandar({ para: '38999991234', texto: 'oi' }, CLIENTE)).toMatch(/ainda não foi liberado/);
    expect(R.motivoParaNaoMandar({ para: '38999991234', texto: 'oi' }, CLIENTE, { liberado: true })).toBe('');
    expect(R.motivoParaNaoMandar({ para: '38988887777', texto: 'oi' }, CLIENTE, { liberado: true })).toBe('(38) 98888-7777 não é o telefone do cadastro deste cliente');
    expect(R.motivoParaNaoMandar({ para: '38999991234', texto: 'oi' }, null, { liberado: true })).toBe('cliente não encontrado');
  });

  it('número inválido, texto vazio ou longo demais não saem', () => {
    expect(R.motivoParaNaoMandar({ para: '1234', texto: 'oi' }, null)).toMatch(/inválido/);
    expect(R.motivoParaNaoMandar({ para: ESCRITORIO, texto: '   ' }, null)).toBe('mensagem vazia');
    expect(R.motivoParaNaoMandar({ para: ESCRITORIO, texto: 'x'.repeat(4001) }, null)).toMatch(/longa demais/);
  });
});

describe('o freio', () => {
  it('até 30 por hora e 150 por dia', () => {
    expect(R.motivoDoFreio([], AGORA)).toBe('');
    const naHora = Array.from({ length: R.LIMITE_POR_HORA }, (_, i) => AGORA - i * MIN);
    expect(R.motivoDoFreio(naHora, AGORA)).toMatch(/por hora/);
    expect(R.motivoDoFreio(naHora.slice(1), AGORA)).toBe('');
    const noDia = Array.from({ length: R.LIMITE_POR_DIA }, (_, i) => AGORA - 2 * 36e5 - i * MIN);
    expect(R.motivoDoFreio(noDia, AGORA)).toMatch(/por dia/);
    expect(R.motivoDoFreio(noDia.map(t => t - 864e5), AGORA)).toBe('');
  });

  it('de 20 a 60 segundos entre uma mensagem e outra', () => {
    expect(R.esperaAntesDeMandar(0, AGORA, 0.5)).toBe(0);
    expect(R.esperaAntesDeMandar(AGORA, AGORA, 0)).toBe(R.INTERVALO_MIN_MS);
    expect(R.esperaAntesDeMandar(AGORA, AGORA, 1)).toBe(R.INTERVALO_MAX_MS);
    expect(R.esperaAntesDeMandar(AGORA - 2 * MIN, AGORA, 1)).toBe(0);
  });
});

describe('o número', () => {
  it('55 + DDD + número, como o wa.me', () => {
    expect(R.numeroDoWhatsApp('(38) 99999-1234')).toBe('5538999991234');
    expect(R.numeroDoWhatsApp('+55 38 9138-3638')).toBe(ESCRITORIO);
    expect(R.numeroDoWhatsApp('999')).toBe('');
    expect(R.numeroFormatado(ESCRITORIO)).toBe('(38) 9138-3638');
  });
});

describe('a situação: o robô grava, o nads lê', () => {
  const ler = (e: Solto, agora = AGORA) => robos.lerWhatsappDoRobo(R.estadoParaOBanco(e, AGORA), new Date(agora));

  it('conectado e com notícia recente: pronto, com o número e a trava', () => {
    const w = ler({ situacao: 'conectado', numero: '5538999990000', nome: 'Nilma', desde: '2026-11-12T14:00:00.000Z', qr: 'não vai' });
    expect(w).toMatchObject({ situacao: 'conectado', numero: '5538999990000', nome: 'Nilma', qr: '', pronto: true, liberado: false, teste: [ESCRITORIO] });
    expect(robos.mandaPeloRobo(w, ESCRITORIO)).toBe(true);
    expect(robos.mandaPeloRobo(w, '5538999991234')).toBe(false);
    expect(robos.mandaPeloRobo({ ...w, liberado: true }, '5538999991234')).toBe(true);
  });

  it('sem notícia há mais de 30 min, não está pronto', () => {
    const w = ler({ situacao: 'conectado', numero: '5538999990000' }, AGORA + 31 * MIN);
    expect(w.pronto).toBe(false);
    expect(robos.mandaPeloRobo(w, ESCRITORIO)).toBe(false);
  });

  it('o QR só vai enquanto espera a leitura; o número só quando conectado', () => {
    expect(ler({ situacao: 'aguardando-qr', qr: '2@abc', numero: '5538999990000' })).toMatchObject({ qr: '2@abc', numero: '', pronto: false });
    expect(ler({ situacao: 'desconectado', motivo: 'o QR venceu' })).toMatchObject({ qr: '', motivo: 'o QR venceu', pronto: false });
    expect(robos.lerWhatsappDoRobo(undefined, new Date(AGORA)).situacao).toBe('desligado');
    expect(ler({ situacao: 'qualquer' }).situacao).toBe('desligado');
  });

  it('só o que está na lista vai ao banco', () => {
    expect(Object.keys(R.estadoParaOBanco({ situacao: 'conectado', segredo: 'x' }, AGORA)).sort()).toEqual(['atualizadoEm', 'desde', 'liberado', 'motivo', 'nome', 'numero', 'qr', 'situacao', 'teste']);
  });
});

describe('quem comanda', () => {
  it('só admin ativo conecta ou desconecta', () => {
    expect(R.podeComandar({ roles: ['admin'] })).toBe(true);
    expect(R.podeComandar({ roles: ['admin'], ativo: false })).toBe(false);
    expect(R.podeComandar({ roles: ['contabil'] })).toBe(false);
    expect(R.podeComandar(null)).toBe(false);
  });
});
