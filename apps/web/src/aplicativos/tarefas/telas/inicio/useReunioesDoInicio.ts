// ViewModel das reuniões nas Notificações do Início novo (Vitor, 13/11/2026). O papel vem do nível: o Sênior pede (e escolhe
// quem vai), o Diretor e o Dono decidem (revisar com prazo, aprovar ou recusar com a observação) e marcam direto, os outros
// participam (comentam quando a reunião é finalizada). Quem vê, o status de agora e o que cada um pode fazer vêm do core
// (tarefas.reunioes). No modo desenvolvedor, o ⚡ simula o nível.
import { tarefas, usuarios } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useModoDesenvolvedor } from '../../../../comum/modoDesenvolvedor';
import { encolherAnexo } from '../../dados/encolherAnexo';
import { useAcesso, useReunioes, useTarefasDelegadas } from '../../dados/repo';
import type { QualArquivo } from '../../dados/reunioes';
import { useOperador, type Operador } from '../../casca/operador';
import { useSaudacaoSimulada } from './saudacaoSimulada';

const r = tarefas.reunioes;
const quandoTexto = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const agoraLocal = () => { const d = new Date(); return tarefas.delegadas.hojeIso(d) + 'T' + d.toTimeString().slice(0, 5); };
/** os arquivos do Problema e da Solução: texto, Word, Excel ou PDF */
export const ACEITA_NA_REUNIAO = '.txt,.doc,.docx,.xls,.xlsx,.csv,.pdf';

/** O nível que vale no Início novo: no modo desenvolvedor, o simulado pelo ⚡ (o Sênior, o Diretor, o Pleno); fora dele, o da conta. */
export function useNivelDoInicio() {
  const op = useOperador().operador as Operador;
  const [dev] = useModoDesenvolvedor();
  const simulada = useSaudacaoSimulada();
  return dev && simulada.nivel ? simulada.nivel : op.nivel;
}

export function useReunioesDoInicio() {
  const { toast, aviso } = useRetorno();
  const nivel = useNivelDoInicio();
  const papel = r.papelPeloNivel(nivel);
  const aprova = papel === 'aprova';
  const repo = useReunioes();
  const uid = useTarefasDelegadas().eu()?.uid || '';
  const acesso = useAcesso();
  const agora = agoraLocal();
  const ativos = acesso.equipe().lista.filter(u => u.ativo);
  // o pedido da tela (sem a caixinha): o Diretor ou o Dono participa quando algum convidado é Diretor ou Dono
  type PedidoDaTela = Omit<tarefas.reunioes.PedidoDeReuniao, 'comDiretor'>;
  const comNivel = (p: PedidoDaTela): tarefas.reunioes.PedidoDeReuniao => ({ ...p, comDiretor: r.comDiretorEntre(p.participantes, ativos) });
  const { carregadas, reunioes } = repo.lista();
  const visiveis = r.ordenar(reunioes.filter(x => r.ve(x, uid, aprova)), agora);
  const erro = (titulo: string) => (e: unknown) => aviso({ tom: 'erro', titulo, texto: e instanceof Error ? e.message : String(e) });
  const fazer = (titulo: string, f: () => Promise<void>, ok?: string) => f().then(() => { if (ok) toast(ok); }).catch(erro(titulo));
  const item = (x: tarefas.reunioes.Reuniao) => {
    const status = r.statusDaReuniao(x, agora);
    return {
      ...x, statusAgora: status, rotulo: r.ROTULO_DO_STATUS[status], tom: r.TOM_DO_STATUS[status],
      quandoTexto: quandoTexto(x.quando), pedidaEm: quandoTexto(x.em), acoes: r.acoes(x, { uid, aprova }, agora),
      duracaoTexto: r.rotuloDaDuracao(x.duracao), tipoRotulo: r.rotuloDoTipoDaReuniao(x.tipo),
      faltaComentar: r.faltaComentar(x).map(p => p.nome), souResponsavel: r.responsavel(x, uid),
      /** a minha resposta (true vai, false não vai, null ainda não respondi) e quem não respondeu */
      minhaPresenca: x.presencas.find(p => p.uid === uid)?.vai ?? null, semResposta: r.semResposta(x).map(p => p.nome),
    };
  };
  return {
    papel, nivel, carregadas,
    lista: visiveis.map(item),
    /** as que esperam a decisão (o Diretor e o Dono) ou os pedidos da pessoa (o Sênior) */
    solicitacoes: visiveis.filter(x => x.origem === 'pedido' && (aprova ? x.status === 'em-analise' || x.status === 'revisando' : x.criadaPor.uid === uid)).map(item),
    pendentes: aprova ? visiveis.filter(x => x.origem === 'pedido' && (x.status === 'em-analise' || x.status === 'revisando')).length : 0,
    /** as próximas, para o Painel e o calendário (aprovadas ou remarcadas, de hoje em diante) */
    proximas: visiveis.filter(x => (x.status === 'aprovada' || x.status === 'remarcada') && x.quando >= agora.slice(0, 10)).map(item),
    /** quem pode ir (a equipe ativa, sem a própria pessoa) */
    equipe: ativos.filter(u => u.uid !== uid && !usuarios.ehContaReservada(u.email)).map(u => ({ uid: u.uid, nome: u.nome })),
    aceita: ACEITA_NA_REUNIAO,
    tipos: r.TIPOS_DA_REUNIAO, duracoes: r.DURACOES.map(m => ({ valor: m, rotulo: r.rotuloDaDuracao(m) })),
    problemaDaRecusa: r.problemaDaRecusa,
    problemaDoPedido: (p: PedidoDaTela) => r.problemaDoPedido(comNivel(p)),
    async pedir(p: PedidoDaTela): Promise<boolean> {
      try { await repo.pedir(comNivel(p), aprova); toast(aprova ? 'Reunião marcada: já aparece para todos.' : 'Reunião pedida: o Diretor vai aprovar ou não.'); return true; }
      catch (e) { erro('A reunião não foi pedida')(e); return false; }
    },
    revisar: (id: string, prazo: string) => fazer('Não deu para revisar', () => repo.revisar(id, prazo), 'Em revisão, com o prazo de resposta.'),
    decidir: (id: string, aprovar: boolean, obs: string) => fazer('Não deu para decidir', () => repo.decidir(id, aprovar, obs), aprovar ? 'Reunião aprovada.' : 'Reunião recusada.'),
    remarcar: (id: string, quando: string) => fazer('Não deu para remarcar', () => repo.remarcar(id, quando), 'Reunião remarcada.'),
    confirmar: (id: string, vai: boolean) => fazer('A resposta não foi gravada', () => repo.confirmar(id, vai), vai ? 'Presença confirmada.' : 'Avisado que você não vai.'),
    anexar: (id: string, qual: QualArquivo, arquivo: File) => fazer('O arquivo não foi anexado', async () => repo.anexar(id, qual, await encolherAnexo(arquivo)), 'Arquivo anexado.'),
    async baixar(id: string, qual: QualArquivo) {
      const a = reunioes.find(x => x.id === id)?.[qual];
      const bytes = await repo.baixar(id, qual).catch(() => null);
      if (!a || !bytes) { toast('O arquivo não foi encontrado.'); return; }
      baixarBytes(bytes, a.nome, 'application/octet-stream');
    },
    finalizar: (id: string) => fazer('Não deu para finalizar', () => repo.finalizar(id), 'Reunião finalizada.'),
    comentar: (id: string, texto: string) => fazer('O comentário não foi gravado', () => repo.comentar(id, texto), 'Comentário gravado.'),
    encerrar: (id: string) => fazer('Não deu para encerrar', () => repo.encerrar(id), 'Reunião encerrada.'),
  };
}
