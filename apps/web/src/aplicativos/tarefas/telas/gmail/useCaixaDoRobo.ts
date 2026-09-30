// ViewModel da caixa do robô do Gmail (como nas Pendências): o robô (online, lendo, fila, andamento), "Verificar o
// Gmail agora", as abas (de clientes, sem cliente, spam), a busca, e as ações de cada e-mail: salvar os anexos no
// Drive, escolher o cliente, ligar o remetente a um cliente, marcar como spam (admin), abrir no Gmail. O e-mail aberto
// (usePainelDoEmail) pede o texto inteiro ao robô e mostra as respostas; responder vai para a fila dele.
import { entregas as e } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useMemo, useState } from 'react';
import { useOperador } from '../../casca/operador';
import { useGmailDoEntregas } from '../../dados/repo';

export type AbaDaCaixa = 'clientes' | 'sem-cliente' | 'spam';

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function quandoFoi(iso: string, agora = Date.now()): string {
  const t = Date.parse(iso);
  if (!t) return '';
  const min = Math.round((agora - t) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return 'há ' + min + ' min';
  const d = new Date(t);
  const hoje = new Date(agora);
  if (d.toDateString() === hoje.toDateString()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function useCaixaDoRobo() {
  const repo = useGmailDoEntregas();
  const { toast } = useRetorno();
  const admin = !!useOperador().operador?.admin;
  const [aba, setAba] = useState<AbaDaCaixa>('clientes');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const estado = repo.estado();
  const clientes = repo.clientes().lista;
  const ignorados = repo.ignorados();
  const semDono = useMemo(() => e.semCliente(estado, clientes, ignorados), [estado, clientes, ignorados]);

  const listas: Record<AbaDaCaixa, e.EmailDaCaixa[]> = { clientes: estado.caixa, 'sem-cliente': semDono, spam: estado.spam };
  const q = semAcento(busca.trim());
  const linhas = listas[aba].filter(x => !q || semAcento([x.nome, x.remetente, x.assunto, x.trecho, x.clienteNome || ''].join(' ')).includes(q));
  const todos = [...estado.caixa, ...estado.naoReconhecidos, ...estado.spam];

  async function tentar(oque: string, f: () => Promise<void>, ok: string) {
    try { await f(); toast(ok); } catch (err) { toast('Não consegui ' + oque + ': ' + (err as Error).message + '.'); }
  }

  return {
    exemplos: repo.exemplos,
    carregando: !estado.carregado,
    erro: estado.erro ? 'Não consegui ler o robô (' + estado.erro + '). Só o admin e o contábil veem a caixa dele.' : '',
    robo: {
      online: estado.online,
      visto: estado.vistoEm ? quandoFoi(estado.vistoEm) : '',
      lendo: estado.status === 'lendo',
      erro: estado.status === 'erro' ? estado.statusMsg : '',
      naFila: estado.naFila,
      ultimaLeitura: estado.ultimaExecucao ? quandoFoi(estado.ultimaExecucao) : '',
      andamento: estado.andamento,
    },
    aba, setAba,
    contagem: { clientes: estado.caixa.length, 'sem-cliente': semDono.length, spam: estado.spam.length } as Record<AbaDaCaixa, number>,
    busca, setBusca,
    linhas,
    clientes,
    admin,
    salvo: (x: e.EmailDaCaixa) => estado.salvos[x.mensagemId] || null,
    parecido: (x: e.EmailDaCaixa) => e.clienteParecido(x, clientes),
    /** os clientes que batem com a busca (código ou nome), para escolher o dono do e-mail */
    clientesQueBatem(busca: string): e.ClienteDoEntregas[] {
      const t = semAcento(busca.trim());
      if (!t) return [];
      return clientes.filter(c => c.codigo === t || c.codigo.startsWith(t) || semAcento(c.nome).includes(t)).slice(0, 8);
    },
    linkDoGmail: e.linkDoGmail,
    quandoFoi,
    verificar: () => tentar('pedir a leitura', () => repo.verificar(3), estado.online ? 'Pedido na fila: o robô vai ler os e-mails dos últimos 3 dias.' : 'Pedido na fila: o robô está fora do ar e lê quando voltar.'),
    cancelar: () => tentar('parar', () => repo.cancelar(), 'Pedido para parar na fila do robô.'),
    salvarNoDrive: (x: e.EmailDaCaixa, clienteId?: string | null) =>
      tentar('pedir', () => repo.salvarNoDrive(x.mensagemId, clienteId ?? x.clienteId), 'O robô vai salvar os anexos no Drive.'),
    ligar: (x: e.EmailDaCaixa, clienteId: string) => {
      const c = clientes.find(k => k.id === clienteId);
      return tentar('ligar o remetente', () => repo.ligarRemetente(clienteId, x.remetente), x.remetente + ' agora é de ' + (c?.nome || 'cliente') + '.');
    },
    ignorar: (x: e.EmailDaCaixa) => {
      if (!admin) { toast('Só um administrador marca remetente como spam.'); return Promise.resolve(); }
      return tentar('marcar como spam', () => repo.ignorar(x.remetente), x.remetente + ' marcado como spam.');
    },
    abrir: setAberto,
    aberto: aberto ? todos.find(x => x.mensagemId === aberto) || null : null,
    fechar: () => setAberto(null),
  };
}

export type VmCaixa = ReturnType<typeof useCaixaDoRobo>;

/** O e-mail aberto: o texto inteiro (o robô busca), as respostas pedidas e responder. */
export function usePainelDoEmail(email: e.EmailDaCaixa) {
  const repo = useGmailDoEntregas();
  const { toast } = useRetorno();
  const [lido, setLido] = useState<{ carregando: boolean; email: e.EmailLido | null; erro: string }>({ carregando: true, email: null, erro: '' });
  const [respostas, setRespostas] = useState<e.RespostaPedida[]>([]);
  const [texto, setTexto] = useState('');
  const [todos, setTodos] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vale = true;
    repo.ler(email.mensagemId).then(
      m => { if (vale) setLido({ carregando: false, email: m, erro: '' }); },
      (err: Error) => { if (vale) setLido({ carregando: false, email: null, erro: err.message }); },
    );
    const parar = repo.respostas(email.mensagemId, setRespostas);
    return () => { vale = false; parar(); };
  }, [repo, email.mensagemId]);

  return {
    lido, respostas, texto, setTexto, todos, setTodos, enviando,
    async responder() {
      if (!texto.trim() || enviando) return;
      setEnviando(true);
      try {
        await repo.responder({ mensagemId: email.mensagemId, corpo: texto.trim(), todos, para: email.remetente, assunto: email.assunto, clienteId: email.clienteId });
        setTexto('');
        setTodos(false);
        toast('Resposta na fila do robô.');
      } catch (err) {
        toast('Não consegui pôr a resposta na fila: ' + (err as Error).message + '.');
      } finally { setEnviando(false); }
    },
  };
}
