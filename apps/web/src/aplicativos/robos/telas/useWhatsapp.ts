// ViewModel da aba WhatsApp dos Ajustes da Central (12/11/2026): a situação do chip do robô, o QR code para conectar, o
// desconectar (com confirmação) e a mensagem de teste para o número do escritório (a trava do robô só deixa esse).
import { robos as r } from '@nads/core';
import { useState } from 'react';
import { useWhatsappDoRobo } from '../dados/repo';
import type { ComandoDoWhatsapp } from '../dados/whatsapp';
import { useQr } from '../../tarefas/telas/entregas/useQr';

const mensagemDe = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** o QR em tamanho real, sem a tela encolher (17/11/2026: encolhido para caber, a câmera do celular não lia) */
export const TAMANHO_DO_QR = 320;
const TEXTO_DO_TESTE = 'Teste do WhatsApp do nads: se esta mensagem chegou, o robô está mandando pelo chip novo.';

/** 553891383638 → (38) 9138-3638 */
export function numeroFormatado(numero: string): string {
  const d = numero.replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  return d;
}

export function useAbaWhatsapp(por: string) {
  const { situacao: w, repo } = useWhatsappDoRobo();
  const [ocupado, setOcupado] = useState('');
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [confirmarDesconectar, setConfirmarDesconectar] = useState(false);
  const [texto, setTexto] = useState(TEXTO_DO_TESTE);
  const qr = useQr(w.qr, TAMANHO_DO_QR);
  const [escolhido, setEscolhido] = useState('');
  // para quem vai o teste: um dos números que a trava deixa (o primeiro, se ninguém escolheu)
  const numeroDeTeste = w.teste.includes(escolhido) ? escolhido : w.teste[0] || '';

  async function fazer(rotulo: string, f: () => Promise<'feito' | 'na-fila'>, feito: string) {
    if (ocupado) return;
    setOcupado(rotulo);
    setAviso(null);
    try {
      const r2 = await f();
      setAviso({ ok: true, texto: r2 === 'feito' ? feito : 'Pedido na fila do robô: ele ainda não pegou (o robô da nuvem está ligado?).' });
    } catch (e) {
      setAviso({ ok: false, texto: mensagemDe(e) });
    } finally {
      setOcupado('');
    }
  }
  const comandar = (c: ComandoDoWhatsapp) => fazer(c === 'conectar' ? 'Pedindo o QR code' : 'Desconectando', () => repo.comandar(c, por),
    c === 'conectar' ? 'O robô pediu o QR code: ele aparece aqui em instantes.' : 'Desconectado: o chip saiu do robô.');

  return {
    exemplos: repo.exemplos,
    situacao: w.situacao,
    texto: r.textoDoWhatsapp(w),
    /** por que não está conectado (ou: conectado, mas o robô não dá notícia há mais de 30 minutos) */
    motivo: w.situacao === 'conectado' ? (w.pronto ? '' : 'O robô da nuvem não dá notícia há mais de 30 minutos.') : w.motivo,
    conectado: w.situacao === 'conectado',
    pronto: w.pronto,
    numero: w.numero ? numeroFormatado(w.numero) : '',
    nome: w.nome,
    desde: w.desde ? new Date(w.desde).toLocaleString('pt-BR') : '',
    /** a imagem do QR (data URL), só enquanto aguarda a leitura */
    qr: w.situacao === 'aguardando-qr' ? qr : '',
    liberado: w.liberado,
    numeroDeTeste: numeroDeTeste ? numeroFormatado(numeroDeTeste) : '',
    ocupado, aviso,
    podeConectar: !ocupado && (w.situacao === 'desconectado' || w.situacao === 'desligado'),
    conectar: () => { void comandar('conectar'); },
    pedirDesconectar: () => setConfirmarDesconectar(true),
    confirmarDesconectar,
    cancelarDesconectar: () => setConfirmarDesconectar(false),
    desconectar: () => { setConfirmarDesconectar(false); void comandar('desconectar'); },
    teste: {
      texto, escrever: setTexto,
      para: numeroDeTeste,
      numeros: w.teste.map(n => ({ valor: n, rotulo: numeroFormatado(n) })),
      escolher: setEscolhido,
      pode: !ocupado && w.pronto && !!numeroDeTeste && !!texto.trim(),
      mandar: () => { void fazer('Mandando o teste', () => repo.testar(numeroDeTeste, texto.trim(), por), 'Mandou: confira no WhatsApp de ' + numeroFormatado(numeroDeTeste) + '.'); },
    },
  };
}
