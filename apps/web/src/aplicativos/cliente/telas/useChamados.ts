// ViewModel de Solicitações e chamados (Vitor, 16/10/2026): a abertura rápida (assunto, prioridade, o texto e um anexo),
// o histórico, a conversa e a resposta. A prioridade e o nome do anexo vão no fim do texto; o anexo segue pelo Enviar.
import { areaCliente as ac } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { repoAreaCliente } from '../dados/repo';
import { textoDoChamado } from '../dados/regras';
import type { DaCasca } from './useAreaCliente';
import { comMime } from './useEnviar';

export const PRIORIDADES = ['Normal', 'Alta', 'Urgente'];

export function useChamados({ token, area }: DaCasca) {
  const { toast } = useRetorno();
  const [abertoId, setAbertoId] = useState('');
  const [tipo, setTipo] = useState<ac.TipoDeChamado | ''>('');
  const [prioridade, setPrioridade] = useState('Normal');
  const [texto, setTexto] = useState('');
  const [anexo, setAnexo] = useState<File | null>(null);
  const [resposta, setResposta] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const aberto = area.chamados.find(c => c.id === abertoId) ?? null;

  async function criar() {
    const problema = ac.erroDoNovoChamado(tipo, texto) || (anexo ? ac.erroDoEnvio({ nome: anexo.name, tamanho: anexo.size }) : '');
    setErro(problema);
    if (problema || !tipo) return;
    setEnviando(true);
    try {
      if (anexo) await repoAreaCliente.enviar(token, 'outro', [comMime(anexo)]);
      const id = await repoAreaCliente.abrirChamado(token, { tipo, texto: textoDoChamado(texto, prioridade, anexo?.name ?? '') });
      if (id) {
        setAbertoId(id); setTipo(''); setTexto(''); setPrioridade('Normal'); setAnexo(null);
        toast('Chamado aberto. O escritório vai responder por aqui.');
      }
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
    chamados: area.chamados, aberto, abrir: (id: string) => { setAbertoId(id); setResposta(''); }, fecharConversa: () => setAbertoId(''),
    tipos: ac.TIPOS_DE_CHAMADO, tipo, mudarTipo: (v: string) => setTipo(v as ac.TipoDeChamado | ''),
    prioridades: PRIORIDADES, prioridade, mudarPrioridade: setPrioridade,
    limite: ac.LIMITE_DO_ENVIO,
    texto, mudarTexto: setTexto, anexo, mudarAnexo: setAnexo, aceitar: ac.ACEITAR_NO_CAMPO,
    criar, erro, resposta, mudarResposta: setResposta, responder, enviando,
    aceitaResposta: !!aberto && ac.chamadoAceitaResposta(aberto),
    rotuloDaSituacao: ac.ROTULO_DA_SITUACAO_DO_CHAMADO, rotuloDoTipo: (t: string) => ac.TIPOS_DE_CHAMADO.find(x => x.valor === t)?.rotulo ?? 'Outro assunto',
    // a prévia de cada chamado na lista: a última mensagem e quando
    ultimaMensagem: (c: ac.ChamadoDoCliente) => c.mensagens[c.mensagens.length - 1] ?? null,
    abertoEm: (c: ac.ChamadoDoCliente) => c.mensagens[0] ? new Date(c.mensagens[0].em).toLocaleDateString('pt-BR') : '',
    quando: (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
  };
}
