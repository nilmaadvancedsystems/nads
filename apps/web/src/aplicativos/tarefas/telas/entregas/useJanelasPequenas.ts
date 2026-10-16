// Os ViewModels das janelas pequenas da entrega de documentos (16/10/2026, a cópia fiel do Entregas): "Não esqueça de
// falar com o cliente" (Falei / Deixar pra próxima e um lembrete novo), "Assinar no celular do cliente" (o QR do link de
// uso único, que fica ouvindo e volta para a parada já com a assinatura), "Ler guia" (a câmera acha a parada pelo código
// de barras ou pelo QR do PIX da guia), a meta do mês e "Sem entrega há tempo".
import { entregas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { useEntregasDeDocumentos } from '../../dados/repo';
import { useJanelasDasEntregas } from './contextoDasJanelas';
import { quadroDoVideo } from './arquivosDaEntrega';
import { textoDoErro } from './useJanelaDaParada';

type Entrega = ReturnType<typeof entregas.entregaDoDocumento>;

/** Logo depois de concluir: os lembretes das empresas, com Falei (resolve) ou Deixar pra próxima. */
export function useJanelaDosLembretes(clientes: { id: string; nome: string }[]) {
  const repo = useEntregasDeDocumentos();
  const retorno = useRetorno();
  const janelas = useJanelasDasEntregas();
  const ativos = repo.lembretes().lista;
  // a lista do começo (resolver um não pode tirar ele da janela: vira "Falei")
  const [lista] = useState(() => {
    const vistos = new Set<string>();
    return clientes.filter(c => c.id && !vistos.has(c.id) && vistos.add(c.id)).flatMap(c => ativos.filter(l => l.clienteId === c.id).map(l => ({ l, nome: c.nome })));
  });
  const [estado, setEstado] = useState<Record<string, 'falei' | 'depois' | 'gravando'>>({});
  const [novo, setNovo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const principal = clientes[0];
  return {
    principal: principal?.nome || '',
    itens: lista.map(x => ({ id: x.l.id, texto: x.l.texto, meta: (lista.length > 1 && x.nome ? x.nome + ' · ' : '') + 'por ' + (x.l.criadoPorNome || x.l.criadoPor || 'alguém da equipe') + ' · ' + entregas.dataHoraDaEntrega(x.l.criadoEm), estado: estado[x.l.id] || '' })),
    async falei(id: string) {
      setEstado(e => ({ ...e, [id]: 'gravando' }));
      try { await repo.resolverLembrete(id); setEstado(e => ({ ...e, [id]: 'falei' })); } catch (err) {
        setEstado(e => ({ ...e, [id]: '' } as typeof e));
        retorno.aviso({ tom: 'erro', titulo: textoDoErro(err, 'Não foi possível marcar.') });
      }
    },
    depois: (id: string) => setEstado(e => ({ ...e, [id]: 'depois' })),
    novo, setNovo, salvando,
    fechar: janelas.fechar,
    async pronto() {
      const t = novo.trim();
      if (!t || !principal) { janelas.fechar(); return; }
      setSalvando(true);
      try { await repo.criarLembrete(principal.id, principal.nome, t); retorno.aviso({ tom: 'ok', titulo: 'Lembrete salvo pra próxima entrega.' }); janelas.fechar(); } catch (err) {
        retorno.aviso({ tom: 'erro', titulo: textoDoErro(err, 'Não foi possível salvar o lembrete.') });
        setSalvando(false);
      }
    },
  };
}

/** O QR para o cliente assinar no celular dele: o link vale uma vez e expira em 2 h; quando ele assina, volta pra parada. */
export function useAssinarNoCelular(entrega: Entrega) {
  const repo = useEntregasDeDocumentos();
  const retorno = useRetorno();
  const janelas = useJanelasDasEntregas();
  const [status, setStatus] = useState('Preparando o link...');
  const [link, setLink] = useState('');
  const parar = useRef<() => void>(() => undefined);
  const cliente = entrega.clienteId ? repo.clientes().lista.find(c => c.id === entrega.clienteId) : null;
  useEffect(() => {
    let vivo = true;
    const semSinal = setTimeout(() => { if (vivo) setStatus(s => (/Preparando/.test(s) ? 'Sem sinal: o link só fica pronto quando a internet voltar. Se o cliente estiver esperando, volte e colha a assinatura na tela.' : s)); }, 6000);
    const p = repo.pedirAssinaturaNoCelular(entrega, a => {
      if (!vivo) return;
      // remonta a parada já com a assinatura dentro (o quadro é novo a cada remontagem)
      janelas.abrir({ tipo: 'parada', entrega, assinatura: a });
      retorno.aviso({ tom: 'ok', titulo: 'Cliente assinou. Confira e confirme a entrega.' });
    }, m => { if (vivo) setStatus(m || 'Não foi possível preparar o link.'); });
    parar.current = p.parar;
    setLink(p.link);
    p.pronto.then(() => { clearTimeout(semSinal); if (vivo) setStatus('Esperando o cliente assinar...'); }, () => clearTimeout(semSinal));
    return () => { vivo = false; clearTimeout(semSinal); p.parar(); };
    // um link por abertura da janela
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrega.id]);
  const pronto = /Esperando/.test(status);
  return {
    nome: entrega.clienteNome,
    status, link: pronto ? link : '',
    voltar() { parar.current(); janelas.abrir({ tipo: 'parada', entrega }); },
    async copiar() { try { await navigator.clipboard.writeText(link); retorno.aviso({ tom: 'ok', titulo: 'Link copiado.' }); } catch { janelas.abrir({ tipo: 'copiar', titulo: 'Link para o cliente assinar', texto: link }); } },
    whatsapp() { window.open(entregas.linkDoWhatsApp('Assine o recebimento dos documentos aqui (o link vale 2 horas): ' + link, cliente?.telefone || ''), '_blank'); },
  };
}

interface Detector { detect(fonte: unknown): Promise<{ rawValue: string }[]> }
type DetectorConstrutor = new (o: { formats: string[] }) => Detector;
const CHAVE_CAMERA = 'nilma_camera_guia';
/** Este navegador sabe ler código de barras (Chrome no Android)? Só então o botão "Ler guia" aparece. */
export const sabeLerGuia = () => typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;

/** A câmera lê a guia de papel e abre a confirmação daquela parada (só acha guia montada com o PDF). */
export function useLerGuia(video: React.RefObject<HTMLVideoElement | null>) {
  const repo = useEntregasDeDocumentos();
  const janelas = useJanelasDasEntregas();
  const [status, setStatus] = useState('Abrindo a câmera…');
  const [diag, setDiag] = useState('');
  const [lanterna, setLanterna] = useState<null | boolean>(null);
  const [podeTrocar, setPodeTrocar] = useState(false);
  const estado = useRef<{ fluxo: MediaStream | null; relogio: number; fechado: boolean; trilha: MediaStreamTrack | null; pode: Record<string, unknown>; cameras: MediaDeviceInfo[]; i: number; ocupado: boolean }>({
    fluxo: null, relogio: 0, fechado: false, trilha: null, pode: {}, cameras: [], i: 0, ocupado: false,
  });
  const acoes = useRef({ lerDaFoto: () => {}, trocar: () => {}, tocarVideo: () => {} });
  const pendentes = repo.naRota().lista;
  const pendentesRef = useRef(pendentes);
  pendentesRef.current = pendentes;

  useEffect(() => {
    const s = estado.current;
    s.fechado = false;
    const Construtor = (window as unknown as { BarcodeDetector?: DetectorConstrutor }).BarcodeDetector;
    if (!Construtor) { setStatus('Este navegador não lê código de barras.'); return; }
    const leitor = new Construtor({ formats: ['itf', 'qr_code'] });
    const dizer = (t: string) => { if (!s.fechado) setStatus(t); };
    const parar = () => { clearInterval(s.relogio); s.fluxo?.getTracks().forEach(t => t.stop()); s.fluxo = null; };
    const achou = (bruto: string) => {
      const e = entregas.paradaDoCodigo(bruto, pendentesRef.current);
      if (!e) { dizer('Li o código, mas essa guia não está na rota (ou foi montada sem o PDF).'); return; }
      s.fechado = true;
      parar();
      try { navigator.vibrate?.(80); } catch { /* sem vibrar */ }
      janelas.abrir({ tipo: 'parada', entrega: e });
    };
    const focar = (modo: string) => {
      const f = s.pode.focusMode as string[] | undefined;
      if (!s.trilha || !f || !f.includes(modo)) return;
      s.trilha.applyConstraints({ advanced: [{ focusMode: modo } as MediaTrackConstraintSet] }).catch(() => undefined);
    };
    const abrir = async (deviceId: string | null) => {
      parar();
      const v: MediaTrackConstraints & { advanced?: MediaTrackConstraintSet[] } = { width: { ideal: 1920 }, height: { ideal: 1080 }, advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] };
      if (deviceId) v.deviceId = { exact: deviceId }; else v.facingMode = { ideal: 'environment' };
      const f = await navigator.mediaDevices.getUserMedia({ video: v });
      if (s.fechado) { f.getTracks().forEach(t => t.stop()); return; }
      s.fluxo = f;
      const el = video.current;
      if (el) { el.srcObject = f; void el.play(); }
      s.trilha = f.getVideoTracks()[0] || null;
      try { s.pode = (s.trilha?.getCapabilities?.() as Record<string, unknown>) || {}; } catch { s.pode = {}; }
      focar('continuous');
      const cfg = (s.trilha?.getSettings?.() || {}) as MediaTrackSettings;
      const zoom = s.pode.zoom as { max?: number } | undefined;
      setDiag([(cfg.width || '?') + '×' + (cfg.height || '?'), 'foco: ' + (Array.isArray(s.pode.focusMode) ? (s.pode.focusMode as string[]).join('/') : 'não informado'),
        zoom ? 'zoom até ' + zoom.max + '×' : 'sem zoom', s.pode.torch ? 'lanterna' : 'sem lanterna'].join(' · '));
      setLanterna(s.pode.torch ? false : null);
      dizer('Procurando o código… se não pegar, toque em "Focar e ler".');
      s.relogio = window.setInterval(() => {
        const vv = video.current;
        if (!vv || vv.readyState < 2 || s.ocupado) return;
        s.ocupado = true;
        leitor.detect(vv).then(a => { s.ocupado = false; if (a.length && !s.fechado) achou(a[0].rawValue); }, () => { s.ocupado = false; });
      }, 350);
    };
    const lembrada = (() => { try { return localStorage.getItem(CHAVE_CAMERA) || ''; } catch { return ''; } })();
    (lembrada ? abrir(lembrada).catch(() => abrir(null)) : abrir(null)).then(async () => {
      if (s.fechado || !navigator.mediaDevices.enumerateDevices) return;
      // celular com várias câmeras traseiras costuma abrir na grande-angular, que não foca de perto: dá pra trocar
      s.cameras = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
      const emUso = (s.trilha?.getSettings?.() || {}).deviceId || '';
      s.cameras.forEach((d, i) => { if (d.deviceId === emUso) s.i = i; });
      if (s.cameras.length > 1) { setDiag(d => d + ' · câmera ' + (s.i + 1) + ' de ' + s.cameras.length); setPodeTrocar(true); }
    }).catch(() => dizer('Não consegui abrir a câmera. Confira a permissão do navegador.'));
    acoes.current.lerDaFoto = () => {
      if (!s.trilha || s.fechado) return;
      dizer('Focando e tirando a foto…');
      focar('single-shot');
      setTimeout(() => {
        if (s.fechado) return;
        const vv = video.current;
        const comImagem = (img: unknown) => leitor.detect(img).then(a => {
          if (s.fechado) return;
          if (!a.length) { dizer('Não consegui ler nessa foto. Encoste mais na guia e toque de novo.'); focar('continuous'); return; }
          achou(a[0].rawValue);
        }, () => dizer('Não consegui ler nessa foto. Tente de novo.'));
        const porCanvas = () => { if (vv) void comImagem(quadroDoVideo(vv)); };
        const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto(): Promise<Blob> } }).ImageCapture;
        if (IC && s.trilha) new IC(s.trilha).takePhoto().then(b => createImageBitmap(b)).then(comImagem, porCanvas);
        else porCanvas();
      }, 900);
    };
    acoes.current.trocar = () => {
      if (s.cameras.length < 2) return;
      s.i = (s.i + 1) % s.cameras.length;
      dizer('Trocando de câmera…');
      const id = s.cameras[s.i].deviceId;
      abrir(id).then(() => { try { localStorage.setItem(CHAVE_CAMERA, id); } catch { /* nada */ } }, () => dizer('Essa câmera não abriu. Toque de novo pra tentar a próxima.'));
    };
    acoes.current.tocarVideo = () => { focar('single-shot'); setTimeout(() => focar('continuous'), 1200); };
    return () => { s.fechado = true; parar(); };
  }, [video, janelas]);

  return {
    status, diag, lanterna, podeTrocar,
    lerDaFoto: () => acoes.current.lerDaFoto(),
    trocar: () => acoes.current.trocar(),
    tocarVideo: () => acoes.current.tocarVideo(),
    alternarLanterna() {
      const s = estado.current;
      if (!s.trilha) return;
      const acesa = !lanterna;
      s.trilha.applyConstraints({ advanced: [{ torch: acesa } as MediaTrackConstraintSet] }).then(() => setLanterna(acesa), () => setLanterna(false));
    },
    fechar: janelas.fechar,
  };
}

/** A meta do mês (config/metas): entregas confirmadas por pessoa; vazio ou zero tira a meta. */
export function useJanelaDaMeta() {
  const repo = useEntregasDeDocumentos();
  const retorno = useRetorno();
  const janelas = useJanelasDasEntregas();
  const [valor, setValor] = useState(() => String(repo.metaPorPessoa() || ''));
  const [salvando, setSalvando] = useState(false);
  return {
    valor, setValor, salvando, fechar: janelas.fechar,
    async salvar() {
      const n = parseInt(valor, 10) || 0;
      setSalvando(true);
      try { await repo.salvarMeta(n); retorno.aviso({ tom: 'ok', titulo: n ? 'Meta salva: ' + n + ' por pessoa.' : 'Meta removida.' }); janelas.fechar(); } catch (err) {
        retorno.aviso({ tom: 'erro', titulo: textoDoErro(err, 'Não foi possível salvar a meta.') });
        setSalvando(false);
      }
    },
  };
}

/** Os clientes do Entregas sem entrega confirmada nas últimas 3 competências: clicar abre o cliente. */
export function useJanelaSemEntrega(ids: string[]) {
  const repo = useEntregasDeDocumentos();
  const janelas = useJanelasDasEntregas();
  const porId = new Map(repo.clientes().lista.map(c => [c.id, c]));
  const lista = ids.map(id => porId.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
  return {
    lista: lista.map(c => ({ id: c.id, nome: entregas.rotuloDoCliente(c) })),
    abrir: (id: string) => janelas.abrir({ tipo: 'cliente', clienteId: id, consulta: false }),
    fechar: janelas.fechar,
  };
}

export function useJanelaParaCopiar() {
  return { fechar: useJanelasDasEntregas().fechar };
}
