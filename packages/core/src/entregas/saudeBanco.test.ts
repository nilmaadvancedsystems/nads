import { describe, expect, it } from 'vitest';
import {
  colecoesQueCrescem, cotaDeHoje, cotaDoArmazenamento, formatarBytes, lerResumoDaSaudeDoBanco, lerUsoDeHoje, piorTom, saudeDoBanco, sinaisNoBanco,
  type LinhaDaFila,
} from '.';

const AGORA = Date.parse('2026-10-21T15:00:00Z');
const ha = (min: number) => new Date(AGORA - min * 60000).toISOString();

describe('saúde do banco (o site do admin)', () => {
  it('lê o robo/uso e compara com a cota grátis', () => {
    const uso = lerUsoDeHoje({ em: ha(5), desde: ha(600), leituras: 36000, gravacoes: 1500, exclusoes: '19000' });
    const cota = cotaDeHoje(uso);
    expect(cota.map(c => [c.id, c.pct, c.tom])).toEqual([['leituras', 72, 'aviso'], ['gravacoes', 7.5, 'ok'], ['exclusoes', 95, 'erro']]);
    expect(cota[0].texto).toBe('36.000 de 50.000 (72%)');
  });

  it('sem medição (ou com erro) não inventa número', () => {
    expect(lerUsoDeHoje(null)).toBeNull();
    expect(cotaDeHoje(null).every(c => c.usado === null && c.tom === 'neutro' && c.texto === 'sem medição')).toBe(true);
    const comErro = lerUsoDeHoje({ em: ha(5), erro: 'sem permissão' });
    expect(cotaDeHoje(comErro)[0].usado).toBeNull();
  });

  it('lê o resumo diário, com o que faltou como null', () => {
    const r = lerResumoDaSaudeDoBanco({
      em: ha(60), dia: '2026-10-21', leiturasGastas: 812, duracaoMs: 9000,
      colecoes: [{ nome: 'rotinas', total: 4200, ha7dias: 3900 }, { nome: 'novidade', total: 3 }],
      orfaos: [{ colecao: 'areasCliente', rotulo: 'Espelhos sem link', quantos: 2, exemplos: ['a', 'b', 'c', 'd', 'e', 'f'] }],
      usoPorDia: [{ dia: '2026-10-20', leituras: 30000 }, { dia: '2026-10-19', leituras: 20000 }, { dia: 'lixo' }],
      armazenamento: { erro: 'sem permissão' },
      hospedagem: [{ projeto: 'conferencia-nilma', bytes: 2e9, limite: 1e10, sites: [{ site: 'a', bytes: 1 }, { site: 'b', bytes: 5 }] }],
    })!;
    expect(r.colecoes[1].ha7dias).toBeNull();
    expect(r.orfaos[0].exemplos).toHaveLength(5);
    expect(r.usoPorDia.map(u => u.dia)).toEqual(['2026-10-19', '2026-10-20']);
    expect(r.armazenamento).toEqual({ bytes: null, erro: 'sem permissão' });
    expect(r.hospedagem[0].sites.map(s => s.site)).toEqual(['b', 'a']);
    expect(r.hospedagem[0].enviadoNoMes).toBeNull();
    const linhas = cotaDoArmazenamento(r);
    expect(linhas.map(l => [l.id, l.pct, l.tom])).toEqual([['firestore', null, 'neutro'], ['hosp-conferencia-nilma', 20, 'ok']]);
  });

  it('bytes por extenso', () => {
    expect(formatarBytes(null)).toBe('—');
    expect(formatarBytes(512)).toBe('512 B');
    expect(formatarBytes(1536)).toBe('1,5 KB');
    expect(formatarBytes(1024 ** 3)).toBe('1 GB');
    expect(formatarBytes(340 * 1024 ** 2)).toBe('340 MB');
  });

  it('as coleções que crescem demais', () => {
    const c = colecoesQueCrescem([
      { nome: 'parada', total: 100, ha7dias: 100 },
      { nome: 'dobrou', total: 3000, ha7dias: 1500 },
      { nome: 'grande', total: 60000, ha7dias: 59900 },
      { nome: 'nova', total: 10, ha7dias: null },
    ]);
    expect(c.map(x => [x.nome, x.cresceu, x.tom])).toEqual([['dobrou', 1500, 'aviso'], ['grande', 100, 'aviso'], ['parada', 0, 'ok'], ['nova', null, 'ok']]);
  });

  it('a última gravação de cada robô, com o prazo de cada um', () => {
    const s = sinaisNoBanco([
      { id: 'vm', rotulo: 'Robô da nuvem', em: ha(1), esperadoMin: 3 },
      { id: 'pc', rotulo: 'Robô do PC', em: ha(7), esperadoMin: 3 },
      { id: 'uso', rotulo: 'Uso do banco', em: ha(200), esperadoMin: 20 },
      { id: 'resumo', rotulo: 'Resumo', em: '', esperadoMin: 1440 },
    ], AGORA);
    expect(s.map(x => x.tom)).toEqual(['ok', 'aviso', 'erro', 'neutro']);
    expect(piorTom(s.map(x => x.tom))).toBe('erro');
    expect(piorTom([])).toBe('neutro');
  });

  it('as linhas da saúde: sem resumo, só o que dá para dizer', () => {
    const fila = (tom: LinhaDaFila['tom'], esperando: number): LinhaDaFila => ({ id: 'f' + tom, nome: 'Fila ' + tom, esperando, andamento: 0, maisAntigoEm: ha(90), erro: '', robo: 'pc', tom, espera: 'há 1 h' });
    const itens = saudeDoBanco({
      resumo: null, uso: null, sinais: [], filas: [fila('ok', 1), fila('aviso', 3)],
      errosDaFila: [{ tipo: 'um', erro: 'x', em: ha(30), cliente: 'A' }, { tipo: 'um', erro: 'y', em: ha(60 * 30), cliente: 'B' }],
    }, AGORA);
    expect(itens.map(i => i.id)).toEqual(['cota', 'resumo', 'filas', 'sinais', 'pedidos']);
    const por = Object.fromEntries(itens.map(i => [i.id, i]));
    expect(por.cota.tom).toBe('neutro');
    expect(por.resumo.texto).toBe('O robô ainda não publicou o resumo');
    expect(por.filas.tom).toBe('aviso');
    expect(por.filas.texto).toBe('1 fila atrasada');
    expect(por.pedidos.texto).toBe('1 pedido deu erro');
  });

  it('as linhas da saúde com o resumo: órfãos, crescimento e resumo atrasado', () => {
    const resumo = lerResumoDaSaudeDoBanco({
      em: ha(60 * 40), dia: '2026-10-19', colecoes: [{ nome: 'roboAtividade', total: 9000, ha7dias: 2000 }],
      orfaos: [{ colecao: 'areasCliente', rotulo: 'Espelhos sem link', quantos: 2 }, { colecao: 'feedbacks', rotulo: 'Partes sem feedback', quantos: 0 }],
      armazenamento: { bytes: 300 * 1024 ** 2 },
    });
    const por = Object.fromEntries(saudeDoBanco({ resumo, uso: null, sinais: [], filas: [], errosDaFila: [] }, AGORA).map(i => [i.id, i]));
    expect(por.resumo.tom).toBe('aviso');
    expect(por.resumo.texto).toBe('Atrasado: o último é há 40 h');
    expect(por.armazenamento.tom).toBe('ok');
    expect(por.orfaos.texto).toBe('2 documentos órfãos');
    expect(por.orfaos.detalhe).toBe('Espelhos sem link: 2');
    expect(por.crescimento.tom).toBe('aviso');
    expect(por.filas.tom).toBe('neutro');
  });
});
