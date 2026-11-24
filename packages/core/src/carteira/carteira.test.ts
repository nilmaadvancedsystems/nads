import { describe, expect, it } from 'vitest';
import type { ContaAPagar } from '../financeiro/contasPagar';
import {
  avisosDaComissao, comValorParaAPessoa, conferirComissao, descricaoDaComissao, quantidadeDaComissao, valorDoServico, conferirDataDaPessoa, pessoaPodeMexer, conferirLancamento, conferirServicos, esperandoCalculo, percentualDoServico, mesDoPagamento, novoServico, servicosPadrao, valorDaComissao, historico, liberadaPara, pagamentosDaCarteira, recebidoNoMes, resumoDasFinancas,
  resumoParaPagar, salarioDoMes, totaisDasComissoes, ultimosMeses, type Comissao, type DocumentoDaCarteira, type Lancamento,
} from '.';

const comissao = (id: string, uid: string, valor: number, situacao: Comissao['situacao'], competencia = '2026-11'): Comissao => ({
  id, uid, nome: uid === 'v' ? 'Vitor' : 'Clara', competencia, data: competencia + '-05', cliente: 'Cliente', descricao: 'Venda', valor, situacao, criadoEm: '2026-11-05T10:00:00Z',
});
const lanc = (id: string, tipo: Lancamento['tipo'], valor: number, categoria: string, data = '2026-11-10'): Lancamento => ({ id, tipo, valor, categoria, data, descricao: categoria });
const doc = (tipo: DocumentoDaCarteira['tipo'], competencia: string, valor: number | null, enviadoEm = '2026-11-05T10:00:00Z'): DocumentoDaCarteira => ({
  id: tipo + competencia + enviadoEm, uid: 'v', nome: 'Vitor', tipo, competencia, valor, arquivo: 'h.pdf', tamanho: 1000, partes: 1, enviadoEm, enviadoPor: 'Nilma',
});

describe('Carteira', () => {
  it('liberada só para o Vitor por enquanto (com ou sem acento, com sobrenome)', () => {
    expect(['Vitor', 'Vítor Silva', 'VITOR', ' vitor ', 'Clara', '', null].map(liberadaPara)).toEqual([true, true, true, true, false, false, false]);
  });

  it('confere a comissão e o lançamento antes de salvar', () => {
    const c = { competencia: '2026-12', data: '2026-11-05', cliente: 'A', clienteCodigo: 10, porte: null, servico: 'Emissão de NFE', valorServico: 200, percentual: 10 };
    expect(conferirComissao(c)).toEqual([]);
    // o avulso sem o porte; o serviço sem a % do Financeiro
    expect(conferirComissao({ ...c, clienteCodigo: null })).toEqual(['Escolha o porte do cliente avulso.']);
    expect(conferirComissao({ ...c, clienteCodigo: null, porte: 'ME' })).toEqual([]);
    expect(conferirComissao({ ...c, percentual: 0 })).toEqual(['O Financeiro ainda não definiu a % de Emissão de NFE.']);
    expect(conferirComissao({ competencia: '2026-13', data: '', cliente: ' ', clienteCodigo: 1, porte: null, servico: '', valorServico: 0, percentual: 0 })).toHaveLength(5);
    expect(conferirLancamento({ tipo: 'saida', data: '2026-11-01', descricao: 'Luz', categoria: 'Contas', valor: 120 })).toEqual([]);
    expect(conferirLancamento({ tipo: 'saida', data: '01/11', descricao: '', categoria: '', valor: -1 })).toHaveLength(3);
  });

  it('a comissão sai do valor do serviço × a %; o mês do pagamento é sempre o seguinte', () => {
    expect(valorDaComissao(350, 10)).toBe(35);
    expect(valorDaComissao(199.99, 12.5)).toBe(25);
    expect(mesDoPagamento(new Date(2026, 10, 12))).toBe('2026-12');
    expect(mesDoPagamento(new Date(2026, 11, 31))).toBe('2027-01');
  });

  it('os serviços comissionados: os 10 do começo (a Alteração de MEI, 19/11/2026), um novo sem repetir o id e a conferência', () => {
    const l = servicosPadrao();
    expect(l).toHaveLength(10);
    expect(l[0]).toEqual({ id: 'emissao-de-nfe', nome: 'Emissão de NFE', percentual: 0 });
    expect(novoServico(l, 'Emissão de NFE ').id).toBe('emissao-de-nfe-2');
    expect(conferirServicos(l)).toEqual([]);
    expect(conferirServicos([...l, { id: 'x', nome: 'emissao de nfe', percentual: 120 }])).toEqual(['A % fica entre 0 e 100.', 'Há serviço repetido.']);
  });

  it('totais das comissões e o resumo para o Financeiro pagar, por pessoa', () => {
    const cs = [comissao('1', 'v', 100, 'lancada'), comissao('2', 'v', 250.5, 'aprovada'), comissao('3', 'v', 50, 'paga'), comissao('4', 'v', 999, 'recusada'), comissao('5', 'c', 300, 'aprovada')];
    expect(totaisDasComissoes(cs.filter(c => c.uid === 'v'))).toEqual({ lancadas: 100, aprovadas: 250.5, pagas: 50, recusadas: 999, total: 400.5, quantas: 3 });
    const r = resumoParaPagar(cs);
    expect(r.map(x => [x.nome, x.aRevisar, x.aPagar, x.pagas, x.ids.aprovadas])).toEqual([['Clara', 0, 300, 0, ['5']], ['Vitor', 100, 250.5, 50, ['2']]]);
  });

  it('finanças do mês: entradas, saídas, saldo e as saídas por categoria', () => {
    const ls = [lanc('1', 'entrada', 3000, 'Salário'), lanc('2', 'saida', 900, 'Moradia'), lanc('3', 'saida', 300, 'Alimentação'), lanc('4', 'saida', 600, 'Moradia'), lanc('5', 'saida', 50, 'Lazer', '2026-10-30')];
    const r = resumoDasFinancas(ls, '2026-11');
    expect([r.entradas, r.saidas, r.saldo]).toEqual([3000, 1800, 1200]);
    expect(r.porCategoria.map(x => [x.categoria, x.valor])).toEqual([['Moradia', 1500], ['Alimentação', 300]]);
  });

  it('o salário do mês vem do holerite mais novo daquele mês', () => {
    const ds = [doc('holerite', '2026-10', 2800), doc('holerite', '2026-11', 3000), doc('holerite', '2026-11', 3100, '2026-11-06T10:00:00Z'), doc('comprovante', '2026-11', 3100)];
    expect([salarioDoMes(ds, '2026-11'), salarioDoMes(ds, '2026-10'), salarioDoMes(ds, '2026-09')]).toEqual([3100, 2800, null]);
    expect(historico(ultimosMeses(new Date(2026, 10, 12), 2), [comissao('1', 'v', 100, 'aprovada')], [lanc('1', 'entrada', 10, 'Extra')], ds))
      .toEqual([{ competencia: '2026-10', salario: 2800, comissoes: 0, saldo: 0 }, { competencia: '2026-11', salario: 3100, comissoes: 100, saldo: 10 }]);
  });

  it('as contas a pagar ligadas à pessoa viram os pagamentos da Carteira (só os comprovantes aparecem)', () => {
    const conta = (id: string, uid: string | null, vencimento: string, pago: boolean): ContaAPagar => ({
      id, numero: 1, fornecedorId: 'f', documento: 'NOV', emissao: vencimento, vencimento, valor: 3000, lancadoEm: '', lancadoPor: '',
      ...(uid ? { funcionario: { uid, nome: 'Vitor', tipo: 'salario' as const } } : {}),
      ...(pago ? { pagamento: { data: vencimento, valorPago: 2990, juros: 0, desconto: 10, por: 'Nilma', em: '' } } : {}),
      anexos: [{ id: 'b', tipo: 'boleto', nome: 'b.pdf', tamanho: 1, partes: 1, enviadoEm: '', enviadoPor: '' }, ...(pago ? [{ id: 'c', tipo: 'comprovante' as const, nome: 'pix.pdf', tamanho: 2, partes: 1, enviadoEm: '', enviadoPor: '' }] : [])],
    });
    const ps = pagamentosDaCarteira([conta('1', 'v', '2026-10-05', true), conta('2', 'v', '2026-11-05', false), conta('3', 'outro', '2026-11-05', true), conta('4', null, '2026-11-05', true)], 'v');
    expect(ps.map(p => [p.id, p.rotulo, p.pago, p.comprovantes.map(c => c.nome)])).toEqual([['2', 'Salário · NOV', false, []], ['1', 'Salário · NOV', true, ['pix.pdf']]]);
    expect([recebidoNoMes(ps, '2026-10'), recebidoNoMes(ps, '2026-11')]).toEqual([{ recebido: 2990, aReceber: 0 }, { recebido: 0, aReceber: 3000 }]);
  });
});

describe('a comissão escondida (16/11/2026)', () => {
  const base = { id: 'x', uid: 'v', nome: 'Pessoa A', competencia: '2026-12', data: '2026-11-16', cliente: 'CLIENTE', descricao: 'Abertura de MEI', situacao: 'lancada' as const, criadoEm: '' };
  const visivel = { ...base, id: 'a', valor: 15 };
  const naFila = { ...base, id: 'b', valor: 0, oculta: true, calculo: 'fila' as const };
  const feita = { ...base, id: 'c', valor: 40, oculta: true, calculo: 'feito' as const };
  it('a % é só a do serviço', () => {
    const servicos = [{ id: 'a', nome: 'Abertura de MEI', percentual: 10 }];
    expect([percentualDoServico(servicos, 'Abertura de MEI'), percentualDoServico(servicos, 'Outro')]).toEqual([10, 0]);
  });
  it('registra sem a % e sem o aviso do Financeiro', () => {
    const c = { competencia: '2026-12', data: '2026-11-16', cliente: 'CLIENTE', clienteCodigo: null, porte: 'MEI' as const, servico: 'Abertura de MEI', valorServico: 150, percentual: 0 };
    expect(conferirComissao(c)).toEqual(['O Financeiro ainda não definiu a % de Abertura de MEI.']);
    expect(conferirComissao({ ...c, oculta: true })).toEqual([]);
  });
  it('a pessoa não vê o valor da escondida, nem no total', () => {
    expect(comValorParaAPessoa([visivel, naFila, feita]).map(c => c.id)).toEqual(['a']);
  });
  it('sem o cálculo do robô, fica fora do Aprovar tudo', () => {
    expect([esperandoCalculo(visivel), esperandoCalculo(naFila), esperandoCalculo(feita)]).toEqual([false, true, false]);
    expect(resumoParaPagar([visivel, naFila, feita])[0].ids.lancadas).toEqual(['a', 'c']);
  });
  it('virou o mês, a da pessoa trava e a data de mês passado só o Financeiro lança (19/11/2026)', () => {
    const c = { id: 'x', uid: 'v', nome: 'P', competencia: '2026-12', data: '2026-11-19', cliente: 'C', descricao: 'S', valor: 10, situacao: 'lancada' as const, criadoEm: '' };
    expect([pessoaPodeMexer(c, new Date(2026, 10, 30)), pessoaPodeMexer(c, new Date(2026, 11, 1))]).toEqual([true, false]);
    expect(conferirDataDaPessoa('2026-11-19', new Date(2026, 10, 19))).toBe('');
    expect(conferirDataDaPessoa('2026-10-31', new Date(2026, 10, 19))).not.toBe('');
  });
});

describe('a quantidade e o valor do serviço definido pelo Financeiro (23/11/2026)', () => {
  it('a quantidade vai na descrição e volta dela; sem quantidade, só o serviço', () => {
    expect(descricaoDaComissao({ servico: 'Emissão de GTA', quantidade: 3 })).toBe('Emissão de GTA × 3');
    expect(descricaoDaComissao({ servico: 'Emissão de GTA', quantidade: 1 })).toBe('Emissão de GTA');
    expect(descricaoDaComissao({ servico: 'Emissão de GTA' })).toBe('Emissão de GTA');
    expect(quantidadeDaComissao({ descricao: 'Emissão de GTA × 3', servico: 'Emissão de GTA' })).toBe(3);
    expect(quantidadeDaComissao({ descricao: 'Emissão de GTA', servico: 'Emissão de GTA' })).toBe(1);
    // a comissão de antes, sem o serviço, e um texto qualquer
    expect(quantidadeDaComissao({ descricao: 'Venda', servico: undefined })).toBe(1);
  });
  it('o valor do serviço: o definido pelo Financeiro, 0 quando não tem (a pessoa digita)', () => {
    const lista = [{ id: 'gta', nome: 'Emissão de GTA', percentual: 10, valor: 30 }, { id: 'nfe', nome: 'Emissão de NFE', percentual: 10 }];
    expect(valorDoServico(lista, 'Emissão de GTA')).toBe(30);
    expect(valorDoServico(lista, 'Emissão de NFE')).toBe(0);
    expect(conferirServicos([{ id: 'a', nome: 'A', percentual: 10, valor: -1 }])).toContain('Confira o valor do serviço.');
    expect(conferirServicos(lista)).toEqual([]);
  });
  it('a quantidade de 1 a 999; a comissão sobre o total', () => {
    const base = { competencia: '2026-12', data: '2026-11-23', cliente: 'Cliente', clienteCodigo: 1, porte: null, servico: 'Emissão de GTA', valorServico: 90, percentual: 10 };
    expect(conferirComissao({ ...base, quantidade: 3 })).toEqual([]);
    expect(conferirComissao({ ...base, quantidade: 0 })).toContain('A quantidade vai de 1 a 999.');
    expect(conferirComissao({ ...base, quantidade: 1000 })).toContain('A quantidade vai de 1 a 999.');
    expect(valorDaComissao(3 * 30, 10)).toBe(9);
  });
});

describe('os avisos da comissão a pagar (auditoria de segurança, 24/11/2026)', () => {
  const servicos = [{ id: 'nfe', nome: 'Emissão de NFE', percentual: 10 }, { id: 'gta', nome: 'Emissão de GTA', percentual: 5, valor: 30 }];
  const base = (extra: Partial<Comissao>): Comissao => ({ ...comissao('1', 'c', 20, 'lancada'), servico: 'Emissão de NFE', valorServico: 200, percentual: 10, ...extra });

  it('a comissão certa não tem aviso', () => {
    expect(avisosDaComissao(base({}), servicos)).toEqual([]);
    expect(avisosDaComissao(base({ servico: 'Emissão de GTA', descricao: 'Emissão de GTA × 3', valorServico: 90, percentual: 5, valor: 4.5 }), servicos)).toEqual([]);
  });

  it('pega o valor que não é serviço × %, a % fora da tabela e o valor do serviço trocado', () => {
    expect(avisosDaComissao(base({ valor: 999999 }), servicos)).toEqual(['O valor não é o do serviço × a %.']);
    expect(avisosDaComissao(base({ percentual: 100, valor: 200 }), servicos)).toEqual(['A % (100%) não é a da tabela (10%).']);
    expect(avisosDaComissao(base({ servico: 'Emissão de GTA', descricao: 'Emissão de GTA', valorServico: 5000, percentual: 5, valor: 250 }), servicos))
      .toEqual(['O valor do serviço não é o definido pelo Financeiro.']);
    expect(avisosDaComissao(base({ servico: 'Inventado' }), servicos)).toEqual(['O serviço não está na tabela.']);
  });

  it('a escondida e a já decidida não entram', () => {
    expect(avisosDaComissao(base({ valor: 999999, oculta: true }), servicos)).toEqual([]);
    expect(avisosDaComissao(base({ valor: 999999, situacao: 'paga' }), servicos)).toEqual([]);
  });
});
