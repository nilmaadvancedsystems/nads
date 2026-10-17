// ViewModel da janela da parada (16/10/2026, a cópia fiel do openConfirmPendingModal do Entregas): os documentos (e
// "Editar documentos/competência" para quem pôs na rota ou o admin), o lembrete "Pra falar com o cliente", "Cliente
// ausente / entrega não realizada" (o motivo num toque e a foto obrigatória), o PIX do honorário (só honorário), quem
// recebeu (os nomes de sempre num toque e a dica de horário), "Entreguei, mas o cliente não assinou" (a foto vale), a foto,
// a assinatura (com a tela cheia; ou no celular do cliente, pelo QR), o lugar da confirmação e o link do cliente.
// Confirmar: um lote (a entrega e o comprovante); não entregue oferece "Tentar de novo?"; entregue mostra os lembretes;
// recusada, diz se outra pessoa confirmou antes. "Remover da rota": quem pôs, ou o admin.
import { entregas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useMemo, useState } from 'react';
import { useOperador } from '../../casca/operador';
import { useEntregasDeDocumentos } from '../../dados/repo';
import { fotoComprimida } from './arquivosDaEntrega';
import { useJanelasDasEntregas } from './contextoDasJanelas';
import { capturarPosicao, textoDaLocalizacao } from './localizacao';

type Entrega = ReturnType<typeof entregas.entregaDoDocumento>;
type Geo = NonNullable<ReturnType<typeof entregas.geoDoBanco>>;

/** O documento na edição da parada (os tipos do Entregas e o outro). */
export interface EdicaoDaParada { competencia: string; zona: string; marcados: string[]; outro: string; valores: Record<string, string>; funcionarios: Record<string, string> }

export function useJanelaDaParada(inicial: Entrega, assinaturaInicial?: { assinatura: string; recebedor: string }) {
  const repo = useEntregasDeDocumentos();
  const retorno = useRetorno();
  const janelas = useJanelasDasEntregas();
  const { operador } = useOperador();
  const naRota = repo.naRota();
  const clientes = repo.clientes();
  const quem = repo.quem();
  const [local, setLocal] = useState<Entrega>(inicial);
  const viva = naRota.lista.find(e => e.id === inicial.id);
  const e = viva || local;
  const cliente = e.clienteId ? clientes.lista.find(c => c.id === e.clienteId) || null : null;
  const avisar = (titulo: string, tom: 'ok' | 'erro' | 'info' = 'ok') => retorno.aviso({ tom, titulo });

  const [falha, setFalha] = useState(false);
  const [semAssinatura, setSemAssinatura] = useState(false);
  const [pix, setPix] = useState(false);
  const [pixValor, setPixValor] = useState('');
  const [recebedor, setRecebedor] = useState(assinaturaInicial?.recebedor || '');
  const [motivoFalha, setMotivoFalha] = useState('');
  const [motivoSemAssinatura, setMotivoSemAssinatura] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [assinatura, setAssinatura] = useState<string | null>(assinaturaInicial?.assinatura || null);
  const [doCelular, setDoCelular] = useState(!!assinaturaInicial?.assinatura);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [procurandoGeo, setProcurandoGeo] = useState(true);
  const [erros, setErros] = useState<{ foto?: string; motivo?: string; assinatura?: string }>({});
  const [salvando, setSalvando] = useState(false);
  const [edicao, setEdicao] = useState<EdicaoDaParada | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [historico, setHistorico] = useState<Entrega[]>([]);

  // o lugar, os nomes de quem costuma receber e a assinatura que o cliente já fez no celular dele (o link foi gasto e a
  // janela tinha fechado: o app recarregou, o celular bloqueou)
  useEffect(() => {
    let vivo = true;
    capturarPosicao().then(g => { if (vivo) { setGeo(g); setProcurandoGeo(false); } });
    if (inicial.clienteId) repo.recentesDoCliente(inicial.clienteId).then(l => { if (vivo) setHistorico(l); }).catch(() => undefined);
    if (!assinaturaInicial?.assinatura) {
      repo.assinaturaFeita(inicial.id).then(a => {
        if (!vivo || !a) return;
        setAssinatura(x => x || a.assinatura);
        setDoCelular(true);
        setRecebedor(r => r || a.recebedor);
        retorno.aviso({ tom: 'info', titulo: 'O cliente já tinha assinado pelo link. Confira e confirme a entrega.' });
      }).catch(() => undefined);
    }
    return () => { vivo = false; };
  }, [inicial.id, inicial.clienteId, assinaturaInicial?.assinatura, repo, retorno]);

  const soHonorario = entregas.soHonorario(e.itens);
  const esc = repo.escritorio();
  const pixNum = entregas.valorDigitado(pixValor);
  const comPix = soHonorario && !falha && pix;
  const lembretes = repo.lembretes().lista.filter(l => l.clienteId && l.clienteId === e.clienteId);
  const sugeridos = useMemo(() => entregas.recebedoresSugeridos(historico), [historico]);
  const dica = useMemo(() => entregas.dicaDoCliente(historico), [historico]);
  const podeEditar = entregas.podeExcluir(e, { admin: !!operador?.admin || !!quem?.papeis.includes('admin'), email: quem?.email || '' });

  async function confirmar() {
    if (salvando) return;
    const c: entregas.Confirmacao = { falha, semAssinatura: !falha && semAssinatura, comPix, recebedor, motivoFalha, motivoSemAssinatura, assinatura: falha || semAssinatura ? null : assinatura, foto, geo };
    const faltas = entregas.faltasNaConfirmacao(c, e.itens);
    setErros(faltas);
    if (Object.keys(faltas).length) return;
    setSalvando(true);
    // avalia ANTES de gravar: longe do cliente, o ponto dele não muda (senão o cliente "muda" para onde a confirmação foi feita)
    const avaliacao = entregas.avaliarLocalDaEntrega(cliente, geo);
    try {
      const r = await repo.confirmar(e, c, avaliacao);
      avisar(r === 'aparelho' ? 'Salvo no aparelho. Sobe sozinho quando voltar o sinal.' : entregas.avisoDaConfirmacao(c));
      if (!falha && avaliacao.divergente) retorno.aviso({ tom: 'info', titulo: 'Fora do local do cliente', texto: entregas.textoDoLocalDivergente(avaliacao, e.clienteNome) });
      janelas.fechar();
      if (!falha && e.clienteId && lembretes.length) {
        const ids = [{ id: e.clienteId, nome: e.clienteNome }];
        setTimeout(() => janelas.abrir({ tipo: 'lembretes', clientes: ids }), 260);
      }
      // cliente ausente quase sempre é "volto amanhã": oferece recriar já com tudo preenchido
      if (falha) await oferecerTentarDeNovo([e], motivoFalha.trim(), repo, retorno);
    } catch (err) {
      const explicacao = (err as { code?: string })?.code === 'permission-denied' ? await repo.explicarRecusa(e.id) : '';
      if (explicacao) { avisar(explicacao, 'erro'); janelas.fechar(); } else avisar(textoDoErro(err, 'Não foi possível confirmar.'), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return {
    entrega: e,
    exemplos: repo.exemplos,
    sub: entregas.rotuloDaCompetencia(e.competencia) + (e.status === 'link' ? ' · no link' : ' · na rota') + (e.zona ? ' · ' + entregas.rotuloDaZona(e.zona) : ''),
    dica,
    fichas: e.itens.map(entregas.fichaDoItem),
    podeEditar,
    lembretes: lembretes.map(l => l.texto),
    // ---- a edição (abrirEdicaoPendente) ----
    edicao,
    tipos: entregas.TIPOS_DE_DOCUMENTO,
    zonas: entregas.ZONAS,
    abrirEdicao() {
      const marcados: string[] = [], valores: Record<string, string> = {}, funcionarios: Record<string, string> = {};
      let outro = '';
      for (const i of e.itens) {
        const t = entregas.tipoPeloRotulo(i.tipo);
        if (t) { if (!marcados.includes(t.chave)) marcados.push(t.chave); } else if (!outro) outro = i.tipo;
        if (i.valor != null) valores[i.tipo] = String(i.valor);
        if (i.funcionario) funcionarios[i.tipo] = i.funcionario;
      }
      setEdicao({ competencia: e.competencia || entregas.competenciaAtual(), zona: e.zona, marcados, outro, valores, funcionarios });
    },
    mudarEdicao: (m: Partial<EdicaoDaParada>) => setEdicao(x => (x ? { ...x, ...m } : x)),
    salvandoEdicao,
    async salvarEdicao() {
      if (!edicao) return;
      const linhas = [...entregas.TIPOS_DE_DOCUMENTO.filter(t => edicao.marcados.includes(t.chave)).map(t => ({ rotulo: t.rotulo, semValor: !!t.semValor, pedeFuncionario: !!t.pedeFuncionario })),
        ...(edicao.outro.trim() ? [{ rotulo: edicao.outro.trim(), semValor: false, pedeFuncionario: false }] : [])];
      const itens = linhas.map(l => ({ tipo: l.rotulo, valor: l.semValor ? null : entregas.valorDigitado(edicao.valores[l.rotulo]), ...(l.pedeFuncionario ? { funcionario: (edicao.funcionarios[l.rotulo] || '').trim() } : {}) }));
      if (!itens.length) { avisar('Selecione ao menos um documento.', 'erro'); return; }
      setSalvandoEdicao(true);
      try {
        const r = await repo.editar(e, edicao.competencia, edicao.zona, itens);
        avisar(r === 'aparelho' ? 'Salvo no aparelho. Sobe sozinho quando voltar o sinal.' : 'Rota atualizada.');
        setLocal({ ...e, competencia: edicao.competencia, zona: edicao.zona, itens });
        setEdicao(null);
      } catch (err) {
        avisar(textoDoErro(err, 'Não foi possível salvar.'), 'erro');
      } finally {
        setSalvandoEdicao(false);
      }
    },
    // ---- como foi ----
    falha, setFalha(v: boolean) { setFalha(v); setErros({}); if (v) setPix(false); },
    semAssinatura, setSemAssinatura(v: boolean) { setSemAssinatura(v); setErros({}); },
    soHonorario: soHonorario && !falha,
    pix: comPix, setPix, pixValor, setPixValor,
    pixSemChave: !esc.pixChave,
    pixCodigo: comPix && esc.pixChave ? entregas.pixCopiaECola(esc.pixChave, esc.pixNome, esc.pixCidade, pixNum) : '',
    pixSub: pixNum ? entregas.dinheiro(pixNum) + ' · ' + (esc.pixNome || 'Nilma Contabilidade') : 'sem valor — o cliente digita quanto vai pagar',
    async copiarPix(codigo: string) { try { await navigator.clipboard.writeText(codigo); avisar('Código Pix copiado.'); } catch { janelas.abrir({ tipo: 'copiar', titulo: 'Pix do escritório', texto: codigo }); } },
    motivos: entregas.MOTIVOS_DE_FALHA,
    motivoFalha, setMotivoFalha,
    usarMotivo: (m: string) => setMotivoFalha(x => entregas.motivoComToque(x, m)),
    motivoMarcado: entregas.MOTIVOS_DE_FALHA.find(m => motivoFalha.startsWith(m)) || '',
    recebedor, setRecebedor, sugeridos,
    motivoSemAssinatura, setMotivoSemAssinatura,
    rotuloDaFoto: falha || (semAssinatura && !falha) || comPix ? 'Foto (obrigatória)' : 'Foto (opcional se colher assinatura)',
    foto,
    async anexarFoto(arquivos: File[]) {
      const a = arquivos[0];
      if (!a) return;
      try { setFoto(await fotoComprimida(a)); setErros(x => ({ ...x, foto: undefined })); } catch { avisar('Não foi possível processar a foto.', 'erro'); }
    },
    tirarFoto: () => setFoto(null),
    assinatura, doCelular,
    setAssinatura(v: string | null) { setAssinatura(v); setDoCelular(false); if (v) setErros(x => ({ ...x, assinatura: undefined })); },
    assinarNoCelular: () => janelas.abrir({ tipo: 'assinarNoCelular', entrega: e }),
    localizacao: textoDaLocalizacao(geo, procurandoGeo),
    linkDoCliente: cliente?.portalToken ? entregas.linkDoPortal(cliente.portalToken) : '',
    erros,
    salvando,
    rotuloDoBotao: falha ? 'Registrar entrega não realizada' : 'Confirmar entrega',
    confirmar,
    fechar: janelas.fechar,
    async removerDaRota() {
      const sim = await retorno.modal({
        icone: 'alert', titulo: 'Remover da rota?', texto: 'A entrega pendente é excluída.',
        botoes: [{ rotulo: 'Remover', valor: true, variante: 'btn-danger' }, { rotulo: 'Cancelar', valor: false }],
      });
      if (!sim) return;
      try { await repo.excluir(e); avisar('Entrega excluída.'); janelas.fechar(); } catch (err) { avisar(textoDoErro(err, 'Não foi possível excluir.'), 'erro'); }
    },
  };
}

export function textoDoErro(err: unknown, padrao: string): string {
  const c = String((err as { code?: string })?.code || '');
  if (c === 'permission-denied') return 'Sem permissão — confira as regras do Firestore.';
  if (c === 'unavailable') return 'Sem conexão. Verifique sua internet.';
  return padrao;
}

/** "Tentar de novo?" (oferecerReagendar_): volta pra rota com os mesmos documentos, como a tentativa seguinte. */
export async function oferecerTentarDeNovo(lista: Entrega[], motivo: string, repo: ReturnType<typeof useEntregasDeDocumentos>, retorno: ReturnType<typeof useRetorno>) {
  if (!lista.length) return;
  const tentativa = entregas.proximaTentativa(lista);
  const sim = await retorno.modal({
    icone: 'repeat', titulo: 'Tentar de novo?',
    texto: (lista[0].clienteNome || 'cliente') + ' · ' + (motivo || 'não entregue') + '. Volta pra rota com os mesmos documentos e valores, marcada como ' + tentativa + 'ª tentativa. A entrega de hoje continua registrada como não realizada.',
    botoes: [{ rotulo: 'Colocar de volta na rota', valor: true, variante: 'btn-primary' }, { rotulo: 'Agora não', valor: false }],
  });
  if (!sim) return;
  try {
    const r = await repo.novaTentativa(lista, motivo);
    retorno.aviso({ tom: 'ok', titulo: r === 'aparelho' ? 'Salvo no aparelho. Sobe sozinho quando voltar o sinal.' : 'De volta na rota como ' + tentativa + 'ª tentativa.' });
  } catch (err) {
    retorno.aviso({ tom: 'erro', titulo: textoDoErro(err, 'Não foi possível recolocar na rota.') });
  }
}
