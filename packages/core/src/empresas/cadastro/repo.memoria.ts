// A porta do cadastro EM MEMÓRIA (modo exemplos): guarda neste navegador (localStorage) quando dá.
// Nada vai para o banco. A empresa 901 (a do Extratudo de exemplo) já vem com duas contas, para as telas terem o que mostrar
// (sem plano: o Creditor de exemplo usa o balancete de exemplo dele).
import { criarRepoCadastro, type PortaCadastro, type RepoCadastro } from './repo';

const CHAVE = 'nads-cadastro-exemplos-v1';

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
  planos: {},
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
    async gravar(id, cadastro, plano) {
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
