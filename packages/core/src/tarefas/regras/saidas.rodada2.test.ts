// 2ª rodada: o que sai para o Alterdata (o .xls de 10 colunas das etapas de INSS, FGTS e Honorários), a planilha das tabelas e o
// CSV do delegador. Layout exato, ordem, débito e crédito preenchidos, acentos e a ida e volta lendo os bytes de novo. Dados
// fictícios; semente fixa.
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { planilhaDeImportacao, LINHAS_EM_BRANCO } from '../../extratudo/creditor/arquivos/gerar';
import { montarCsv } from '../../formatos';
import { celulaDoCsv, CABECALHO_DA_PLANILHA, linhasDaPlanilha as linhasDasDelegadas, acoesDoStatus, emAberto, type Status, type TarefaDelegada } from './delegadas';
import { inssDeTeste } from './deTeste';
import { lancamentosDosHonorarios, pagamentosDosHonorarios, type CobrancaDeHonorario } from './honorarios';
import { conferirInss, linhasDoAlterdata, type GuiaDoInss } from './inss';
import { planilhaXlsx } from './planilha';
import { lerRazao } from './razao';

const cent = (n: number) => Math.round(n * 100) / 100;
function gerador(semente: number) {
  let a = semente >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const CABECALHO = ['Data', 'Contrapartida', 'Descrição', 'Valor', 'Histórico', 'Descrição histórico', 'Saldo'];
type Item = readonly [data: string, valor: number, historico?: string, contrapartida?: string];
function razaoDe(itens: readonly Item[], saldoInicial = 0) {
  let s = saldoInicial;
  return lerRazao([CABECALHO, ...itens.map(([data, valor, h = '', c = '']) => { s = cent(s + valor); return [data.split('-').reverse().join('/'), c, '', valor, '', h, s]; })]);
}
const linhaXls = (o: { data: string; debito: string; credito: string; historico: string; valor: number; documento?: string; codHistorico?: string }) => ({ automatico: '', codHistorico: '', documento: '', tipo: 'principal' as const, tituloId: 0, ...o });
function relerXls(b: Uint8Array): unknown[][] {
  const wb = XLSX.read(b, { type: 'array', cellDates: false });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '', blankrows: true });
}
const serialDe = (br: string) => { const [d, m, a] = br.split('/').map(Number); return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000); };

describe('o .xls de importação do Alterdata', () => {
  it('BIFF8, 4 linhas em branco, 10 colunas: vazia, débito, crédito, data, valor, cód. histórico, complemento, vazia, vazia, nota', () => {
    const b = planilhaDeImportacao([linhaXls({ data: '31/01/2026', debito: '2150', credito: '112', historico: 'Pgto INSS ref. 12/2025 — ação', valor: 1234.56, documento: 'NF 77', codHistorico: '45' })]);
    expect([...b.slice(0, 4)]).toEqual([0xd0, 0xcf, 0x11, 0xe0]);
    const ls = relerXls(b);
    expect(LINHAS_EM_BRANCO).toBe(4);
    for (let i = 0; i < 4; i++) expect((ls[i] || []).every(c => c === '')).toBe(true);
    const l = ls[4];
    expect(l).toHaveLength(10);
    expect(String(l[1])).toBe('2150');
    expect(String(l[2])).toBe('112');
    expect(l[3]).toBe(serialDe('31/01/2026'));
    expect(l[4]).toBe(1234.56);
    expect(String(l[5])).toBe('45');
    expect(l[6]).toBe('Pgto INSS ref. 12/2025 — ação');
    expect(l[9]).toBe('NF 77');
    expect([l[0], l[7], l[8]]).toEqual(['', '', '']);
  });

  it('a data e o formato: fevereiro bissexto, dezembro e janeiro viram o serial certo', () => {
    const datas = ['29/02/2024', '31/12/2026', '01/01/2027', '28/02/2026'];
    const ls = relerXls(planilhaDeImportacao(datas.map(data => linhaXls({ data, debito: '1', credito: '2', historico: 'x', valor: 1 }))));
    expect(ls.slice(4).map(l => l[3])).toEqual(datas.map(serialDe));
  });

  it('a ordem das linhas é a de entrada e o total relido fecha em centavos (600 linhas sorteadas)', () => {
    const r = gerador(600);
    let soma = 0;
    const entrada = Array.from({ length: 600 }, (_, i) => { const c = Math.floor(r() * 9_000_000) + 1; soma += c; return linhaXls({ data: '15/03/2026', debito: String(100 + i), credito: '112', historico: 'L' + i, valor: c / 100 }); });
    const ls = relerXls(planilhaDeImportacao(entrada)).slice(4);
    expect(ls.map(l => l[6])).toEqual(entrada.map(l => l.historico));
    expect(ls.reduce((t: number, l) => t + Math.round(Number(l[4]) * 100), 0)).toBe(soma);
  }, 20000);
});

describe('as linhas das etapas: partida dobrada', () => {
  const razaoInss = () => razaoDe([
    ['2026-02-28', -1000.1, 'INSS s/ folha ref. 02/2026', '4101'],
    ['2026-03-20', 900.05, 'Pgto INSS ref. 02/2026', '112'],
  ]);
  const guia = (c: string, total: number, vencimento = '2026-03-20'): GuiaDoInss => ({ competencia: c, total, vencimento, numero: 'g' + c } as unknown as GuiaDoInss);

  it('toda linha do INSS tem uma conta de cada lado, nunca a mesma nas duas, e o valor é positivo em centavos', () => {
    const meses = ['2026-01', '2026-02', '2026-03'];
    const d = inssDeTeste(meses);
    const c = conferirInss(d.razao, d.guias, meses);
    expect(c.sugestoes.length).toBeGreaterThan(0);
    // a tela só libera o .xls com toda contrapartida preenchida (podeExportar): aqui, todas escolhidas
    for (const l of linhasDoAlterdata(c.sugestoes, '2150', new Proxy({}, { get: () => '999' }) as Record<string, string>)) {
      expect(l.debito).toMatch(/^\d+$/);
      expect(l.credito).toMatch(/^\d+$/);
      expect(l.debito).not.toBe(l.credito);
      expect([l.debito, l.credito]).toContain('2150');
      expect(l.valor).toBeGreaterThan(0);
      expect(cent(l.valor)).toBe(l.valor);
      expect(l.data).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    }
  });

  it('com os meses vazios (a rota sem período válido) o INSS não quebra: é a única das três conferências que a tela chama sem olhar os meses', () => {
    expect(conferirInss(razaoInss(), [guia('2026-02', 1000.1)], [])).toMatchObject({ meses: [], sugestoes: [] });
  });

  const cobranca = (o: Partial<CobrancaDeHonorario>): CobrancaDeHonorario => ({ codigoCliente: 1, emissao: '2026-01-05', numero: '000013074', vencimento: '2026-01-20', pagamento: '', valor: 300, recebido: 0, aReceber: 300, ...o });

  it('honorários: a provisão e o pagamento mantêm o débito igual ao crédito e fecham o que saiu do banco', () => {
    const r = gerador(2606);
    for (let i = 0; i < 400; i++) {
      const valor = (Math.floor(r() * 500000) + 100) / 100;
      const recebido = cent(valor + (Math.floor(r() * 2001) - 1000) / 100);
      if (recebido <= 0 || recebido < valor) continue; // pago a menos: regra em aberto (a conta do desconto)
      const c = cobranca({ valor, recebido, pagamento: '2026-02-10', aReceber: 0 });
      const prov = lancamentosDosHonorarios([c], '4500', '2300');
      expect(prov).toHaveLength(1);
      expect(prov[0]).toMatchObject({ debito: '4500', credito: '2300', valor, data: '05/01/2026', documento: '13074' });
      const pg = pagamentosDosHonorarios([c], '2300', '4500', () => '112');
      expect(pg.every(l => l.credito === '112' && l.debito !== l.credito && l.valor > 0)).toBe(true);
      expect(cent(pg.reduce((s, l) => s + l.valor, 0))).toBe(recebido);
      expect(pg.filter(l => l.debito === '2300').reduce((s, l) => s + l.valor, 0)).toBe(valor);
    }
  });
});

describe('a planilha das tabelas', () => {
  it('ida e volta: acento, nulo vira vazio, número continua número, zero à frente em texto fica', () => {
    const b = planilhaXlsx('Obrigações 08-2026', ['Cód.', 'Razão Social', 'Valor'], [[12, 'Açaí & Cia', 10.5], [null, '00123', null]]);
    const wb = XLSX.read(b, { type: 'array' });
    expect(wb.SheetNames).toEqual(['Obrigações 08-2026']);
    expect(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })).toEqual([['Cód.', 'Razão Social', 'Valor'], [12, 'Açaí & Cia', 10.5], ['', '00123', '']]);
  });
  it('o nome da aba passa do limite de 31 letras sem quebrar', () => {
    const nome = 'Uma aba de nome bem comprido demais para o Excel';
    expect(XLSX.read(planilhaXlsx(nome, ['A'], [[1]]), { type: 'array' }).SheetNames).toEqual([nome.slice(0, 31)]);
  });
  it('sem linha nenhuma: só o cabeçalho', () => {
    const wb = XLSX.read(planilhaXlsx('Vazia', ['A', 'B'], []), { type: 'array' });
    expect(XLSX.utils.sheet_to_json(wb.Sheets.Vazia, { header: 1 })).toEqual([['A', 'B']]);
  });
});

describe('o CSV do delegador', () => {
  /** lê como o Excel lê um CSV com ";": aspas protegem ";" e quebra; "" é uma aspa */
  function lerCsv(texto: string): string[][] {
    const linhas: string[][] = [[]];
    let c = '', q = false;
    for (let i = 0; i < texto.length; i++) {
      const x = texto[i];
      if (q) { if (x === '"' && texto[i + 1] === '"') { c += '"'; i++; } else if (x === '"') q = false; else c += x; continue; }
      if (x === '"') q = true;
      else if (x === ';') { linhas[linhas.length - 1].push(c); c = ''; }
      else if (x === '\n') { linhas[linhas.length - 1].push(c); c = ''; linhas.push([]); }
      else c += x;
    }
    linhas[linhas.length - 1].push(c);
    return linhas;
  }
  const t = (o: Partial<TarefaDelegada>): TarefaDelegada => ({
    numero: 7, status: 'pendente', titulo: 'Título', prioridade: 'normal', prazo: '2026-12-31', prazoHora: '', clientes: [], responsavel: { uid: 'u1', nome: 'Ana' }, criadaPor: { uid: 'u2', nome: 'Bia' },
    criadaEm: '2026-12-31T23:30:00.000Z', concluidaEm: '', descricao: '', ...o,
  } as unknown as TarefaDelegada);

  it('ida e volta: ponto e vírgula, aspas, quebra de linha e acento na mesma célula', () => {
    const difíceis = ['a;b', 'diz "oi"', 'linha 1\nlinha 2', 'çãé', '"', ';', '', 'fim\r\nde linha'];
    const r = gerador(8);
    const entrada = Array.from({ length: 200 }, () => [difíceis[Math.floor(r() * difíceis.length)], difíceis[Math.floor(r() * difíceis.length)], String(Math.floor(r() * 1000))]);
    const csv = montarCsv(entrada.map(l => l.map(celulaDoCsv).join(';')));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lerCsv(csv.slice(1))).toEqual(entrada);
  });

  it('a linha da planilha tem uma célula por coluna e a data do fim do ano é a de Brasília', () => {
    const [l] = linhasDasDelegadas([t({ titulo: 'x;y' })]);
    expect(l).toHaveLength(CABECALHO_DA_PLANILHA.length);
    expect(l[8]).toBe('31/12/2026');
    expect(l[4]).toBe('31/12/2026');
  });

  it('as ações de cada status só levam para status válidos; a encerrada não tem botão', () => {
    const caminho: Record<Status, Status[]> = { pendente: ['andamento', 'concluida'], andamento: ['pausada', 'concluida'], pausada: ['andamento', 'concluida'], concluida: [], cancelada: [] };
    for (const [s, destino] of Object.entries(caminho) as [Status, Status[]][]) expect(acoesDoStatus(s).map(a => a.status)).toEqual(destino);
    expect(emAberto({ status: 'pausada' })).toBe(true);
    expect(emAberto({ status: 'cancelada' })).toBe(false);
    expect(emAberto({ status: 'concluida' })).toBe(false);
  });
});
