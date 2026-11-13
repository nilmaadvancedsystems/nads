// A folha lida dos PDFs do DP (13/11/2026). Os exemplos imitam o layout real do holerite ("Demonstrativo de Pagamento de
// Salário") e da "Previsão - Vencimento de Férias", com pessoas, empresa e números inventados.
import { describe, expect, it } from 'vitest';
import { feriasDasPaginas, historicoComAFolha, holeritesDasPaginas, registroComAFolha, type PedacoDaFolha } from './folhaLida';
import { feriasPelaFolha } from './dp';
import { idDoFuncionario } from './pessoal';

type Peca = [x: number, texto: string, largura?: number];
interface Pessoa { matricula: string; nome: string; cpf: string; cargo: string; admissao: string; titulo?: string; ferias?: boolean }

/** Uma via do holerite: as peças nas posições do layout, deslocadas (dx, dy) e encolhidas (escala). */
function via(p: Pessoa, dx = 0, dy = 0, escala = 1): PedacoDaFolha[] {
  const linhas: [number, Peca[]][] = [
    [800, [[30, p.titulo ?? 'Demonstrativo de Pagamento de Salário', 200]]],
    [790, [[30, '00999 -', 30]]],
    [780, [[30, 'EMPRESA EXEMPLO LTDA', 120], [300, '12.345.678/0001-90', 80]]],
    [770, [[30, 'Depto.: GERAL', 60], [150, 'Ref.: 10/2026', 60]]],
    [760, [[30, p.matricula, 30], [70, p.nome, 150], [250, 'CPF: ' + p.cpf, 100], [380, p.cargo, 80]]],
    [750, [[30, 'Código', 30], [60, 'Descrição', 50], [300, 'Referência', 50], [380, 'Vencimentos', 60], [470, 'Descontos', 50]]],
    [740, [[30, '001', 15], [60, 'Salario Base', 60], [300, '220:00', 30], [390, '2.000,00', 50]]],
    [730, [[30, '604', 15], [60, 'Desconto Vale Transporte', 100], [475, '120,00', 45]]],
    [720, [[30, '903', 15], [60, 'INSS Folha', 50], [300, '7,50 %', 30], [475, '150,00', 45]]],
    [710, [[30, '642', 15], [60, 'Empréstimo (Crédito Trabalhador) Parc. 4/36', 160], [475, '100,00', 45]]],
    [700, [[30, 'Observações: Atestado de 08/10/2026 até 22/10/2026 (110:00)', 250]]],
    [690, [...(p.ferias ? [[30, 'Férias Vencidas', 60] as Peca] : []), [200, 'Admissão:', 40], [380, '2.000,00', 60], [470, '370,00', 50]]],
    [680, [[200, p.admissao, 50]]],
    [670, [[30, 'Banco:', 30], [300, 'Valor Líquido', 60], [400, '1.630,00', 50]]],
    [660, [[30, 'Salário Base', 50], [100, 'Sal. Contr. INSS', 60], [180, 'Base Cálculo FGTS', 70], [260, 'FGTS do Mês', 50], [330, 'Base Cálculo IRRF', 70], [420, 'Alíquota IRRF', 50], [480, 'Depend. IRRF', 50]]],
    [650, [[30, '2.000,00', 40], [100, '2.000,00', 40], [180, '2.000,00', 40], [260, '160,00', 40], [330, '1.730,00', 40], [420, '0,00 %', 30], [480, '0', 10]]],
    [630, [[30, 'DECLARO TER RECEBIDO A IMPORTÂNCIA LÍQUIDA DISCRIMINADA NESTE RECIBO', 300]]],
  ];
  return linhas.flatMap(([y, pecas]) => pecas.map(([x, texto, largura]) => ({ texto, x: dx + x * escala, y: y - dy, largura: (largura ?? 0) * escala })));
}

const MARIA: Pessoa = { matricula: '000004', nome: 'MARIA DE TESTE SILVA', cpf: '12345678909', cargo: 'VENDEDORA', admissao: '15/06/2023', ferias: true };
const JOSE: Pessoa = { matricula: '000007', nome: 'JOSE EXEMPLO SOUZA', cpf: '98765432100', cargo: 'AUXILIAR', admissao: '01/02/2024' };

describe('holeritesDasPaginas', () => {
  it('lê o holerite: pessoa, cargo, admissão, rubricas nas colunas certas, totais, bases, férias vencidas e afastamento', () => {
    const [h, ...resto] = holeritesDasPaginas([[...via(MARIA), ...via(MARIA, 0, 350)]]);
    expect(resto).toHaveLength(0); // a segunda via conta uma vez
    expect(h).toMatchObject({
      empresa: '00999', competencia: '2026-10', matricula: '000004', nome: 'MARIA DE TESTE SILVA', cpf: '12345678909', cargo: 'VENDEDORA',
      admissao: '2023-06-15', proventos: 2000, descontos: 370, liquido: 1630, salarioBase: 2000, baseInss: 2000, baseFgts: 2000, fgts: 160,
      baseIrrf: 1730, inss: 150, irrf: 0, feriasVencidas: true, confere: true,
    });
    expect(h.rubricas.map(r => [r.codigo, r.descricao, r.referencia, r.valor, r.tipo])).toEqual([
      ['001', 'Salario Base', '220:00', 2000, 'provento'],
      ['604', 'Desconto Vale Transporte', '', 120, 'desconto'],
      ['903', 'INSS Folha', '7,50 %', 150, 'desconto'],
      ['642', 'Empréstimo (Crédito Trabalhador) Parc. 4/36', '', 100, 'desconto'],
    ]);
    expect(h.afastamentos).toEqual([{ de: '2026-10-08', ate: '2026-10-22', motivo: 'Atestado' }]);
  });

  it('duas vias lado a lado: lê só a da esquerda; várias pessoas em páginas diferentes', () => {
    const hs = holeritesDasPaginas([[...via(MARIA, 0, 0, 0.5), ...via(MARIA, 300, 0, 0.5)], via(JOSE)]);
    expect(hs.map(h => [h.nome, h.liquido, h.confere])).toEqual([['MARIA DE TESTE SILVA', 1630, true], ['JOSE EXEMPLO SOUZA', 1630, true]]);
    expect(hs[1].feriasVencidas).toBe(false);
  });

  it('deixa de fora o recibo de adiantamento, de férias e o PDF que não é holerite', () => {
    expect(holeritesDasPaginas([via({ ...MARIA, titulo: 'Recibo de Pagamento de Adiantamento' })])).toEqual([]);
    expect(holeritesDasPaginas([via({ ...MARIA, titulo: 'Recibo de Pagamento de Férias' })])).toEqual([]);
    expect(holeritesDasPaginas([[{ texto: 'Documento de Arrecadação do Simples Nacional', x: 10, y: 10 }]])).toEqual([]);
  });

  it('sem a largura das peças, as colunas ainda saem pela posição do cabeçalho', () => {
    const semLargura = via(MARIA).map(({ texto, x, y }) => ({ texto, x, y }));
    const [h] = holeritesDasPaginas([semLargura]);
    expect(h.rubricas.map(r => r.tipo)).toEqual(['provento', 'desconto', 'desconto', 'desconto']);
    expect(h.liquido).toBe(1630);
  });
});

/** A "Previsão - Vencimento de Férias" (uma linha por peça, como o relatório). */
function previsao(): PedacoDaFolha[] {
  const linhas = [
    'EMPRESA EXEMPLO LTDA ( 00999 ) CNPJ/CPF: 12345678000190 Previsão de Vencimento de Férias',
    'Previsão - Vencimento de Férias até 30/11/2026',
    'Código Nome Admissão Vcto. Férias Conceder até',
    'Departamento: Todos 000004 MARIA DE TESTE SILVA 15/06/2023 14/06/2026 15/05/2027 1 1 1',
    'Período aquisitivo Faltas no período Dias gozados Dias de direito Dias a serem gozados Conceder até',
    '15/06/2024 a 14/06/2025 0 20 30 10 15/05/2026',
    '15/06/2025 a 14/06/2026 0 0 30 30 15/05/2027',
    '000012 PESSOA FORA DO REGISTRO 01/03/2026 28/02/2027 31/01/2028 1',
    'Período aquisitivo Faltas no período Dias gozados Dias de direito Dias a serem gozados Conceder até',
    '01/03/2026 a 28/02/2027 0 0 30 30 31/01/2028',
  ];
  return linhas.map((texto, k) => ({ texto, x: 10, y: 800 - k * 10 }));
}

describe('feriasDasPaginas', () => {
  it('lê os períodos de cada um', () => {
    const r = feriasDasPaginas([previsao()]);
    expect(r?.empresa).toBe('00999');
    expect(r?.dataBase).toBe('2026-11-30');
    expect(r?.funcionarios[0]).toEqual({
      matricula: '000004', nome: 'MARIA DE TESTE SILVA', admissao: '2023-06-15', periodos: [
        { inicio: '2024-06-15', fim: '2025-06-14', faltas: 0, gozados: 20, direito: 30, aGozar: 10, concederAte: '2026-05-15' },
        { inicio: '2025-06-15', fim: '2026-06-14', faltas: 0, gozados: 0, direito: 30, aGozar: 30, concederAte: '2027-05-15' },
      ],
    });
    expect(r?.funcionarios).toHaveLength(2);
  });
  it('outro PDF: null', () => { expect(feriasDasPaginas([via(MARIA)])).toBeNull(); });
});

describe('registroComAFolha e historicoComAFolha', () => {
  const daGuia = { id: idDoFuncionario(MARIA.cpf), nome: 'MARIA DE TESTE SILVA', cpf: '***.456.789-**', matricula: '4', remuneracao: 2000, desde: '2025-01', ultimo: '2026-10', ativo: true };
  const holerites = holeritesDasPaginas([via(MARIA), via(JOSE)]);

  it('completa quem está nas guias, põe quem só está no holerite e junta os períodos de férias pela matrícula', () => {
    const r = registroComAFolha({ funcionarios: [daGuia], competencia: '2026-10', total: 2000 }, holerites, [feriasDasPaginas([previsao()])!]);
    const maria = r.funcionarios.find(f => f.id === daGuia.id)!;
    expect(maria).toMatchObject({ cargo: 'VENDEDORA', admissao: '2023-06-15', desde: '2023-06', salarioBase: 2000, liquido: 1630, feriasVencidas: true,
      afastadoDe: '2026-10-08', afastadoAte: '2026-10-22', fonte: 'folha', ativo: true });
    expect(maria.periodosDeFerias).toHaveLength(2);
    expect(JSON.stringify(r)).not.toContain('12345678909'); // o CPF inteiro não sai
    expect(JSON.stringify(r)).not.toContain('Atestado'); // nem o motivo do afastamento
    const jose = r.funcionarios.find(f => f.id === idDoFuncionario(JOSE.cpf))!;
    expect(jose).toMatchObject({ nome: 'JOSE EXEMPLO SOUZA', cpf: '***.654.321-**', ativo: true, desde: '2024-02', cargo: 'AUXILIAR' });
    expect(r.total).toBe(4000);
  });

  it('sem holerite nem férias, o registro das guias fica igual', () => {
    const reg = { funcionarios: [daGuia], competencia: '2026-10', total: 2000 };
    expect(registroComAFolha(reg, [], [])).toBe(reg);
  });

  it('o histórico ganha os números dos holerites; o mês sem guia entra pelo holerite', () => {
    const h = historicoComAFolha([{ competencia: '2026-09', base: 1900, fgts: 152, funcionarios: 1 }], holerites);
    expect(h).toEqual([
      { competencia: '2026-09', base: 1900, fgts: 152, funcionarios: 1 },
      { competencia: '2026-10', base: 4000, fgts: 320, funcionarios: 2, proventos: 4000, descontos: 740, liquido: 3260, inss: 300, irrf: 0, holerites: 2 },
    ]);
  });
});

describe('feriasPelaFolha', () => {
  const periodos = [
    { inicio: '2024-06-15', fim: '2025-06-14', aGozar: 10, concederAte: '2026-05-15' },
    { inicio: '2025-06-15', fim: '2026-06-14', aGozar: 30, concederAte: '2027-05-15' },
  ];
  it('o período completo mais antigo manda', () => {
    expect(feriasPelaFolha(periodos, new Date(2026, 0, 10))).toMatchObject({ situacao: 'tem', limite: '2026-05', pendentes: 1 });
    expect(feriasPelaFolha(periodos, new Date(2026, 3, 10))).toMatchObject({ situacao: 'vence-logo', texto: 'Tirar até 15/05/2026 · 10 dias a tirar · período 15/06/2024 a 14/06/2025' });
    expect(feriasPelaFolha(periodos, new Date(2026, 10, 13))).toMatchObject({ situacao: 'vencida', pendentes: 2 });
  });
  it('ainda adquirindo, ou sem período', () => {
    expect(feriasPelaFolha(periodos.slice(1), new Date(2026, 0, 10))).toMatchObject({ situacao: 'a-adquirir', aPartirDe: '2026-06' });
    expect(feriasPelaFolha([], new Date())).toBeNull();
  });
});
