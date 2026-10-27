// ViewModel do balão do suporte (Vitor, 20/10/2026): no canto de baixo, à direita, em toda tela da Tarefas. A conversa é
// guiada por cápsulas (o problema, o banco, o mês), já sabendo a empresa, o período e a tela (contextoDoSuporte), e termina
// nas instruções, diretas. "Não resolveu" (ou "Outro"): o arquivo e uma frase vão para os Feedbacks, aba Bugs, e o robô do
// PC do escritório investiga e escreve o report para o admin. As regras da conversa ficam no core (suporte).
import { suporte as s } from '@nads/core';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { VERSAO_SISTEMA } from '../../../../versao';
import { useFeedback } from '../../dados/repo';
import { useOndeEsta } from './contextoDoSuporte';
import { useOperador } from '../../casca/operador';
import { botoesDaPagina } from './botoesDaPagina';

/** Uma fala da conversa: a pergunta ou as instruções do suporte, e a cápsula que a pessoa escolheu. */
export interface FalaDoSuporte { passo: s.PassoDoSuporte; escolhida: string }


// o chat é temporário (Vitor, 21/10/2026: "sistema de chat temporário, que depois de 1 dia é excluído"): a conversa fica
// só neste navegador e some 1 dia depois de começar (o bug enviado continua nos Feedbacks)
const CHAVE = 'nads-suporte-chat';
const DURA_MS = 24 * 3600 * 1000;
/** A conversa guardada: as respostas, a empresa dela (trocou de empresa, recomeça) e os botões da página, fixos na conversa. */
interface ChatGuardado { comecou: number; escolhas: string[]; resolvido: boolean; enviado: boolean; empresa?: string; botoes?: string[]; pedido?: string }
function lerChat(): ChatGuardado | null {
  try {
    const g = JSON.parse(localStorage.getItem(CHAVE) || 'null') as ChatGuardado | null;
    if (!g || !Array.isArray(g.escolhas) || Date.now() - g.comecou > DURA_MS) { localStorage.removeItem(CHAVE); return null; }
    return g;
  } catch { return null; }
}

export function useBalaoDoSuporte() {
  const repo = useFeedback();
  const { pathname } = useLocation();
  const onde = useOndeEsta();
  // o nome de quem está usando, para o suporte falar com a pessoa (Vitor, 21/10/2026: "coloca o nome do usuário")
  const nomeDaPessoa = (useOperador().operador?.nome || '').trim().split(/\s+/)[0] || '';
  // as cápsulas marcadas na pergunta de várias respostas (21/10/2026: "algumas respostas precisam ser múltiplas ou todas")
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [aberto, setAberto] = useState(false);
  const [guardado] = useState(lerChat);
  const [comecou, setComecou] = useState(() => guardado?.comecou ?? 0);
  const [escolhas, setEscolhas] = useState<string[]>(() => guardado?.escolhas ?? []);
  const [resolvido, setResolvido] = useState(() => guardado?.resolvido ?? false);
  // vários arquivos (Vitor, 26/10/2026: "só tá dando para anexar somente 1")
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [frase, setFrase] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(() => guardado?.enviado ?? false);
  // o número do pedido enviado (Vitor, 21/10/2026: "nomeie em #"), o mesmo que aparece nos Feedbacks
  const [pedido, setPedido] = useState(() => guardado?.pedido ?? '');
  // a empresa da conversa: trocou de empresa, o chat recomeça (Vitor, 21/10/2026)
  const [empresaDoChat, setEmpresaDoChat] = useState(() => guardado?.empresa ?? '');
  // os botões de importação da página: lidos ao abrir o balão e fixos na conversa (21/10/2026: lidos a cada resposta, a
  // lista que chegava depois embaralhava o histórico); vazia, tenta de novo na próxima resposta
  const [botoes, setBotoes] = useState<string[]>(() => guardado?.botoes ?? []);
  const lerBotoes = (forcar = false) => { if (botoes.length && !forcar) return; try { setBotoes(botoesDaPagina()); } catch { /* sem a página: fica sem */ } };
  // guarda a conversa (com a hora em que começou); vazia, apaga
  useEffect(() => {
    try {
      if (!escolhas.length && !resolvido && !enviado) localStorage.removeItem(CHAVE);
      else localStorage.setItem(CHAVE, JSON.stringify({ comecou: comecou || Date.now(), escolhas, resolvido, enviado, empresa: empresaDoChat, botoes, pedido } satisfies ChatGuardado));
    } catch { /* sem localStorage: fica só na tela */ }
  }, [comecou, escolhas, resolvido, enviado, empresaDoChat, botoes, pedido]);
  const [erro, setErro] = useState('');

  const rotuloDaTela = onde ? onde.aba || onde.etapa : '';
  const empresaAgora = onde?.empresa || '';
  // trocou de empresa no meio da conversa: recomeça (a conversa era de outra empresa)
  useEffect(() => {
    if (!empresaAgora || empresaAgora === empresaDoChat) return;
    if (empresaDoChat) recomecar();
    setEmpresaDoChat(empresaAgora);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAgora]);
  const ctx: s.ContextoDoSuporte = {
    tela: s.telaPeloRotulo(rotuloDaTela), rotuloDaTela: rotuloDaTela || 'Tarefas',
    empresa: onde?.empresa || '', codigo: onde?.codigo ?? null, meses: onde?.meses || [], bancos: onde?.bancos || [],
    pagina: [onde?.etapa, onde?.aba].filter(Boolean).join(' › ') || 'Tarefas', botoes,
  };
  const passo = s.passoDoSuporte(ctx, escolhas);
  // o que já foi conversado: cada passo de antes e a cápsula escolhida nele
  const conversa: FalaDoSuporte[] = escolhas.map((e, i) => {
    const antes = s.passoDoSuporte(ctx, escolhas.slice(0, i));
    return { passo: antes, escolhida: s.rotuloDaEscolha(ctx, e) };
  });

  function recomecar() {
    setComecou(0);
    setMarcadas([]);
    setBotoes([]);
    setEscolhas([]); setResolvido(false); setArquivos([]); setFrase(''); setEnviado(false); setPedido(''); setErro('');
  }

  function escolher(id: string) {
    if (!comecou) setComecou(Date.now());
    lerBotoes();
    setMarcadas([]);
    setEscolhas(e => [...e, id]);
  }

  async function enviar() {
    if (!arquivos.length && !frase.trim()) { setErro('Anexe o arquivo (ou escreva um comentário).'); return; }
    setEnviando(true); setErro('');
    try {
      const caminho = s.caminhoDaConversa(ctx, escolhas);
      const lidos = await Promise.all(arquivos.map(async f => ({ nome: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })));
      const id = await repo.enviarBug({
        // a mensagem no formato de sempre (Vitor, 21/10/2026: "chegue para mim em um padrão")
        texto: s.mensagemDoBug(ctx, escolhas, frase, arquivos.map(f => f.name).join(', ')).slice(0, 4000),
        tela: pathname + (rotuloDaTela ? ' · ' + [onde?.etapa, onde?.aba].filter(Boolean).join(' › ') : ''),
        versao: VERSAO_SISTEMA, caminho,
        contexto: { empresa: ctx.empresa, codigo: ctx.codigo, tela: ctx.rotuloDaTela, meses: ctx.meses },
        arquivos: lidos,
      });
      setPedido(s.codigoDoPedido(id));
      setEnviado(true);
    } catch (e) {
      setErro('Não consegui enviar: ' + (e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return {
    // sem o "Nova conversa" (Vitor, 21/10/2026): a conversa que terminou (resolveu ou foi enviada) recomeça ao abrir de novo
    aberto, abrir: () => { const terminou = resolvido || enviado; if (terminou) recomecar(); lerBotoes(terminou); setAberto(true); }, fechar: () => setAberto(false),
    /** o título: a empresa e a tela de onde a pessoa está */
    titulo: [ctx.empresa, ctx.rotuloDaTela].filter(Boolean).join(' · '),
    conversa, passo, resolvido, enviado, enviando, erro, pedido,
    escolher,
    nomeDaPessoa,
    /** a pergunta de várias: marca ou desmarca a cápsula */
    marcadas, marcar: (id: string) => setMarcadas(m => (m.includes(id) ? m.filter(x => x !== id) : [...m, id])),
    /** confirma as marcadas: o prefixo e os valores juntos ('m:2026-01|2026-02') */
    confirmar: () => { if (marcadas.length) escolher(marcadas[0].slice(0, 2) + marcadas.map(id => id.slice(2)).join(s.SEPARADOR)); },
    resolveu: () => setResolvido(true),
    naoResolveu: () => { lerBotoes(); setEscolhas(e => [...e, s.NAO_RESOLVEU]); },
    /** os arquivos anexados: escolher junta aos que já estão (o mesmo nome não entra duas vezes); o × tira um */
    arquivos,
    anexar: (fs: File[]) => setArquivos(a => [...a, ...fs.filter(f => !a.some(x => x.name === f.name && x.size === f.size))]),
    tirarArquivo: (i: number) => setArquivos(a => a.filter((_, k) => k !== i)),
    frase, setFrase,
    enviar: () => { void enviar(); },
    /** começa de novo (Vitor, 21/10/2026: "deixa o botão de nova conversa") */
    novaConversa: () => { recomecar(); lerBotoes(true); },
    /** abandona a conversa e fecha o chat ("sair (abandonar)"); o × do canto só fecha */
    sair: () => { recomecar(); setAberto(false); },
    recomecar,
  };
}
