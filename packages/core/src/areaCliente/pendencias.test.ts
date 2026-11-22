// O que falta o cliente mandar (plano do Acessórias, 17/11/2026, fichas o-que-falta-mandar e pedidos-do-mandei).
import { describe, expect, it } from 'vitest';
import { competenciaDoEnvio, documentoDoEnvio, envioDaPendencia, pendenciasDoMes } from './pendencias';

describe('o que falta mandar', () => {
  it('os títulos do NADS, o tipo do envio e os ids estáveis', () => {
    expect(pendenciasDoMes(['extrato', 'aplicacao', 'coisa'], '2026-10')).toEqual([
      { id: 'extrato-2026-10', titulo: 'Extrato bancário de outubro', tipo: 'extrato', competencia: '2026-10' },
      { id: 'aplicacao-2026-10', titulo: 'Extrato da aplicação de outubro', tipo: 'extrato', competencia: '2026-10' },
    ]);
    expect(pendenciasDoMes(['comprovante'], '2026-01')[0].titulo).toBe('Comprovantes de pagamento de janeiro');
    expect(pendenciasDoMes(['extrato'], 'outubro')).toEqual([]);
  });
  it('o mês do extrato mandado pela Área: o do nome; sem ele, o anterior ao envio', () => {
    const novembro = new Date(2026, 10, 5);
    expect(competenciaDoEnvio('extrato', novembro, 'extrato-sicoob.pdf')).toBe('2026-10');
    expect(competenciaDoEnvio('extrato', novembro, 'Extrato SICOOB 09-2026.pdf')).toBe('2026-09');
    expect(competenciaDoEnvio('extrato', novembro, 'extrato 08/2026.pdf')).toBe('2026-08');
    expect(competenciaDoEnvio('extrato', new Date(2027, 0, 3), 'x.pdf')).toBe('2026-12');
    expect(competenciaDoEnvio('nota', novembro, 'notas 10-2026.zip')).toBeNull();
    // o comprovante também baixa (22/11/2026)
    expect(competenciaDoEnvio('comprovante', novembro, 'x.pdf')).toBe('2026-10');
  });
});

describe('qual documento o envio baixa e o que o aviso abre (22/11/2026)', () => {
  it('extrato, aplicação pelo nome, comprovante; nota e outro não', () => {
    expect(documentoDoEnvio('extrato', 'sicoob.pdf')).toBe('extrato');
    expect(documentoDoEnvio('extrato', 'Aplicação - rendimentos.pdf')).toBe('aplicacao');
    expect(documentoDoEnvio('extrato', 'aplicacao 10-2026.pdf')).toBe('aplicacao');
    expect(documentoDoEnvio('comprovante', 'Comprovante FGTS 10-2026 - x.pdf')).toBe('comprovante');
    expect(documentoDoEnvio('nota', 'x.zip')).toBeNull();
    expect(documentoDoEnvio('outro', 'x.pdf')).toBeNull();
  });
  it('o aviso da aplicação abre o extrato com o prefixo; os outros, sem', () => {
    expect(envioDaPendencia('aplicacao-2026-10')).toEqual({ documento: 'aplicacao', tipo: 'extrato', prefixo: 'Aplicação', competencia: '2026-10' });
    expect(envioDaPendencia('comprovante-2026-10')).toEqual({ documento: 'comprovante', tipo: 'comprovante', competencia: '2026-10' });
    expect(envioDaPendencia('ticket-9')).toBeNull();
  });
});
