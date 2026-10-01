import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, ArquivoLido, EmpresaExtrator } from '../extratudo/extrator/tipos';
import { situacaoDoBancoNoPeriodo } from '../extratudo/extrator/regras/situacaoDoBanco';
import { checklistDaFolha } from '../tarefas/regras/folha';
import { conferenciaDeTeste, EMPRESA_DEMO, ehEmpresaDemo, extratosDeTeste, razaoDeTeste } from './index';

const MESES = ['2026-07', '2026-08'];
const arqs = (lado: 'banco' | 'sistema', lidos: ArquivoLido[]): ArquivoImportado[] =>
  lidos.map((l, i) => ({ id: lado + i, lado, nome: l.nome, importadoEm: '2026-10-01T12:00:00Z', modo: 'primeira', lancamentos: l.lancamentos, banco: 'sicoob', ...(l.saldoAnterior != null ? { saldoAnterior: l.saldoAnterior } : {}) }));
const empresa = (razao: ArquivoLido[]): EmpresaExtrator => ({ nome: EMPRESA_DEMO.nome, arquivos: [...arqs('banco', extratosDeTeste(MESES)), ...arqs('sistema', razao)], auditoria: [] });
const situacao = (razao: ArquivoLido[]) => situacaoDoBancoNoPeriodo(empresa(razao), 'sicoob', 'sicoob', MESES).tipo;

describe('Personaly Company (dados de teste)', () => {
  it('é reconhecida pelo nome e pelo código da URL', () => {
    expect(ehEmpresaDemo('PERSONALY COMPANY')).toBe(true);
    expect(ehEmpresaDemo('9999')).toBe(true);
    expect(ehEmpresaDemo('FITO INDUSTRIA')).toBe(false);
  });
  it('o razão batendo deixa o dia negativo sem o cheque; com o cheque, Ok; com erros, pendente', () => {
    expect(situacao(razaoDeTeste(MESES, 'bate'))).toBe('falta-cheque');
    expect(situacao(razaoDeTeste(MESES, 'cheque'))).toBe('ok');
    expect(situacao(razaoDeTeste(MESES, 'erros'))).toBe('pendente');
  });
  it('a Conferência de teste tem as contas da folha no Passivo', () => {
    const e = conferenciaDeTeste();
    expect(e.nome).toBe('PERSONALY COMPANY');
    expect(checklistDaFolha(e.contas, MESES).map(i => i.id)).toEqual(['salarios', 'pro-labore', 'ferias', 'rescisao', 'fgts', 'grrf', 'inss']);
  });
});
