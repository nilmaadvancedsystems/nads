// ViewModel da janela da nota (15/10/2026: "vamos criar um emissor de notas fiscais para o financeiro"): a nota ao vivo (o
// robô muda a situação enquanto a janela está aberta), copiar a chave de acesso, baixar o XML da autorizada e o pedido de
// cancelamento (o motivo da NFS-e Nacional e a justificativa de pelo menos 15 letras).
import { nfse } from '@nads/core';
import { baixarArquivo, useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useOperador } from '../../casca/operador';
import { useNfse } from '../../dados/repo';

export const MINIMO_DA_JUSTIFICATIVA = 15;

export function useJanelaDaNota(id: string) {
  const repo = useNfse();
  const { toast } = useRetorno();
  const por = useOperador().operador?.nome || '';
  const nota = repo.notas().lista.find(n => n.id === id) || null;
  const [baixando, setBaixando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cMotivo, setCMotivo] = useState<'1' | '2' | '9'>('1');
  const [justificativa, setJustificativa] = useState('');
  const [enviando, setEnviando] = useState(false);

  const letras = justificativa.trim().length;

  async function copiarChave() {
    if (!nota?.chaveAcesso) return;
    try {
      await navigator.clipboard.writeText(nota.chaveAcesso);
      toast('Chave de acesso copiada.');
    } catch {
      toast('Não consegui copiar: selecione a chave e copie.');
    }
  }

  async function baixarXml() {
    if (!nota || baixando) return;
    setBaixando(true);
    try {
      const xml = await repo.xml(nota.id);
      baixarArquivo(xml, (nota.chaveAcesso || 'nfse-' + nota.numeroNfse) + '.xml', 'application/xml');
    } catch (err) {
      toast('Não consegui baixar o XML: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBaixando(false);
    }
  }

  async function pedirCancelamento() {
    if (!nota || enviando || letras < MINIMO_DA_JUSTIFICATIVA) return;
    setEnviando(true);
    try {
      await repo.cancelar(nota.id, cMotivo, justificativa.trim(), por);
      toast('Cancelamento pedido: o robô cancela na prefeitura.');
      setCancelando(false);
      setJustificativa('');
    } catch (err) {
      toast('Não consegui pedir o cancelamento: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setEnviando(false);
    }
  }

  return {
    nota,
    rotulo: nota ? nfse.rotuloDoStatus(nota.status) : null,
    andando: nota ? nfse.andando(nota.status) : false,
    /** corrigir: só a recusada; baixar o XML: só a autorizada; cancelar: a autorizada (e a que a prefeitura recusou cancelar, para tentar de novo) */
    podeCorrigir: nota?.status === 'erro',
    podeBaixar: nota?.status === 'autorizada',
    podeCancelar: nota?.status === 'autorizada' || nota?.status === 'erro-cancelamento',
    motivos: nfse.MOTIVOS_DE_CANCELAMENTO,
    copiarChave, baixarXml, baixando,
    cancelando, abrirCancelamento: () => setCancelando(true), fecharCancelamento: () => setCancelando(false),
    cMotivo, setCMotivo, justificativa, setJustificativa, letras, enviando, pedirCancelamento,
    podePedirCancelamento: letras >= MINIMO_DA_JUSTIFICATIVA,
  };
}
