// O certificado digital A1 na Área do Cliente (plano do Acessórias, 17/11/2026, ficha certificado-digital).
import { describe, expect, it } from 'vitest';
import { certificadoDoLink, type CertificadoNoCofre } from './certificado';

const cofre = (mais: Partial<CertificadoNoCofre>): CertificadoNoCofre => ({ codigo: 58, empresa: 'PADARIA X LTDA', validade: '2026-12-10', temCertificado: true, ...mais });
const PADARIA = { codigo: 58, nome: 'Padaria X Ltda' };

describe('o certificado do link', () => {
  it('casa pelo código e o titular é a razão social do cadastro', () => {
    expect(certificadoDoLink([cofre({ empresa: 'OUTRO NOME NO COFRE' })], [PADARIA])).toEqual({ tipo: 'A1', titular: 'Padaria X Ltda', validoAte: '2026-12-10' });
  });
  it('sem código no cofre, casa pela razão social (sem acento, maiúscula, pontuação)', () => {
    expect(certificadoDoLink([cofre({ codigo: null, empresa: 'PADARIA X, LTDA.' })], [PADARIA])?.validoAte).toBe('2026-12-10');
    expect(certificadoDoLink([cofre({ codigo: null, empresa: 'OUTRA LTDA' })], [PADARIA])).toBeNull();
  });
  it('ignora a conta gov, quem não tem certificado e a validade torta', () => {
    expect(certificadoDoLink([cofre({ tipo: 'gov' })], [PADARIA])).toBeNull();
    expect(certificadoDoLink([cofre({ temCertificado: false })], [PADARIA])).toBeNull();
    expect(certificadoDoLink([cofre({ validade: '10/12/2026' })], [PADARIA])).toBeNull();
  });
  it('com duas empresas no link, pega o que vence primeiro', () => {
    const r = certificadoDoLink([cofre({}), cofre({ codigo: 59, validade: '2026-11-30' })], [PADARIA, { codigo: 59, nome: 'Filial Y' }]);
    expect(r).toEqual({ tipo: 'A1', titular: 'Filial Y', validoAte: '2026-11-30' });
  });
  it('nunca leva outro campo do cofre (o titular cifrado, a senha)', () => {
    const r = certificadoDoLink([{ ...cofre({}), titular: 'cifrado', senha: 'x' } as CertificadoNoCofre], [PADARIA]);
    expect(Object.keys(r!).sort()).toEqual(['tipo', 'titular', 'validoAte']);
  });
});
