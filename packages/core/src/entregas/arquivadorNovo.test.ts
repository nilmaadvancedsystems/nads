import { describe, expect, it } from 'vitest';
import {
  barrasPorTipo, filtrarItens, grupoDoTipo, lerPainelDoArquivador, lerParteDoDia, progressoDaPassada, resumoDoDia, situacaoDoArquivador,
  type PainelDoArquivador,
} from '.';

const AGORA = Date.parse('2026-10-22T15:00:00Z');
const ha = (min: number) => new Date(AGORA - min * 60000).toISOString();

const contagem = (o: Record<string, unknown>) => ({ chave: '2026-10-22', porAcao: {}, porTipo: {}, porMotivo: {}, pastasNovas: [], clientes: [], totalDeClientes: 0, ...o });
function painel(o: Record<string, unknown> = {}): PainelDoArquivador {
  return lerPainelDoArquivador({ painel: { em: ha(1), config: { modo: 'producao', emProducao: true, tiposProducao: ['todos'] }, hoje: contagem({}), mes: contagem({}), ...o } })!;
}

describe('o arquivador novo (Admin › Arquivador)', () => {
  it('sem o painel: null (o robô ainda não foi atualizado)', () => {
    expect(lerPainelDoArquivador(null)).toBeNull();
    expect(lerPainelDoArquivador({ config: { modo: 'simulacao' } })).toBeNull();
  });

  it('lê o painel, com o que veio torto no lugar', () => {
    const p = lerPainelDoArquivador({ painel: {
      em: ha(1), situacao: 'esperando', esperando: 'a rotina antiga está rodando', ritmo: '12.5',
      config: { modo: 'xxx', tiposProducao: ['XML', 3] },
      pasta: { naPasta: 7, lista: [{ nome: 'a.pdf', situacao: 'lendo' }, { nome: 'b.pdf', situacao: '???' }] },
      hoje: { porAcao: { arquivou: 3, naoIdentificado: '2' }, porTipo: { DAS: 2, X: 0 }, clientes: [{ codigo: '58', nome: 'A', n: 3 }, { nome: 'sem código' }] },
      ultimos: [{ id: 'i1', acao: 'arquivou', nome: 'a.pdf', confianca: 96, evidencias: ['CNPJ', '', null] }, { acao: 'outra coisa', rel: 'x\\b.pdf' }],
    } })!;
    expect(p.config?.modo).toBe('');
    expect(p.config?.tiposProducao).toEqual(['XML', '3']);
    expect(p.ritmo).toBe(12.5);
    expect(p.pasta?.lista.map(x => x.situacao)).toEqual(['lendo', 'fila']);
    expect(p.hoje.porAcao).toEqual({ arquivou: 3, arquivaria: 0, jaArquivado: 0, naoIdentificado: 2, fica: 0, erro: 0 });
    expect(p.hoje.porTipo).toEqual({ DAS: 2 });
    expect(p.hoje.clientes).toEqual([{ codigo: '58', nome: 'A', n: 3 }]);
    expect(p.ultimos[0].evidencias).toEqual(['CNPJ']);
    expect(p.ultimos[1]).toMatchObject({ acao: 'fica', nome: 'b.pdf', confianca: null });
    expect(p.ladoALado).toBeNull();
  });

  it('lê uma parte do histórico do dia', () => {
    const d = lerParteDoDia({ dia: '2026-10-22', parte: 2, itens: [{ id: 'a', acao: 'arquivou', nome: 'x.xml' }] });
    expect([d.dia, d.parte, d.itens.length, d.itens[0].acao]).toEqual(['2026-10-22', 2, 1, 'arquivou']);
    expect(lerParteDoDia(null).itens).toEqual([]);
  });

  it('agrupa os tipos das regras para o gráfico, cada um com a logo ou o ícone', () => {
    expect(grupoDoTipo('XML NF-e EVENTOS')).toMatchObject({ id: 'xml-nfe', formato: 'XML' });
    expect(grupoDoTipo('DAS')).toMatchObject({ id: 'das', marca: 'simples' });
    expect(grupoDoTipo('DARF')).toMatchObject({ marca: 'receita' });
    expect(grupoDoTipo('FGTS')).toMatchObject({ marca: 'fgts' });
    expect(grupoDoTipo('DAE')).toMatchObject({ marca: 'minas' });
    expect(grupoDoTipo('EXTRATO OFX').id).toBe('extrato');
    expect(grupoDoTipo('qualquer').id).toBe('outros');
    const b = barrasPorTipo({ 'XML NF-e': 5, 'XML NF-e EVENTOS': 2, DAS: 9, DEFIS: 1, EXTRATO: 3 });
    expect(b.map(x => [x.id, x.n])).toEqual([['das', 10], ['xml-nfe', 7], ['extrato', 3]]);
    expect(b[1].tipos).toEqual(['XML NF-e', 'XML NF-e EVENTOS']);
  });

  it('o resumo do dia em linguagem simples (produção)', () => {
    const p = painel({ hoje: contagem({
      porAcao: { arquivou: 312, naoIdentificado: 8, fica: 1, jaArquivado: 4 }, totalDeClientes: 41,
      porMotivo: { CLIENTE_NAO_LOCALIZADO: 5, CLIENTE_AMBIGUO: 3, CONTEUDO_SEM_TEXTO: 1 }, pastasNovas: ['592 - ALFA LTDA', '593 - BETA ME'],
    }) });
    expect(resumoDoDia(p)).toBe('Hoje arquivei 312 arquivos de 41 clientes. 9 ficaram para você resolver (5 sem CNPJ cadastrado, 3 com duas empresas possíveis e 1 escaneado sem leitura). '
      + '4 já estavam arquivados (o mesmo conteúdo na pasta do cliente). Criei 2 pastas novas: 592 - ALFA LTDA e 593 - BETA ME.');
  });

  it('o resumo em simulação fala no condicional; dia vazio também tem frase', () => {
    const sim = painel({ config: { modo: 'simulacao' }, hoje: contagem({ porAcao: { arquivaria: 1 }, totalDeClientes: 1 }) });
    expect(resumoDoDia(sim)).toBe('Hoje eu arquivaria (simulação) 1 arquivo de 1 cliente. Nada ficou para você resolver.');
    expect(resumoDoDia(painel())).toBe('Hoje ainda não chegou nada para arquivar.');
    const comResto = painel({ hoje: contagem({ porAcao: { arquivou: 1, naoIdentificado: 6 }, porMotivo: { A: 2, B: 1, C: 1, D: 1, E: 1 } }) });
    expect(resumoDoDia(comResto)).toContain('6 ficaram para você resolver (2 a, 1 b, 1 c e 2 por outros motivos).');
  });

  it('o progresso da passada: "1.240 de 17.158" e a previsão pelo ritmo', () => {
    const p = progressoDaPassada({ inicio: ha(60), feitos: 1240, total: 17158, fim: '' }, 40, AGORA)!;
    expect([p.feitos, p.total, p.pct, p.faltam, p.terminou]).toEqual([1240, 17158, 7, 15918, false]);
    expect(p.previsao).toMatch(/^Termina por volta (das|de)/);
    expect(progressoDaPassada({ inicio: ha(5), feitos: 10, total: 30, fim: '' }, 2, AGORA)!.previsao).toBe('Termina em uns 10 min');
    expect(progressoDaPassada({ inicio: ha(5), feitos: 10, total: 30, fim: '' }, 0, AGORA)!.previsao).toBe('Sem ritmo ainda para prever o fim');
    expect(progressoDaPassada({ inicio: ha(5), feitos: 30, total: 30, fim: ha(1) }, 5, AGORA)).toMatchObject({ pct: 100, terminou: true });
    expect(progressoDaPassada(null, 5, AGORA)).toBeNull();
  });

  it('a situação: em dia, trabalhando, esperando, Drive fora, parado, sem sinal', () => {
    expect(situacaoDoArquivador(null, AGORA).tom).toBe('neutro');
    expect(situacaoDoArquivador(painel({ pasta: { naPasta: 0 } }), AGORA).titulo).toBe('Em dia');
    expect(situacaoDoArquivador(painel({ pasta: { naPasta: 9, naFila: 8, sendoLidos: 1 } }), AGORA).titulo).toBe('Trabalhando');
    expect(situacaoDoArquivador(painel({ situacao: 'sem-drive' }), AGORA).tom).toBe('erro');
    expect(situacaoDoArquivador(painel({ situacao: 'esperando', esperando: 'a rotina antiga' }), AGORA)).toMatchObject({ tom: 'aviso', texto: 'a rotina antiga' });
    expect(situacaoDoArquivador(painel({ em: ha(40), pasta: { naFila: 3 } }), AGORA).titulo).toBe('Parado');
  });

  it('filtra pela busca (sem acento), pelo cliente, pelo grupo de tipo e pela ação', () => {
    const p = painel({ ultimos: [
      { id: '1', acao: 'arquivou', nome: 'Extrato São José.pdf', tipo: 'EXTRATO', cliente: '58', clienteNome: 'ALFA' },
      { id: '2', acao: 'arquivou', nome: 'nota.xml', tipo: 'XML NF-e', cliente: '292', clienteNome: 'BETA' },
      { id: '3', acao: 'jaArquivado', nome: 'das.pdf', tipo: 'DAS', cliente: '58', clienteNome: 'ALFA' },
    ] });
    expect(filtrarItens(p.ultimos, { busca: 'sao jose' }).map(x => x.id)).toEqual(['1']);
    expect(filtrarItens(p.ultimos, { cliente: '58' }).map(x => x.id)).toEqual(['1', '3']);
    expect(filtrarItens(p.ultimos, { tipo: 'xml-nfe' }).map(x => x.id)).toEqual(['2']);
    expect(filtrarItens(p.ultimos, { acao: 'jaArquivado' }).map(x => x.id)).toEqual(['3']);
    expect(filtrarItens(p.ultimos, { busca: 'beta' }).map(x => x.id)).toEqual(['2']);
  });
});
