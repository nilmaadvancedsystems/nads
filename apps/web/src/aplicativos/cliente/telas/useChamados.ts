// ViewModel da aba Chamados (Vitor, 16/10/2026): a lista, abrir um novo (assunto + texto), abrir a conversa e responder.
import { areaCliente as ac } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { repoAreaCliente } from '../dados/repo';
import type { DaCasca } from './useAreaCliente';

export function useChamados({ token, area }: DaCasca) {
  const { toast } = useRetorno();
  const [abertoId, setAbertoId] = useState('');
  const [novo, setNovo] = useState(false);
  const [tipo, setTipo] = useState<ac.TipoDeChamado | ''>('');
  const [texto, setTexto] = useState('');
  const [resposta, setResposta] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const aberto = area.chamados.find(c => c.id === abertoId) ?? null;

  function comecarNovo() { setNovo(true); setAbertoId(''); setTipo(''); setTexto(''); setErro(''); }
  function abrir(id: string) { setAbertoId(id); setNovo(false); setResposta(''); }

  async function criar() {
    const problema = ac.erroDoNovoChamado(tipo, texto);
    setErro(problema);
    if (problema || !tipo) return;
    setEnviando(true);
    try {
      const id = await repoAreaCliente.abrirChamado(token, { tipo, texto });
      setNovo(false);
      if (id) { setAbertoId(id); toast('Chamado aberto. O escritório vai responder por aqui.'); }
    } finally { setEnviando(false); }
  }

  async function responder() {
    if (!aberto || !resposta.trim()) return;
    setEnviando(true);
    try {
      await repoAreaCliente.responderChamado(token, aberto.id, resposta);
      setResposta('');
    } finally { setEnviando(false); }
  }

  return {
    chamados: area.chamados, aberto, novo, comecarNovo, cancelarNovo: () => setNovo(false), abrir,
    tipos: ac.TIPOS_DE_CHAMADO, tipo, mudarTipo: (v: string) => setTipo(v as ac.TipoDeChamado | ''), texto, mudarTexto: setTexto, criar, erro,
    resposta, mudarResposta: setResposta, responder, enviando,
    aceitaResposta: !!aberto && ac.chamadoAceitaResposta(aberto),
    // a prévia de cada chamado na lista: a última mensagem e quando
    ultimaMensagem: (c: ac.ChamadoDoCliente) => c.mensagens[c.mensagens.length - 1] ?? null,
    quando: (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    rotuloDaSituacao: ac.ROTULO_DA_SITUACAO_DO_CHAMADO, rotuloDoTipo: (t: string) => ac.TIPOS_DE_CHAMADO.find(x => x.valor === t)?.rotulo ?? 'Outro assunto',
  };
}
