// Os ViewModels das janelas que a página do cliente abre (16/10/2026, a cópia fiel do Entregas): a entrega feita
// (renderHistoricoDetail: os documentos, o comprovante — a assinatura, a foto e as guias da pasta, para salvar —, quem
// recebeu, quem entregou, quando, onde; Enviar comprovante, Imprimir e Excluir), Corrigir localização ("Estou no local
// agora" ou "mesmo local de outro cliente", e a região), Aglutinar com outra empresa e o Link do cliente (criar, mandar,
// copiar, ver como o cliente vê, trocar quando vazou). Assinatura e foto são dado de cliente: abrir e baixar ficam na
// auditoria.
import { entregas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useMemo, useState } from 'react';
import { useOperador } from '../../casca/operador';
import { useEntregasDeDocumentos } from '../../dados/repo';
import type { ComprovanteDaEntrega, GuiaAnexada } from '../../dados/entregasDeDocumentos';
import { baixarDataUrl } from './arquivosDaEntrega';
import { useJanelasDasEntregas, type JanelaDaEntrega } from './contextoDasJanelas';
import { abrirAbaDoPapel, escreverNaAba, protocoloDeEntregas } from './papeisParaImprimir';
import { textoDoErro } from './useJanelaDaParada';

type Entrega = ReturnType<typeof entregas.entregaDoDocumento>;
type Geo = NonNullable<ReturnType<typeof entregas.geoDoBanco>>;

export function useJanelaDaEntrega(e: Entrega, nome: string, clienteId: string | null, voltar: JanelaDaEntrega | null) {
  const repo = useEntregasDeDocumentos();
  const retorno = useRetorno();
  const janelas = useJanelasDasEntregas();
  const { operador } = useOperador();
  const quem = repo.quem();
  const [anexos, setAnexos] = useState<ComprovanteDaEntrega | null>(null);
  const [guias, setGuias] = useState<GuiaAnexada[]>([]);
  const cliente = clienteId ? repo.clientes().lista.find(c => c.id === clienteId) : null;
  const rotuloComp = entregas.rotuloDaCompetencia(e.competencia);
  useEffect(() => {
    let vivo = true;
    repo.comprovante(e.id).then(a => {
      if (!vivo) return;
      setAnexos(a);
      if (a.assinatura || a.foto) repo.registrarAuditoria('comprovante_aberto', nome + ' · ' + rotuloComp);
    }, () => { if (vivo) setAnexos({ assinatura: '', foto: '' }); });
    repo.guiasAnexadas(e.id).then(g => { if (vivo) setGuias(g); }, () => undefined);
    return () => { vivo = false; };
  }, [e.id, nome, rotuloComp, repo]);
  const total = entregas.totalDosItens(e.itens);
  const fechar = () => (voltar ? janelas.abrir(voltar) : janelas.fechar());
  return {
    nome, competencia: rotuloComp,
    fichas: e.itens.map(entregas.fichaDoItem),
    semComprovante: e.semComprovante ? e.motivoSemComprovante || 'motivo não informado' : '',
    falha: e.status === 'falha' ? e.motivoFalha || 'não entregue' : '',
    localDivergente: e.localDivergente ? 'Confirmada a ' + (e.distanciaDoClienteKm ? Math.round(e.distanciaDoClienteKm * 1000) + ' m' : 'certa distância') + ' de onde o cliente fica — provavelmente registrada depois, fora do local.' : '',
    anexos, guias,
    dados: [
      ...(total > 0 ? [['Total', entregas.dinheiro(total)]] : []),
      ['Recebido por', e.recebedor || 'não informado'], ['Entregue por', e.entregadoPorNome || e.entregadoPor || 'não informado'], ['Data/hora', entregas.dataHoraDaEntrega(entregas.quandoFoi(e))],
    ] as [string, string][],
    mapa: e.geo ? 'https://maps.google.com/?q=' + e.geo.lat + ',' + e.geo.lng : '',
    podeExcluir: entregas.podeExcluir(e, { admin: !!operador?.admin || !!quem?.papeis.includes('admin'), email: quem?.email || '' }),
    fechar,
    salvar(tipo: 'assinatura' | 'foto') {
      const url = anexos?.[tipo];
      if (!url) return;
      repo.registrarAuditoria('comprovante_baixado', nome + ' · ' + rotuloComp + ' · ' + tipo);
      baixarDataUrl(url, 'entrega-' + e.id + '-' + tipo + '.' + (tipo === 'assinatura' ? 'png' : 'jpg'));
    },
    baixarGuia(g: GuiaAnexada) {
      if (!g.pdf) return;
      repo.registrarAuditoria('guia_baixada', nome + ' · ' + rotuloComp + ' · ' + (g.nome || g.tipo));
      baixarDataUrl('data:application/pdf;base64,' + g.pdf, g.nome || 'guia-' + g.tipo + '.pdf');
    },
    async imprimir() {
      const aba = abrirAbaDoPapel();
      if (!aba) { retorno.aviso({ tom: 'erro', titulo: 'O navegador bloqueou a nova aba. Permita pop-ups para este site.' }); return; }
      const a = e.temAssinatura ? (anexos?.assinatura || (await repo.comprovante(e.id).then(x => x.assinatura, () => ''))) : '';
      escreverNaAba(aba, protocoloDeEntregas(nome, [e], [a || null], quem?.nome || ''));
      repo.registrarAuditoria('protocolo_emitido', nome + ' · 1 entrega(s)');
    },
    async enviarComprovante() {
      const texto = entregas.textoDoComprovante(e, nome, entregas.rotuloDaCompetencia, entregas.dinheiro, entregas.dataHoraDaEntrega);
      const url = entregas.linkDoWhatsApp(texto, cliente?.telefone || '');
      repo.registrarAuditoria('comprovante_enviado', nome + ' · ' + rotuloComp);
      // no celular, manda o texto junto com a imagem do comprovante; senão, o WhatsApp com o texto
      const imagem = anexos?.assinatura || anexos?.foto;
      try {
        if (navigator.share && imagem) {
          const blob = await (await fetchDoDataUrl(imagem)).blob();
          const arquivo = new File([blob], 'comprovante.jpg', { type: blob.type || 'image/jpeg' });
          if (navigator.canShare?.({ files: [arquivo] })) await navigator.share({ text: texto, files: [arquivo] });
          else await navigator.share({ text: texto });
        } else if (navigator.share) await navigator.share({ text: texto });
        else window.open(url, '_blank');
      } catch { window.open(url, '_blank'); }
    },
    async excluir() {
      const sim = await retorno.modal({
        icone: 'alert', titulo: 'Excluir esta entrega?', texto: 'A entrega e o comprovante saem do histórico do cliente. Não dá para desfazer.',
        botoes: [{ rotulo: 'Excluir', valor: true, variante: 'btn-danger' }, { rotulo: 'Cancelar', valor: false }],
      });
      if (!sim) return;
      try { await repo.excluir(e); retorno.aviso({ tom: 'ok', titulo: 'Entrega excluída.' }); fechar(); } catch (err) { retorno.aviso({ tom: 'erro', titulo: textoDoErro(err, 'Não foi possível excluir.') }); }
    },
  };
}

/** O data URL vira Blob sem rede (o fetch de um data: não sai do aparelho; aqui, sem fetch nenhum). */
async function fetchDoDataUrl(dataUrl: string): Promise<{ blob: () => Promise<Blob> }> {
  const [cab, dados] = dataUrl.split(',');
  const tipo = /data:([^;,]+)/.exec(cab)?.[1] || 'image/png';
  const bin = /;base64/.test(cab) ? atob(dados) : decodeURIComponent(dados);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { blob: async () => new Blob([bytes], { type: tipo }) };
}

/** Corrigir localização: "Estou no local agora" ou "mesmo local de outro cliente", e a região da rota. */
export function useCorrigirLocal(clienteId: string, voltar: JanelaDaEntrega | null) {
  const repo = useEntregasDeDocumentos();
  const retorno = useRetorno();
  const janelas = useJanelasDasEntregas();
  const clientes = repo.clientes().lista;
  const cliente = clientes.find(c => c.id === clienteId) || null;
  const [zona, setZona] = useState(cliente?.zona || '');
  const [novoGeo, setNovoGeo] = useState<Geo | null>(null);
  const [status, setStatus] = useState('');
  const [busca, setBusca] = useState('');
  const [pegando, setPegando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const q = busca.trim().toLowerCase();
  const achados = useMemo(() => (q.length < 2 || !cliente ? [] : clientes.filter(c => c.id !== cliente.id && entregas.pontoConfiavel(c) && entregas.clienteCombina(c, q)).slice(0, 6)), [q, clientes, cliente]);
  const fechar = () => (voltar ? janelas.abrir(voltar) : janelas.fechar());
  return {
    cliente, fechar,
    rotulo: cliente ? entregas.rotuloDoCliente(cliente) : '',
    zona, setZona, zonas: entregas.ZONAS,
    status, pegando, salvando,
    busca, setBusca, achados: achados.map(c => ({ c, nome: entregas.rotuloDoCliente(c), sub: c.endereco || 'sem endereço escrito' })),
    estouNoLocal() {
      if (!navigator.geolocation) { setStatus('Este aparelho não informa localização.'); return; }
      setPegando(true);
      navigator.geolocation.getCurrentPosition(p => {
        setNovoGeo({ lat: p.coords.latitude, lng: p.coords.longitude, origem: 'manual', precisao: 'rua' });
        setStatus('Vai usar a sua posição atual.');
        setPegando(false);
      }, () => { setStatus('Não consegui pegar sua localização agora.'); setPegando(false); }, { enableHighAccuracy: true, timeout: 10000 });
    },
    mesmoLocalDe(c: (typeof clientes)[number]) {
      const g = entregas.pontoConfiavel(c);
      if (!g) return;
      setNovoGeo({ lat: g.lat, lng: g.lng, origem: 'manual', precisao: 'rua', referencia: 'mesmo local de ' + c.nome });
      if (c.zona) setZona(c.zona);
      setStatus('Vai usar o mesmo local de ' + entregas.rotuloDoCliente(c) + '.');
      setBusca(entregas.rotuloDoCliente(c));
    },
    async salvar() {
      if (!cliente) return;
      const dados: { geo?: Geo; zona?: string } = {};
      if (novoGeo) dados.geo = novoGeo;
      if (zona !== (cliente.zona || '')) dados.zona = zona;
      if (!Object.keys(dados).length) { fechar(); return; }
      setSalvando(true);
      // as regras deixam qualquer pessoa da equipe ajustar geo e zona: quem está na rua sabe onde o cliente fica
      try { await repo.corrigirLocal(cliente, dados); retorno.aviso({ tom: 'ok', titulo: 'Localização atualizada.' }); fechar(); } catch (err) {
        retorno.aviso({ tom: 'erro', titulo: textoDoErro(err, 'Não foi possível salvar.') });
        setSalvando(false);
      }
    },
  };
}

/** Aglutinar com outra empresa (mesmo endereço físico: uma parada só e uma assinatura). */
export function useAglutinar(clienteId: string, voltar: JanelaDaEntrega | null) {
  const repo = useEntregasDeDocumentos();
  const retorno = useRetorno();
  const janelas = useJanelasDasEntregas();
  useEffect(() => { void repo.garantirTodosOsClientes(); }, [repo]);
  const clientes = repo.clientes().lista;
  const cliente = clientes.find(c => c.id === clienteId) || null;
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [gravando, setGravando] = useState(false);
  const q = busca.trim().toLowerCase();
  const achados = useMemo(() => (q.length < 2 || !cliente ? [] : clientes.filter(c => c.id !== cliente.id && entregas.clienteCombina(c, q)).slice(0, 6)), [q, clientes, cliente]);
  const ancora = cliente?.grupoLocal ? clientes.find(c => c.id === cliente.grupoLocal) : null;
  const seguidores = cliente ? clientes.filter(x => x.id !== cliente.id && x.grupoLocal === cliente.id) : [];
  const fechar = () => (voltar ? janelas.abrir(voltar) : janelas.fechar());
  return {
    cliente, fechar,
    rotulo: cliente ? entregas.rotuloDoCliente(cliente) : '',
    ancora: ancora ? entregas.rotuloDoCliente(ancora) : '',
    seguidores: seguidores.map(entregas.rotuloDoCliente),
    busca, setBusca, status, gravando,
    achados: achados.map(c => ({ c, nome: entregas.rotuloDoCliente(c), sub: c.endereco || 'sem endereço escrito' })),
    async desfazer() {
      if (!cliente) return;
      setGravando(true);
      try { await repo.desaglutinar(cliente); retorno.aviso({ tom: 'ok', titulo: 'Aglutinação desfeita — ' + entregas.rotuloDoCliente(cliente) + ' volta a ser parada própria.' }); fechar(); } catch (err) {
        retorno.aviso({ tom: 'erro', titulo: textoDoErro(err, 'Não foi possível desfazer.') });
        setGravando(false);
      }
    },
    async aglutinarCom(c: (typeof clientes)[number]) {
      if (!cliente) return;
      if ((c.grupoLocal || c.id) === cliente.id) { setStatus('Essas duas já estão aglutinadas.'); return; }
      setGravando(true);
      try { await repo.aglutinar(cliente, c); retorno.aviso({ tom: 'ok', titulo: 'Aglutinado com ' + entregas.rotuloDoCliente(c) + '. Agora contam como uma parada só na rota.' }); fechar(); } catch (err) {
        retorno.aviso({ tom: 'erro', titulo: textoDoErro(err, 'Não foi possível aglutinar.') });
        setGravando(false);
      }
    },
  };
}

/** O link do cliente (a página dele, sem senha): criar (admin), mandar, copiar, ver como ele vê e trocar quando vazou. */
export function useLinkDoCliente(clienteId: string) {
  const repo = useEntregasDeDocumentos();
  const retorno = useRetorno();
  const janelas = useJanelasDasEntregas();
  const { operador } = useOperador();
  const quem = repo.quem();
  const clientes = repo.clientes().lista;
  const porId = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes]);
  const original = porId.get(clienteId) || null;
  // empresa que segue outra usa o link da principal: um endereço só pro dono
  const principal = original?.grupoLocal && !original.portalToken ? porId.get(original.grupoLocal) || null : null;
  const cliente = principal || original;
  const avisoDoGrupo = original && principal ? (principal.portalToken
    ? entregas.rotuloDoCliente(original) + ' aparece no link de ' + entregas.rotuloDoCliente(principal) + ', que é a empresa principal do grupo.'
    : 'O link deste grupo é criado na empresa principal: ' + entregas.rotuloDoCliente(principal) + '.') : '';
  const [visto, setVisto] = useState<string>('');
  const [criando, setCriando] = useState(false);
  const token = cliente?.portalToken || '';
  useEffect(() => {
    if (!token) return;
    let vivo = true;
    repo.vistoNoLink(token).then(v => {
      if (vivo) setVisto(v ? 'O cliente abriu o link pela última vez em ' + entregas.dataHoraDaEntrega(v.ultima) + (v.vezes > 1 ? ' (' + v.vezes + ' visitas)' : '') + '.' : 'O cliente ainda não abriu o link.');
    }, () => undefined);
    return () => { vivo = false; };
  }, [token, repo]);
  const link = token ? entregas.linkDoPortal(token) : '';
  const empresas = cliente ? entregas.empresasDoLink(cliente, porId) : [];
  return {
    cliente, avisoDoGrupo, fechar: janelas.fechar,
    rotulo: cliente ? entregas.rotuloDoCliente(cliente) : '',
    tem: !!token, link, visto, criando,
    admin: !!operador?.admin || !!quem?.papeis.includes('admin'),
    grupo: empresas.length > 1 ? 'Este link mostra as ' + empresas.length + ' empresas do grupo: ' + empresas.map(x => x.nomeFantasia || x.nome).join(', ') + '.' : '',
    async criar(trocar: boolean) {
      if (!cliente) return;
      if (trocar) {
        const sim = await retorno.modal({ icone: 'link', titulo: 'Trocar o link do cliente?', texto: 'O link antigo para de funcionar. Mande o novo para o cliente.',
          botoes: [{ rotulo: 'Trocar o link', valor: true, variante: 'btn-primary' }, { rotulo: 'Cancelar', valor: false }] });
        if (!sim) return;
      }
      setCriando(true);
      try { await repo.criarLinkDoCliente(cliente); retorno.aviso({ tom: 'ok', titulo: trocar ? 'Link trocado. O antigo não funciona mais.' : 'Link criado.' }); } catch (err) {
        retorno.aviso({ tom: 'erro', titulo: textoDoErro(err, 'Não foi possível criar o link.') });
      }
      setCriando(false);
    },
    async copiar() { try { await navigator.clipboard.writeText(link); retorno.aviso({ tom: 'ok', titulo: 'Link copiado.' }); } catch { janelas.abrir({ tipo: 'copiar', titulo: 'Link do cliente', texto: link }); } },
    // "&equipe": a página do cliente não conta esta abertura como visita dele
    verComoOCliente: () => window.open(link + '&equipe=1', '_blank'),
    whatsapp() {
      window.open(entregas.linkDoWhatsApp('Olá! Este é o seu link da Nilma Contabilidade. Nele você acompanha as guias entregues, os comprovantes e o que ainda falta enviar: ' + link, cliente?.telefone || ''), '_blank');
    },
  };
}
