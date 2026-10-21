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

/** Uma fala da conversa: a pergunta ou as instruções do suporte, e a cápsula que a pessoa escolheu. */
export interface FalaDoSuporte { passo: s.PassoDoSuporte; escolhida: string }

const ROTULO_DA_ESCOLHA: Record<string, string> = { [s.NAO_RESOLVEU]: 'Não resolveu', [s.OUTRO]: 'Outro' };

// o chat é temporário (Vitor, 21/10/2026: "sistema de chat temporário, que depois de 1 dia é excluído"): a conversa fica
// só neste navegador e some 1 dia depois de começar (o bug enviado continua nos Feedbacks)
const CHAVE = 'nads-suporte-chat';
const DURA_MS = 24 * 3600 * 1000;
interface ChatGuardado { comecou: number; escolhas: string[]; resolvido: boolean; enviado: boolean }
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
  const [aberto, setAberto] = useState(false);
  const [guardado] = useState(lerChat);
  const [comecou, setComecou] = useState(() => guardado?.comecou ?? 0);
  const [escolhas, setEscolhas] = useState<string[]>(() => guardado?.escolhas ?? []);
  const [resolvido, setResolvido] = useState(() => guardado?.resolvido ?? false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [frase, setFrase] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(() => guardado?.enviado ?? false);
  // guarda a conversa (com a hora em que começou); vazia, apaga
  useEffect(() => {
    try {
      if (!escolhas.length && !resolvido && !enviado) localStorage.removeItem(CHAVE);
      else localStorage.setItem(CHAVE, JSON.stringify({ comecou: comecou || Date.now(), escolhas, resolvido, enviado } satisfies ChatGuardado));
    } catch { /* sem localStorage: fica só na tela */ }
  }, [comecou, escolhas, resolvido, enviado]);
  const [erro, setErro] = useState('');

  const rotuloDaTela = onde ? onde.aba || onde.etapa : '';
  const ctx: s.ContextoDoSuporte = {
    tela: s.telaPeloRotulo(rotuloDaTela), rotuloDaTela: rotuloDaTela || 'Tarefas',
    empresa: onde?.empresa || '', codigo: onde?.codigo ?? null, meses: onde?.meses || [], bancos: onde?.bancos || [],
  };
  const passo = s.passoDoSuporte(ctx, escolhas);
  // o que já foi conversado: cada passo de antes e a cápsula escolhida nele
  const conversa: FalaDoSuporte[] = escolhas.map((e, i) => {
    const antes = s.passoDoSuporte(ctx, escolhas.slice(0, i));
    const rotulo = ROTULO_DA_ESCOLHA[e] || (antes.tipo === 'pergunta' ? antes.opcoes.find(o => o.id === e)?.rotulo : '') || e;
    return { passo: antes, escolhida: rotulo };
  });

  function recomecar() {
    setComecou(0);
    setEscolhas([]); setResolvido(false); setArquivo(null); setFrase(''); setEnviado(false); setErro('');
  }

  async function enviar() {
    if (!arquivo && !frase.trim()) { setErro('Anexe o arquivo ou escreva o que está errado.'); return; }
    setEnviando(true); setErro('');
    try {
      const caminho = s.caminhoDaConversa(ctx, escolhas);
      const bytes = arquivo ? new Uint8Array(await arquivo.arrayBuffer()) : null;
      await repo.enviarBug({
        texto: (frase.trim() || caminho).slice(0, 4000),
        tela: pathname + (rotuloDaTela ? ' · ' + [onde?.etapa, onde?.aba].filter(Boolean).join(' › ') : ''),
        versao: VERSAO_SISTEMA, caminho,
        contexto: { empresa: ctx.empresa, codigo: ctx.codigo, tela: ctx.rotuloDaTela, meses: ctx.meses },
        arquivo: arquivo && bytes ? { nome: arquivo.name, bytes } : null,
      });
      setEnviado(true);
    } catch (e) {
      setErro('Não consegui enviar: ' + (e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return {
    // sem o "Nova conversa" (Vitor, 21/10/2026): a conversa que terminou (resolveu ou foi enviada) recomeça ao abrir de novo
    aberto, abrir: () => { if (resolvido || enviado) recomecar(); setAberto(true); }, fechar: () => setAberto(false),
    /** o título: a empresa e a tela de onde a pessoa está */
    titulo: [ctx.empresa, ctx.rotuloDaTela].filter(Boolean).join(' · '),
    conversa, passo, resolvido, enviado, enviando, erro,
    escolher: (id: string) => { if (!comecou) setComecou(Date.now()); setEscolhas(e => [...e, id]); },
    resolveu: () => setResolvido(true),
    naoResolveu: () => setEscolhas(e => [...e, s.NAO_RESOLVEU]),
    arquivo, setArquivo, frase, setFrase,
    enviar: () => { void enviar(); },
    recomecar,
  };
}
