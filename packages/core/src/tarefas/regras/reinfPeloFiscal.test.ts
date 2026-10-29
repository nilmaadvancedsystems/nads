import { describe, expect, it } from 'vitest';
import { estadoDa, execucaoNova, reinfDesfeitaPeloFiscal, reinfJaMarcadaPeloFiscal, reinfPeloFiscal } from './execucao';

const agora = new Date('2026-10-29T17:15:00Z');
const nova = () => execucaoNova('CONSTRUTOP MATERIAIS DE CONSTRUCAO LTDA', 593, '2026-09', 'dp');
/** a REINF de setembro como a importação do Toriba deixou: feita, por "Toriba" */
const doToriba = () => ({ ...nova(), etapas: { 'dp-reinf': { situacao: 'feita' as const, por: 'Toriba', em: '2026-10-14T12:30:38.079Z', observacao: 'importado do Toriba' } } });

describe('a REINF do DP pelo Fiscal', () => {
  it('transmitir marca a REINF do DP como feita pelo Fiscal', () => {
    const r = reinfPeloFiscal(nova(), 'Gustavo.S', 'Heverton', agora);
    expect(estadoDa(r.execucao, 'dp-reinf')?.situacao).toBe('feita');
    expect(reinfJaMarcadaPeloFiscal(r.execucao)).toBe(true);
  });

  it('a marca do Toriba não conta como do Fiscal: transmitir troca por ela', () => {
    expect(reinfJaMarcadaPeloFiscal(doToriba())).toBe(false);
    const r = reinfPeloFiscal(doToriba(), 'Gustavo.S', 'Heverton', agora);
    expect(r.execucao.etapas['dp-reinf']?.por).toBe('Gustavo.S (Fiscal)');
  });

  it('desfazer volta a REINF do DP para a fazer, também a marcada pelo Toriba', () => {
    const doFiscal = reinfPeloFiscal(nova(), 'Gustavo.S', 'Heverton', agora).execucao;
    expect(estadoDa(reinfDesfeitaPeloFiscal(doFiscal, 'Gustavo.S', agora)!.execucao, 'dp-reinf')).toBeFalsy();
    expect(estadoDa(reinfDesfeitaPeloFiscal(doToriba(), 'Gustavo.S', agora)!.execucao, 'dp-reinf')).toBeFalsy();
  });

  it('desfazer sem marca no DP não grava nada', () => {
    expect(reinfDesfeitaPeloFiscal(nova(), 'Gustavo.S', agora)).toBeNull();
  });
});
