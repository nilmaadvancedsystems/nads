// ViewModel da aba WhatsApp dos Ajustes da Central (12/11/2026): a situação do chip do robô, o QR code para conectar, o
// desconectar (com confirmação) e a mensagem de teste para o número do escritório (a trava do robô só deixa esse).
// Desde 27/11/2026 (pronto para o chip): as chaves do que o robô faz pelo WhatsApp, gravadas depois da confirmação com o
// "de → para" (ligar a trava pede uma confirmação de perigo), e as respostas dos clientes dos últimos 7 dias, lidas quando
// a pessoa pede.
import { robos as r } from '@nads/core';
import { useEffect, useState } from 'react';
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

  // as chaves: as gravadas e o rascunho da tela
  const [salvas, setSalvas] = useState<r.ChavesDoWhatsapp | null>(null);
  const [rascunho, setRascunho] = useState<r.ChavesDoWhatsapp | null>(null);
  const [erroDasChaves, setErroDasChaves] = useState('');
  const [confirmarChaves, setConfirmarChaves] = useState(false);
  const [gravandoChaves, setGravandoChaves] = useState(false);
  // os números de teste a mais como a pessoa digita (separados por vírgula); viram lista no rascunho
  const [textoDosNumeros, setTextoDosNumeros] = useState('');
  useEffect(() => {
    let vivo = true;
    repo.chaves().then(c => { if (vivo) { setSalvas(c); setRascunho(c); setTextoDosNumeros(c.numerosDeTeste.map(numeroFormatado).join(', ')); } }, e => { if (vivo) setErroDasChaves(mensagemDe(e)); });
    return () => { vivo = false; };
  }, [repo]);
  const mudancas = salvas && rascunho ? r.mudancasDasChaves(salvas, rascunho) : [];
  async function gravarChaves() {
    if (!rascunho || gravandoChaves) return;
    setGravandoChaves(true);
    setErroDasChaves('');
    try {
      await repo.gravarChaves(rascunho, por);
      // relê para mostrar quem gravou e quando (e o que o banco guardou de fato)
      const gravadas = await repo.chaves().catch(() => rascunho);
      setSalvas(gravadas);
      setRascunho(gravadas);
      setConfirmarChaves(false);
    } catch (e) {
      const m = mensagemDe(e);
      setErroDasChaves(/permission|insufficient/i.test(m) ? 'O banco não deixou: só o administrador grava as chaves.' : m);
    } finally {
      setGravandoChaves(false);
    }
  }

  // as respostas: uma leitura quando a pessoa pede
  const [respostas, setRespostas] = useState<r.RespostaRecebida[] | null>(null);
  const [lendoRespostas, setLendoRespostas] = useState(false);
  const [erroDasRespostas, setErroDasRespostas] = useState('');
  async function lerRespostas() {
    if (lendoRespostas) return;
    setLendoRespostas(true);
    setErroDasRespostas('');
    try { setRespostas(await repo.respostas()); } catch (e) { setErroDasRespostas(mensagemDe(e)); } finally { setLendoRespostas(false); }
  }

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
    chaves: {
      carregadas: !!rascunho,
      erro: erroDasChaves,
      lista: r.CHAVES_DO_WHATSAPP.map(c => ({ ...c, ligada: !!rascunho?.[c.chave], mudou: !!rascunho && !!salvas && rascunho[c.chave] !== salvas[c.chave] })),
      trocar: (chave: r.ChaveDoWhatsapp) => setRascunho(c => (c ? { ...c, [chave]: !c[chave] } : c)),
      empresaDeTeste: rascunho?.empresaDeTeste ?? '',
      escreverEmpresa: (v: string) => setRascunho(c => (c ? { ...c, empresaDeTeste: v.replace(/\D/g, '').slice(0, 8) } : c)),
      numerosDeTeste: textoDosNumeros,
      escreverNumeros: (v: string) => {
        setTextoDosNumeros(v);
        setRascunho(c => (c ? { ...c, numerosDeTeste: v.split(/[,;\n]/).map(x => x.trim()).filter(Boolean) } : c));
      },
      maxNumeros: r.MAX_NUMEROS_DE_TESTE,
      gravadoPor: salvas?.atualizadoPor ? salvas.atualizadoPor + (salvas.atualizadoEm ? ' em ' + new Date(salvas.atualizadoEm).toLocaleString('pt-BR') : '') : '',
      mudancas,
      /** a trava vai abrir: a confirmação é de perigo */
      liberando: !!rascunho?.liberado && !salvas?.liberado,
      pode: mudancas.length > 0 && !gravandoChaves,
      desfazer: () => { setRascunho(salvas); setTextoDosNumeros(salvas ? salvas.numerosDeTeste.map(numeroFormatado).join(', ') : ''); },
      pedirGravar: () => setConfirmarChaves(true),
      confirmar: confirmarChaves,
      cancelar: () => { setConfirmarChaves(false); setErroDasChaves(''); },
      gravar: () => { void gravarChaves(); },
      gravando: gravandoChaves,
    },
    respostas: {
      lidas: respostas !== null,
      lendo: lendoRespostas,
      erro: erroDasRespostas,
      lista: (respostas || []).map(x => ({
        id: x.id,
        empresa: x.empresa,
        detalhe: [x.origem, x.numero, x.teste ? 'teste' : ''].filter(Boolean).join(' · '),
        quando: x.quando ? new Date(x.quando).toLocaleString('pt-BR') : '',
        ultima: x.ultima,
        escritorio: x.pedeEscritorio,
        todas: x.respostas.length > 1 ? x.respostas.map(r.textoDaResposta) : [],
      })),
      ler: () => { void lerRespostas(); },
    },
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
