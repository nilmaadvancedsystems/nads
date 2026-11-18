// A ficha cadastral da empresa na Área do Cliente (plano do Acessórias, 17/11/2026, ficha dados-cadastrais; frase do dono:
// "Sim, comece assim"). A aba "Dados da empresa" e o "Copiar todos os dados" (para o cliente preencher cadastro em banco
// ou fornecedor) passam a ter os dados de verdade: o retrato da Receita que o robô vigia-cnpj grava toda semana
// (clientes/{id}.receita) e o que o cadastro do Entregas tem (nome fantasia, inscrição estadual). LISTA BRANCA RÍGIDA: o
// CNPJ é o da própria empresa e os sócios vão só pelo nome, nunca o CPF (R5). Cliente pessoa física (CPF) não tem ficha.
// O robô do PC grava resumo/ficha. Só a lógica (sem tela e sem banco).

/** O que vai para o espelho (resumo/ficha). */
export interface FichaDoEspelho {
  razaoSocial: string;
  nomeFantasia?: string;
  /** só os 14 números */
  cnpj: string;
  inscricaoEstadual?: string;
  regime: string;
  /** "4711-3/02 - Comércio varejista…" */
  cnae: string;
  /** 'aaaa-mm-dd' */
  abertura?: string;
  endereco: string;
  socios: { nome: string }[];
}

/** O que o robô tem do cliente: o cadastro do Entregas e o retrato da Receita. */
export interface ClienteParaFicha {
  documento?: unknown;
  nomeFantasia?: unknown;
  inscricaoEstadual?: unknown;
  receita?: { razaoSocial?: unknown; cnae?: unknown; cnaeDescricao?: unknown; abertura?: unknown; endereco?: unknown; socios?: unknown } | null;
}

const texto = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** "4711302" → "4711-3/02" (o CNAE como se escreve). */
function cnaeEscrito(c: string): string {
  const d = c.replace(/\D/g, '');
  return d.length === 7 ? d.slice(0, 4) + '-' + d[4] + '/' + d.slice(5) : c;
}

/** A ficha do cliente para o espelho; null quando não há o retrato da Receita ou o cliente não é empresa (CPF). */
export function fichaDoCliente(cliente: ClienteParaFicha | null | undefined, regime: string): FichaDoEspelho | null {
  if (!cliente) return null;
  const cnpj = String(cliente.documento ?? '').replace(/\D/g, '');
  const r = cliente.receita;
  const razaoSocial = texto(r?.razaoSocial);
  if (cnpj.length !== 14 || !r || !razaoSocial) return null;
  const nomeFantasia = texto(cliente.nomeFantasia);
  const ie = texto(cliente.inscricaoEstadual, 30);
  const cod = texto(r.cnae, 20);
  const desc = texto(r.cnaeDescricao);
  const abertura = texto(r.abertura, 10);
  // os sócios só pelo nome: a Receita manda o nome (o vigia-cnpj já descarta o CPF mascarado); um texto com número fica de fora
  const socios = (Array.isArray(r.socios) ? r.socios : []).map(s => texto(s, 120)).filter(n => n && !/\d{3}/.test(n)).slice(0, 20).map(nome => ({ nome }));
  return {
    razaoSocial,
    ...(nomeFantasia && nomeFantasia.toUpperCase() !== razaoSocial.toUpperCase() ? { nomeFantasia } : {}),
    cnpj,
    ...(ie && !/^isento$/i.test(ie) ? { inscricaoEstadual: ie } : ie ? { inscricaoEstadual: 'Isento' } : {}),
    regime: texto(regime, 60),
    cnae: [cod ? cnaeEscrito(cod) : '', desc].filter(Boolean).join(' - '),
    ...(/^\d{4}-\d{2}-\d{2}$/.test(abertura) ? { abertura } : {}),
    endereco: texto(r.endereco, 300),
    socios,
  };
}
