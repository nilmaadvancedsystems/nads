// A porta do cadastro EM MEMÓRIA (modo exemplos): guarda neste navegador (localStorage) quando dá.
// Nada vai para o banco. A empresa 901 (a do Extratudo de exemplo) já vem com duas contas e, desde 17/11/2026, um plano de
// contas pequeno com a classificação (o Lançatudo escolhe a conta nele, em árvore); as contas do balancete de exemplo do
// Creditor estão nele, com os mesmos códigos, e o Creditor, que usa o plano do cadastro quando tem, segue achando as dele.
import { criarRepoCadastro, type PortaCadastro, type RepoCadastro } from './repo';

const CHAVE = 'nads-cadastro-exemplos-v2';

type Doc = Record<string, unknown>;
interface Guardado { cadastros: Record<string, Doc>; planos: Record<string, Doc> }

const EXEMPLO: Guardado = {
  cadastros: {
    'exemplo-comercio-de-alimentos-ltda': {
      nome: 'EXEMPLO COMERCIO DE ALIMENTOS LTDA', codigo: 901,
      bancos: [
        { id: 'sicoob-3001-123456', marca: 'sicoob', nome: 'Sicoob', agencia: '3001', conta: '12345-6', tipo: 'corrente', apelido: 'Conta movimento', contaContabil: '10503' },
        { id: 'itau-0412-998877', marca: 'itau', nome: 'Itaú', agencia: '0412', conta: '99887-7', tipo: 'corrente', contaContabil: '10504', desde: '2026-03' },
      ],
      historico: [],
    },
  },
  planos: {
    // o plano de contas de exemplo (17/11/2026, o Lançatudo): pequeno, com a classificação e as sintéticas
    'exemplo-comercio-de-alimentos-ltda': {
      origem: 'arquivo', arquivo: 'plano-de-contas-exemplo.xls', importadoEm: '2026-09-01T12:00:00.000Z', por: 'Exemplo',
      contas: [
        { codigo: '1', nome: 'ATIVO', classificacao: '1', grupo: 'Ativo', sintetica: true, ordem: 0 },
        { codigo: '100', nome: 'ATIVO CIRCULANTE', classificacao: '1.1', grupo: 'Ativo', sintetica: true, ordem: 1 },
        { codigo: '101', nome: 'DISPONÍVEL', classificacao: '1.1.1', grupo: 'Ativo', sintetica: true, ordem: 2 },
        { codigo: '10101', nome: 'CAIXA GERAL', classificacao: '1.1.1.01', grupo: 'Ativo', ordem: 3 },
        { codigo: '10502', nome: 'BANCO DO BRASIL C/ MOVIMENTO', classificacao: '1.1.1.02', grupo: 'Ativo', ordem: 4 },
        { codigo: '10503', nome: 'BANCO SICOOB C/ MOVIMENTO', classificacao: '1.1.1.03', grupo: 'Ativo', ordem: 5 },
        { codigo: '10504', nome: 'BANCO ITAÚ C/ MOVIMENTO', classificacao: '1.1.1.04', grupo: 'Ativo', ordem: 6 },
        { codigo: '10510', nome: 'SICOOB APLICAÇÃO FINANCEIRA', classificacao: '1.1.1.05', grupo: 'Ativo', ordem: 7 },
        { codigo: '112', nome: 'CLIENTES', classificacao: '1.1.2', grupo: 'Ativo', sintetica: true, ordem: 8 },
        { codigo: '11201', nome: 'CLIENTE ALFA', classificacao: '1.1.2.01', grupo: 'Ativo', ordem: 9 },
        { codigo: '11202', nome: 'BETA LTDA', classificacao: '1.1.2.02', grupo: 'Ativo', ordem: 10 },
        { codigo: '11203', nome: 'CLIENTES DIVERSOS', classificacao: '1.1.2.03', grupo: 'Ativo', ordem: 11 },
        { codigo: '2', nome: 'PASSIVO', classificacao: '2', grupo: 'Passivo', sintetica: true, ordem: 12 },
        { codigo: '200', nome: 'PASSIVO CIRCULANTE', classificacao: '2.1', grupo: 'Passivo', sintetica: true, ordem: 13 },
        { codigo: '211', nome: 'FORNECEDORES', classificacao: '2.1.1', grupo: 'Passivo', sintetica: true, ordem: 14 },
        { codigo: '21101', nome: 'FORNECEDOR DELTA', classificacao: '2.1.1.01', grupo: 'Passivo', ordem: 15 },
        { codigo: '21102', nome: 'CEMIG DISTRIBUIÇÃO', classificacao: '2.1.1.02', grupo: 'Passivo', ordem: 16 },
        { codigo: '21103', nome: 'PROVEDOR DE INTERNET', classificacao: '2.1.1.03', grupo: 'Passivo', ordem: 17 },
        { codigo: '205', nome: 'OBRIGAÇÕES TRIBUTÁRIAS E TRABALHISTAS', classificacao: '2.1.2', grupo: 'Passivo', sintetica: true, ordem: 18 },
        { codigo: '20501', nome: 'SIMPLES NACIONAL A RECOLHER', classificacao: '2.1.2.01', grupo: 'Passivo', ordem: 19 },
        { codigo: '20510', nome: 'SALÁRIOS A PAGAR', classificacao: '2.1.2.02', grupo: 'Passivo', ordem: 20 },
        { codigo: '3', nome: 'RECEITAS', classificacao: '3', grupo: 'Receita', sintetica: true, ordem: 21 },
        { codigo: '30101', nome: 'VENDAS DE MERCADORIAS', classificacao: '3.1.01', grupo: 'Receita', ordem: 22 },
        { codigo: '97304', nome: 'JUROS RECEBIDOS', classificacao: '3.1.02', grupo: 'Receita', ordem: 23 },
        { codigo: '85002', nome: 'DESCONTOS OBTIDOS', classificacao: '3.1.03', grupo: 'Receita', ordem: 24 },
        { codigo: '4', nome: 'DESPESAS', classificacao: '4', grupo: 'Despesa', sintetica: true, ordem: 25 },
        { codigo: '401', nome: 'DESPESAS ADMINISTRATIVAS', classificacao: '4.1', grupo: 'Despesa', sintetica: true, ordem: 26 },
        { codigo: '81012', nome: 'TARIFAS BANCÁRIAS', classificacao: '4.1.01', grupo: 'Despesa', ordem: 27 },
        { codigo: '81020', nome: 'ENERGIA ELÉTRICA', classificacao: '4.1.02', grupo: 'Despesa', ordem: 28 },
        { codigo: '81030', nome: 'INTERNET E TELEFONE', classificacao: '4.1.03', grupo: 'Despesa', ordem: 29 },
        { codigo: '82001', nome: 'SALÁRIOS E ORDENADOS', classificacao: '4.1.04', grupo: 'Despesa', ordem: 30 },
        { codigo: '402', nome: 'DESPESAS FINANCEIRAS', classificacao: '4.2', grupo: 'Despesa', sintetica: true, ordem: 31 },
        { codigo: '97301', nome: 'JUROS PASSIVOS', classificacao: '4.2.01', grupo: 'Despesa', ordem: 32 },
        { codigo: '85001', nome: 'DESCONTOS CONCEDIDOS', classificacao: '4.2.02', grupo: 'Despesa', ordem: 33 },
      ],
    },
  },
};

function ler(): Guardado {
  try {
    const bruto = globalThis.localStorage?.getItem(CHAVE);
    if (bruto) return JSON.parse(bruto) as Guardado;
  } catch { /* segue com o exemplo */ }
  return structuredClone(EXEMPLO);
}

function guardar(g: Guardado) {
  try { globalThis.localStorage?.setItem(CHAVE, JSON.stringify(g)); } catch { /* segue em memória */ }
}

export function portaCadastroMemoria(inicial?: Guardado): PortaCadastro {
  const g: Guardado = inicial ? structuredClone(inicial) : ler();
  const ouvintes = new Map<string, Set<() => void>>();
  const avisar = (chave: string) => { for (const f of ouvintes.get(chave) || []) f(); };
  function ouvir(chave: string, entregar: () => void) {
    if (!ouvintes.has(chave)) ouvintes.set(chave, new Set());
    ouvintes.get(chave)?.add(entregar);
    queueMicrotask(entregar); // chega "do banco" logo depois, como no site
    return () => { ouvintes.get(chave)?.delete(entregar); };
  }
  return {
    ouvirCadastro: (id, aoChegar) => ouvir('c:' + id, () => aoChegar(g.cadastros[id] || null)),
    ouvirPlano: (id, aoChegar) => ouvir('p:' + id, () => aoChegar(g.planos[id] || null)),
    ouvirTodos: aoChegar => ouvir('todos', () => aoChegar(Object.entries(g.cadastros).map(([id, doc]) => ({ id, doc })))),
    async gravarCampos(id, campos, apagar, plano) {
      const cadastro = { ...(g.cadastros[id] || {}), ...campos };
      for (const k of apagar) delete cadastro[k];
      g.cadastros[id] = cadastro;
      if (plano) g.planos[id] = plano;
      if (!inicial) guardar(g);
      avisar('c:' + id);
      if (plano) avisar('p:' + id);
      avisar('todos');
    },
  };
}

export function criarRepoCadastroMemoria(inicial?: Guardado): RepoCadastro {
  return criarRepoCadastro(portaCadastroMemoria(inicial), true);
}
