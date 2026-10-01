import { describe, expect, it } from 'vitest';
import { erroDaFila, haQuanto, saudeDoRobo } from '.';

const AGORA = Date.parse('2026-10-01T15:00:00Z');
const ha = (min: number) => new Date(AGORA - min * 60000).toISOString();

describe('saúde do robô', () => {
  it('tempo relativo', () => {
    expect(haQuanto(ha(0.5), AGORA)).toBe('agora há pouco');
    expect(haQuanto(ha(5), AGORA)).toBe('há 5 min');
    expect(haQuanto(ha(180), AGORA)).toBe('há 3 h');
    expect(haQuanto(ha(3 * 24 * 60), AGORA)).toBe('há 3 dias');
    expect(haQuanto('', AGORA)).toBe('');
  });

  it('robô vivo, caixas, arquivador parado e erros da fila', () => {
    const itens = saudeDoRobo({
      estado: {
        vigia: { em: ha(1), pc: 'nuvem-google' }, status: 'ok', ultimaExecucao: ha(30), ultimaExecucaoResumo: '3 e-mails',
        caixas: { robo: { autorizada: true, email: 'robo@x.com' }, contabil: { autorizada: false }, fiscal: { autorizada: true, erro: 'expirou' } },
        backup: { ok: true, em: ha(600) },
      },
      arquivador: { em: ha(90), situacao: 'livre' },
      uso: null,
      raiz: { atualizadoEm: ha(2), varreduraEm: ha(700) },
      erros: [erroDaFila({ tipo: 'um', erro: 'e-mail fora do cadastro', erroEm: ha(60), clienteNome: 'PADARIA' }), erroDaFila({ tipo: 'um', erro: 'velho', erroEm: ha(2000) })],
    }, AGORA);
    const por = Object.fromEntries(itens.map(i => [i.id, i]));
    expect(por.robo.tom).toBe('ok');
    expect(por.robo.texto).toBe('Ligado (nuvem-google)');
    expect([por.gmail.tom, por.gmail.texto]).toEqual(['ok', 'Última leitura há 30 min']);
    expect([por['caixa-robo'].texto, por['caixa-contabil'].tom, por['caixa-fiscal'].tom]).toEqual(['robo@x.com', 'neutro', 'erro']);
    expect(por['caixa-contabil'].detalhe).toMatch(/Gmail do robô/);
    expect(por.arquivador.tom).toBe('aviso');
    expect(por.drive.tom).toBe('ok');
    expect(por.backup.tom).toBe('ok');
    expect([por.fila.tom, por.fila.texto, por.fila.detalhe]).toEqual(['aviso', '1 pedido deu erro', 'cobrança de PADARIA: e-mail fora do cadastro']);
  });

  it('robô parado e leitura velha', () => {
    const itens = saudeDoRobo({ estado: { vigia: { em: ha(30) }, ultimaExecucao: ha(30 * 60) }, arquivador: null, uso: null, raiz: null, erros: [] }, AGORA);
    expect(itens[0]).toMatchObject({ tom: 'erro', texto: 'Parado — último sinal há 30 min' });
    expect(itens[1].tom).toBe('aviso');
    expect(saudeDoRobo({ estado: null, arquivador: null, uso: null, raiz: null, erros: [] }, AGORA)[0].tom).toBe('neutro');
  });
});
