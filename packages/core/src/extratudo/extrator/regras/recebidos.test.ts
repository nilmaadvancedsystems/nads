import { describe, expect, it } from 'vitest';
import { linhaDoRecebido, type ExtratoRecebido } from './recebidos';

const r = (bancos: string[], contas: { agencia: string; conta: string }[] = []): ExtratoRecebido => ({ id: 'x', nome: 'extrato.pdf', competencia: '2026-09', bancos, contas, em: '', remetente: '' });
const linhas = [
  { id: 'sicoob-1', nome: 'Sicoob', marca: 'sicoob', numeroConta: '12345-6' },
  { id: 'sicoob-2', nome: 'Sicoob', marca: 'sicoob', numeroConta: '98765-4' },
  { id: 'bb-1', nome: 'Banco do Brasil', marca: 'banco-do-brasil', numeroConta: '5555-1' },
];

describe('o extrato que chegou por e-mail: em qual linha entra (08/10/2026)', () => {
  it('pelo banco, quando é uma conta só daquele banco (o bb do robô é o banco-do-brasil)', () => {
    expect(linhaDoRecebido(r(['bb']), linhas)).toEqual({ linha: 'bb-1', candidatas: ['bb-1'] });
  });
  it('duas contas do mesmo banco: pelo número da conta lido no extrato', () => {
    expect(linhaDoRecebido(r(['sicoob'], [{ agencia: '3001', conta: '000987654' }]), linhas).linha).toBe('sicoob-2');
  });
  it('duas contas e sem o número: a pessoa escolhe', () => {
    expect(linhaDoRecebido(r(['sicoob']), linhas)).toEqual({ linha: null, candidatas: ['sicoob-1', 'sicoob-2'] });
  });
  it('sem banco lido e uma conta só: ela', () => {
    expect(linhaDoRecebido(r([]), [linhas[2]]).linha).toBe('bb-1');
  });
  it('só a linha genérica Banco: entra nela', () => {
    expect(linhaDoRecebido(r(['itau']), [{ id: 'banco', nome: 'Banco' }]).linha).toBe('banco');
  });
});
