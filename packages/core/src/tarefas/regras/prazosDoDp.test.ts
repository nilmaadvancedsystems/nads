import { describe, expect, it } from 'vitest';
import { diasAtePrazo, prazoDaObrigacaoDp, prazoMaisUrgenteDoDp } from './prazosDoDp';

describe('prazos do DP', () => {
  it('a folha vence no 5º dia útil do mês seguinte, contando o sábado e não o domingo nem o feriado', () => {
    // outubro/2026: qui 1, sex 2, sáb 3, (dom 4), seg 5, ter 6
    expect(prazoDaObrigacaoDp('folha', '2026-09')).toBe('2026-10-06');
    expect(prazoDaObrigacaoDp('recibos', '2026-09')).toBe('2026-10-06');
    // novembro/2026: (dom 1), (seg 2, Finados), ter 3, qua 4, qui 5, sex 6, sáb 7
    expect(prazoDaObrigacaoDp('folha', '2026-10')).toBe('2026-11-07');
  });

  it('o eSocial e a REINF vencem no dia 15 e antecipam quando não há expediente', () => {
    expect(prazoDaObrigacaoDp('s1299', '2026-09')).toBe('2026-10-15');
    expect(prazoDaObrigacaoDp('s1200', '2026-09')).toBe('2026-10-15');
    expect(prazoDaObrigacaoDp('reinf', '2026-09')).toBe('2026-10-15');
    // 15/11/2026 é domingo e feriado: antecipa para a sexta, 13
    expect(prazoDaObrigacaoDp('s1299', '2026-10')).toBe('2026-11-13');
  });

  it('o FGTS Digital, a DCTFWeb e o DARF vencem no dia 20 e antecipam', () => {
    expect(prazoDaObrigacaoDp('fgts', '2026-09')).toBe('2026-10-20');
    expect(prazoDaObrigacaoDp('dctfweb', '2026-09')).toBe('2026-10-20');
    expect(prazoDaObrigacaoDp('darf', '2026-09')).toBe('2026-10-20');
    // 20/11/2026 é feriado (Consciência Negra): antecipa para a quinta, 19
    expect(prazoDaObrigacaoDp('fgts', '2026-10')).toBe('2026-11-19');
    // dezembro vira janeiro do ano seguinte: 20/01/2027 é quarta
    expect(prazoDaObrigacaoDp('darf', '2026-12')).toBe('2027-01-20');
  });

  it('a entrega vale o prazo da guia mais cedo do cliente; sem guia, o da folha', () => {
    expect(prazoDaObrigacaoDp('envio', '2026-09', ['folha', 'fgts', 'darf'])).toBe('2026-10-20');
    expect(prazoDaObrigacaoDp('envio', '2026-09', ['folha', 's1299'])).toBe('2026-10-06');
  });

  it('a categoria criada no nads não tem prazo', () => {
    expect(prazoDaObrigacaoDp('x-ferias', '2026-09')).toBeNull();
    expect(prazoDaObrigacaoDp('folha', 'setembro')).toBeNull();
  });

  it('conta os dias até o prazo (negativo = venceu)', () => {
    const hoje = new Date(2026, 9, 18, 15, 30);
    expect(diasAtePrazo('2026-10-20', hoje)).toBe(2);
    expect(diasAtePrazo('2026-10-18', hoje)).toBe(0);
    expect(diasAtePrazo('2026-10-15', hoje)).toBe(-3);
  });

  it('a mais urgente é a pendente de prazo mais cedo', () => {
    const hoje = new Date(2026, 9, 18);
    expect(prazoMaisUrgenteDoDp(['fgts', 's1299'], ['folha', 'fgts', 's1299'], '2026-09', hoje)).toEqual({ obrigacao: 's1299', prazo: '2026-10-15', dias: -3 });
    expect(prazoMaisUrgenteDoDp(['x-ferias'], ['x-ferias'], '2026-09', hoje)).toBeNull();
  });
});
