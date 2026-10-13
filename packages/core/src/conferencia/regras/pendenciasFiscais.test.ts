import { describe, expect, it } from 'vitest';
import { conta, empresa } from '../__legado__/fixtures';
import { FILTRO_MOVIMENTO_VAZIO } from '../tipos';
import { pendenciasFiscaisComLugar } from './pendenciasFiscais';

describe('pendências da Conferência fiscal', () => {
  it('sem balancete: o primeiro passo é importar o balancete (o Resolver leva até ele)', () => {
    expect(pendenciasFiscaisComLugar(empresa(), FILTRO_MOVIMENTO_VAZIO)).toEqual([{ texto: 'Importar o balancete', alvo: 'balancete' }]);
  });
  it('com o balancete e nada a conferir: nada pendente', () => {
    expect(pendenciasFiscaisComLugar(empresa({ contas: [conta('10', 'Fornecedores')] }), FILTRO_MOVIMENTO_VAZIO)).toEqual([]);
  });
});
