// ViewModel do Mandei (Vitor, 07/10/2026): os tickets mandados aos clientes. Meus tickets (os que a pessoa mandou)
// e a Central (todos): o número de controle, a empresa, quem mandou, se o e-mail saiu, se o link foi aberto, se o
// cliente respondeu e anexou, e a situação. O 1º link vencido sem arquivo gera o 2º sozinho; vencido o 2º, avisa para
// ligar. Respondido, o Resolver marca o ticket e volta para a etapa da Tarefa; os arquivos baixam do ticket.
// 11/11/2026 (no padrão do Content Snare, do Onvio e do Liscio): cada resposta se aceita ou se pede de novo, com o motivo
// (o pedido vai num link novo, num e-mail só); a nota interna (o cliente não vê) e o histórico do ticket.
import { mandei as m } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useOperador } from '../../casca/operador';
import { arquivoParaBaixar, criarTicketDeTeste, gerarSegundoLink, gravarTicket, mandeiNoExemplo, pedirDeNovoAoCliente, resolverTicket, ROTULO_DA_SIMULACAO, simular, urlDoLink, useTicketsDoMandei, type SimulacaoDoMandei } from '../../dados/mandei';
import { useModoDesenvolvedor } from '../../../../comum/modoDesenvolvedor';

export type FiltroDoMandei = 'abertos' | 'respondidos' | 'resolvidos' | 'todos';
const FILTROS: Record<FiltroDoMandei, (s: m.SituacaoDoTicket) => boolean> = {
  abertos: s => s !== 'respondido' && s !== 'resolvido',
  respondidos: s => s === 'respondido',
  resolvidos: s => s === 'resolvido',
  todos: () => true,
};
export const ROTULO_DO_FILTRO: Record<FiltroDoMandei, string> = { abertos: 'Em andamento', respondidos: 'Respondidos', resolvidos: 'Resolvidos', todos: 'Todos' };

const dataHora = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};
const data = (iso?: string) => (iso ? dataHora(iso).slice(0, 5) + '/' + new Date(iso).getFullYear() : '');

function dataUrlParaBytes(u: string): Uint8Array {
  const b = atob(u.slice(u.indexOf(',') + 1));
  return Uint8Array.from(b, c => c.charCodeAt(0));
}

export function useMandei(pagina: 'meus' | 'central') {
  const op = useOperador().operador;
  const navegar = useNavigate();
  const { aviso, toast } = useRetorno();
  const todos = useTicketsDoMandei();
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setAgora(new Date()), 60_000); return () => clearInterval(i); }, []);
  const [filtro, setFiltro] = useState<FiltroDoMandei>('abertos');
  const [busca, setBusca] = useState('');
  const [aberto, setAbertoDaVez] = useState<string | null>(null);
  const [dev] = useModoDesenvolvedor();
  const falhou = (titulo: string) => (e: unknown) => aviso({ tom: 'erro', titulo, texto: e instanceof Error ? e.message : String(e) });
  // o pedido de novo que a pessoa está montando no ticket aberto (a chave → o motivo) e a nota interna em digitação
  const [pedidos, setPedidos] = useState<Record<string, string>>({});
  const [nota, setNota] = useState('');
  const [novo, setNovo] = useState(false);
  const setAberto = (f: string | null | ((a: string | null) => string | null)) => { setAbertoDaVez(f); setPedidos({}); setNota(''); };

  // o 1º link vencido sem arquivo: o 2º sai sozinho (pela tela de quem mandou o ticket)
  useEffect(() => {
    for (const t of todos) if (t.criadoPor.nome === op?.nome && m.situacaoDoTicket(t, agora) === 'segundo-link') void gerarSegundoLink(t, agora).catch(() => { /* outra tela já gerou, ou sem acesso agora: tenta de novo no próximo minuto */ });
  }, [todos, agora, op?.nome]);

  const daPagina = todos.filter(t => pagina === 'central' || t.criadoPor.nome === op?.nome);
  const q = busca.trim().toLowerCase();
  const comSituacao = daPagina.map(t => ({ t, s: m.situacaoDoTicket(t, agora) }));
  const linhas = comSituacao
    .filter(x => FILTROS[filtro](x.s))
    .filter(x => !q || (m.rotuloDoNumero(x.t.numero) + ' ' + x.t.empresa.nome + ' ' + x.t.para.email + ' ' + x.t.criadoPor.nome).toLowerCase().includes(q))
    .map(({ t, s }) => {
      const l = m.linkAtual(t);
      return {
        id: t.id, numero: m.rotuloDoNumero(t.numero), empresa: (t.empresa.codigo != null ? t.empresa.codigo + ' · ' : '') + t.empresa.nome,
        para: t.para.email, por: t.criadoPor.nome, assunto: t.assunto,
        enviado: dataHora(l.enviadoEm), aberto: dataHora(t.links.map(x => x.abertoEm).filter(Boolean).sort().pop()),
        respondido: dataHora(t.respondidoEm), arquivos: t.arquivos.filter(a => a.status !== 'erro').length,
        situacao: s, rotulo: m.ROTULO_DA_SITUACAO[s], vence: s === 'resolvido' || s === 'respondido' ? '' : data(l.validoAte),
        /** as respostas que o escritório ainda não aceitou nem pediu de novo */
        aRevisar: s === 'resolvido' ? 0 : m.chavesParaRevisar(t).length,
      };
    });
  const contagem = Object.fromEntries((Object.keys(FILTROS) as FiltroDoMandei[]).map(f => [f, comSituacao.filter(x => FILTROS[f](x.s)).length])) as Record<FiltroDoMandei, number>;

  const t = aberto ? todos.find(x => x.id === aberto) || null : null;
  const s = t ? m.situacaoDoTicket(t, agora) : null;
  // o cliente já mandou o formulário alguma vez (o rascunho sozinho não vai para a revisão)
  const enviou = !!t && (!!t.respondidoEm || !!t.historico?.some(e => e.tipo === 'respondido'));
  const detalhe = t && s ? {
    id: t.id, numero: m.rotuloDoNumero(t.numero), empresa: t.empresa.nome, para: t.para.email + (t.para.nome ? ' (' + t.para.nome + ')' : ''),
    por: t.criadoPor.nome, criado: dataHora(t.criadoEm), origem: t.origem.titulo, situacao: s, rotulo: m.ROTULO_DA_SITUACAO[s],
    links: t.links.map(l => ({ numero: l.refazer ? 'Link da volta' : l.numero + 'º link', enviado: dataHora(l.enviadoEm) || 'não enviado', aberto: dataHora(l.abertoEm) || '—', vence: data(l.validoAte), url: urlDoLink(l.codigo) })),
    itens: t.itens.map(it => ({
      id: it.id, titulo: it.titulo, valor: it.valor || '', detalhe: it.detalhe || '',
      // a resposta de cada linha (Vitor, 08/10/2026: o cliente responde por linha); o item sem linhas, inteiro
      respostas: m.chavesDoItem(it).map((chave, n) => {
        const l = it.linhas?.[n];
        const rev = t.revisao?.[chave];
        const tem = !!t.respostas[chave];
        return {
          chave, linha: l ? m.operacaoDaLinha(l) + ' · ' + (l.nf && l.nf !== '—' ? 'NF ' + l.nf : l.conta || l.data) + ' · ' + l.valor : '', opcao: t.respostas[chave]?.opcao || '', texto: t.respostas[chave]?.texto || '',
          /** aceita, pedida de novo (esperando o cliente), a revisar (respondida, sem revisão) ou sem resposta ainda */
          revisao: rev?.estado === 'aceita' ? 'aceita' as const : rev?.estado === 'refazer' ? 'refazer' as const : tem && enviou ? 'revisar' as const : 'sem' as const,
          motivo: rev?.motivo || '', por: rev ? rev.por + ' em ' + dataHora(rev.em) : '',
          /** o pedido de novo em montagem (null = não marcado) */
          pedido: chave in pedidos ? pedidos[chave] : null,
        };
      }),
      arquivos: t.arquivos.filter(a => !!a.itemId && m.itemDaChave(a.itemId) === it.id),
    })),
    arquivosSoltos: t.arquivos.filter(a => !a.itemId || !t.itens.some(it => it.id === m.itemDaChave(a.itemId as string))),
    podeResolver: s === 'respondido' || s === 'ligar' || s === 'aguardando' || s === 'aguardando-2',
    url: urlDoLink(m.linkAtual(t).codigo),
    revisar: s === 'resolvido' ? [] : m.chavesParaRevisar(t),
    /** o pedido de novo pronto para mandar (todas as marcadas com motivo) */
    pedidos: Object.keys(pedidos).length, faltaMotivo: Object.values(pedidos).some(x => !x.trim()),
    notas: (t.notas || []).map((x, i) => ({ id: String(i), texto: x.texto, por: x.por, em: dataHora(x.em) })).reverse(),
    historico: (t.historico || []).map((e, i) => ({ id: String(i), em: dataHora(e.em), rotulo: m.ROTULO_DO_EVENTO[e.tipo], por: e.por || '', texto: e.texto || '' })).reverse(),
  } : null;

  return {
    exemplo: mandeiNoExemplo(),
    /** o ⚡ do modo desenvolvedor (Vitor, 07/10/2026): criar um ticket de teste e simular o cliente e os prazos */
    testes: dev && mandeiNoExemplo() ? [
      { rotulo: 'Criar ticket de teste', onClick: () => { void criarTicketDeTeste(op?.nome || '').then(n => { setFiltro('todos'); setAberto(n.id); toast('Ticket ' + m.rotuloDoNumero(n.numero) + ' de teste criado'); }); } },
      ...(t ? (Object.keys(ROTULO_DA_SIMULACAO) as SimulacaoDoMandei[]).map(a => ({ rotulo: ROTULO_DA_SIMULACAO[a] + ' (' + m.rotuloDoNumero(t.numero) + ')', onClick: () => { simular(t, a); if (a === 'apagar') setAberto(null); setAgora(new Date()); } })) : []),
    ] : [],
    filtro, setFiltro, contagem, busca, setBusca,
    linhas,
    respondidos: contagem.respondidos,
    ligar: comSituacao.filter(x => x.s === 'ligar').length,
    abrir: (id: string) => setAberto(a => (a === id ? null : id)),
    fechar: () => setAberto(null),
    detalhe,
    /** Resolver: marca o ticket e vai para a etapa da Tarefa de onde ele saiu */
    resolver: () => {
      if (!t || !op) return;
      void resolverTicket(t, op.nome).then(() => {
        aviso({ tom: 'ok', titulo: m.rotuloDoNumero(t.numero) + ' resolvido', texto: t.origem.titulo });
        if (t.origem.rota) navegar(t.origem.rota);
      }, falhou('Não deu para resolver'));
    },
    // a revisão de cada resposta (11/11/2026)
    aceitar: (chaves: string[]) => {
      if (!t || !op || !chaves.length) return;
      void gravarTicket(m.aceitar(t, chaves, op.nome, new Date())).catch(falhou('Não deu para aceitar'));
      toast(chaves.length === 1 ? 'Resposta aceita' : chaves.length + ' respostas aceitas');
    },
    /** marca (ou desmarca) a resposta para pedir de novo; o motivo se escreve embaixo dela */
    marcarPedido: (chave: string) => setPedidos(p => { const n = { ...p }; if (chave in n) delete n[chave]; else n[chave] = ''; return n; }),
    escreverMotivo: (chave: string, motivo: string) => setPedidos(p => ({ ...p, [chave]: motivo })),
    mandarPedidos: () => {
      if (!t || !op) return;
      const lista = Object.entries(pedidos).map(([chave, motivo]) => ({ chave, motivo }));
      if (!lista.length || lista.some(x => !x.motivo.trim())) { aviso({ tom: 'erro', titulo: 'Falta o motivo', texto: 'Escreva o motivo de cada resposta pedida de novo: é o que o cliente lê.' }); return; }
      void pedirDeNovoAoCliente(t, lista, op.nome).then(n => {
        if (n === t) return;
        setPedidos({});
        aviso({ tom: 'ok', titulo: m.rotuloDoNumero(t.numero) + ': pedido mandado', texto: (lista.length === 1 ? '1 resposta volta' : lista.length + ' respostas voltam') + ' ao cliente, num link novo que vale até ' + data(m.linkAtual(n).validoAte) });
      }, falhou('Não deu para pedir de novo'));
    },
    nota, setNota,
    guardarNota: () => {
      if (!t || !op || !nota.trim()) return;
      void gravarTicket(m.comNota(t, nota, op.nome, new Date())).catch(falhou('Não deu para guardar a nota'));
      setNota('');
    },
    // o ticket avulso, a partir de um modelo (11/11/2026)
    novo, abrirNovo: () => { setNovo(true); setAberto(null); }, fecharNovo: () => setNovo(false),
    criado: (id: string) => { setNovo(false); setFiltro('todos'); setAberto(id); },
    copiarLink: (url: string) => { void navigator.clipboard?.writeText(url).then(() => toast('Link copiado')); },
    baixar: (a: m.ArquivoDoTicket) => {
      const u = arquivoParaBaixar(a);
      // no banco, o arquivo vai para o Drive pelo robô (a pasta do Claudio Secretário): a tela diz onde está
      if (!u) {
        aviso(mandeiNoExemplo() ? { tom: 'erro', titulo: 'Arquivo indisponível', texto: a.nome + ': no exemplo, só o que foi anexado neste navegador.' }
          : a.status === 'no-drive' ? { tom: 'ok', titulo: 'No Drive', texto: a.local || a.nome }
          : a.status === 'erro' ? { tom: 'erro', titulo: 'O arquivo não chegou ao Drive', texto: a.nome + (a.erro ? ': ' + a.erro : '') }
          : { tom: 'ok', titulo: 'A caminho do Drive', texto: a.nome + ': o robô ainda está gravando.' });
        return;
      }
      baixarBytes(dataUrlParaBytes(u), a.nome, u.slice(5, u.indexOf(';')) || 'application/octet-stream');
    },
  };
}
