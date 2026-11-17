import { describe, expect, it } from 'vitest';
import * as e from './entradaDeClientes';

const EM = '2026-11-13T12:00:00.000Z';
const ficha = (p: Partial<e.Ficha> = {}): e.Ficha => ({ ...e.fichaVazia(), contato: 'José da Silva', telefone: '(38) 99999-0000', razaoSocial: 'Padaria Exemplo Ltda', ...p });

describe('entrada de clientes', () => {
  it('confere a ficha', () => {
    expect(e.problemaDaFicha(e.fichaVazia())).toMatch(/nome/);
    expect(e.problemaDaFicha(ficha({ telefone: '', email: '' }))).toMatch(/telefone ou um e-mail/);
    expect(e.problemaDaFicha(ficha({ email: 'jose@' }))).toMatch(/e-mail/);
    expect(e.problemaDaFicha(ficha({ socios: [{ nome: 'A', cpf: '', participacao: 60, administrador: true }, { nome: 'B', cpf: '', participacao: 30, administrador: false }] }))).toMatch(/100%/);
    expect(e.problemaDaFicha(ficha())).toBe('');
  });

  it('dá a nota do cliente ideal', () => {
    const todos = Object.fromEntries(e.REQUISITOS_DO_CLIENTE_IDEAL.map(r => [r.id, true]));
    expect(e.notaDoCliente({ requisitos: todos }).classificacao).toBe('ideal');
    expect(e.notaDoCliente({ requisitos: { extratos: true, financeiro: true, sistema: true, prazo: true, certificado: false } })).toMatchObject({ sim: 4, respondidos: 5, classificacao: 'bom' });
    expect(e.notaDoCliente({ requisitos: {} })).toMatchObject({ sim: 0, classificacao: 'atencao' });
  });

  it('sugere o orçamento pela ficha', () => {
    const o = e.sugestaoDeOrcamento(ficha({ regime: 'simples', funcionarios: 3, notasPorMes: 200, bancos: 4, motivo: 'troca' }));
    expect(o.itens.map(i => i.valor)).toEqual([450, 135, 150, 80]);
    expect(e.totalMensal(o)).toBe(815);
    expect(o.implantacao).toBe(450);
    expect(e.sugestaoDeOrcamento(ficha({ motivo: 'abertura', regime: 'mei' })).implantacao).toBe(800);
    expect(e.problemaDoOrcamento({ ...o, itens: [] })).toMatch(/item/);
  });

  it('monta o e-mail do orçamento', () => {
    const f = ficha();
    const m = e.emailDoOrcamento(f, e.sugestaoDeOrcamento(f), v => 'R$ ' + v);
    expect(m.assunto).toBe('Orçamento de contabilidade — Padaria Exemplo Ltda');
    expect(m.corpo).toMatch(/^Olá, José!/);
    expect(m.corpo).toContain('Total mensal: R$ 450');
  });

  it('pede os documentos da empresa e de cada sócio, na pasta certa', () => {
    const f = ficha({ motivo: 'troca', funcionarios: 1, socios: [{ nome: 'Maria Souza', cpf: '', participacao: 100, administrador: true }] });
    const d = e.documentosPedidos(f);
    expect(d.some(x => x.id === 'empresa:balancete')).toBe(true);
    expect(d.some(x => x.id === 'empresa:folha')).toBe(true);
    expect(d.find(x => x.id === 'socio:Maria Souza:rg')?.pasta).toBe('SOCIETÁRIO/QUADRO SOCIETÁRIO/MARIA SOUZA');
    expect(e.documentosPedidos(ficha({ motivo: 'abertura' })).some(x => x.id === 'empresa:cnpj')).toBe(false);
    expect(e.pastaDoCliente(2026, 412, 'Padaria do Zé Ltda')).toBe('Meu Drive/2026/0412 - PADARIA DO ZÉ LTDA');
    expect(e.faltando(d, [{ documento: 'empresa:contrato' }]).some(x => x.id === 'empresa:contrato')).toBe(false);
  });

  it('o fluxo: ficha → orçamento → aguardando → documentos → cadastro → concluída', () => {
    let x = e.nova('1', 1, 'Nilma', EM);
    expect(() => e.paraOOrcamento(x, 'Nilma', EM)).toThrow();
    x = e.paraOOrcamento(e.comFicha(x, ficha(), EM), 'Nilma', EM);
    expect(x.etapa).toBe('orcamento');
    expect(x.orcamento?.itens.length).toBe(1);
    x = e.enviado(x, 'Nilma', EM);
    expect(x.etapa).toBe('aguardando');
    expect(e.respostaDoCliente(x, false, 'Achou caro', 'Nilma', EM).etapa).toBe('recusada');
    x = e.respostaDoCliente(x, true, '', 'Nilma', EM);
    expect(x.etapa).toBe('documentos');
    x = e.comDocumento(x, { documento: 'empresa:contrato', nome: 'contrato.pdf', tamanho: 10, em: EM, por: 'Nilma' });
    expect(x.documentos).toHaveLength(1);
    x = e.paraOCadastro(x, 'Nilma', EM);
    const c: e.Cadastro = { codigo: 413, razaoSocial: 'Padaria Exemplo Ltda', cnpj: '', regime: 'simples', fiscal: { uid: 'h', nome: 'Heverton' }, contabil: { uid: 'v', nome: 'Vitor' }, dp: null };
    expect(() => e.cadastrado(x, c, [413], 'Nilma', EM)).toThrow(/já é de outra/);
    expect(() => e.cadastrado(x, { ...c, fiscal: null }, [], 'Nilma', EM)).toThrow(/Fiscal/);
    expect(e.cadastrado(x, c, [412], 'Nilma', EM).etapa).toBe('concluida');
    expect(e.proximoCodigo([10, 412, 3])).toBe(413);
  });
});
