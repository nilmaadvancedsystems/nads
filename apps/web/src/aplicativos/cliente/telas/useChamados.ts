// ViewModel das Solicitações da Área do Cliente (Vitor, 16/10/2026): pedir algo ao escritório (o assunto e o texto) e as
// conversas (abrir e responder). O telefone e o WhatsApp ficam só na janela "Fale com o escritório".
import { areaCliente as ac } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { repoAreaCliente } from '../dados/repo';
import type { DaCasca } from './useAreaCliente';

export function useChamados({ token, area }: DaCasca) {
  const { toast } = useRetorno();
  const [abertoId, setAbertoId] = useState('');
  const [tipo, setTipo] = useState<ac.TipoDeChamado | ''>('');
  const [texto, setTexto] = useState('');
  const [resposta, setResposta] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const aberto = area.chamados.find(c => c.id === abertoId) ?? null;

  async function mandar() {
    const problema = ac.erroDoNovoChamado(tipo, texto);
    setErro(problema);
    if (problema || !tipo) return;
    setEnviando(true);
    try {
      const id = await repoAreaCliente.abrirChamado(token, { tipo, texto });
      if (id) { setTipo(''); setTexto(''); setAbertoId(id); toast('Pedido enviado. O escritório responde por aqui.'); }
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
    tipos: ac.TIPOS_DE_CHAMADO, tipo, mudarTipo: (v: string) => setTipo(v as ac.TipoDeChamado | ''),
    texto, mudarTexto: setTexto, mandar, erro, enviando,
    chamados: area.chamados, aberto, alternar: (id: string) => { setAbertoId(a => (a === id ? '' : id)); setResposta(''); },
    resposta, mudarResposta: setResposta, responder,
    aceitaResposta: !!aberto && ac.chamadoAceitaResposta(aberto),
    situacao: (c: ac.ChamadoDoCliente) => ac.ROTULO_DA_SITUACAO_DO_CHAMADO[c.situacao],
    ultimaMensagem: (c: ac.ChamadoDoCliente) => c.mensagens[c.mensagens.length - 1] ?? null,
    quando: (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
  };
}
