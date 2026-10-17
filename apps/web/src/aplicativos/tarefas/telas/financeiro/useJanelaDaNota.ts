// ViewModel da janela da nota (15/10/2026: "vamos criar um emissor de notas fiscais para o financeiro"): a nota ao vivo (o
// robô muda a situação enquanto a janela está aberta), copiar a chave de acesso, baixar o XML da autorizada e o pedido de
// cancelamento (o motivo da NFS-e Nacional e a justificativa de pelo menos 15 letras). Baixar a DANFSe (15/10/2026: "faz o danf
// poder ser baixado"): o PDF do documento auxiliar, desenhado aqui no navegador a partir do XML da nota autorizada.
// Enviar por e-mail (15/10/2026): o pedido ao robô (envioEmail) com o e-mail do tomador já no campo, e como foi o último envio.
import { nfse } from '@nads/core';
import { baixarArquivo, baixarBytes, useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useOperador } from '../../casca/operador';
import { dataHoraBr } from './formatosDaNota';
import { useNfse } from '../../dados/repo';

export const MINIMO_DA_JUSTIFICATIVA = 15;

export function useJanelaDaNota(id: string) {
  const repo = useNfse();
  const { toast } = useRetorno();
  const por = useOperador().operador?.nome || '';
  const nota = repo.notas().lista.find(n => n.id === id) || null;
  const [baixando, setBaixando] = useState(false);
  const [baixandoDanfse, setBaixandoDanfse] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cMotivo, setCMotivo] = useState<'1' | '2' | '9'>('1');
  const [justificativa, setJustificativa] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mandandoEmail, setMandandoEmail] = useState(false);
  const [paraEmail, setParaEmail] = useState('');
  const [avisoEmail, setAvisoEmail] = useState('');
  const [pedindoEmail, setPedindoEmail] = useState(false);

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

  /** o PDF da DANFSe v2.0: lê o XML da nota, monta os dados (core) e desenha a página (o pdf-lib e o QR só carregam aqui) */
  async function baixarDanfse() {
    if (!nota || baixandoDanfse) return;
    setBaixandoDanfse(true);
    try {
      const dados = nfse.dadosDaDanfse(await repo.xml(nota.id));
      const { desenharDanfse } = await import('./danfsePdf');
      baixarBytes(await desenharDanfse(dados), 'DANFSe-' + (nota.numeroNfse || dados.numeroNfse) + '.pdf', 'application/pdf');
    } catch (err) {
      toast('Não consegui gerar a DANFSe: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBaixandoDanfse(false);
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

  function abrirEmail() {
    if (!nota) return;
    setParaEmail(nota.tomador.email || '');
    setAvisoEmail('');
    setCancelando(false);
    setMandandoEmail(true);
  }

  /** grava o pedido (envioEmail): o robô manda a DANFSe e o XML e apaga o pedido */
  async function enviarPorEmail() {
    if (!nota || pedindoEmail) return;
    const para = paraEmail.trim();
    if (!nfse.emailValido(para)) { setAvisoEmail('Esse e-mail não parece um e-mail.'); return; }
    setPedindoEmail(true);
    try {
      await repo.enviarPorEmail(nota.id, para, por);
      toast('Pedido: o robô manda a nota para ' + para + '.');
      setMandandoEmail(false);
    } catch (err) {
      setAvisoEmail('Não consegui pedir: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setPedindoEmail(false);
    }
  }

  // a linha "E-mail": o pedido em curso, o último envio ou o erro dele
  const e = nota?.email;
  const envioDoEmail: { texto: string; erro: boolean; andando: boolean } | null = nota?.envioEmail
    ? { texto: 'Enviando para ' + nota.envioEmail.para + '…', erro: false, andando: true }
    : e?.erro ? { texto: 'Não foi' + (e.para ? ' para ' + e.para : '') + ': ' + e.erro, erro: true, andando: false }
      : e?.enviadoEm ? { texto: 'Enviada para ' + e.para + ' em ' + dataHoraBr(e.enviadoEm), erro: false, andando: false }
        : e ? { texto: 'Enviando para ' + e.para + '…', erro: false, andando: true } : null;

  return {
    nota,
    envioDoEmail,
    /** enviar por e-mail: só a autorizada, sem outro pedido em curso */
    podeEnviarEmail: nota?.status === 'autorizada' && !nota.envioEmail,
    mandandoEmail, abrirEmail, fecharEmail: () => setMandandoEmail(false),
    paraEmail, setParaEmail: (v: string) => { setParaEmail(v); setAvisoEmail(''); }, avisoEmail, pedindoEmail, enviarPorEmail,
    rotulo: nota ? nfse.rotuloDoStatus(nota.status) : null,
    andando: nota ? nfse.andando(nota.status) : false,
    /** corrigir: só a recusada; baixar o XML: só a autorizada; cancelar: a autorizada (e a que a prefeitura recusou cancelar, para tentar de novo) */
    podeCorrigir: nota?.status === 'erro',
    podeBaixar: nota?.status === 'autorizada',
    podeCancelar: nota?.status === 'autorizada' || nota?.status === 'erro-cancelamento',
    motivos: nfse.MOTIVOS_DE_CANCELAMENTO,
    copiarChave, baixarXml, baixando, baixarDanfse, baixandoDanfse,
    cancelando, abrirCancelamento: () => { setMandandoEmail(false); setCancelando(true); }, fecharCancelamento: () => setCancelando(false),
    cMotivo, setCMotivo, justificativa, setJustificativa, letras, enviando, pedirCancelamento,
    podePedirCancelamento: letras >= MINIMO_DA_JUSTIFICATIVA,
  };
}
