// Excluir usuário (Vitor, 16/11/2026): só o inativo, só quem não tem registro no sistema (nunca fez nenhuma tarefa e o nome
// não está gravado em lugar nenhum) e só o Diretor ou o Dono exclui. O inativo com registro continua inativo, e a tela diz
// por que não dá para excluir.
// LUGARES_DE_REGISTRO é o levantamento de onde a pessoa fica gravada (pelo uid, pelo nome ou pelo e-mail): a camada de dados
// procura um documento em cada lugar (limit 1) e devolve os rótulos de onde achou. Lugar novo que grava a pessoa entra aqui.
import { nivelDeDiretor } from './papeis';
import type { Nivel, Usuario } from '../tipos';

/** Por qual dado da pessoa o lugar a guarda. */
export type ChaveDaPessoa = 'uid' | 'nome' | 'email';

/** Um lugar do banco onde a pessoa fica registrada. */
export interface LugarDeRegistro {
  /** a coleção (de primeiro nível) */
  colecao: string;
  /** o campo, com ponto para o que está dentro de um mapa (ex.: 'criadoPor.uid') */
  campo: string;
  chave: ChaveDaPessoa;
  /** 'valor' = o campo é a pessoa (==); 'lista' = o campo é uma lista que pode ter a pessoa (array-contains) */
  forma: 'valor' | 'lista';
  /** como a tela diz o lugar ("Tarefas", "Avisos"…) */
  rotulo: string;
  /** a busca é em todas as subcoleções com este nome (collectionGroup), não numa coleção de primeiro nível */
  grupo?: boolean;
  /** o nome também gravado com estes finais (ex.: 'Clara (Fiscal)', a etapa da REINF) */
  sufixos?: readonly string[];
}

const L = (colecao: string, campo: string, chave: ChaveDaPessoa, rotulo: string, extra: Partial<LugarDeRegistro> = {}): LugarDeRegistro =>
  ({ colecao, campo, chave, forma: 'valor', rotulo, ...extra });

/**
 * Onde a pessoa fica gravada num campo que dá para consultar (levantamento de 16/11/2026, no código do nads, dos robôs e do
 * Entregas). Fica de fora o que é técnico e some com a conta (login liberado, pedidos de liberação, convites, pedidos de conta,
 * loginPorNome, a chave do Cofre, a contagem de uso, o "atualizadoPor" das configurações) e o que a regra do banco não deixa o
 * Diretor consultar (os pedidos que só o dono lê, protocolos). Os nomes são os de agora: o nome ou o e-mail antigo, de quem
 * trocou, não entra (os lugares com o uid pegam essa pessoa do mesmo jeito).
 */
export const LUGARES_DE_REGISTRO: readonly LugarDeRegistro[] = [
  // a execução das etapas (cada clique numa etapa vira um evento, com o nome de quem fez)
  L('eventos', 'por', 'nome', 'Etapas feitas', { grupo: true, sufixos: [' (Fiscal)'] }),
  L('rotinas', 'rotinaReaberta.por', 'nome', 'Etapas feitas'),
  // as empresas de que cuida
  L('cadastro', 'responsaveis.fiscal', 'nome', 'Empresas de que é responsável'),
  L('cadastro', 'responsaveis.contabil', 'nome', 'Empresas de que é responsável'),
  L('cadastro', 'transferencias.fiscal.de', 'nome', 'Empresas de que é responsável'),
  L('cadastro', 'transferencias.fiscal.para', 'nome', 'Empresas de que é responsável'),
  L('cadastro', 'transferencias.contabil.de', 'nome', 'Empresas de que é responsável'),
  L('cadastro', 'transferencias.contabil.para', 'nome', 'Empresas de que é responsável'),
  // a Carteira: comissões, insumos e holerites
  L('carteiraComissoes', 'uid', 'uid', 'Comissões'),
  L('carteiraComissoes', 'nome', 'nome', 'Comissões'),
  L('carteiraComissoes', 'decididoPor', 'nome', 'Comissões'),
  L('carteiraInsumos', 'uid', 'uid', 'Insumos'),
  L('carteiraInsumos', 'nome', 'nome', 'Insumos'),
  L('carteiraDocumentos', 'uid', 'uid', 'Documentos da Carteira'),
  L('carteiraDocumentos', 'enviadoPor', 'nome', 'Documentos da Carteira'),
  // o Mandei e o atendimento
  L('tickets', 'criadoPor.uid', 'uid', 'Mandei'),
  L('tickets', 'resolvidoPor', 'nome', 'Mandei'),
  L('areasCliente', 'criadoPor', 'nome', 'Área do cliente'),
  L('solicitacoesEmail', 'criadoPorUid', 'uid', 'E-mails enviados'),
  L('feedbacks', 'uid', 'uid', 'Feedbacks'),
  // o Financeiro
  L('financeiroContasPagar', 'funcionario.uid', 'uid', 'Financeiro'),
  L('financeiroContasPagar', 'criadoPor', 'nome', 'Financeiro'),
  L('financeiroContasPagar', 'atualizadoPor', 'nome', 'Financeiro'),
  L('financeiroContasPagar', 'lancadoPor', 'nome', 'Financeiro'),
  L('financeiroHonorarios', 'criadoPor', 'nome', 'Financeiro'),
  L('financeiroHonorarios', 'atualizadoPor', 'nome', 'Financeiro'),
  L('financeiroRecebimentos', 'por', 'nome', 'Financeiro'),
  L('financeiroBoletos', 'criadoPorUid', 'uid', 'Financeiro'),
  L('financeiroBoletos', 'atualizadoPor', 'nome', 'Financeiro'),
  L('financeiroBoletos', 'envio.porUid', 'uid', 'Financeiro'),
  L('financeiroCaixa', 'criadoPor', 'nome', 'Financeiro'),
  L('financeiroCaixa', 'atualizadoPor', 'nome', 'Financeiro'),
  L('financeiroFornecedores', 'criadoPor', 'nome', 'Financeiro'),
  L('financeiroFornecedores', 'atualizadoPor', 'nome', 'Financeiro'),
  L('financeiroBancoImportacoes', 'importadoPor', 'nome', 'Financeiro'),
  L('nfseEmissoes', 'pedidoPorUid', 'uid', 'Notas fiscais emitidas'),
  // o trabalho dos departamentos
  L('parcelamentos', 'criadoPorUid', 'uid', 'Parcelamentos'),
  L('parcelamentos', 'atualizadoPor', 'nome', 'Parcelamentos'),
  L('lcdprEmpresas', 'atualizadoPor', 'nome', 'LCDPR'),
  L('controleTributos', 'atualizadoPor', 'nome', 'Controle de tributos'),
  L('controleTributosFolha', 'atualizadoPor', 'nome', 'Controle de tributos'),
  L('legislacaoDp', 'atualizadoPor', 'nome', 'Legislação do DP'),
  L('legislacaoDp', 'excluidaPor', 'nome', 'Legislação do DP'),
  L('cofre', 'atualizadoPor', 'nome', 'Cofre de senhas'),
  L('pedidosAlterdata', 'criadoPorUid', 'uid', 'Pedidos aos robôs'),
  L('pedidosFgts', 'criadoPorUid', 'uid', 'Pedidos aos robôs'),
  L('pedidosSieg', 'criadoPorUid', 'uid', 'Pedidos aos robôs'),
  L('pedidosSituacao', 'criadoPorUid', 'uid', 'Pedidos aos robôs'),
  L('solicitacoesArquivo', 'criadoPorUid', 'uid', 'Pedidos aos robôs'),
  // o Entregas: documentos, solicitações, lembretes e o que foi feito por lá
  L('entregas', 'entregadoPor', 'email', 'Documentos entregues'),
  L('solicitacoes', 'criadoPor', 'email', 'Solicitações'),
  L('solicitacoes', 'concluidoPor', 'email', 'Solicitações'),
  L('lembretesCliente', 'criadoPor', 'email', 'Lembretes'),
  L('lembretesCliente', 'resolvidoPor', 'email', 'Lembretes'),
  L('rotaLinks', 'criadoPor', 'email', 'Links enviados'),
  L('assinaturas', 'criadoPor', 'email', 'Links enviados'),
  L('portais', 'criadoPor', 'email', 'Links enviados'),
  L('recados', 'criadoPor', 'email', 'Recados'),
  L('auditoria', 'feitoPor', 'email', 'Histórico do Entregas'),
  L('emprestimos', 'pegouPor', 'nome', 'Empréstimos'),
  L('emprestimos', 'devolvidoPor', 'nome', 'Empréstimos'),
  // as tarefas do Entregas antigo (tarefas.html) e o cadastro de clientes de lá
  L('tarefas', 'criadoPorUid', 'uid', 'Tarefas do Entregas'),
  L('tarefas', 'responsavelUid', 'uid', 'Tarefas do Entregas'),
  L('anexosTarefas', 'criadoPorUid', 'uid', 'Tarefas do Entregas'),
  L('clientes', 'responsavelUid', 'uid', 'Empresas de que é responsável'),
  L('clientes', 'responsavelFiscalUid', 'uid', 'Empresas de que é responsável'),
  L('empresas', 'ondeParouPorUid', 'uid', 'Tarefas do Entregas'),
  L('empresas', 'substitutoUid', 'uid', 'Tarefas do Entregas'),
  L('ausencias', 'cobreUid', 'uid', 'Ausências'),
];

/**
 * As coleções em que a pessoa fica dentro de listas de objetos (participantes, comentários, histórico, quem leu…), que não dá
 * para consultar: a camada de dados lê a coleção inteira e procura a pessoa em cada documento (contemAPessoa). São coleções
 * do nads, pequenas (a exclusão é rara: lê uma vez, ao abrir a janela de um inativo).
 */
export const COLECOES_VARRIDAS: readonly { colecao: string; rotulo: string }[] = [
  { colecao: 'nadsTarefasDelegadas', rotulo: 'Tarefas' },
  { colecao: 'nadsReunioes', rotulo: 'Reuniões' },
  { colecao: 'nadsAvisos', rotulo: 'Avisos' },
  { colecao: 'chamados', rotulo: 'Chamados dos clientes' },
];

/**
 * A pessoa está em algum lugar deste documento? Procura em tudo (mapas e listas, em qualquer fundura) um texto igual ao uid,
 * ao nome (o login ou o completo, também com os finais conhecidos, como "Clara (Fiscal)") ou ao e-mail. Só texto inteiro igual:
 * "Clara" não acha "Clarice".
 */
export function contemAPessoa(dado: unknown, u: Pick<Usuario, 'uid' | 'nome' | 'email'> & { sobrenome?: string }): boolean {
  const c = chavesDaPessoa(u);
  const procurados = new Set([...c.uid, ...c.nome, ...c.nome.map(n => n + ' (Fiscal)'), ...c.email.map(e => e.toLowerCase())]);
  const ver = (v: unknown, fundura: number): boolean => {
    if (fundura > 20) return false;
    if (typeof v === 'string') return procurados.has(v.trim()) || procurados.has(v.trim().toLowerCase()) && v.includes('@');
    if (Array.isArray(v)) return v.some(x => ver(x, fundura + 1));
    if (v && typeof v === 'object') return Object.values(v as Record<string, unknown>).some(x => ver(x, fundura + 1));
    return false;
  };
  return ver(dado, 0);
}

/** Quem exclui usuário: o Diretor e o Dono (o mesmo Admin com nível de Diretor que a regra do banco pede para apagar). */
export function podeExcluirUsuarios(op: { nivel: Nivel | string | null | undefined; admin: boolean } | null | undefined): boolean {
  return !!op && op.admin && nivelDeDiretor(op.nivel);
}

/** Os valores pelos quais procurar a pessoa: o uid, o nome (o login e o completo) e o e-mail; sem vazio, sem repetir. */
export function chavesDaPessoa(u: Pick<Usuario, 'uid' | 'nome' | 'email'> & { sobrenome?: string }): Record<ChaveDaPessoa, string[]> {
  const unicos = (xs: string[]) => [...new Set(xs.map(x => x.trim()).filter(Boolean))];
  const completo = [u.nome.trim(), (u.sobrenome || '').trim()].filter(Boolean).join(' ');
  const email = u.email.trim();
  return { uid: unicos([u.uid]), nome: unicos([u.nome, completo]), email: unicos([email, email.toLowerCase()]) };
}

/** As buscas de um lugar: uma por valor da pessoa (o nome pode vir em duas formas). */
export function buscasDoLugar(lugar: LugarDeRegistro, u: Pick<Usuario, 'uid' | 'nome' | 'email'> & { sobrenome?: string }): { lugar: LugarDeRegistro; valor: string }[] {
  const valores = chavesDaPessoa(u)[lugar.chave];
  return [...valores, ...(lugar.chave === 'nome' ? valores.flatMap(v => (lugar.sufixos || []).map(f => v + f)) : [])].map(valor => ({ lugar, valor }));
}

/** Os rótulos de onde a pessoa foi achada, sem repetir, na ordem da tabela. */
export function rotulosDosRegistros(achados: readonly LugarDeRegistro[]): string[] {
  return [...new Set(achados.map(l => l.rotulo))];
}

/** O que a busca nos lugares deu: onde achou a pessoa e os lugares que não conseguiu ler (negado, fora do ar). */
export interface BuscaDosRegistros { achados: string[]; semConferir: string[] }

/** A busca, no formato de situacaoDaExclusao: achou em algum lugar, basta (tem registro); senão, faltou ler algum, não conferiu. */
export function registrosDaBusca(b: BuscaDosRegistros): string[] | { semConferir: string[] } {
  if (b.achados.length) return b.achados;
  return b.semConferir.length ? { semConferir: b.semConferir } : [];
}

/** O que a tela mostra sobre excluir a pessoa. */
export type SituacaoDaExclusao =
  /** nada (não é Diretor/Dono, ou a pessoa está ativa) */
  | { tipo: 'nada' }
  /** ainda procurando os registros */
  | { tipo: 'conferindo' }
  | { tipo: 'pode' }
  | { tipo: 'nao-pode'; motivo: string };

/** Junta os rótulos numa frase: "Tarefas", "Tarefas e Avisos", "Tarefas, Avisos e Reuniões". */
function lista(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] || '') : xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1];
}

/**
 * A situação da exclusão de `alvo` para quem está vendo. `registros`: os rótulos de onde a pessoa está gravada (null = ainda
 * procurando; { semConferir } = os lugares que a busca não conseguiu ler, e aí não deixa excluir: sem conferir, não exclui).
 */
export function situacaoDaExclusao(
  op: { nivel: Nivel | string | null | undefined; admin: boolean; email?: string } | null | undefined,
  alvo: Pick<Usuario, 'ativo' | 'nivel' | 'email'>,
  registros: string[] | null | { semConferir: string[] },
): SituacaoDaExclusao {
  if (!podeExcluirUsuarios(op) || alvo.ativo) return { tipo: 'nada' };
  if (op?.email && op.email.trim().toLowerCase() === alvo.email.trim().toLowerCase()) return { tipo: 'nao-pode', motivo: 'Você não pode excluir a própria conta.' };
  if (alvo.nivel === 'dono') return { tipo: 'nao-pode', motivo: 'O Dono não pode ser excluído.' };
  if (registros === null) return { tipo: 'conferindo' };
  if (!Array.isArray(registros)) {
    const onde = registros.semConferir.length ? ' (' + lista(registros.semConferir) + ')' : '';
    return { tipo: 'nao-pode', motivo: 'Não consegui conferir se a pessoa tem registro no sistema' + onde + '. Sem conferir, não exclui. Tente de novo mais tarde.' };
  }
  if (registros.length) {
    return { tipo: 'nao-pode', motivo: 'Não pode ser excluído porque tem registro no sistema (' + lista(registros) + '). A conta fica inativa, e o histórico continua com o nome.' };
  }
  return { tipo: 'pode' };
}
