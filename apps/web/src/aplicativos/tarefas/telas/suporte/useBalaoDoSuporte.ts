// ViewModel do balão do suporte (Vitor, 20/10/2026): no canto de baixo, à direita, em toda tela da Tarefas. A conversa é
// guiada por cápsulas (o problema, o banco, o mês), já sabendo a empresa, o período e a tela (contextoDoSuporte), e termina
// nas instruções, diretas. "Não resolveu" (ou "Outro"): o arquivo e uma frase vão para os Feedbacks, aba Bugs, e o robô do
// PC do escritório investiga e escreve o report para o admin. As regras da conversa ficam no core (suporte).
import { suporte as s } from '@nads/core';
import { useState } from 'react';
import { useLocation } from 'react-router';
import { VERSAO_SISTEMA } from '../../../../versao';
import { useFeedback } from '../../dados/repo';
import { useOndeEsta } from './contextoDoSuporte';

/** Uma fala da conversa: a pergunta ou as instruções do suporte, e a cápsula que a pessoa escolheu. */
export interface FalaDoSuporte { passo: s.PassoDoSuporte; escolhida: string }

const ROTULO_DA_ESCOLHA: Record<string, string> = { [s.NAO_RESOLVEU]: 'Não resolveu', [s.OUTRO]: 'Outro' };

export function useBalaoDoSuporte() {
  const repo = useFeedback();
  const { pathname } = useLocation();
  const onde = useOndeEsta();
  const [aberto, setAberto] = useState(false);
  const [escolhas, setEscolhas] = useState<string[]>([]);
  const [resolvido, setResolvido] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [frase, setFrase] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
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
    aberto, abrir: () => setAberto(true), fechar: () => setAberto(false),
    /** o título: a empresa e a tela de onde a pessoa está */
    titulo: [ctx.empresa, ctx.rotuloDaTela].filter(Boolean).join(' · '),
    conversa, passo, resolvido, enviado, enviando, erro,
    escolher: (id: string) => setEscolhas(e => [...e, id]),
    resolveu: () => setResolvido(true),
    naoResolveu: () => setEscolhas(e => [...e, s.NAO_RESOLVEU]),
    arquivo, setArquivo, frase, setFrase,
    enviar: () => { void enviar(); },
    recomecar,
  };
}
