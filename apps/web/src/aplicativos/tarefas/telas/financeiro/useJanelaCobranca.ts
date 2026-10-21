// ViewModel da janela Cobrar (21/10/2026, Honorários): a mensagem pronta do modelo do core (nome, competência, valor e a
// chave PIX do escritório, lida de config/escritorio do Entregas), editável; o telefone do cliente (o WhatsApp do cadastro do
// nads ou o do Entregas; se não houver, digita-se); o link do WhatsApp; copiar a mensagem. Mandar (abrir o WhatsApp ou
// copiar) registra a cobrança no contrato (cobrancas.AAAA-MM) e a linha passa a mostrar "Cobrado em".
import { financeiro } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useOperador } from '../../casca/operador';
import { contatosDoEntregas, repoDoCadastro } from '../../dados/fonte';
import { useEntregasDeDocumentos, useHonorarios } from '../../dados/repo';
import { foneSoDigitos } from './formatosDaNota';

export function useJanelaCobranca(contratoId: string, competencia: string, fechar: () => void) {
  const repo = useHonorarios();
  const { toast } = useRetorno();
  const operador = useOperador().operador?.nome || '';
  const contrato = repo.contratos().lista.find(c => c.id === contratoId);
  const pix = useEntregasDeDocumentos().escritorio().pixChave;
  const [fone, setFone] = useState('');
  // se o texto foi mexido à mão, deixa de acompanhar o modelo (a chave PIX chega depois de a janela abrir)
  const [editado, setEditado] = useState<string | null>(null);
  const [lendo, setLendo] = useState(true);

  const codigo = contrato ? Number(contrato.codigo) : NaN;
  const nome = contrato?.nome ?? '';
  useEffect(() => {
    let vale = true;
    const cod = Number.isInteger(codigo) ? codigo : null;
    void Promise.all([contatosDoEntregas(), repoDoCadastro().obter(nome, cod)]).then(([contatos, cad]) => {
      if (!vale) return;
      setFone(foneSoDigitos(cad.contato?.whatsapp || (cod != null ? contatos.get(cod)?.whatsapp : '') || ''));
    }).catch(() => undefined).finally(() => { if (vale) setLendo(false); });
    return () => { vale = false; };
  }, [codigo, nome]);

  const gerada = contrato ? financeiro.mensagemDeCobranca({ nome: contrato.nome, competencia, valor: contrato.valor, pix }) : '';
  const texto = editado ?? gerada;
  const link = financeiro.linkDoWhatsapp(fone, texto);

  async function registrar() {
    try { await repo.registrarCobranca(contratoId, competencia, operador); } catch (e) { toast('Não consegui registrar a cobrança. ' + (e instanceof Error ? e.message : '')); }
  }

  return {
    contrato, texto, setTexto: setEditado, voltarAoModelo: () => setEditado(null), editado: editado !== null,
    fone, setFone, lendo, link, temPix: !!pix.trim(),
    /** o WhatsApp foi aberto pelo link: registra a cobrança */
    aoAbrirWhatsapp: () => { void registrar(); fechar(); },
    copiar() {
      void navigator.clipboard.writeText(texto).then(() => { toast('Mensagem copiada.'); void registrar(); }, () => toast('Não consegui copiar; selecione o texto e copie.'));
    },
  };
}
