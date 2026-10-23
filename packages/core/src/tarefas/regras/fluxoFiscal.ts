// As regras do fluxo operacional do Fiscal (23/10/2026; os fluxos em rotinas/fluxoFiscal.ts). Puro: a tela só desenha.
//   - o status de um subprocesso (a própria pessoa passa por todos; o usuário decidiu): Concluído e Aprovado deixam a
//     etapa da rotina "feita", Não aplicável deixa "dispensada", os outros "pendente" (com o status guardado);
//   - o responsável de cada subprocesso;
//   - o fluxo do mês da empresa: as etapas na ordem, cada uma com os subprocessos do mês, quantos encerraram, e se está
//     liberada (a etapa só libera quando as de antes estão encerradas).
import { etapaDoFluxoNoMes, ondeEsta, statusEncerra, subprocessoNoMes, type EtapaDoFluxo, type FluxoFiscal, type StatusDoSubprocesso, type SubprocessoFiscal } from '../rotinas/fluxoFiscal';
import type { EstadoEtapa, Evento, Execucao } from '../tipos';

/** o status do subprocesso no estado gravado (sem status: pela situação de antes — feita é Concluído, dispensada é Não aplicável) */
export function statusDe(est: EstadoEtapa | undefined): StatusDoSubprocesso {
  if (est?.status) return est.status;
  if (est?.situacao === 'feita') return 'concluido';
  if (est?.situacao === 'dispensada') return 'nao-aplicavel';
  if (est?.situacao === 'interrompida') return 'execucao';
  return 'pendente';
}

/**
 * muda o status do subprocesso (a observação vai junto quando tem); sem responsável gravado, fica o padrão (o do Fiscal da
 * empresa no Cadastro, ou quem mexeu: 23/10/2026, "tenho que ficar colocando responsável em todos?")
 */
export function definirStatus(ex: Execucao, sub: string, status: StatusDoSubprocesso, por: string, agora: Date, observacao = '', responsavelPadrao = ''): { execucao: Execucao; evento: Evento } {
  const em = agora.toISOString();
  const antes = ex.etapas[sub];
  const situacao: EstadoEtapa['situacao'] = status === 'nao-aplicavel' ? 'dispensada' : statusEncerra(status) ? 'feita' : 'pendente';
  const obs = observacao.trim();
  const estado: EstadoEtapa = {
    situacao, por, em, status,
    ...(antes?.responsavel ? { responsavel: antes.responsavel } : responsavelPadrao ? { responsavel: responsavelPadrao } : {}),
    ...(status === 'nao-aplicavel' ? { objecao: 'nao-se-aplica' } : {}),
    ...(obs ? { observacao: obs } : antes?.observacao ? { observacao: antes.observacao } : {}),
  };
  return { execucao: { ...ex, etapas: { ...ex.etapas, [sub]: estado } }, evento: { tipo: 'status', etapa: sub, por, em, observacao: status + (obs ? ' · ' + obs : '') } };
}

/** o mesmo status em vários subprocessos de uma vez (o "Concluir a etapa"): uma gravação só, um evento só */
export function definirStatusDeVarios(ex: Execucao, subs: readonly string[], status: StatusDoSubprocesso, por: string, agora: Date, responsavelPadrao = ''): { execucao: Execucao; evento: Evento } {
  let atual = ex;
  for (const sub of subs) atual = definirStatus(atual, sub, status, por, agora, '', responsavelPadrao).execucao;
  return { execucao: atual, evento: { tipo: 'status', etapa: subs[0] || '', por, em: agora.toISOString(), observacao: status + ' · ' + subs.length + ' subprocessos' } };
}

/** o mesmo responsável em vários subprocessos de uma vez (o "trocar" do responsável da etapa) */
export function definirResponsavelDeVarios(ex: Execucao, subs: readonly string[], responsavel: string, por: string, agora: Date): { execucao: Execucao; evento: Evento } {
  let atual = ex;
  for (const sub of subs) atual = definirResponsavelDoSubprocesso(atual, sub, responsavel, por, agora).execucao;
  return { execucao: atual, evento: { tipo: 'responsavel', etapa: subs[0] || '', por, em: agora.toISOString(), observacao: responsavel + ' · ' + subs.length + ' subprocessos' } };
}

/** o responsável do subprocesso ('' = tira) */
export function definirResponsavelDoSubprocesso(ex: Execucao, sub: string, responsavel: string, por: string, agora: Date): { execucao: Execucao; evento: Evento } {
  const em = agora.toISOString();
  const antes = ex.etapas[sub];
  const base: EstadoEtapa = antes ? { ...antes } : { situacao: 'pendente', por, em, status: 'pendente' };
  if (responsavel) base.responsavel = responsavel; else delete base.responsavel;
  return { execucao: { ...ex, etapas: { ...ex.etapas, [sub]: base } }, evento: { tipo: 'responsavel', etapa: sub, por, em, observacao: responsavel } };
}

export interface SubprocessoNoMes extends SubprocessoFiscal { status: StatusDoSubprocesso; encerrado: boolean; responsavel: string; por: string; em: string; observacao: string }
export interface EtapaNoMes extends Omit<EtapaDoFluxo, 'subprocessos'> {
  subprocessos: SubprocessoNoMes[];
  encerrados: number;
  /** todos os subprocessos do mês encerrados (concluídos, aprovados ou não aplicáveis) */
  concluida: boolean;
  /** as de antes estão concluídas: dá para trabalhar nesta */
  liberada: boolean;
  /** a primeira de antes que ainda falta (o porquê do bloqueio) */
  esperando: string;
}

/** o fluxo do mês da empresa: as etapas do mês (as trimestrais só no trimestre), na ordem, com o estado de cada subprocesso */
export function fluxoDoMes(fluxo: FluxoFiscal, ex: Execucao | null, competencia: string): EtapaNoMes[] {
  const mes = Number(competencia.slice(5, 7)) || 0;
  const etapas = fluxo.etapas.filter(e => etapaDoFluxoNoMes(e, mes)).map(e => {
    const subprocessos = e.subprocessos.filter(s => subprocessoNoMes(e, s, mes)).map(s => {
      const est = ex?.etapas[s.id];
      const status = statusDe(est);
      return { ...s, status, encerrado: statusEncerra(status), responsavel: est?.responsavel || '', por: est?.por || '', em: est?.em || '', observacao: est?.observacao || '' };
    });
    const encerrados = subprocessos.filter(s => s.encerrado).length;
    return { ...e, subprocessos, encerrados, concluida: encerrados === subprocessos.length, liberada: true, esperando: '' };
  });
  let falta = '';
  for (const e of etapas) {
    e.liberada = !falta;
    e.esperando = falta;
    if (!falta && !e.concluida) falta = e.n + '. ' + e.nome;
  }
  return etapas;
}

/** o resumo do fluxo do mês: quantos subprocessos encerraram, a etapa da vez e se acabou */
export function resumoDoFluxo(etapas: readonly EtapaNoMes[]): { encerrados: number; total: number; daVez: EtapaNoMes | null; concluido: boolean } {
  const total = etapas.reduce((s, e) => s + e.subprocessos.length, 0);
  const encerrados = etapas.reduce((s, e) => s + e.encerrados, 0);
  const daVez = etapas.find(e => !e.concluida) || null;
  return { encerrados, total, daVez, concluido: !daVez };
}

/** é um subprocesso do fluxo novo? (o executor antigo fica para o MEI e os outros regimes) */
export const ehSubprocessoDoFluxo = (id: string) => !!ondeEsta(id);
