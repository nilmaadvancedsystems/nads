// O que falta o cliente mandar (plano do Acessórias, 17/11/2026, fichas o-que-falta-mandar e pedidos-do-mandei).
import { describe, expect, it } from 'vitest';
import { competenciaDoEnvio, pendenciasDoMes } from './pendencias';

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
    expect(competenciaDoEnvio('comprovante', novembro, 'x.pdf')).toBeNull();
  });
});
