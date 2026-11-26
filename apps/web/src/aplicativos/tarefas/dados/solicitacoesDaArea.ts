// As regras da seção Solicitações da Área do Cliente refeita (26/11/2026: "quero que esse modulo seja completamente refeito
// para suportar e gerenciar de maneira mais simples e coerente a area do cliente como está hoje, preciso que seja o mais
// bonito e de facil entendimento possivel"). Os filtros (situação e tipo), a busca, a ordem, a contagem, a área do anexo e a
// linha do arquivo na resposta ("tem que ter a opcao de subir um arquivo por aqui"). Só a lógica, sem React.
import { areaCliente as ac } from '@nads/core';
import type { ChamadoNaEquipe } from './areaCliente';

/** O filtro por situação, como aparece na barra. */
export type FiltroDaSituacao = 'abertas' | 'andamento' | 'respondidas' | 'concluidas' | 'todas';
export const FILTROS_DA_SITUACAO: readonly { valor: FiltroDaSituacao; rotulo: string; situacao: ac.SituacaoDoChamado | null }[] = [
  { valor: 'abertas', rotulo: 'Abertas', situacao: 'aberto' },
  { valor: 'andamento', rotulo: 'Em andamento', situacao: 'em andamento' },
  { valor: 'respondidas', rotulo: 'Respondidas', situacao: 'respondido' },
  { valor: 'concluidas', rotulo: 'Concluídas', situacao: 'concluido' },
  { valor: 'todas', rotulo: 'Todas', situacao: null },
];

/** O filtro por tipo: os três do DP juntos (admissão, férias, demissão), e os outros tipos do core. */
export type FiltroDoTipo = 'todos' | 'dp' | 'duvida' | 'documento' | 'outro';
export const FILTROS_DO_TIPO: readonly { valor: FiltroDoTipo; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos os tipos' },
  { valor: 'dp', rotulo: 'DP' },
  { valor: 'duvida', rotulo: 'Dúvida' },
  { valor: 'documento', rotulo: 'Documento' },
  { valor: 'outro', rotulo: 'Outro' },
];

const TIPOS_DO_DP: ReadonlySet<string> = new Set<ac.TipoDeChamado>(['admissao', 'ferias', 'demissao']);

/** O grupo do tipo no filtro: os do DP viram "dp". */
export const grupoDoTipo = (tipo: string): Exclude<FiltroDoTipo, 'todos'> =>
  TIPOS_DO_DP.has(tipo) ? 'dp' : tipo === 'duvida' || tipo === 'documento' ? tipo : 'outro';

/** "Contratar um funcionário", "Tirar uma dúvida"… (o rótulo do core; o tipo desconhecido fica como veio) */
export const rotuloDoTipo = (tipo: string) => ac.TIPOS_DE_CHAMADO.find(t => t.valor === tipo)?.rotulo || tipo;

/** O tom do selo de cada situação: aberta pede atenção, em andamento é informação, respondida espera o cliente, concluída ok. */
export const TOM_DA_SITUACAO: Readonly<Record<ac.SituacaoDoChamado, 'aviso' | 'info' | 'neutro' | 'ok'>> = {
  aberto: 'aviso', 'em andamento': 'info', respondido: 'neutro', concluido: 'ok',
};

const simples = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** A busca: todas as palavras aparecem na empresa, no assunto ou nos códigos. */
export function bateNaBusca(c: Pick<ChamadoNaEquipe, 'empresa' | 'titulo' | 'codigos'>, busca: string): boolean {
  const q = simples(busca.trim());
  if (!q) return true;
  const alvo = simples(c.empresa + ' ' + c.titulo + ' ' + c.codigos.join(' '));
  return q.split(/\s+/).every(p => alvo.includes(p));
}

const daSituacao = (f: FiltroDaSituacao) => FILTROS_DA_SITUACAO.find(x => x.valor === f)?.situacao ?? null;

/** Mais novas primeiro (pela última mudança). */
export const maisNovasPrimeiro = <T extends Pick<ChamadoNaEquipe, 'atualizadoEm'>>(lista: readonly T[]): T[] =>
  [...lista].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));

/** As linhas da lista: tipo, busca e situação, as mais novas primeiro. */
export function filtrarSolicitacoes<T extends ChamadoNaEquipe>(lista: readonly T[], f: { situacao: FiltroDaSituacao; tipo: FiltroDoTipo; busca: string }): T[] {
  const s = daSituacao(f.situacao);
  return maisNovasPrimeiro(lista.filter(c => (s == null || c.situacao === s) && (f.tipo === 'todos' || grupoDoTipo(c.tipo) === f.tipo) && bateNaBusca(c, f.busca)));
}

/** A contagem de cada filtro de situação, já com o tipo e a busca (o número bate com o que aparece ao clicar). */
export function contagemPorSituacao(lista: readonly ChamadoNaEquipe[], f: { tipo: FiltroDoTipo; busca: string }): Record<FiltroDaSituacao, number> {
  const base = lista.filter(c => (f.tipo === 'todos' || grupoDoTipo(c.tipo) === f.tipo) && bateNaBusca(c, f.busca));
  const conta = {} as Record<FiltroDaSituacao, number>;
  for (const x of FILTROS_DA_SITUACAO) conta[x.valor] = x.situacao == null ? base.length : base.filter(c => c.situacao === x.situacao).length;
  return conta;
}

/** Começa em "Abertas" se houver alguma; senão, "Todas". */
export const filtroInicial = (lista: readonly Pick<ChamadoNaEquipe, 'situacao'>[]): FiltroDaSituacao =>
  lista.some(c => c.situacao === 'aberto') ? 'abertas' : 'todas';

/** A área da empresa onde o anexo da resposta cai: DP → DP; guia → Fiscal; o resto → Societário. */
export function areaDoAnexo(tipo: string): ac.AreaDoEscritorio {
  if (TIPOS_DO_DP.has(tipo)) return 'dp';
  if (/guia/i.test(tipo)) return 'fiscal';
  return 'societario';
}

/** A linha que vai no fim da resposta quando a equipe anexou um arquivo (o cliente vê em Documentos › Do escritório). */
export const linhaDoAnexo = (nomeFinal: string) => ac.linhaDoAnexo(nomeFinal);

/** O texto da resposta: o que foi digitado e, havendo anexo, a linha do arquivo no fim (só ela, se não houver texto). */
export function textoDaResposta(texto: string, nomeDoAnexo?: string | null): string {
  const t = texto.trim();
  if (!nomeDoAnexo) return t;
  return t ? t + '\n\n' + linhaDoAnexo(nomeDoAnexo) : linhaDoAnexo(nomeDoAnexo);
}

/** Os passos do pedido do DP, para marcar ([] nos outros tipos). */
export const passosDaSolicitacao = (c: Pick<ChamadoNaEquipe, 'tipo' | 'passos'>) =>
  ac.passosDoTipo(c.tipo).map(nome => ({ nome, feito: !!c.passos[nome] }));

/** "★★★★☆" */
export const estrelas = (n: number) => '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(5 - Math.max(0, Math.min(5, n)));
