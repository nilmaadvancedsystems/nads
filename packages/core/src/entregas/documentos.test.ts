// As regras da entrega de documentos (a rota e o painel do Entregas no nads, 16/10/2026), com clientes e entregas fictícios.
import { describe, expect, it } from 'vitest';
import {
  chaveDaParada, clienteCombina, clienteDaRotaDoDocumento, comprovanteDaConfirmacao, dadosDaConfirmacao, dadosDaEntregaNova, dadosDaNovaTentativa,
  entregaDoDocumento, faltasNaConfirmacao, faltasNaEntrega, linhasDoPainel, moverNaRota, numerosDoMes, ordenarParadas, podeExcluir,
  rotaPadraoDoDocumento, rotuloDaSituacao, situacaoNoMes, textoDoComprovante, totalDosItens, valorDigitado, vencimentoAutomatico,
  type ClienteDaRota, type Entrega,
} from './documentos';

const cliente = (id: string, nome: string, extra: Partial<ClienteDaRota> = {}): ClienteDaRota =>
  clienteDaRotaDoDocumento(id, { nome, codigoOrigem: id.replace(/\D/g, ''), documento: '', entrega: true, ...extra });
const entrega = (id: string, d: Record<string, unknown>): Entrega =>
  entregaDoDocumento(id, { clienteNome: 'X', competencia: '2026-09', status: 'pendente', criadoEm: '2026-10-01T10:00:00Z', ...d });

const A = cliente('c1', 'ALFA EXEMPLO LTDA', { documento: '11.222.333/0001-81' });
const B = cliente('c2', 'BETA EXEMPLO ME');
const C = cliente('c3', 'GAMA EXEMPLO', { entrega: false });
const QUEM = { email: 'maria@nilma.local', nome: 'Maria' };

describe('leitura do banco', () => {
  it('a entrega antiga com os itens só em texto e campos faltando', () => {
    const e = entregaDoDocumento('e1', { clienteId: 'c1', itens: ['DAS', { tipo: 'FGTS', valor: 120.5 }, null], status: 'xx', tentativa: 2 });
    expect(e.itens).toEqual([{ tipo: 'DAS', valor: null }, { tipo: 'FGTS', valor: 120.5 }]);
    expect(e.status).toBe('pendente');
    expect(e.tentativa).toBe(2);
    expect(e.ordemRota).toBeNull();
  });
  it('o cliente: ativo e de entrega', () => {
    expect(clienteDaRotaDoDocumento('x', { nome: 'N', ativo: false }).ativo).toBe(false);
    expect(clienteDaRotaDoDocumento('x', { nome: 'N' })).toMatchObject({ ativo: true, entrega: false });
  });
  it('a rota padrão ignora o que não é número/texto', () => {
    expect(rotaPadraoDoDocumento({ zonas: { c1: 'superior', c2: 3 }, ordem: { c1: 2, c2: 'x' } })).toEqual({ zonas: { c1: 'superior' }, ordem: { c1: 2 } });
    expect(rotaPadraoDoDocumento(null)).toEqual({ zonas: {}, ordem: {} });
  });
});

describe('busca e valores', () => {
  it('busca por nome sem acento, código e parte do CNPJ', () => {
    expect(clienteCombina({ nome: 'ORÇAMENTO EXEMPLO', codigoOrigem: '', documento: '' }, 'orcamento')).toBe(true);
    expect(clienteCombina(A, '1')).toBe(true);
    expect(clienteCombina(A, '22233')).toBe(true);
    expect(clienteCombina(A, '99')).toBe(false);
  });
  it('o valor digitado', () => {
    expect(valorDigitado('1.234,56')).toBe(1234.56);
    expect(valorDigitado('R$ 80')).toBe(80);
    expect(valorDigitado('12.5')).toBe(12.5);
    expect(valorDigitado('')).toBeNull();
    expect(valorDigitado('abc')).toBeNull();
    expect(totalDosItens([{ tipo: 'DAS', valor: 10.1 }, { tipo: 'Notas', valor: null }, { tipo: 'FGTS', valor: 0.2 }])).toBe(10.3);
  });
});

describe('painel', () => {
  const doMes = [
    entrega('e1', { clienteId: 'c1', status: 'falha', criadoEm: '2026-10-01T10:00:00Z', confirmadoEm: '2026-10-02T10:00:00Z' }),
    entrega('e2', { clienteId: 'c1', status: 'confirmada', criadoEm: '2026-10-03T10:00:00Z', confirmadoEm: '2026-10-04T10:00:00Z' }),
    entrega('e3', { clienteId: 'c2', status: 'link' }),
    entrega('e4', { clienteId: null, avulso: true, clienteNome: 'Banco: Caixa', status: 'pendente' }),
  ];
  it('a situação é a da entrega mais nova', () => {
    expect(situacaoNoMes(doMes.filter(e => e.clienteId === 'c1'))).toBe('entregue');
    expect(situacaoNoMes([doMes[2]])).toBe('rota');
    expect(situacaoNoMes([])).toBe('sem_entrega');
    expect(rotuloDaSituacao('rota', doMes[2]).rotulo).toBe('No link');
  });
  it('sem busca, só os clientes de entrega; os avulsos no fim', () => {
    const l = linhasDoPainel({ clientes: [A, B, C], pendentes: [], doMes, busca: '', filtro: 'todos' });
    expect(l.map(x => x.nome)).toEqual(['1 - ALFA EXEMPLO LTDA', '2 - BETA EXEMPLO ME', 'Banco: Caixa']);
  });
  it('quem está na rota entra mesmo sem a marca; com busca, qualquer cliente ativo', () => {
    expect(linhasDoPainel({ clientes: [A, B, C], pendentes: [{ clienteId: 'c3' }], doMes: [], busca: '', filtro: 'todos' }).map(x => x.chave)).toEqual(['c1', 'c2', 'c3']);
    expect(linhasDoPainel({ clientes: [A, B, C], pendentes: [], doMes: [], busca: 'gama', filtro: 'todos' }).map(x => x.chave)).toEqual(['c3']);
  });
  it('os filtros', () => {
    const f = (filtro: Parameters<typeof linhasDoPainel>[0]['filtro']) => linhasDoPainel({ clientes: [A, B, C], pendentes: [], doMes, busca: '', filtro }).map(x => x.chave);
    expect(f('entregue')).toEqual(['c1']);
    expect(f('rota')).toEqual(['c2', 'avulsa-e4']);
    expect(f('sem_entrega')).toEqual([]);
    expect(f('com_entrega')).toEqual(['c1', 'c2', 'avulsa-e4']);
  });
  it('os números do mês', () => {
    expect(numerosDoMes([A, B], doMes)).toEqual({ total: 2, entregue: 1, rota: 1, falha: 0, sem_entrega: 0, porcento: 50 });
  });
});

describe('rota', () => {
  const clientes = new Map([[A.id, { ...A, grupoLocal: 'predio-1' }], [B.id, { ...B, grupoLocal: 'predio-1' }]]);
  it('empresas no mesmo endereço são uma parada', () => {
    expect(chaveDaParada({ clienteId: 'c1', clienteNome: '' }, clientes)).toBe(chaveDaParada({ clienteId: 'c2', clienteNome: '' }, clientes));
    expect(chaveDaParada({ clienteId: null, clienteNome: 'Avulso' }, clientes)).toBe('Avulso');
  });
  it('a ordem: a manual, depois a fixa do escritório, depois quem entrou primeiro', () => {
    const lista = [
      entrega('p1', { clienteId: 'x1', criadoEm: '2026-10-01T08:00:00Z' }),
      entrega('p2', { clienteId: 'x2', criadoEm: '2026-10-01T09:00:00Z' }),
      entrega('p3', { clienteId: 'x3', criadoEm: '2026-10-01T07:00:00Z', ordemRota: 0 }),
      entrega('p4', { clienteId: 'x4', criadoEm: '2026-10-01T06:00:00Z' }),
    ];
    const fixa = { zonas: { x2: 'superior', x4: 'inferior' }, ordem: { x2: 5, x4: 1 } };
    expect(ordenarParadas(lista, fixa).map(e => e.id)).toEqual(['p3', 'p2', 'p4', 'p1']);
    expect(ordenarParadas(lista).map(e => e.id)).toEqual(['p3', 'p4', 'p1', 'p2']);
  });
  it('mover uma parada', () => {
    expect(moverNaRota(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moverNaRota(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
  });
});

describe('registrar e confirmar', () => {
  it('o que falta para pôr na rota', () => {
    expect(faltasNaEntrega({ para: { tipo: 'avulso', nome: ' ' }, competencia: '2026-13', vencimento: '', itens: [], zona: '' }))
      .toEqual(['o cliente', 'a competência', 'ao menos um documento']);
    expect(faltasNaEntrega({ para: { tipo: 'banco', nome: '' }, competencia: '2026-09', vencimento: '', itens: [{ tipo: 'DAS', valor: 1 }], zona: '' })).toEqual(['qual banco']);
  });
  it('o documento novo, como o Entregas grava', () => {
    const d = dadosDaEntregaNova({ para: { tipo: 'cliente', cliente: A }, competencia: '2026-09', vencimento: '2026-10-20', itens: [{ tipo: 'DAS', valor: 10 }], zona: 'central', foto: 'data:image/jpeg;base64,x', fotoEhGuia: true }, QUEM, '2026-10-16T12:00:00Z');
    expect(d).toMatchObject({ clienteId: 'c1', clienteNome: '1 - ALFA EXEMPLO LTDA', avulso: false, banco: null, status: 'pendente', temGuia: true, temFoto: true, temAssinatura: false, entregadoPor: 'maria@nilma.local', confirmadoEm: null, zona: 'central' });
    expect(dadosDaEntregaNova({ para: { tipo: 'banco', nome: 'Caixa' }, competencia: '2026-09', vencimento: '', itens: [], zona: '', foto: null, fotoEhGuia: false }, QUEM, 'x'))
      .toMatchObject({ clienteId: null, clienteNome: 'Banco: Caixa', avulso: true, banco: 'Caixa', temGuia: false, temFoto: false });
  });
  it('as exigências da confirmação', () => {
    const base = { recebedor: '', motivo: '', assinatura: null, foto: null };
    expect(faltasNaConfirmacao({ ...base, como: 'entregue' }, [{ tipo: 'DAS', valor: 1 }])).toEqual(['a assinatura ou a foto']);
    expect(faltasNaConfirmacao({ ...base, como: 'entregue' }, [{ tipo: 'Honorário', valor: null }])).toEqual([]);
    expect(faltasNaConfirmacao({ ...base, como: 'entregue', assinatura: 'data:x' }, [{ tipo: 'DAS', valor: 1 }])).toEqual([]);
    expect(faltasNaConfirmacao({ ...base, como: 'sem_assinatura' }, [])).toEqual(['a foto (ela vale como comprovante)']);
    expect(faltasNaConfirmacao({ ...base, como: 'falha' }, [])).toEqual(['o que aconteceu', 'a foto']);
  });
  it('a confirmação grava quem entregou e não apaga a guia', () => {
    const c = { como: 'entregue' as const, recebedor: ' João ', motivo: '', assinatura: 'data:a', foto: null };
    expect(dadosDaConfirmacao({ temFoto: true }, c, QUEM, 't')).toMatchObject({ status: 'confirmada', recebedor: 'João', temAssinatura: true, temFoto: true, entregadoPor: 'maria@nilma.local', confirmadoEm: 't', falha: false });
    expect(comprovanteDaConfirmacao(c)).toEqual({ assinatura: 'data:a' });
    expect(comprovanteDaConfirmacao({ ...c, como: 'falha', assinatura: 'data:a', foto: null })).toBeNull();
    expect(dadosDaConfirmacao({ temFoto: false }, { ...c, como: 'falha', motivo: 'Cliente ausente', foto: 'data:f' }, QUEM, 't')).toMatchObject({ status: 'falha', motivoFalha: 'Cliente ausente', recebedor: '', temAssinatura: false });
  });
  it('a nova tentativa', () => {
    const e = entrega('e1', { clienteId: 'c1', itens: [{ tipo: 'DAS', valor: 5 }], tentativa: 2, status: 'falha' });
    expect(dadosDaNovaTentativa(e, 'Cliente ausente', QUEM, 't')).toMatchObject({ tentativa: 3, motivoTentativaAnterior: 'Cliente ausente', status: 'pendente', clienteId: 'c1' });
  });
  it('quem pode tirar da rota', () => {
    expect(podeExcluir({ status: 'confirmada', entregadoPor: 'maria@nilma.local' }, { admin: false, email: 'maria@nilma.local' })).toBe(false);
    expect(podeExcluir({ status: 'pendente', entregadoPor: 'maria@nilma.local' }, { admin: false, email: 'maria@nilma.local' })).toBe(true);
    expect(podeExcluir({ status: 'pendente', entregadoPor: 'jose@nilma.local' }, { admin: false, email: 'maria@nilma.local' })).toBe(false);
    expect(podeExcluir({ status: 'confirmada', entregadoPor: '' }, { admin: true, email: '' })).toBe(true);
  });
});

describe('vencimento e comprovante', () => {
  it('dia 20 do mês seguinte; o FGTS antecipa e o DAS adia o fim de semana', () => {
    // 20/09/2026 é domingo
    expect(vencimentoAutomatico('2026-08', [{ tipo: 'FGTS' }])).toBe('2026-09-18');
    expect(vencimentoAutomatico('2026-08', [{ tipo: 'DAS' }])).toBe('2026-09-21');
    expect(vencimentoAutomatico('2026-08', [{ tipo: 'DAS' }, { tipo: 'FGTS' }])).toBeNull();
    expect(vencimentoAutomatico('2026-09', [{ tipo: 'Notas' }])).toBeNull();
  });
  it('o texto do comprovante', () => {
    const e = entrega('e1', { clienteNome: '1 - ALFA', itens: [{ tipo: 'DAS', valor: 10 }], recebedor: 'João', entregadoPorNome: 'Maria', confirmadoEm: '2026-10-02T10:00:00Z', status: 'confirmada' });
    const t = textoDoComprovante(e, c => 'Set/' + c.slice(0, 4), n => 'R$ ' + n, () => '02/10/2026');
    expect(t).toContain('• DAS — R$ 10');
    expect(t).toContain('Recebido por: João');
    expect(t).toContain('Total: R$ 10');
  });
});
