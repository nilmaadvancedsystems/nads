// ViewModel de Entregas › Nova entrega (16/10/2026, a cópia fiel do entregas.html: "só copia o entregas e joga aqui no
// design n1"). O formulário "Registrar entrega" de lá, campo a campo: Preparar rota ou Pelo link (só quando o cliente tem
// link), a região da rota, o cliente (a busca por nome, código ou CNPJ, com ↑↓ e Enter; "+ Adicionar novo cliente"; ou o
// avulso; ou o banco), a competência (a fechada pede confirmação de novo), o vencimento (preenchido sozinho pela regra da
// guia, com fim de semana e feriado, enquanto a pessoa não digita), os documentos (a planilha: o tipo, o valor, repetir o
// imposto, o funcionário da multa; "Outro documento…"), "Puxar guias da pasta" (admin e contábil), repetir o mês passado,
// o aviso de valor muito diferente do mês passado, o honorário (como o cliente costuma pagar e o PIX com o QR), o PDF da
// guia no link (o leitor acha o cliente, o tipo, a competência, o vencimento, o valor e o código para pagar) e o rascunho
// guardado no aparelho. Gravar: "Adicionar à rota" (os documentos ficam para o próximo cliente) ou "Publicar no link do
// cliente" (e o convite para avisar no WhatsApp).
import { entregas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOperador } from '../../casca/operador';
import { useEntregasDeDocumentos } from '../../dados/repo';
import type { GuiaParaAnexar } from '../../dados/entregasDeDocumentos';
import { lerPdfDaGuia, textoDoPdf } from './arquivosDaEntrega';

type Cliente = ReturnType<typeof entregas.clienteDaRotaDoDocumento>;
type Entrega = ReturnType<typeof entregas.entregaDoDocumento>;
type CodigoPagamento = NonNullable<Entrega['codigoPagamento']>;

/** Um documento repetido (dois DAS, o FGTS de duas folhas…): uma linha a mais, com o valor dela. */
export interface DuplicataDoDocumento { id: string; rotulo: string; pedeFuncionario: boolean; valor: string; funcionario: string }
/** Uma linha dos documentos da entrega (na ordem do Entregas: os tipos, o outro, as repetições). */
export interface LinhaDoDocumento { chave: string; rotulo: string; semValor: boolean; pedeFuncionario: boolean; valor: string; funcionario: string; outro?: boolean; dup?: DuplicataDoDocumento }

const RASCUNHO = 'nilma_rascunho_nova_v1';
const dataBr = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : '');
const dataIso = (br: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
let seq = 0;

export function useNovaEntrega() {
  const repo = useEntregasDeDocumentos();
  const retorno = useRetorno();
  const { operador } = useOperador();
  const clientes = repo.clientes();
  const quem = repo.quem();
  const porId = useMemo(() => new Map(clientes.lista.map(c => [c.id, c])), [clientes.lista]);
  const avisar = useCallback((titulo: string, tom: 'ok' | 'erro' | 'info' = 'ok') => retorno.aviso({ tom, titulo }), [retorno]);

  const [modo, setModo] = useState<'rota' | 'link'>('rota');
  const [zona, setZona] = useState('');
  const [avulso, setAvulso] = useState(false);
  const [banco, setBanco] = useState(false);
  const [avulsoNome, setAvulsoNome] = useState('');
  const [bancoNome, setBancoNome] = useState('');
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState<Cliente | null>(null);
  const [listaAberta, setListaAberta] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [competencia, setCompetencia] = useState(entregas.competenciaAtual());
  const [vencimento, setVencimentoIso] = useState('');
  const [vencimentoTexto, setVencimentoTexto] = useState('');
  const ultimoAuto = useRef<string | null>(null);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [funcionarios, setFuncionarios] = useState<Record<string, string>>({});
  const [outro, setOutro] = useState('');
  const [outroAberto, setOutroAberto] = useState(false);
  const [duplicatas, setDuplicatas] = useState<DuplicataDoDocumento[]>([]);
  const [planilha, setPlanilha] = useState(false);
  /** o campo a focar depois de escolher (o valor do documento, ou o nome do "Outro") */
  const [focar, setFocar] = useState<string | null>(null);
  const [mesPassado, setMesPassado] = useState<Entrega | null>(null);
  const [divergentes, setDivergentes] = useState<Record<string, string>>({});
  const [pix, setPix] = useState(false);
  const [pixValor, setPixValor] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [fotoEhGuia, setFotoEhGuia] = useState(false);
  const [codigoPagamento, setCodigoPagamento] = useState<CodigoPagamento | null>(null);
  const [pdfStatus, setPdfStatus] = useState('');
  const [guiasStatus, setGuiasStatus] = useState('');
  const [puxandoGuias, setPuxandoGuias] = useState(false);
  const guiasParaAnexar = useRef<Record<string, GuiaParaAnexar>>({});
  const guiasJaPuxadas = useRef<Record<string, boolean>>({});
  const [erros, setErros] = useState<{ cliente?: string; competencia?: string; itens?: string }>({});
  const [salvando, setSalvando] = useState(false);
  const fechadaConfirmada = useRef(0);
  const campoCliente = useRef<HTMLInputElement | null>(null);

  // ---- os documentos, na ordem do Entregas (os tipos, depois o outro, depois as repetições) ----
  const linhas: LinhaDoDocumento[] = useMemo(() => {
    const l: LinhaDoDocumento[] = entregas.TIPOS_DE_DOCUMENTO.filter(t => marcados.includes(t.chave)).map(t => ({
      chave: t.chave, rotulo: t.rotulo, semValor: !!t.semValor, pedeFuncionario: !!t.pedeFuncionario, valor: valores[t.chave] || '', funcionario: funcionarios[t.chave] || '',
    }));
    if (outro.trim() || outroAberto) l.push({ chave: 'outro', rotulo: outro.trim() || 'Outro documento', semValor: false, pedeFuncionario: false, valor: valores.outro || '', funcionario: '', outro: true });
    for (const d of duplicatas) l.push({ chave: d.id, rotulo: d.rotulo + ' (repetido)', semValor: false, pedeFuncionario: d.pedeFuncionario, valor: d.valor, funcionario: d.funcionario, dup: d });
    return l;
  }, [marcados, valores, funcionarios, outro, outroAberto, duplicatas]);
  const itens: entregas.ItemDaEntrega[] = useMemo(() => [
    ...entregas.TIPOS_DE_DOCUMENTO.filter(t => marcados.includes(t.chave)).map(t => ({
      tipo: t.rotulo, valor: t.semValor ? null : entregas.valorDigitado(valores[t.chave]), ...(t.pedeFuncionario ? { funcionario: (funcionarios[t.chave] || '').trim() } : {}),
    })),
    ...(outro.trim() ? [{ tipo: outro.trim(), valor: entregas.valorDigitado(valores.outro) }] : []),
    ...duplicatas.map(d => ({ tipo: d.rotulo, valor: entregas.valorDigitado(d.valor), ...(d.pedeFuncionario ? { funcionario: d.funcionario.trim() } : {}) })),
  ], [marcados, valores, funcionarios, outro, duplicatas]);
  const apenas = (chave: string) => marcados.length === 1 && marcados[0] === chave && !outro.trim() && !duplicatas.length;
  const apenasHonorario = apenas('honorario');

  // ---- o vencimento automático: só por cima do que ele mesmo pôs (nunca do digitado ou do PDF) ----
  const tiposComRegra = marcados.filter(k => ['das', 'fgts', 'darf', 'esocial'].includes(k)).map(k => entregas.tipoPelaChave(k)?.rotulo || '').join('|');
  useEffect(() => {
    if (vencimento && vencimento !== ultimoAuto.current) { ultimoAuto.current = null; return; }
    const nova = entregas.vencimentoAutomatico(competencia, tiposComRegra ? tiposComRegra.split('|').map(tipo => ({ tipo })) : []);
    if (nova) { ultimoAuto.current = nova; setVencimentoIso(nova); setVencimentoTexto(dataBr(nova)); }
    else if (ultimoAuto.current) { ultimoAuto.current = null; setVencimentoIso(''); setVencimentoTexto(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competencia, tiposComRegra]);

  // ---- o cliente ----
  const q = busca.trim().toLowerCase();
  const achados = useMemo(() => (q ? clientes.lista.filter(c => c.ativo && entregas.clienteCombina(c, q)).slice(0, 8) : []), [q, clientes.lista]);
  const nomeExato = achados.some(c => c.nome.toLowerCase() === q);
  // nada achado na carga curta: pode ser cliente que ainda não é do Entregas — busca a base inteira
  useEffect(() => {
    if (repo.clientesCompletos() || achados.length || q.length < 3) return;
    const t = setTimeout(() => { void repo.garantirTodosOsClientes(); }, 600);
    return () => clearTimeout(t);
  }, [q, achados.length, repo]);
  const temLink = !!escolhido && entregas.donosDoLinkDe(escolhido.id, porId).length > 0;
  useEffect(() => { if (!temLink && modo === 'link') setModo('rota'); }, [temLink, modo]);

  function oferecerRepetir(c: Cliente) {
    setMesPassado(null);
    const anterior = entregas.competenciaAnterior(competencia);
    repo.doClienteNoMes(c.id, anterior).then(l => {
      const com = l.filter(e => e.itens.length);
      if (com.length) setMesPassado(com[com.length - 1]);
    }).catch(() => undefined);
  }
  function escolher(c: Cliente) {
    setEscolhido(c);
    setBusca(entregas.rotuloDoCliente(c));
    setListaAberta(false);
    setAtivo(-1);
    setErros(e => ({ ...e, cliente: undefined }));
    if (modo === 'rota' && c.zona) setZona(c.zona);
    oferecerRepetir(c);
    guiasParaAnexar.current = {};
    setGuiasStatus('');
  }

  // ---- o rascunho no aparelho (assinatura e foto não existem aqui; o cliente e os documentos, sim) ----
  const rascunho = useRef({ restaurado: false });
  useEffect(() => {
    if (rascunho.current.restaurado || !clientes.carregada) return;
    rascunho.current.restaurado = true;
    const r = (() => { try { return JSON.parse(localStorage.getItem(RASCUNHO) || 'null') as Record<string, unknown> | null; } catch { return null; } })();
    if (!r) return;
    if (Date.now() - Number(r.quando || 0) > 12 * 3600e3) { try { localStorage.removeItem(RASCUNHO); } catch { /* nada */ } return; }
    if (r.avulso) { setAvulso(true); setAvulsoNome(String(r.avulsoNome || '')); }
    else if (r.selectedClienteId && porId.has(String(r.selectedClienteId))) { const c = porId.get(String(r.selectedClienteId)) as Cliente; setEscolhido(c); setBusca(entregas.rotuloDoCliente(c)); }
    else if (r.clienteInputValor) setBusca(String(r.clienteInputValor));
    if (r.competencia) setCompetencia(String(r.competencia));
    if (r.vencimento) { setVencimentoIso(String(r.vencimento)); setVencimentoTexto(dataBr(String(r.vencimento))); }
    if (r.zona) setZona(String(r.zona));
    if (Array.isArray(r.itensChecados)) setMarcados(r.itensChecados.map(String));
    if (r.outro) setOutro(String(r.outro));
    setValores((r.valoresState as Record<string, string>) || {});
    setFuncionarios((r.funcionarioState as Record<string, string>) || {});
    setDuplicatas(Array.isArray(r.duplicatasExtras) ? (r.duplicatasExtras as DuplicataDoDocumento[]) : []);
    avisar('Rascunho da entrega restaurado — confira antes de confirmar.', 'info');
  }, [clientes.carregada, porId, avisar]);
  useEffect(() => {
    if (!rascunho.current.restaurado) return;
    const t = setTimeout(() => {
      try {
        if (!escolhido && !avulsoNome.trim()) { localStorage.removeItem(RASCUNHO); return; }
        localStorage.setItem(RASCUNHO, JSON.stringify({
          quando: Date.now(), formMode: modo, selectedClienteId: escolhido?.id || null, clienteInputValor: busca, avulso, avulsoNome, competencia, vencimento, zona,
          itensChecados: marcados, outro, valoresState: valores, funcionarioState: funcionarios, duplicatasExtras: duplicatas,
        }));
      } catch { /* sem armazenamento */ }
    }, 700);
    return () => clearTimeout(t);
  }, [modo, escolhido, busca, avulso, avulsoNome, competencia, vencimento, zona, marcados, outro, valores, funcionarios, duplicatas]);

  // ---- o PDF e as guias da pasta ----
  function aplicarDadosDoPdf(texto: string, imagem: string | null, tipo?: string): string[] {
    const daPasta = !!tipo;
    const d = entregas.dadosDoPdf(texto, clientes.lista, tipo);
    const achados: string[] = [];
    if (imagem) { setFotoEhGuia(true); setFoto(imagem); achados.push('foto'); }
    if (d.cliente && !daPasta) { escolher(d.cliente); achados.push('cliente'); }
    if (d.tipo) { setMarcados(m => (m.includes(d.tipo as string) ? m : [...m, d.tipo as string])); achados.push('tipo de documento'); }
    if (d.competencia && !daPasta) { setCompetencia(d.competencia); achados.push('competência'); }
    if (d.codigo) { setCodigoPagamento(d.codigo); achados.push(d.codigo.tipo === 'pix' ? 'código PIX' : 'código de barras'); }
    if (d.vencimento) { ultimoAuto.current = null; setVencimentoIso(d.vencimento); setVencimentoTexto(dataBr(d.vencimento)); achados.push('vencimento'); }
    else if (d.tipo && (d.competencia || daPasta)) {
      const rot = entregas.tipoPelaChave(d.tipo)?.rotulo || '';
      const v = entregas.vencimentoAutomatico(d.competencia || competencia, [{ tipo: rot }]);
      if (v) { ultimoAuto.current = v; setVencimentoIso(v); setVencimentoTexto(dataBr(v)); achados.push('vencimento (estimado)'); }
    }
    if (d.tipo && d.valor) { setValores(v => ({ ...v, [d.tipo as string]: d.valor as string })); achados.push('valor'); }
    return achados;
  }
  async function anexarPdf(arquivos: File[]) {
    const a = arquivos[0];
    if (!a) return;
    setPdfStatus('Lendo o PDF...');
    try {
      const { texto, imagem } = await lerPdfDaGuia(a);
      if (!entregas.pdfCitaAlgum(texto, clientes.lista)) await repo.garantirTodosOsClientes();
      const achados = aplicarDadosDoPdf(texto, imagem);
      setPdfStatus('');
      avisar((achados.length
        ? 'Detectado automaticamente: ' + achados.join(', ') + ' — confira antes de confirmar.'
        : 'Não consegui identificar os dados automaticamente nesse PDF. Preencha manualmente.')
        + (achados.includes('foto') ? '' : ' A imagem do PDF não pôde ser gerada — anexe uma foto do documento também.'), 'info');
    } catch (e) {
      setPdfStatus('');
      avisar('Não foi possível ler esse PDF: ' + ((e as Error)?.message || 'erro desconhecido'), 'erro');
    }
  }
  const podePuxarGuias = !!escolhido && !!escolhido.codigoOrigem && !!quem && (quem.papeis.includes('admin') || quem.papeis.includes('contabil') || !!operador?.admin);
  async function puxarGuiasDaPasta() {
    const c = escolhido;
    if (!c || !podePuxarGuias) return;
    const g = entregas.mesDaGuia(competencia);
    const chave = c.id + '|' + g.aaaa + '-' + g.mm;
    if (guiasJaPuxadas.current[chave]) return;
    guiasJaPuxadas.current[chave] = true;
    setPuxandoGuias(true);
    setGuiasStatus('Procurando as guias de ' + g.mm + '/' + g.aaaa + ' na pasta do cliente…');
    try {
      const guias = await repo.guiasDaPasta(c, g);
      if (!guias.length) { guiasJaPuxadas.current[chave] = false; setGuiasStatus('Não achei FGTS, DARF nem DAS de ' + g.mm + '/' + g.aaaa + ' na pasta do cliente.'); return; }
      setGuiasStatus('Puxando ' + guias.map(x => x.guia.nome).join(' e ') + ' de ' + g.mm + '/' + g.aaaa + ' da pasta do cliente…');
      const trazidas: string[] = [];
      for (const x of guias) {
        try {
          const arq = await repo.lerDoDrive(x.arquivo);
          const texto = await textoDoPdf(arq.bytes);
          aplicarDadosDoPdf(texto, null, x.guia.tipo);
          guiasParaAnexar.current[x.guia.tipo] = { tipo: x.guia.tipo, nome: x.arquivo.n, driveId: x.arquivo.i, tamanho: arq.tamanho, pdf: arq.tamanho <= entregas.LIMITE_PDF_ANEXO ? arq.base64 : null };
          trazidas.push(x.guia.nome);
        } catch { /* a próxima */ }
      }
      setGuiasStatus(trazidas.length ? trazidas.join(' e ') + ' de ' + g.mm + '/' + g.aaaa + ' vieram da pasta do cliente e vão anexados à entrega. Confira os valores.' : '');
      guiasJaPuxadas.current[chave] = false;
      if (!trazidas.length) avisar('Não consegui trazer as guias da pasta do cliente. Adicione à mão.', 'erro');
    } catch (e) {
      // sem acesso ao mapa do Drive (quem não é admin nem contábil): fica como estava, sem aviso
      guiasJaPuxadas.current[chave] = false;
      setGuiasStatus('');
      if (!/permission/i.test(String((e as Error)?.message))) console.warn('guias da pasta:', e);
    } finally {
      setPuxandoGuias(false);
    }
  }

  // ---- gravar ----
  function limpar(manterItens: boolean) {
    setEscolhido(null); setBusca(''); setAvulso(false); setAvulsoNome(''); setBanco(false); setBancoNome('');
    if (!manterItens) {
      setMarcados([]); setOutro(''); setOutroAberto(false); setValores({}); setFuncionarios({}); setDuplicatas([]); setPix(false); setPixValor('');
    }
    setVencimentoIso(''); setVencimentoTexto(''); ultimoAuto.current = null;
    setFoto(null); setFotoEhGuia(false); setCodigoPagamento(null); setMesPassado(null); setDivergentes({});
    guiasParaAnexar.current = {}; setGuiasStatus('');
    try { localStorage.removeItem(RASCUNHO); } catch { /* nada */ }
    if (manterItens) setTimeout(() => campoCliente.current?.focus(), 0);
  }
  async function gravar() {
    if (salvando) return;
    setErros({});
    const link = modo === 'link';
    if (link && banco) { avisar('Pagar no banco vai pela rota, não pelo link.', 'erro'); return; }
    if (link) {
      if (avulso || !escolhido || !entregas.donosDoLinkDe(escolhido.id, porId).length) { avisar('Este cliente não tem link. Crie em Clientes › Link do cliente.', 'erro'); return; }
      if (!(fotoEhGuia && foto)) { avisar('Anexe o PDF da guia: é ele que o cliente vai ver no link.', 'erro'); return; }
    }
    const para: entregas.ParaQuem = banco ? { tipo: 'banco', nome: bancoNome } : avulso ? { tipo: 'avulso', nome: avulsoNome } : (escolhido ? { tipo: 'cliente', cliente: escolhido } : { tipo: 'avulso', nome: '' });
    const faltas = entregas.faltasNaEntrega({ para: !banco && !avulso && !escolhido ? { tipo: 'avulso', nome: '' } : para, competencia, itens });
    if (!banco && !avulso && !escolhido) faltas.cliente = 'Selecione um cliente da lista, ou informe o nome.';
    if (Object.keys(faltas).length) { setErros(faltas); return; }
    // competência já conferida e fechada: uma confirmação a mais em vez de lançar em silêncio no mês errado
    if (repo.competenciasFechadas().includes(competencia) && Date.now() - fechadaConfirmada.current > 8000) {
      fechadaConfirmada.current = Date.now();
      avisar(entregas.rotuloDaCompetencia(competencia) + ' já está fechada. Toque em confirmar de novo se for isso mesmo.', 'erro');
      return;
    }
    fechadaConfirmada.current = 0;
    setSalvando(true);
    const nova: entregas.EntregaNova = {
      modo, para, competencia, vencimento: vencimento || '', itens, zona: link ? '' : zona, codigoPagamento, foto, fotoEhGuia,
    };
    const guias = para.tipo === 'cliente' ? Object.values(guiasParaAnexar.current).filter(g => marcados.includes(g.tipo)) : [];
    try {
      const { resultado } = await repo.registrar(nova, guias);
      avisar(resultado === 'aparelho' ? 'Salvo no aparelho. Sobe sozinho quando voltar o sinal.' : entregas.avisoDaEntregaNova(modo));
      if (link && escolhido) void oferecerAvisarDoLink(escolhido);
      limpar(modo === 'rota');
    } catch (e) {
      const c = String((e as { code?: string })?.code || '');
      avisar(c === 'permission-denied' ? 'Sem permissão — confira as regras do Firestore.' : c === 'unavailable' ? 'Sem conexão. Verifique sua internet.' : 'Não foi possível salvar.', 'erro');
    } finally {
      setSalvando(false);
    }
  }
  /** Depois de publicar a guia no link: um toque para avisar o cliente no WhatsApp. */
  async function oferecerAvisarDoLink(c: Cliente) {
    const dono = entregas.donosDoLinkDe(c.id, porId)[0];
    const tel = c.telefone || dono?.telefone || '';
    if (!dono || !entregas.numeroDoWhatsApp(tel)) return;
    const texto = 'Olá! Sua guia já está disponível aqui: ' + entregas.linkDoPortal(dono.portalToken)
      + ' — é só abrir, conferir e tocar em "Confirmar que recebi". O código para pagar está na mesma página.';
    await retorno.modal({
      icone: 'link', titulo: 'Avisar o cliente?',
      texto: entregas.rotuloDoCliente(c) + ' — a guia já está na página dele. A mensagem leva o link e pede pra ele tocar em "Confirmar que recebi".',
      botoes: [{ rotulo: 'Mandar no WhatsApp', valor: true, variante: 'btn-primary', aoClicar: () => { window.open(entregas.linkDoWhatsApp(texto, tel), '_blank'); } }, { rotulo: 'Agora não', valor: false }],
    });
  }

  async function adicionarCliente() {
    const nome = busca.trim();
    try {
      const id = await repo.adicionarCliente(nome);
      setEscolhido(entregas.clienteDaRotaDoDocumento(id, { nome, ativo: true }));
      setListaAberta(false);
      setErros(e => ({ ...e, cliente: undefined }));
      avisar('Cliente adicionado.');
    } catch (e) {
      const c = String((e as { code?: string })?.code || '');
      avisar(c === 'permission-denied' ? 'Sem permissão — confira as regras do Firestore.' : 'Não foi possível adicionar o cliente.', 'erro');
    }
  }

  // ---- o PIX do honorário ----
  const esc = repo.escritorio();
  const pixNum = entregas.valorDigitado(pixValor);
  const pixCodigo = apenasHonorario && pix && esc.pixChave ? entregas.pixCopiaECola(esc.pixChave, esc.pixNome, esc.pixCidade, pixNum) : '';

  return {
    exemplos: repo.exemplos,
    carregando: !clientes.carregada,
    modo, temLink,
    setModo(m: 'rota' | 'link') { setModo(m); if (m === 'link') setZona(''); },
    zona, setZona, zonas: entregas.ZONAS,
    avulso, banco, avulsoNome, setAvulsoNome, bancoNome, setBancoNome,
    bancos: ['Banco do Brasil', 'Caixa', 'Sicoob', 'Sicredi', 'Bradesco', 'Itaú', 'Santander', 'Banco do Nordeste', 'Lotérica'],
    alternarAvulso(v: boolean) { setAvulso(v); if (v) { setBanco(false); setBancoNome(''); } else setAvulsoNome(''); setEscolhido(null); setBusca(''); setListaAberta(false); setErros(e => ({ ...e, cliente: undefined })); },
    alternarBanco(v: boolean) { setBanco(v); if (v) { setAvulso(false); setAvulsoNome(''); } else setBancoNome(''); setEscolhido(null); setBusca(''); setListaAberta(false); setErros(e => ({ ...e, cliente: undefined })); },
    campoCliente,
    busca, escolhido, achados, listaAberta: listaAberta && !!q, ativo, setAtivo,
    oferecerNovo: !nomeExato && q.length >= 2,
    digitarCliente(v: string) { setBusca(v); setEscolhido(null); setListaAberta(true); setAtivo(-1); setMesPassado(null); guiasParaAnexar.current = {}; setGuiasStatus(''); },
    abrirLista: () => setListaAberta(true),
    fecharLista: () => setListaAberta(false),
    teclaNaLista(tecla: string): boolean {
      const total = achados.length + (!nomeExato && q.length >= 2 ? 1 : 0);
      if (!listaAberta || !total) return false;
      if (tecla === 'ArrowDown') { setAtivo(a => (a + 1 >= total ? 0 : a + 1)); return true; }
      if (tecla === 'ArrowUp') { setAtivo(a => (a <= 0 ? total - 1 : a - 1)); return true; }
      if (tecla === 'Enter' && ativo >= 0) {
        if (ativo < achados.length) escolher(achados[ativo]); else void adicionarCliente();
        return true;
      }
      return false;
    },
    escolher,
    adicionarCliente,
    competencia, setCompetencia,
    vencimento: vencimentoTexto,
    setVencimento(v: string) { setVencimentoTexto(v); const iso = dataIso(v); setVencimentoIso(iso); if (iso !== ultimoAuto.current) ultimoAuto.current = null; },
    // ---- os documentos ----
    linhas, total: entregas.totalDosItens(itens),
    planilha, focar, limparFoco: () => setFocar(null),
    abrirPlanilha: () => { setPlanilha(true); setFocar('__nova'); },
    fecharPlanilha: () => { setPlanilha(false); },
    livres: entregas.TIPOS_DE_DOCUMENTO.filter(t => !marcados.includes(t.chave)),
    podeOutro: !outroAberto && !outro.trim(),
    escolherDocumento(chave: string) {
      if (!chave) return;
      setErros(e => ({ ...e, itens: undefined }));
      if (chave === '__outro') { setOutroAberto(true); setFocar('outro-nome'); return; }
      setMarcados(m => (m.includes(chave) ? m : [...m, chave]));
      setFocar(chave);
    },
    mudarValor(l: LinhaDoDocumento, v: string) {
      if (l.dup) setDuplicatas(ds => ds.map(d => (d.id === l.chave ? { ...d, valor: v } : d)));
      else setValores(x => ({ ...x, [l.chave]: v }));
    },
    mudarFuncionario(l: LinhaDoDocumento, v: string) {
      if (l.dup) setDuplicatas(ds => ds.map(d => (d.id === l.chave ? { ...d, funcionario: v } : d)));
      else setFuncionarios(x => ({ ...x, [l.chave]: v }));
    },
    mudarOutro: (v: string) => setOutro(v),
    tirarDocumento(l: LinhaDoDocumento) {
      if (l.dup) setDuplicatas(ds => ds.filter(d => d.id !== l.chave));
      else if (l.outro) { setOutro(''); setOutroAberto(false); setValores(x => ({ ...x, outro: '' })); }
      else { setMarcados(m => m.filter(k => k !== l.chave)); setValores(x => ({ ...x, [l.chave]: '' })); }
      setDivergentes(d => ({ ...d, [l.chave]: '' }));
    },
    repetirDocumento(l: LinhaDoDocumento) {
      const base = l.dup || l;
      const id = 'dup' + (++seq);
      setDuplicatas(ds => [...ds, { id, rotulo: l.dup ? l.dup.rotulo : base.rotulo, pedeFuncionario: base.pedeFuncionario, valor: '', funcionario: '' }]);
      setFocar(id);
    },
    /** o valor bem diferente do mês passado (erro de digitação ou guia trocada) */
    conferirValor(l: LinhaDoDocumento) {
      if (l.dup || l.outro || !mesPassado) { setDivergentes(d => ({ ...d, [l.chave]: '' })); return; }
      const atual = entregas.valorDigitado(l.valor);
      const antes = mesPassado.itens.find(i => i.tipo === l.rotulo)?.valor;
      const fora = atual && antes && Math.abs(atual - antes) / antes >= 0.3;
      setDivergentes(d => ({ ...d, [l.chave]: fora ? 'No mês passado foi ' + entregas.dinheiro(antes) + ' — confira se está certo.' : '' }));
    },
    divergentes,
    podePuxarGuias, puxandoGuias, puxarGuiasDaPasta, guiasStatus,
    // ---- repetir o mês passado ----
    repetir: mesPassado ? 'Em ' + entregas.rotuloDaCompetencia(entregas.competenciaAnterior(competencia)) + ' esse cliente recebeu: ' + entregas.textoDosItens(mesPassado.itens) : '',
    repetirMesPassado() {
      if (!mesPassado) return;
      const m: string[] = [], v: Record<string, string> = {}, f: Record<string, string> = {}, fora: string[] = [];
      for (const i of mesPassado.itens) {
        const t = entregas.tipoPeloRotulo(i.tipo);
        if (!t) { fora.push(i.tipo); continue; }
        if (!m.includes(t.chave)) m.push(t.chave);
        if (i.valor != null) v[t.chave] = entregas.valorParaCampo(i.valor);
        if (i.funcionario) f[t.chave] = i.funcionario;
      }
      setMarcados(m); setValores(v); setFuncionarios(f); setDuplicatas([]); setOutro(fora.join(', ')); setOutroAberto(false);
      avisar('Documentos e valores do mês passado copiados — confira antes de confirmar.', 'info');
    },
    // ---- o honorário ----
    apenasHonorario,
    dicaDoHonorario: apenasHonorario && escolhido?.honorarioForma
      ? 'Esse cliente costuma pagar: ' + escolhido.honorarioForma + (escolhido.honorarioDia ? ' · dia ' + escolhido.honorarioDia : '') + (escolhido.pontoReferencia ? ' · ' + escolhido.pontoReferencia : '') : '',
    pix: apenasHonorario && pix, setPix, pixValor, setPixValor,
    pixSemChave: !esc.pixChave,
    pixCodigo,
    pixSub: pixNum ? entregas.dinheiro(pixNum) + ' · ' + (esc.pixNome || 'Nilma Contabilidade') : 'sem valor — o cliente digita quanto vai pagar',
    async copiarPix() {
      try { await navigator.clipboard.writeText(pixCodigo); avisar('Código Pix copiado.'); } catch { avisar('Não consegui copiar. Selecione o código à mão.', 'erro'); }
    },
    // ---- o PDF (Pelo link) ----
    pdfStatus, anexarPdf, foto: fotoEhGuia ? foto : null, tirarFoto: () => { setFoto(null); setFotoEhGuia(false); },
    erros,
    salvando,
    rotuloDoBotao: modo === 'link' ? 'Publicar no link do cliente' : 'Adicionar à rota',
    gravar,
  };
}
