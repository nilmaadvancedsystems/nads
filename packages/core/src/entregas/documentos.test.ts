// As regras da entrega de documentos (a cópia fiel do Entregas no nads, 16/10/2026), com clientes e entregas fictícios.
import { describe, expect, it } from 'vitest';
import {
  clienteCombina, clienteDaRotaDoDocumento, entregaDoDocumento, linhasDoPainel, numerosDoMes, rotaPadraoDoDocumento, rotuloDaCompetencia,
  rotuloDaSituacao, situacaoNoMes, subtituloDaLinhaDoPainel, totalDosItens, valorDigitado, motivoComToque, motivoPadrao, competenciaAnterior,
  ultimasCompetencias, documentoFormatado, type ClienteDaRota, type Entrega,
} from './documentos';
import {
  ajustarDiaUtil, barrasDaLinha, clienteDoPdf, codigoDePagamentoDoPdf, competenciaDoPdf, dadosDoPdf, doMesDaGuia, dvMod10, feriadosNacionais,
  guiasNaPasta, mesDaGuia, paradaDoCodigo, pixCopiaECola, pixValido, chavePixNormalizada, tipoDoPdf, valorDoPdf, vencimentoAutomatico, vencimentoDoPdf,
} from './guiasDoPdf';
import {
  avaliarLocalDaEntrega, avisoDaParada, chaveDaParada, diasAte, estadoDaOrdemFixa, fechamentoDoDia, janelaDoPeriodo, minutosPorParada, moverNaRota,
  moverPara, obrigacoesDoMes, ordemComAsVisiveis, ordemCompletaDaRota, ordenarParadas, ordenarPendentes, previsaoDaRota, projecaoDoLink, protocolosVisiveis,
  qualidadeDaRota, rotaPadraoDoEstado, textoPrazo, vencimentosDaRota, OBRIGACOES_PADRAO, linkDeRotaDoDocumento,
} from './rotaDeEntregas';
import {
  comprovanteDaConfirmacao, dadosDaConfirmacao, dadosDaEdicao, dadosDaEntregaNova, dadosDaNovaTentativa, dadosDoLote, faltasNaConfirmacao, faltasNaEntrega,
  faltasNoLote, proximaTentativa, textoDoComprovante, type Confirmacao,
} from './confirmacaoDaEntrega';
import {
  dicaDoCliente, donosDoLinkDe, empresasDoLink, historicoPorCompetencia, kpisDoCliente, linhasDaPlanilha, numeroDoWhatsApp, projecaoDoPortal,
  recebedoresSugeridos, codigoDoProtocolo, avisosDoCliente,
} from './clienteDaEntrega';
import { clientesSemEntrega, entregasPorDia, idsComEntregaConfirmada, metaDaEquipe, rankingDaEquipe } from './numerosDasEntregas';
import type { ItemDoDrive } from './drive';
import { dadosDaSolicitacao, faltaNaSolicitacao, linhaDaSolicitacao, pendentesPeloPrazo, podeConcluirSolicitacao, solicitacaoDoDocumento } from './solicitacoes';

const cliente = (id: string, nome: string, extra: Record<string, unknown> = {}): ClienteDaRota =>
  clienteDaRotaDoDocumento(id, { nome, codigoOrigem: id.replace(/\D/g, ''), documento: '', entrega: true, ...extra });
const entrega = (id: string, d: Record<string, unknown>): Entrega =>
  entregaDoDocumento(id, { clienteNome: 'X', competencia: '2026-09', status: 'pendente', criadoEm: '2026-10-01T10:00:00Z', ...d });

const A = cliente('c1', 'ALFA EXEMPLO LTDA', { documento: '11.222.333/0001-81' });
const B = cliente('c2', 'BETA EXEMPLO ME');
const C = cliente('c3', 'GAMA EXEMPLO', { entrega: false });
const QUEM = { email: 'maria@nilma.local', nome: 'Maria' };

describe('leitura do banco e formatos', () => {
  it('a entrega antiga com os itens só em texto e campos faltando', () => {
    const e = entregaDoDocumento('e1', { clienteId: 'c1', itens: ['DAS', { tipo: 'FGTS', valor: 120.5 }, null], status: 'xx', tentativa: 2, codigoPagamento: { tipo: 'pix', codigo: '000201x' }, geo: { lat: 1, lng: 2, accuracy: 9 } });
    expect(e.itens).toEqual([{ tipo: 'DAS', valor: null }, { tipo: 'FGTS', valor: 120.5 }]);
    expect(e.status).toBe('pendente');
    expect(e.tentativa).toBe(2);
    expect(e.ordemRota).toBeNull();
    expect(e.codigoPagamento).toEqual({ tipo: 'pix', codigo: '000201x' });
    expect(e.geo).toEqual({ lat: 1, lng: 2, accuracy: 9 });
  });
  it('o cliente: ativo, de entrega, janela, dias e contatos', () => {
    expect(clienteDaRotaDoDocumento('x', { nome: 'N', ativo: false }).ativo).toBe(false);
    const c = clienteDaRotaDoDocumento('x', { nome: 'N', janela: { de: '08:00', ate: '12:00' }, diasEntrega: [1, 3], contatos: [{ nome: 'Ana' }, {}], geo: { lat: 'x' } });
    expect(c).toMatchObject({ ativo: true, entrega: false, janela: { de: '08:00', ate: '12:00' }, diasEntrega: ['1', '3'], geo: null });
    expect(c.contatos).toEqual([{ nome: 'Ana', papel: '', telefone: '' }]);
  });
  it('a rota padrão ignora o que não é número/texto', () => {
    expect(rotaPadraoDoDocumento({ zonas: { c1: 'superior', c2: 3 }, ordem: { c1: 2, c2: 'x' } })).toEqual({ zonas: { c1: 'superior' }, ordem: { c1: 2 } });
    expect(rotaPadraoDoDocumento(null)).toEqual({ zonas: {}, ordem: {} });
  });
  it('a competência por extenso, a anterior e as últimas', () => {
    expect(rotuloDaCompetencia('2026-09')).toBe('setembro/2026');
    expect(competenciaAnterior('2026-01')).toBe('2025-12');
    expect(ultimasCompetencias(3, new Date(2026, 0, 15))).toEqual(['2026-01', '2025-12', '2025-11']);
    expect(documentoFormatado('11222333000181')).toBe('11.222.333/0001-81');
  });
});

describe('busca, valores e motivos', () => {
  it('busca por nome sem acento, código e parte do CNPJ', () => {
    expect(clienteCombina({ nome: 'ORÇAMENTO EXEMPLO', codigoOrigem: '', documento: '' }, 'orcamento')).toBe(true);
    expect(clienteCombina(A, '22233')).toBe(true);
    expect(clienteCombina(A, '99')).toBe(false);
  });
  it('o separador decimal é a posição: "1.500" é mil e quinhentos', () => {
    expect(valorDigitado('R$ 1.500')).toBe(1500);
    expect(valorDigitado('1.234,56')).toBe(1234.56);
    expect(valorDigitado('12.5')).toBe(12.5);
    expect(valorDigitado('1,5')).toBe(1.5);
    expect(valorDigitado('-3,2')).toBe(-3.2);
    expect(valorDigitado('')).toBeNull();
    expect(valorDigitado('abc')).toBeNull();
    expect(totalDosItens([{ tipo: 'DAS', valor: 10.1 }, { tipo: 'Notas', valor: null }, { tipo: 'FGTS', valor: 0.2 }])).toBe(10.3);
  });
  it('o motivo num toque troca o do começo e guarda o resto', () => {
    expect(motivoComToque('Cliente ausente. volto amanhã', 'Estabelecimento fechado')).toBe('Estabelecimento fechado. volto amanhã');
    expect(motivoPadrao('Recusou receber, disse que não é dele')).toBe('Recusou receber');
    expect(motivoPadrao('o portão estava trancado')).toBe('Outro motivo');
  });
});

describe('o PDF da guia', () => {
  const texto = 'DOCUMENTO DE ARRECADAÇÃO DO SIMPLES NACIONAL ALFA EXEMPLO LTDA CNPJ 11.222.333/0001-81 Período de Apuração: Setembro/2026 Data de Vencimento: 20/10/2026 Valor Total R$ 1.234,56';
  it('o tipo, a competência, o vencimento, o valor e o cliente', () => {
    expect(tipoDoPdf(texto)).toBe('das');
    expect(competenciaDoPdf(texto)).toBe('2026-09');
    expect(vencimentoDoPdf(texto)).toBe('2026-10-20');
    expect(valorDoPdf(texto)).toBe('1.234,56');
    expect(clienteDoPdf(texto, [B, A])?.id).toBe('c1');
    expect(clienteDoPdf('FGTS GAMA EXEMPLO DIGITAL', [B, C])?.id).toBe('c3');
    expect(dadosDoPdf(texto, [A], 'fgts')).toMatchObject({ cliente: null, competencia: null, tipo: 'fgts', vencimento: '2026-10-20' });
  });
  it('o vencimento ao lado de "vencimento" não vira competência', () => {
    expect(competenciaDoPdf('Vencimento 10/2026 competência 08/2026')).toBe('2026-08');
  });
  it('o PIX do escritório confere o CRC; a chave vai como o Banco Central pede', () => {
    const pix = pixCopiaECola('11.222.333/0001-81', 'Escritório Exemplo', 'Cidade', 150);
    expect(pixValido(pix)).toBe(true);
    expect(pix).toContain('540615' + '0.00');
    expect(pix).toContain('11222333000181');
    expect(chavePixNormalizada('(38) 99999-0000')).toBe('+5538999990000');
    expect(chavePixNormalizada('Fulano@Exemplo.com')).toBe('fulano@exemplo.com');
    expect(codigoDePagamentoDoPdf('pague com ' + pix + ' fim')).toEqual({ tipo: 'pix', codigo: pix });
  });
  it('a guia de arrecadação (48 dígitos) com o dígito de cada bloco; as barras sem os dígitos', () => {
    const blocos = ['86600000001', '23456000100', '23456789012', '34567890123'];
    const linha = blocos.map(b => b + dvMod10(b)).join(' ');
    expect(codigoDePagamentoDoPdf('Linha: ' + linha)).toEqual({ tipo: 'boleto', codigo: linha });
    expect(barrasDaLinha(linha)).toBe(blocos.join(''));
    const parada = entrega('p1', { codigoPagamento: { tipo: 'boleto', codigo: linha } });
    expect(paradaDoCodigo(blocos.join(''), [entrega('p0', {}), parada])?.id).toBe('p1');
    expect(paradaDoCodigo('123', [parada])).toBeNull();
  });
});

describe('vencimento automático e feriados', () => {
  it('os feriados nacionais de 2026 (a Páscoa em 5 de abril)', () => {
    const f = feriadosNacionais(2026);
    expect(f['2026-02-17']).toBe('Carnaval');
    expect(f['2026-04-03']).toBe('Sexta-feira Santa');
    expect(f['2026-06-04']).toBe('Corpus Christi');
    expect(f['2026-11-20']).toBe('Dia da consciência negra');
  });
  it('dia 20 do mês seguinte; o FGTS antecipa e o DAS adia o fim de semana e o feriado', () => {
    // 20/09/2026 é domingo
    expect(vencimentoAutomatico('2026-08', [{ tipo: 'FGTS' }])).toBe('2026-09-18');
    expect(vencimentoAutomatico('2026-08', [{ tipo: 'DAS' }])).toBe('2026-09-21');
    // 20/11/2026 é feriado (sexta)
    expect(vencimentoAutomatico('2026-10', [{ tipo: 'DAS' }])).toBe('2026-11-23');
    expect(vencimentoAutomatico('2026-10', [{ tipo: 'DARF' }, { tipo: 'FGTS' }])).toBe('2026-11-19');
    expect(vencimentoAutomatico('2026-08', [{ tipo: 'DAS' }, { tipo: 'FGTS' }])).toBeNull();
    expect(vencimentoAutomatico('2026-09', [{ tipo: 'Notas' }])).toBeNull();
    expect(ajustarDiaUtil(new Date(2026, 3, 3), 'antecipa').getDate()).toBe(2);
  });
});

describe('as guias da pasta do cliente', () => {
  const itens: ItemDoDrive[] = [
    { i: 'raiz', n: '58 - ALFA', p: '', t: 'd' },
    { i: 'dp', n: 'DEPARTAMENTO PESSOAL', p: 'raiz', t: 'd' },
    { i: 'm09', n: '09', p: 'dp', t: 'd' },
    { i: 'fg', n: 'FGTS', p: 'm09', t: 'd' },
    { i: 'f1', n: 'guia fgts.pdf', p: 'fg', t: 'f', m: '2026-10-05' },
    { i: 'f2', n: 'guia fgts nova.pdf', p: 'fg', t: 'f', m: '2026-10-06' },
    { i: 'cert', n: 'CERTIDAO FGTS 09-2026.pdf', p: 'raiz', t: 'f' },
    { i: 'fis', n: 'FISCAL', p: 'raiz', t: 'd' },
    { i: 'das', n: '01. DAS', p: 'fis', t: 'd' },
    { i: 'd1', n: 'SETEMBRO 2026.pdf', p: 'das', t: 'f' },
    { i: 'd2', n: 'AGOSTO 2026.pdf', p: 'das', t: 'f' },
  ];
  it('o mês da guia é o anterior ao da entrega', () => {
    expect(mesDaGuia('2026-10')).toEqual({ mm: '09', aaaa: '2026' });
    expect(mesDaGuia('2026-01')).toEqual({ mm: '12', aaaa: '2025' });
    expect(doMesDaGuia(['X', 'FGTS 09-2026.PDF'], { mm: '09', aaaa: '2026' })).toBe(true);
  });
  it('acha a mais nova de cada tipo, sem a certidão', () => {
    expect(guiasNaPasta(itens, { mm: '09', aaaa: '2026' }).map(g => g.guia.tipo + ':' + g.arquivo.i)).toEqual(['fgts:f2', 'das:d1']);
  });
});

describe('painel', () => {
  const doMes = [
    entrega('e1', { clienteId: 'c1', status: 'falha', criadoEm: '2026-10-01T10:00:00Z', confirmadoEm: '2026-10-02T10:00:00Z' }),
    entrega('e2', { clienteId: 'c1', status: 'confirmada', criadoEm: '2026-10-03T10:00:00Z', confirmadoEm: '2026-10-04T10:00:00Z', entregadoPorNome: 'Ana' }),
    entrega('e3', { clienteId: 'c2', status: 'link' }),
    entrega('e4', { clienteId: null, avulso: true, clienteNome: 'Banco: Caixa', status: 'falha' }),
  ];
  it('a situação é a da entrega mais nova', () => {
    expect(situacaoNoMes(doMes.filter(e => e.clienteId === 'c1'))).toBe('entregue');
    expect(situacaoNoMes([doMes[2]])).toBe('rota');
    expect(situacaoNoMes([])).toBe('sem_entrega');
    expect(rotuloDaSituacao('rota', doMes[2]).rotulo).toBe('No link');
  });
  it('sem busca, só os clientes de entrega; o avulso não confirmado conta como "na rota"', () => {
    const l = linhasDoPainel({ clientes: [A, B, C], pendentes: [], doMes, busca: '', filtro: 'todos' });
    expect(l.map(x => x.nome)).toEqual(['1 - ALFA EXEMPLO LTDA', '2 - BETA EXEMPLO ME', 'Banco: Caixa']);
    expect(l[2].situacao).toBe('rota');
    expect(subtituloDaLinhaDoPainel(l[0])).toContain('+1 entrega(s) nesta competência');
    expect(subtituloDaLinhaDoPainel(l[1])).toContain('no link, aguardando o cliente');
  });
  it('quem está na rota entra mesmo sem a marca; com busca, qualquer cliente ativo', () => {
    expect(linhasDoPainel({ clientes: [A, B, C], pendentes: [{ clienteId: 'c3' }], doMes: [], busca: '', filtro: 'todos' }).map(x => x.chave)).toEqual(['c1', 'c2', 'c3']);
    expect(linhasDoPainel({ clientes: [A, B, C], pendentes: [], doMes: [], busca: 'gama', filtro: 'todos' }).map(x => x.chave)).toEqual(['c3']);
  });
  it('os filtros (o avulso não entra em "sem entrega")', () => {
    const f = (filtro: Parameters<typeof linhasDoPainel>[0]['filtro']) => linhasDoPainel({ clientes: [A, B, C], pendentes: [], doMes, busca: '', filtro }).map(x => x.chave);
    expect(f('entregue')).toEqual(['c1']);
    expect(f('rota')).toEqual(['c2', 'avulsa-e4']);
    expect(f('falha')).toEqual([]);
    expect(f('com_entrega')).toEqual(['c1', 'c2', 'avulsa-e4']);
  });
  it('os números, o ranking, a meta e as entregas por dia', () => {
    expect(numerosDoMes([A, B], doMes)).toEqual({ total: 2, entregue: 1, rota: 1, falha: 0, sem_entrega: 0, porcento: 50 });
    expect(rankingDaEquipe(doMes)).toEqual([{ nome: 'Ana', total: 1 }]);
    expect(metaDaEquipe([{ total: 3 }, { total: 5 }], 4).texto).toBe('Meta: 4 por pessoa · 8 de 8 (100%) · meta da equipe batida');
    expect(entregasPorDia(doMes)).toEqual([{ dia: '2026-10-04', total: 1 }]);
    expect(clientesSemEntrega([A, B, C], [], new Set(idsComEntregaConfirmada(doMes))).map(c => c.id)).toEqual(['c2']);
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
  it('a proximidade encaixa quem está solto logo depois da parada mais perto, na mesma região', () => {
    const perto = (id: string, lat: number) => cliente(id, 'N' + id, { geo: { lat, lng: 0, precisao: 'rua' }, zona: 'central' });
    const m = new Map([perto('a', 0), perto('b', 1), perto('c', 0.01)].map(c => [c.id, c]));
    const l = [entrega('ea', { clienteId: 'a', ordemRota: 0 }), entrega('eb', { clienteId: 'b', ordemRota: 1 }), entrega('ec', { clienteId: 'c' })];
    expect(ordenarPendentes(l, { zonas: {}, ordem: {} }, m).map(e => e.id)).toEqual(['ea', 'ec', 'eb']);
  });
  it('a ordem da rota inteira com as visíveis reordenadas no lugar delas', () => {
    const l = [entrega('a', { ordemRota: 0 }), entrega('b', { ordemRota: 1 }), entrega('c', { criadoEm: '2026-10-01T01:00:00Z' }), entrega('d', { criadoEm: '2026-10-01T02:00:00Z' })];
    expect(ordemCompletaDaRota(l)).toEqual(['a', 'b', 'c', 'd']);
    expect(ordemComAsVisiveis(['a', 'b', 'c', 'd'], ['c', 'a'])).toEqual(['c', 'b', 'a', 'd']);
    expect(moverNaRota(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moverNaRota(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
    expect(moverPara(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a']);
  });
  it('o aviso mais caro primeiro: fora do horário, dia errado, a 2ª tentativa', () => {
    const c = cliente('j', 'J', { janela: { de: '08:00', ate: '12:00' }, diasEntrega: ['1'] });
    const e = entrega('t', { tentativa: 2, motivoTentativaAnterior: 'Cliente ausente' });
    expect(avisoDaParada(e, c, new Date(2026, 9, 14, 13, 0))).toBe('atende 08:00–12:00');
    expect(avisoDaParada(e, c, new Date(2026, 9, 14, 9, 0))).toBe('Recebe Seg');
    expect(avisoDaParada(e, c, new Date(2026, 9, 12, 9, 0))).toBe('2ª tentativa — antes: Cliente ausente');
  });
  it('o lugar: aprende sem ponto, aprende perto, acusa longe, ignora GPS ruim', () => {
    const sem = cliente('s', 'S');
    const com = cliente('k', 'K', { geo: { lat: -15.8, lng: -42.2, precisao: 'rua' } });
    expect(avaliarLocalDaEntrega(sem, { lat: 1, lng: 1, accuracy: 10 })).toEqual({ aprender: true, divergente: false, distancia: null });
    expect(avaliarLocalDaEntrega(com, { lat: -15.8001, lng: -42.2, accuracy: 10 }).aprender).toBe(true);
    expect(avaliarLocalDaEntrega(com, { lat: -15.81, lng: -42.2, accuracy: 10 }).divergente).toBe(true);
    expect(avaliarLocalDaEntrega(com, { lat: -15.81, lng: -42.2, accuracy: 2000 })).toEqual({ aprender: false, divergente: false, distancia: null });
  });
  it('o ritmo pela mediana e a previsão', () => {
    const conf = (id: string, h: number, m: number) => entrega(id, { status: 'confirmada', entregadoPor: 'a', confirmadoEm: new Date(2026, 9, 15, h, m).toISOString() });
    const l = [conf('1', 9, 0), conf('2', 9, 10), conf('3', 9, 20), conf('4', 9, 32), conf('5', 9, 40), conf('6', 9, 50), conf('7', 14, 0)];
    expect(minutosPorParada(l)).toEqual({ minutos: 10, amostras: 5 });
    expect(previsaoDaRota({ minutos: 10, amostras: 5 }, 9, false)?.texto).toBe('· ~1h30');
    expect(previsaoDaRota({ minutos: 10, amostras: 5 }, 3, true, new Date(2026, 9, 15, 10, 0))?.texto).toBe('· ~30 min · até 10:30');
    expect(minutosPorParada(l.slice(0, 3))).toBeNull();
  });
  it('os vencimentos da semana e o prazo por extenso', () => {
    const hoje = new Date(2026, 9, 15);
    expect(diasAte('2026-10-20', hoje)).toBe(5);
    expect(textoPrazo(-1)).toBe('venceu há 1 dia');
    expect(textoPrazo(1)).toBe('vence amanhã');
    const l = [entrega('a', { vencimento: '2026-10-30' }), entrega('b', { vencimento: '2026-10-14' }), entrega('c', { vencimento: '2026-10-16' }), entrega('d', {})];
    expect(vencimentosDaRota(l, hoje).map(x => x.e.id)).toEqual(['b', 'c']);
  });
  it('as obrigações: a data cai pra trás no fim de semana e conta as guias na rota', () => {
    const l = obrigacoesDoMes(OBRIGACOES_PADRAO, [entrega('a', { itens: [{ tipo: 'DAS', valor: 1 }] }), entrega('b', { itens: [{ tipo: 'DARF', valor: 1 }] })], new Date(2026, 9, 15));
    // 20/10/2026 é terça: DARF e DAS; o FGTS (7) e o ICMS (9) já passaram e vão para novembro
    expect(l.map(x => x.obrigacao.id + ':' + x.data.getDate() + '/' + (x.data.getMonth() + 1) + ':' + x.naRota)).toEqual(['darf:20/10:1', 'das:20/10:1', 'fgts:6/11:0', 'esocial:6/11:0', 'icms:9/11:0']);
  });
  it('a qualidade: sem região e endereço impreciso, quem está na rota primeiro; o aglutinado fica de fora', () => {
    const q = qualidadeDaRota([A, B, cliente('c9', 'ZETA', { zona: 'central', geo: { lat: 1, lng: 1, precisao: 'cidade' } }), cliente('c8', 'ETA', { grupoLocal: 'c1' })], [{ clienteId: 'c2' }]);
    expect(q.semZona.map(c => c.id)).toEqual(['c2', 'c1']);
    expect(q.enderecoImpreciso.map(c => c.id)).toEqual(['c2', 'c1', 'c9']);
  });
  it('a ordem fixa por região, ida e volta', () => {
    const e = estadoDaOrdemFixa({ zonas: { a: 'central', b: 'central', c: 'superior', z: 'central' }, ordem: { a: 2, b: 1, c: 1, z: 3 } }, id => id !== 'z');
    expect(e).toEqual({ superior: ['c'], central: ['b', 'a'], inferior: [] });
    expect(rotaPadraoDoEstado(e)).toEqual({ zonas: { c: 'superior', b: 'central', a: 'central' }, ordem: { c: 1, b: 1, a: 2 } });
  });
  it('os protocolos do período, a busca e o fechamento do dia', () => {
    expect(janelaDoPeriodo('2026-10-16', '2026-10-15')).toMatchObject({ de: '2026-10-15', ate: '2026-10-16' });
    const conf = (id: string, d: Record<string, unknown>) => entrega(id, { status: 'confirmada', confirmadoEm: new Date(2026, 9, 15, 10).toISOString(), ...d });
    const l = [conf('a', { clienteId: 'c1', clienteNome: '1 - ALFA', entregadoPorNome: 'Ana' }), conf('b', { clienteNome: 'BETA', entregadoPorNome: 'Bia', status: 'falha' })];
    expect(protocolosVisiveis(l, '0001-81', '', new Map([[A.id, A]])).map(e => e.id)).toEqual(['a']);
    expect(protocolosVisiveis(l, '', 'Bia', new Map()).map(e => e.id)).toEqual(['b']);
    expect(fechamentoDoDia(l, '2026-10-15').porPessoa).toEqual([{ nome: 'Ana', entregues: 1, falhas: 0 }, { nome: 'Bia', entregues: 0, falhas: 1 }]);
  });
  it('a fila pública: só o código de quem está na frente; a estimativa sozinha não regrava', () => {
    const m = new Map([[A.id, A], [B.id, B]]);
    const l = [entrega('a', { clienteId: 'c2' }), entrega('b', { clienteId: 'c1' })];
    const link = linkDeRotaDoDocumento('t', { clienteChave: 'c1', paradasAntes: ['2'], estimativaMinutos: 5 });
    expect(projecaoDoLink(link, l, m, { minutos: 10 })).toEqual({ concluida: false, paradasAntes: ['2'], estimativaMinutos: 10, mudou: false });
    expect(projecaoDoLink({ ...link, clienteChave: 'c9' }, l, m, null)).toMatchObject({ concluida: true, mudou: true });
  });
});

describe('registrar e confirmar', () => {
  it('o que falta para pôr na rota', () => {
    expect(faltasNaEntrega({ para: { tipo: 'avulso', nome: ' ' }, competencia: '2026-13', itens: [] }))
      .toEqual({ cliente: 'Selecione um cliente da lista, ou informe o nome.', competencia: 'Informe a competência.', itens: 'Adicione ao menos um documento.' });
    expect(faltasNaEntrega({ para: { tipo: 'banco', nome: '' }, competencia: '2026-09', itens: [{ tipo: 'DAS', valor: 1 }] })).toEqual({ cliente: 'Diga qual banco.' });
  });
  it('o documento novo, como o Entregas grava (na rota e no link)', () => {
    const base = { competencia: '2026-09', vencimento: '2026-10-20', itens: [{ tipo: 'DAS', valor: 10 }], zona: 'central', codigoPagamento: null, foto: null, fotoEhGuia: false };
    const d = dadosDaEntregaNova({ ...base, modo: 'rota', para: { tipo: 'cliente', cliente: A } }, QUEM, '2026-10-16T12:00:00Z');
    expect(d).toMatchObject({ clienteId: 'c1', clienteNome: '1 - ALFA EXEMPLO LTDA', avulso: false, banco: null, status: 'pendente', temGuia: false, temFoto: false, temAssinatura: false, entregadoPor: 'maria@nilma.local', confirmadoEm: null, zona: 'central', canal: '' });
    expect(dadosDaEntregaNova({ ...base, modo: 'link', para: { tipo: 'cliente', cliente: A }, foto: 'data:g', fotoEhGuia: true }, QUEM, 't'))
      .toMatchObject({ status: 'link', canal: 'link', zona: '', temGuia: true, temFoto: true });
    expect(dadosDaEntregaNova({ ...base, modo: 'rota', para: { tipo: 'banco', nome: 'Caixa' } }, QUEM, 'x')).toMatchObject({ clienteId: null, clienteNome: 'Banco: Caixa', avulso: true, banco: 'Caixa' });
  });
  const base: Confirmacao = { falha: false, semAssinatura: false, comPix: false, recebedor: '', motivoFalha: '', motivoSemAssinatura: '', assinatura: null, foto: null, geo: null };
  it('as exigências da parada', () => {
    expect(faltasNaConfirmacao(base, [{ tipo: 'DAS', valor: 1 }])).toEqual({ assinatura: 'Colha a assinatura ou anexe uma foto antes de confirmar.' });
    expect(faltasNaConfirmacao(base, [{ tipo: 'Honorário', valor: null }])).toEqual({});
    expect(faltasNaConfirmacao({ ...base, comPix: true }, [{ tipo: 'Honorário', valor: null }])).toEqual({ foto: 'Anexe uma foto — é obrigatória nesse caso.' });
    expect(faltasNaConfirmacao(base, [{ tipo: 'Notas', valor: null }])).toEqual({});
    expect(faltasNaConfirmacao({ ...base, semAssinatura: true }, [])).toEqual({ foto: 'Anexe uma foto — é obrigatória nesse caso.' });
    expect(Object.keys(faltasNaConfirmacao({ ...base, falha: true }, []))).toEqual(['foto', 'motivo']);
  });
  it('a confirmação grava quem entregou, o lugar, e não apaga a guia', () => {
    const c = { ...base, recebedor: ' João ', assinatura: 'data:a', geo: { lat: 1, lng: 2 } };
    const av = { aprender: false, divergente: true, distancia: 0.8 };
    expect(dadosDaConfirmacao(c, av, QUEM, 't')).toMatchObject({ status: 'confirmada', recebedor: 'João', temAssinatura: true, temFoto: false, entregadoPor: 'maria@nilma.local', confirmadoEm: 't', falha: false, localDivergente: true, distanciaDoClienteKm: 0.8, geo: { lat: 1, lng: 2 } });
    expect(comprovanteDaConfirmacao(c)).toEqual({ assinatura: 'data:a' });
    expect(comprovanteDaConfirmacao({ ...c, falha: true })).toBeNull();
    expect(dadosDaConfirmacao({ ...c, falha: true, motivoFalha: 'Cliente ausente', foto: 'data:f' }, av, QUEM, 't')).toMatchObject({ status: 'falha', motivoFalha: 'Cliente ausente', recebedor: '', temAssinatura: false, localDivergente: false });
    expect(dadosDaConfirmacao({ ...c, semAssinatura: true, motivoSemAssinatura: 'portaria' }, av, QUEM, 't')).toMatchObject({ semAssinatura: true, motivoSemAssinatura: 'portaria', temAssinatura: false });
  });
  it('as paradas juntas: uma assinatura para todas', () => {
    const l = { falha: false, recebedor: '', motivoFalha: '', assinatura: null, foto: null, geo: null };
    expect(faltasNoLote(l, 0)).toEqual({ escolha: 'Escolha ao menos uma entrega.' });
    expect(faltasNoLote(l, 2)).toEqual({ assinatura: 'Colha a assinatura ou anexe uma foto antes de confirmar.' });
    expect(dadosDoLote({ ...l, falha: true, motivoFalha: 'x', foto: 'f' }, { aprender: false, divergente: true, distancia: 2 }, QUEM, 't')).toMatchObject({ status: 'falha', distanciaDoClienteKm: null, localDivergente: false });
  });
  it('a nova tentativa e a edição', () => {
    const e = entrega('e1', { clienteId: 'c1', itens: [{ tipo: 'DAS', valor: 5 }], tentativa: 2, status: 'falha' });
    expect(dadosDaNovaTentativa(e, 'Cliente ausente', QUEM, 't')).toMatchObject({ tentativa: 3, motivoTentativaAnterior: 'Cliente ausente', status: 'pendente', clienteId: 'c1' });
    expect(proximaTentativa([e, entrega('x', {})])).toBe(3);
    expect(dadosDaEdicao('2026-10', 'central', [{ tipo: 'Multa Rescisória', valor: 10, funcionario: ' Ana ' }])).toEqual({ competencia: '2026-10', zona: 'central', itens: [{ tipo: 'Multa Rescisória', valor: 10, funcionario: 'Ana' }] });
  });
  it('o texto do comprovante', () => {
    const e = entrega('e1', { clienteNome: '1 - ALFA', itens: [{ tipo: 'DAS', valor: 10 }], recebedor: 'João', entregadoPorNome: 'Maria', confirmadoEm: '2026-10-02T10:00:00Z', status: 'confirmada' });
    const t = textoDoComprovante(e, '1 - ALFA', c => 'Set/' + c.slice(0, 4), n => 'R$ ' + n, () => '02/10/2026');
    expect(t).toContain('• DAS — R$ 10');
    expect(t).toContain('Recebido por: João');
    expect(t).toContain('Total: R$ 10');
  });
});

describe('o cliente e o link dele', () => {
  const hist = [
    entrega('h1', { clienteId: 'c1', status: 'confirmada', recebedor: 'Ana', confirmadoEm: new Date(2026, 9, 1, 9, 10).toISOString(), competencia: '2026-10' }),
    entrega('h2', { clienteId: 'c1', status: 'confirmada', recebedor: 'ana ', confirmadoEm: new Date(2026, 8, 1, 10, 0).toISOString(), competencia: '2026-09' }),
    entrega('h3', { clienteId: 'c1', status: 'confirmada', recebedor: 'Beto', confirmadoEm: new Date(2026, 7, 1, 10, 30).toISOString(), competencia: '2026-08' }),
    entrega('h4', { clienteId: 'c1', status: 'falha', confirmadoEm: new Date(2026, 6, 1, 12, 5).toISOString(), competencia: '2026-07' }),
    entrega('h5', { clienteId: 'c1', status: 'falha', confirmadoEm: new Date(2026, 6, 2, 12, 40).toISOString(), competencia: '2026-07' }),
  ];
  it('quem costuma receber e a dica de horário', () => {
    expect(recebedoresSugeridos(hist)).toEqual(['Ana', 'Beto']);
    expect(dicaDoCliente(hist)).toBe('Costuma receber entre 9h e 11h · 2 tentativas sem sucesso por volta das 12h');
  });
  it('os números, o histórico por mês e a planilha', () => {
    const k = kpisDoCliente({ ...A, honorarioForma: 'Dinheiro', honorarioDia: '10' }, hist, 4, new Date(2026, 9, 15));
    expect(k.map(x => x.rotulo + '=' + x.valor)).toEqual(['Entregas=5', 'Última entrega=01/10/2026', 'Este mês=1 entregue', 'Honorário=Pendente']);
    expect(historicoPorCompetencia(hist).map(g => g.rotulo + ':' + g.entregas.length)).toEqual(['outubro/2026:1', 'setembro/2026:1', 'agosto/2026:1', 'julho/2026:2']);
    expect(linhasDaPlanilha([hist[0]])[0].slice(0, 2)).toEqual(['X', 'outubro/2026']);
  });
  it('os avisos (sem ponto no mapa só fora da consulta)', () => {
    expect(avisosDoCliente(A, false).map(a => a.tipo)).toEqual(['mapa']);
    expect(avisosDoCliente(A, true)).toEqual([]);
  });
  it('o link: a principal do grupo responde pelas outras', () => {
    const dono = cliente('p', 'PRINCIPAL', { portalToken: 'tok' });
    const seg = cliente('s', 'SEGUE', { grupoLocal: 'p' });
    const m = new Map([[dono.id, dono], [seg.id, seg]]);
    expect(empresasDoLink(dono, m).map(c => c.id)).toEqual(['p', 's']);
    expect(donosDoLinkDe('s', m).map(c => c.id)).toEqual(['p']);
    const p = projecaoDoPortal(dono, empresasDoLink(dono, m), [entrega('x', { clienteId: 's', competencia: '2026-10', itens: [{ tipo: 'Honorário', valor: null }], status: 'confirmada', confirmadoEm: '2026-10-05T10:00:00Z' })],
      { pixChave: '', pixNome: 'N', pixCidade: 'C', honorarioTexto: '', whatsapp: '' }, new Date(2026, 9, 15));
    expect(p.clienteNome).toBe('PRINCIPAL e mais 1 empresa');
    expect(p.entregas.lista[0]).toMatchObject({ id: 'x', empresa: 'SEGUE', status: 'confirmada' });
    expect(p.escritorio).toMatchObject({ honorarioMes: '2026-10', honorarioEntregue: true, pix: '' });
  });
  it('o WhatsApp e o código do protocolo', () => {
    expect(numeroDoWhatsApp('(38) 99999-0000')).toBe('5538999990000');
    expect(numeroDoWhatsApp('1234')).toBe('');
    expect(codigoDoProtocolo(n => new Uint8Array(n).fill(33))).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);
  });
});

describe('as solicitações', () => {
  const s = (id: string, d: Record<string, unknown>) => solicitacaoDoDocumento(id, { descricao: 'D' + id, criadoEm: '2026-10-1' + id + 'T10:00:00Z', criadoPor: 'a@x', ...d });
  it('urgentes à parte, o resto pelo prazo (sem prazo no fim)', () => {
    const p = pendentesPeloPrazo([s('1', { prazo: '2026-10-20' }), s('2', {}), s('3', { prazo: '2026-10-18', urgente: true }), s('4', { prazo: '2026-10-17' })]);
    expect(p.urgentes.map(x => x.id)).toEqual(['3']);
    expect(p.outras.map(x => x.id)).toEqual(['4', '1', '2']);
  });
  it('quem conclui e o que falta', () => {
    expect(podeConcluirSolicitacao({ criadoPor: 'a@x' }, [], 'a@x')).toBe(true);
    expect(podeConcluirSolicitacao({ criadoPor: 'b@x' }, ['admin'], 'a@x')).toBe(false);
    expect(podeConcluirSolicitacao({ criadoPor: 'b@x' }, ['office_boy'], 'a@x')).toBe(true);
    const base = { tipo: 'atestado' as const, local: '', descricao: '', clinica: 'Assegi', funcionario: '', empresa: null, prazo: '2026-10-20', urgente: false };
    expect(faltaNaSolicitacao(base, new Date(2026, 9, 16)).texto).toBe('Falta o nome do funcionário e a empresa (escolha da lista).');
    expect(faltaNaSolicitacao({ ...base, tipo: 'buscar', descricao: 'x', prazo: '2026-10-15' }, new Date(2026, 9, 16)).campo).toBe('prazo');
  });
  it('o documento do atestado, como o Entregas grava', () => {
    const d = dadosDaSolicitacao({ tipo: 'atestado', local: '', descricao: '', clinica: 'Assegi', funcionario: ' Ana ', empresa: { id: 'c1', nome: 'ALFA', codigoOrigem: '1' }, prazo: '2026-10-20', urgente: true }, { email: 'm@x', nome: 'M' }, 't');
    expect(d).toMatchObject({ tipo: 'atestado', local: 'Assegi', descricao: 'Buscar atestado de Ana — 1 - ALFA (clínica Assegi)', atestadoEmpresaId: 'c1', status: 'pendente', criadoPor: 'm@x', urgente: true });
    expect(linhaDaSolicitacao(s('1', { prazo: '2026-10-15' }), 'a@x', new Date(2026, 9, 16)).atrasada).toBe(true);
  });
});
