// O RH NET da SCI no nads (25/11/2026; o dono: "quero que deixe tudo pronto para suportar a rhnet"): os pedidos ao robô da
// nuvem pela fila de sempre (solicitacoesEmail, tipo 'rhnet'), sem coleção nova no banco. O robô (robo/rhnet.js) só atende com
// a chave "RH NET (folha)" ligada em config/sci e a empresa na lista. Interface + a versão de exemplo; a do banco é
// rhNet.firestore.ts. Os dados pessoais de uma admissão vão no pedido (dados) e o robô apaga assim que termina.
import { sci } from '@nads/core';

export type AcaoDoRhNet = 'cadastros' | 'admissao' | 'liberarAdmissao' | 'excluirAdmissao' | 'lancamentos' | 'liberarLancamentos';

/** Um pedido ao RH NET como a tela vê (sem os dados pessoais). */
export interface PedidoRhNet {
  id: string;
  codigo: number;
  acao: AcaoDoRhNet;
  status: 'pendente' | 'processando' | 'concluido' | 'erro';
  /** ISO */
  criadoEm: string;
  criadoPor: string;
  resumo: string;
  erro: string;
  /** na ação 'cadastros': os cadastros da empresa e quantas admissões há por situação */
  cadastros: sci.integracao.CadastrosDoRhNet | null;
  admissoes: Record<string, number>;
  /** na ação 'admissao': o funcionário criado no RH NET */
  admissao: sci.integracao.AdmissaoNoRhNet | null;
}

export interface RepoRhNet {
  exemplos: boolean;
  /** os pedidos mais novos primeiro (pedir já começa a ouvir) */
  pedidos(): { carregados: boolean; lista: PedidoRhNet[] };
  /** o teste só de leitura: os cadastros e as admissões da empresa */
  pedirCadastros(codigo: number): Promise<void>;
  /** cadastra a admissão no RH NET sem liberar (a regra confere antes de mandar) */
  pedirAdmissao(codigo: number, admissao: sci.integracao.AdmissaoParaRhNet): Promise<void>;
  /** libera para a folha do SCI (ou volta para não liberado) */
  pedirLiberacao(codigo: number, ids: number[], situacao: 'liberado' | 'nao_liberado', chamadoId?: string): Promise<void>;
  /** (27/11/2026) apaga a admissão no RH NET (antes de ir para a folha) */
  pedirExclusao(codigo: number, id: number, chamadoId?: string): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** O pedido como volta do banco: só os campos que a tela usa (os dados pessoais nunca são lidos). */
export function pedidoRhNetDoBanco(id: string, d: Record<string, unknown>): PedidoRhNet {
  const t = (v: unknown) => (typeof v === 'string' ? v : '');
  const r = d.rhnet && typeof d.rhnet === 'object' ? (d.rhnet as Record<string, unknown>) : {};
  const a = r.admissao && typeof r.admissao === 'object' ? (r.admissao as Record<string, unknown>) : null;
  const criado = d.criadoEm as { toDate?: () => Date } | string | undefined;
  const acoes: AcaoDoRhNet[] = ['cadastros', 'admissao', 'liberarAdmissao', 'excluirAdmissao', 'lancamentos', 'liberarLancamentos'];
  const status = (['pendente', 'processando', 'concluido', 'erro'] as const).find(s => s === d.status) ?? 'pendente';
  const admissoes = r.admissoes && typeof r.admissoes === 'object' ? Object.fromEntries(Object.entries(r.admissoes as Record<string, unknown>).map(([k, v]) => [k, Number(v) || 0])) : {};
  return {
    id, codigo: Number(d.codigo) || 0, acao: acoes.find(a => a === d.acao) ?? 'cadastros', status,
    criadoEm: typeof criado === 'string' ? criado : criado?.toDate ? criado.toDate().toISOString() : '', criadoPor: t(d.criadoPor),
    resumo: t(d.resumo), erro: t(d.erro), cadastros: sci.integracao.lerCadastrosDoRhNet(r.cadastros), admissoes,
    admissao: a && Number(a.id) > 0 ? { id: Number(a.id), situacao: sci.integracao.situacaoNoRhNet(a.situacao), primeiroNome: t(a.primeiroNome), admissao: t(a.admissao) } : null,
  };
}

/** A versão de exemplo: o pedido de cadastros "responde" na hora com uma empresa de mentira; nada sai do navegador. */
export function criarRhNetMemoria(): RepoRhNet {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let lista: PedidoRhNet[] = [];
  const novo = (codigo: number, acao: AcaoDoRhNet, extra: Partial<PedidoRhNet>): PedidoRhNet => ({
    id: 'ex' + Date.now() + lista.length, codigo, acao, status: 'concluido', criadoEm: new Date().toISOString(), criadoPor: 'exemplo', resumo: '', erro: '',
    cadastros: null, admissoes: {}, admissao: null, ...extra,
  });
  return {
    exemplos: true,
    pedidos: () => ({ carregados: true, lista }),
    async pedirCadastros(codigo) {
      const cadastros: sci.integracao.CadastrosDoRhNet = {
        departamentos: [{ id: 1, nome: 'Administração' }, { id: 2, nome: 'Produção' }], funcoes: [{ id: 5, nome: 'Auxiliar administrativo', codigo: '411005' }],
        centrosCusto: [], quadrosHorario: [{ id: 1, nome: 'Comercial 08h-18h' }], sindicatos: [{ id: 3, nome: 'Sindicato do comércio' }],
      };
      lista = [novo(codigo, 'cadastros', { cadastros, admissoes: { integrado: 4, nao_liberado: 1 }, resumo: sci.integracao.resumoDosCadastros(cadastros) + ' · Admissões 5' }), ...lista];
      mudou();
    },
    async pedirAdmissao(codigo, a) {
      const erro = sci.integracao.erroDaAdmissao(a);
      if (erro) throw new Error(erro);
      lista = [novo(codigo, 'admissao', { admissao: { id: 99, situacao: 'nao_liberado', primeiroNome: a.nome.split(/\s+/)[0].toUpperCase(), admissao: a.admissao }, resumo: 'Admissão no RH NET (não liberada)' }), ...lista];
      mudou();
    },
    async pedirExclusao(codigo, id) {
      lista = [novo(codigo, 'excluirAdmissao', { resumo: 'Apagou a admissão ' + id + ' do RH NET' }), ...lista];
      mudou();
    },
    async pedirLiberacao(codigo, ids, situacao) {
      lista = [novo(codigo, 'liberarAdmissao', { resumo: (situacao === 'liberado' ? 'Liberou para a folha: ' : 'Voltou para não liberado: ') + ids.length + ' admissão(ões)' }), ...lista];
      mudou();
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
