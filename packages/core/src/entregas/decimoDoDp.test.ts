// O 13º do DP na rota do Entregas (11/11/2026): quando a parcela está pronta e quem vai para a rota.
import { describe, expect, it } from 'vitest';
import { clienteDaRotaDoDocumento } from './documentos';
import { decimoParaARota, documentoDaFolha, documentoDoDecimo, dpParaARota, entregaDoDecimo, entregaDoDp } from './decimoDoDp';
import { execucaoNova, fazer } from '../tarefas/regras/execucao';
import { etapasDaParcela, folhaProntaParaEntregar, parcelaDoDecimoPronta, parcelaDoMes, parcelaProntaParaEntregar } from '../tarefas/regras/decimoTerceiro';

const cliente = (id: string, cod: string, extra: Record<string, unknown> = {}) =>
  clienteDaRotaDoDocumento(id, { nome: 'EMPRESA ' + cod, codigoOrigem: cod, ativo: true, zona: 'central', ...extra });

describe('a parcela do 13º pronta (a tabela do 13º do DP)', () => {
  const marcar = (etapas: string[]) => etapas.reduce((ex, etapa) => fazer(ex, etapa, 'Sávio', new Date(2026, 10, 10)).execucao, execucaoNova('EMPRESA 10', 10, '2026-13', 'dp'));
  it('a 1ª: recibos e folha; a 2ª: tudo, até o DARF', () => {
    expect(etapasDaParcela('1')).toEqual(['d13-1-recibos', 'd13-1-folha']);
    expect(etapasDaParcela('2')).toHaveLength(7);
    expect(parcelaDoDecimoPronta(null, '1')).toBe(false);
    expect(parcelaDoDecimoPronta(marcar(['d13-1-recibos']), '1')).toBe(false);
    const primeira = marcar(['d13-1-recibos', 'd13-1-folha']);
    expect(parcelaDoDecimoPronta(primeira, '1')).toBe(true);
    expect(parcelaDoDecimoPronta(primeira, '2')).toBe(false);
    expect(parcelaDoDecimoPronta(marcar(etapasDaParcela('2')), '2')).toBe(true);
  });
  it('a parcela do mês: novembro a 1ª, dezembro e janeiro a 2ª; nos outros, nenhuma', () => {
    expect(parcelaDoMes(new Date(2026, 10, 11))).toEqual({ ano: 2026, parcela: '1' });
    expect(parcelaDoMes(new Date(2026, 11, 2))).toEqual({ ano: 2026, parcela: '2' });
    expect(parcelaDoMes(new Date(2027, 0, 5))).toEqual({ ano: 2026, parcela: '2' });
    expect(parcelaDoMes(new Date(2026, 9, 30))).toBeNull();
  });
});

describe('quem do DP vai para a rota com o 13º', () => {
  const clientes = [cliente('a', '10'), cliente('b', '23'), cliente('c', '37'), cliente('d', '40', { ativo: false }), cliente('e', '54')];
  const tipo = documentoDoDecimo('1', 2026).tipo;
  const doMes = [
    { clienteId: 'b', competencia: '2026-11', status: 'pendente' as const, itens: [{ tipo, valor: null }] },
    { clienteId: 'c', competencia: '2026-11', status: 'confirmada' as const, itens: [{ tipo, valor: null }] },
    // a 2ª parcela na rota não segura a 1ª
    { clienteId: 'e', competencia: '2026-12', status: 'pendente' as const, itens: [{ tipo: documentoDoDecimo('2', 2026).tipo, valor: null }] },
  ];
  const empresas = [
    { codigo: 10, nome: 'DORNAS', pronta: true }, { codigo: 23, nome: 'FLORENCIO', pronta: true }, { codigo: 37, nome: 'LOTERIAS', pronta: true },
    { codigo: 40, nome: 'MADEIREIRA', pronta: true }, { codigo: 54, nome: 'SERRALHERIA', pronta: true }, { codigo: 55, nome: 'TORRA', pronta: false },
  ];
  it('vai quem está pronto e ainda não está na rota; o resto diz por quê', () => {
    const l = decimoParaARota({ parcela: '1', ano: 2026, empresas, clientes, doMes });
    expect(l.map(x => x.codigo + ':' + x.situacao)).toEqual(['10:vai', '54:vai', '23:na-rota', '37:entregue', '40:sem-cadastro', '55:falta-marcar']);
    expect(l[0].nome).toBe('10 - EMPRESA 10');
  });
  it('a parada: o 13º da parcela, sem valor, na região do cliente, com o vencimento da lei', () => {
    expect(documentoDoDecimo('2', 2026)).toEqual({ tipo: '13º Salário 2ª parcela', competencia: '2026-12' });
    expect(entregaDoDecimo(clientes[0], '1', 2026)).toMatchObject({
      modo: 'rota', competencia: '2026-11', vencimento: '2026-11-30', zona: 'central', itens: [{ tipo: '13º Salário 1ª parcela', valor: null }],
      para: { tipo: 'cliente', cliente: { id: 'a' } },
    });
    expect(entregaDoDecimo(clientes[0], '2', 2026).vencimento).toBe('2026-12-18');
  });
});

describe('o que vai para a rota: só o papel do office boy (26/11/2026)', () => {
  const marcar = (etapas: string[], comp = '2026-13') => etapas.reduce((ex, etapa) => fazer(ex, etapa, 'Sávio', new Date(2026, 10, 26)).execucao, execucaoNova('EMPRESA 10', 10, comp, 'dp'));
  it('o 13º: com Recibos e Folha marcados já vai, mesmo sem o eSocial, a DCTFWeb e o DARF da 2ª parcela', () => {
    const papel = marcar(['d13-2-recibos', 'd13-2-folha']);
    expect(parcelaDoDecimoPronta(papel, '2')).toBe(false);
    expect(parcelaProntaParaEntregar(papel, '2')).toBe(true);
    expect(parcelaProntaParaEntregar(marcar(['d13-2-recibos']), '2')).toBe(false);
    expect(parcelaProntaParaEntregar(papel, '1')).toBe(false);
    expect(parcelaProntaParaEntregar(null, '1')).toBe(false);
  });
  it('a folha do mês: os Recibos de pagamento e a Folha de pagamento da rotina do DP', () => {
    expect(folhaProntaParaEntregar(marcar(['dp-recibos', 'dp-folha'], '2026-10'))).toBe(true);
    expect(folhaProntaParaEntregar(marcar(['dp-folha'], '2026-10'))).toBe(false);
    expect(folhaProntaParaEntregar(null)).toBe(false);
  });
  it('a folha na rota: o documento "Folha de Pagamento" da competência, e a folha de outro mês não segura', () => {
    const doc = documentoDaFolha('2026-10');
    expect(doc).toEqual({ tipo: 'Folha de Pagamento', competencia: '2026-10' });
    const clientes = [cliente('a', '10'), cliente('b', '23')];
    const doMes = [{ clienteId: 'b', competencia: '2026-09', status: 'pendente' as const, itens: [{ tipo: doc.tipo, valor: null }] }];
    const l = dpParaARota({ documento: doc, empresas: [{ codigo: 10, nome: 'A', pronta: true }, { codigo: 23, nome: 'B', pronta: true }], clientes, doMes });
    expect(l.map(x => x.codigo + ':' + x.situacao)).toEqual(['10:vai', '23:vai']);
    const parada = entregaDoDp(clientes[0], doc);
    expect(parada.itens).toEqual([{ tipo: 'Folha de Pagamento', valor: null }]);
    expect(parada.competencia).toBe('2026-10');
  });
});
