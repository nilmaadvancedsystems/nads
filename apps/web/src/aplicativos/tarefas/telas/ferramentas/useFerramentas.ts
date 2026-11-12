// O ViewModel das Ferramentas (30/10/2026, o botão ao lado da engrenagem na gaveta): separar, juntar, girar e tirar
// páginas, PDF para imagem ou texto e a conversão de planilha. Tudo no navegador: o arquivo não sai do computador.
// 12/11/2026 ("melhorar o visual e as funcionalidades da aba de Ferramentas"): arrastar e soltar, as páginas em
// miniatura (os cortes do Separar, o giro e o tirar de cada página), o Juntar com a ordem arrastável e com imagem, a
// grade do PDF → imagem com o .zip, e as ferramentas novas: Comprimir, Numerar, Imagem → PDF e o OCR do PDF → texto.
import { ferramentas } from '@nads/core';
import { baixarArquivo, baixarBytes, useRetorno, type NomeIcone } from '@nads/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { imagemParaPdf, imagensDoPdf, miniaturasDoPdf, paginasEmJpg, textoDoPdf, textoPorOcr, type FormatoDaImagem } from './pdfParaArquivos';

const { arquivos: arq, pdf: regras } = ferramentas;

export type Ferramenta = 'separar' | 'juntar' | 'paginas' | 'comprimir' | 'numerar' | 'imagens' | 'texto' | 'imagem-pdf' | 'planilha';

/** As abas, com o ícone e a frase do que cada uma faz (a primeira coisa que a pessoa lê). */
export const FERRAMENTAS: { valor: Ferramenta; rotulo: string; icone: NomeIcone; descricao: string }[] = [
  { valor: 'separar', rotulo: 'Separar', icone: 'copiar', descricao: 'Divida um PDF em vários arquivos: clique na página que começa cada arquivo novo.' },
  { valor: 'juntar', rotulo: 'Juntar', icone: 'list', descricao: 'Junte PDFs e imagens num arquivo só, na ordem que você arrastar.' },
  { valor: 'paginas', rotulo: 'Girar e tirar', icone: 'girar', descricao: 'Gire ou tire páginas pelas miniaturas e baixe o PDF arrumado.' },
  { valor: 'comprimir', rotulo: 'Comprimir', icone: 'minimizar', descricao: 'Diminua o tamanho do PDF para mandar por e-mail ou subir em portal.' },
  { valor: 'numerar', rotulo: 'Numerar', icone: 'hash', descricao: 'Coloque o número das páginas no rodapé, como "Página 1 de 10".' },
  { valor: 'imagens', rotulo: 'PDF → imagem', icone: 'imagem', descricao: 'Baixe as páginas do PDF como imagem: uma por uma ou todas num .zip.' },
  { valor: 'texto', rotulo: 'PDF → texto', icone: 'fileText', descricao: 'Copie o texto do PDF. Se ele for digitalizado (foto), o OCR lê a imagem.' },
  { valor: 'imagem-pdf', rotulo: 'Imagem → PDF', icone: 'camera', descricao: 'Transforme fotos e prints (JPG, PNG) num PDF, uma página por imagem.' },
  { valor: 'planilha', rotulo: 'Planilha', icone: 'grade', descricao: 'Converta planilhas entre Excel (.xls, .xlsx), LibreOffice (.ods) e CSV.' },
];

/** As ferramentas que trabalham com um PDF só (escolhido uma vez e usado em qualquer uma delas). */
export const COM_UM_PDF: readonly Ferramenta[] = ['separar', 'paginas', 'comprimir', 'numerar', 'imagens', 'texto'];

/** O PDF escolhido, guardado só na tela. */
interface PdfEscolhido { arquivo: File; bytes: Uint8Array; total: number }

/** Um arquivo das listas (Juntar e Imagem → PDF). */
export interface ItemDaLista { id: number; arquivo: File; tipo: 'pdf' | 'imagem'; paginas: number | null; miniatura: string | null }

/** A miniatura de uma página do PDF. */
export interface MiniaturaDaPagina { url: string; proporcao: number }

/** A largura das miniaturas, em pixels de tela. */
const LARGURA_DA_MINIATURA = 150;

const bytesDo = async (arquivo: File) => new Uint8Array(await arquivo.arrayBuffer());
const ehNomeDePdf = (nome: string) => /\.pdf$/i.test(nome);
const PDF = 'application/pdf';
const ZIP = 'application/zip';
/** Uma pausa entre um download e o outro: o navegador deixa de bloquear quando eles vêm espaçados. */
const pausa = () => new Promise(ok => setTimeout(ok, 400));
/** O andamento do trabalho longo: "Páginas lidas: 3 de 10…" (contado depois de cada página pronta). */
const andando = (oQue: string) => (feitas: number, total: number) => oQue + ': ' + feitas + ' de ' + total + '…';

let proximoId = 1;

/** Uma lista de arquivos com a ordem que a pessoa arrasta (o Juntar e o Imagem → PDF). */
function useLista(aceita: (f: File) => boolean, recusado: string, aviso: ReturnType<typeof useRetorno>['aviso']) {
  const [itens, setItens] = useState<ItemDaLista[]>([]);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const urls = useRef(new Set<string>());
  useEffect(() => () => { urls.current.forEach(u => URL.revokeObjectURL(u)); }, []);

  function guardarUrl(b: Blob) {
    const u = URL.createObjectURL(b);
    urls.current.add(u);
    return u;
  }
  function soltarUrl(u: string | null) {
    if (u && urls.current.delete(u)) URL.revokeObjectURL(u);
  }
  function mudar(id: number, m: Partial<ItemDaLista>) {
    setItens(atual => atual.map(i => (i.id === id ? { ...i, ...m } : i)));
  }

  function adicionar(fs: File[]) {
    const aceitos = fs.filter(aceita);
    if (aceitos.length < fs.length) aviso({ tom: 'info', titulo: 'Alguns arquivos ficaram de fora', texto: recusado });
    const novos: ItemDaLista[] = aceitos.map(arquivo => ({
      id: proximoId++, arquivo, tipo: ehNomeDePdf(arquivo.name) ? 'pdf' : 'imagem', paginas: ehNomeDePdf(arquivo.name) ? null : 1,
      miniatura: ehNomeDePdf(arquivo.name) ? null : guardarUrl(arquivo),
    }));
    setItens(atual => [...atual, ...novos]);
    // o PDF: as páginas e a miniatura da primeira, depois de aparecer na lista
    for (const item of novos.filter(i => i.tipo === 'pdf')) {
      void (async () => {
        try {
          const bytes = await bytesDo(item.arquivo);
          mudar(item.id, { paginas: await regras.contarPaginas(bytes) });
          await miniaturasDoPdf(bytes, 64, (_i, img) => mudar(item.id, { miniatura: guardarUrl(img) }), () => false, [0]);
        } catch {
          aviso({ tom: 'erro', titulo: 'Não consegui abrir ' + item.arquivo.name, texto: 'Ele saiu da lista: confira se o PDF abre no computador.' });
          setItens(atual => atual.filter(i => i.id !== item.id));
        }
      })();
    }
  }

  function mover(de: number, para: number) {
    setItens(atual => arq.moverItem(atual, de, para));
  }
  function tirar(id: number) {
    setItens(atual => {
      soltarUrl(atual.find(i => i.id === id)?.miniatura ?? null);
      return atual.filter(i => i.id !== id);
    });
  }
  function limpar() {
    itens.forEach(i => soltarUrl(i.miniatura));
    setItens([]);
  }
  /** Soltou o item que estava sendo arrastado em cima do item `para`. */
  function soltarEm(para: number) {
    if (arrastando !== null) mover(arrastando, para);
    setArrastando(null);
  }

  const paginas = itens.reduce((s, i) => s + (i.paginas ?? 0), 0);
  const tamanho = itens.reduce((s, i) => s + i.arquivo.size, 0);
  return { itens, adicionar, mover, tirar, limpar, arrastando, setArrastando, soltarEm, paginas, tamanho };
}

export function useFerramentas() {
  const { aviso } = useRetorno();
  const [ferramenta, setFerramenta] = useState<Ferramenta>('separar');
  const [ocupado, setOcupado] = useState(false);
  /** o andamento do trabalho longo ("Lendo a página 3 de 10…"); null = sem trabalho longo */
  const [andamento, setAndamento] = useState<string | null>(null);

  // ─── o PDF escolhido e as miniaturas das páginas ───
  const [pdf, setPdf] = useState<PdfEscolhido | null>(null);
  /** a miniatura de cada página: a imagem e a proporção (largura ÷ altura); null = ainda desenhando */
  const [miniaturas, setMiniaturas] = useState<(MiniaturaDaPagina | null)[]>([]);
  const vez = useRef(0);
  const urlsDasMiniaturas = useRef<string[]>([]);
  const soltarMiniaturas = () => { urlsDasMiniaturas.current.forEach(u => URL.revokeObjectURL(u)); urlsDasMiniaturas.current = []; };
  useEffect(() => () => { vez.current++; soltarMiniaturas(); }, []);

  // separar: um grupo por arquivo, separados por ponto e vírgula ("1-3; 4-6"); vazio = um arquivo com tudo
  const [grupos, setGrupos] = useState('');
  // girar e tirar: o giro de cada página e as que saem; o campo de páginas aplica nas digitadas
  const [giros, setGiros] = useState<number[]>([]);
  const [tiradas, setTiradas] = useState<number[]>([]);
  const [paginas, setPaginas] = useState('');
  // comprimir
  const [nivel, setNivel] = useState<ferramentas.arquivos.NivelDeCompressao>('media');
  const [comprimido, setComprimido] = useState<{ bytes: Uint8Array; antes: number; depois: number } | null>(null);
  // numerar
  const [modelo, setModelo] = useState<ferramentas.pdf.ModeloDoNumero>('pagina-de');
  const [lugar, setLugar] = useState<ferramentas.pdf.LugarDoNumero>('direita');
  const [primeiro, setPrimeiro] = useState('1');
  // PDF → imagem
  const [formato, setFormato] = useState<FormatoDaImagem>('png');
  const [resolucao, setResolucao] = useState<'normal' | 'alta'>('normal');
  // PDF → texto (null = ainda não lido)
  const [texto, setTexto] = useState<string | null>(null);
  const [textoDoOcr, setTextoDoOcr] = useState(false);
  // as listas
  const juntar = useLista(f => ehNomeDePdf(f.name) || ferramentas.imagens.ehNomeDeImagem(f.name), 'Só entram PDF e imagem (JPG, PNG, WEBP, GIF ou BMP).', aviso);
  const fotos = useLista(f => ferramentas.imagens.ehNomeDeImagem(f.name), 'Só entram imagens (JPG, PNG, WEBP, GIF ou BMP).', aviso);
  const [paginaDaImagem, setPaginaDaImagem] = useState<ferramentas.pdf.PaginaDaImagem>('a4');
  // a planilha
  const [planilha, setPlanilha] = useState<File | null>(null);
  const [destino, setDestino] = useState<ferramentas.planilha.FormatoDeSaida>('xlsx');

  async function fazer(acao: () => Promise<void>, falha: string) {
    setOcupado(true);
    try {
      await acao();
    } catch (e) {
      aviso({ tom: 'erro', titulo: falha, texto: e instanceof Error ? e.message : undefined });
    } finally {
      setOcupado(false);
      setAndamento(null);
    }
  }

  const nomeBase = pdf ? arq.semExtensao(pdf.arquivo.name) : 'documento';

  async function escolherPdf(arquivos: File[]) {
    const arquivo = arquivos[0];
    if (!arquivo) return;
    if (!ehNomeDePdf(arquivo.name)) return aviso({ tom: 'info', titulo: 'Escolha um PDF', texto: arquivo.name + ' não é PDF. Para imagens, use Imagem → PDF; para planilhas, a aba Planilha.' });
    await fazer(async () => {
      const bytes = await bytesDo(arquivo);
      const total = await regras.contarPaginas(bytes);
      const esta = ++vez.current;
      soltarMiniaturas();
      setPdf({ arquivo, bytes, total });
      setMiniaturas(Array<MiniaturaDaPagina | null>(total).fill(null));
      setGrupos('');
      setGiros(Array<number>(total).fill(0));
      setTiradas([]);
      setPaginas('');
      setComprimido(null);
      setTexto(null);
      setTextoDoOcr(false);
      // as miniaturas aparecem uma a uma, sem segurar a tela
      void miniaturasDoPdf(bytes, LARGURA_DA_MINIATURA, (i, img, proporcao) => {
        const u = URL.createObjectURL(img);
        urlsDasMiniaturas.current.push(u);
        setMiniaturas(atual => atual.map((m, k) => (k === i ? { url: u, proporcao } : m)));
      }, () => vez.current !== esta).catch(() => undefined);
    }, 'Não consegui abrir esse PDF.');
  }

  // ─── separar ───
  /** os grupos que valem agora: os escritos, ou um arquivo com todas as páginas */
  const lidos = useMemo(() => {
    if (!pdf) return { grupos: [] as number[][], erro: undefined as string | undefined };
    if (!grupos.trim()) return { grupos: regras.gruposPelosCortes(pdf.total, []), erro: undefined };
    return regras.gruposDoTexto(grupos, pdf.total);
  }, [grupos, pdf]);
  /** os cortes que as miniaturas mostram; null quando os grupos foram escritos fora de sequência */
  const cortes = pdf && !lidos.erro ? regras.cortesDosGrupos(lidos.grupos, pdf.total) : null;
  /** de que arquivo(s) cada página faz parte (1, 2…), para o selo da miniatura */
  const arquivosDaPagina = useMemo(() => {
    const m: number[][] = Array.from({ length: pdf?.total ?? 0 }, () => []);
    lidos.grupos.forEach((g, i) => g.forEach(p => m[p]?.push(i + 1)));
    return m;
  }, [lidos, pdf]);

  /** clicou na página: ela começa um arquivo novo (ou deixa de começar) */
  function alternarCorte(pagina: number) {
    if (!pdf || pagina === 0) return;
    const total = pdf.total;
    // pelo texto mais recente (dois cliques seguidos não se perdem)
    setGrupos(texto => {
      const lido = texto.trim() ? regras.gruposDoTexto(texto, total) : { grupos: regras.gruposPelosCortes(total, []) };
      const atuais = (!('erro' in lido && lido.erro) && regras.cortesDosGrupos(lido.grupos, total)) || [];
      const novos = atuais.includes(pagina) ? atuais.filter(c => c !== pagina) : [...atuais, pagina];
      return novos.length ? regras.textoDosGrupos(regras.gruposPelosCortes(total, novos)) : '';
    });
  }
  function umaPorArquivo() {
    if (pdf) setGrupos(regras.textoDosGrupos(regras.gruposPelosCortes(pdf.total, Array.from({ length: pdf.total }, (_, i) => i))));
  }

  function separar(comoZip: boolean) {
    if (!pdf) return;
    if (lidos.erro) return aviso({ tom: 'info', titulo: 'Páginas não entendidas', texto: lidos.erro });
    void fazer(async () => {
      const saidas = await regras.separarPdf(pdf.bytes, lidos.grupos);
      const nomes = saidas.map((_, i) => `${nomeBase} - parte ${i + 1} (pág ${regras.textoDasPaginas(lidos.grupos[i]).replace(/, /g, ',')}).pdf`);
      if (saidas.length === 1) return baixarBytes(saidas[0], nomes[0], PDF);
      if (comoZip) return baixarBytes(arq.zipDosArquivos(saidas.map((bytes, i) => ({ nome: nomes[i], bytes }))), nomeBase + ' - separado.zip', ZIP);
      for (const [i, bytes] of saidas.entries()) {
        baixarBytes(bytes, nomes[i], PDF);
        await pausa();
      }
    }, 'Não consegui separar o PDF.');
  }

  // ─── girar e tirar ───
  function girar(pagina: number, graus = 90) {
    setGiros(atual => atual.map((g, i) => (i === pagina ? regras.somarGiro(g, graus) : g)));
  }
  function alternarTirada(pagina: number) {
    setTiradas(atual => (atual.includes(pagina) ? atual.filter(p => p !== pagina) : [...atual, pagina]));
  }
  /** aplica nas páginas digitadas (ou em todas, com o campo vazio, no girar) */
  function aplicarNasDigitadas(acao: 'girar' | 'tirar') {
    if (!pdf) return;
    const todas = !paginas.trim() && acao === 'girar';
    const lidas = todas ? { paginas: Array.from({ length: pdf.total }, (_, i) => i) } : regras.paginasDoTexto(paginas, pdf.total);
    if ('erro' in lidas && lidas.erro) return aviso({ tom: 'info', titulo: 'Páginas não entendidas', texto: lidas.erro });
    if (acao === 'girar') setGiros(atual => atual.map((g, i) => (lidas.paginas.includes(i) ? regras.somarGiro(g, 90) : g)));
    else setTiradas(atual => [...new Set([...atual, ...lidas.paginas])]);
  }
  function desfazerPaginas() {
    if (!pdf) return;
    setGiros(Array<number>(pdf.total).fill(0));
    setTiradas([]);
  }
  const giradas = giros.filter((g, i) => g && !tiradas.includes(i)).length;
  function salvarPaginas() {
    if (!pdf) return;
    if (!giradas && !tiradas.length) return aviso({ tom: 'info', titulo: 'Nada mudou ainda', texto: 'Gire ou tire alguma página nas miniaturas.' });
    if (tiradas.length >= pdf.total) return aviso({ tom: 'info', titulo: 'Não dá para tirar todas as páginas' });
    void fazer(async () => {
      const bytes = await regras.editarPdf(pdf.bytes, { giros, tirar: tiradas });
      baixarBytes(bytes, `${nomeBase} - arrumado.pdf`, PDF);
    }, 'Não consegui arrumar as páginas.');
  }

  // ─── comprimir ───
  function comprimir() {
    if (!pdf) return;
    const n = arq.NIVEIS_DE_COMPRESSAO[nivel];
    void fazer(async () => {
      setComprimido(null);
      const passo = andando('Páginas comprimidas');
      const paginasJpg = await paginasEmJpg(pdf.bytes, n.escala, n.qualidade, (f, t) => setAndamento(passo(f, t)));
      setAndamento('Montando o PDF…');
      const bytes = await regras.pdfDeImagens(paginasJpg);
      setComprimido({ bytes, antes: pdf.arquivo.size, depois: bytes.length });
    }, 'Não consegui comprimir o PDF.');
  }
  function baixarComprimido() {
    if (comprimido) baixarBytes(comprimido.bytes, `${nomeBase} - comprimido.pdf`, PDF);
  }
  function mudarNivel(n: ferramentas.arquivos.NivelDeCompressao) {
    setNivel(n);
    setComprimido(null);
  }

  // ─── numerar ───
  const primeiroNumero = Math.max(1, Math.floor(Number(primeiro)) || 1);
  /** o texto do número de cada página, para a prévia nas miniaturas */
  const numeroDaPagina = (i: number) => regras.textoDoNumero(modelo, primeiroNumero + i, (pdf?.total ?? 0) + primeiroNumero - 1);
  function numerar() {
    if (!pdf) return;
    void fazer(async () => {
      const bytes = await regras.numerarPaginas(pdf.bytes, { modelo, lugar, primeiro: primeiroNumero });
      baixarBytes(bytes, `${nomeBase} - numerado.pdf`, PDF);
    }, 'Não consegui numerar as páginas.');
  }

  // ─── PDF → imagem ───
  const escala = resolucao === 'alta' ? 3 : 2;
  const extensao = formato === 'png' ? 'png' : 'jpg';
  const tipoDaImagem = formato === 'png' ? 'image/png' : 'image/jpeg';
  function baixarImagem(i: number) {
    if (!pdf) return;
    void fazer(async () => {
      const [img] = await imagensDoPdf(pdf.bytes, escala, formato, [i]);
      baixarBytes(new Uint8Array(await img.arrayBuffer()), `${nomeBase} - pág ${i + 1}.${extensao}`, tipoDaImagem);
    }, 'Não consegui virar a página em imagem.');
  }
  function baixarTodasAsImagens() {
    if (!pdf) return;
    void fazer(async () => {
      const passo = andando('Páginas convertidas');
      const imgs = await imagensDoPdf(pdf.bytes, escala, formato, undefined, (f, t) => setAndamento(passo(f, t)));
      if (imgs.length === 1) return baixarBytes(new Uint8Array(await imgs[0].arrayBuffer()), `${nomeBase} - pág 1.${extensao}`, tipoDaImagem);
      const arquivos = await Promise.all(imgs.map(async (img, i) => ({ nome: `${nomeBase} - pág ${String(i + 1).padStart(String(imgs.length).length, '0')}.${extensao}`, bytes: new Uint8Array(await img.arrayBuffer()) })));
      baixarBytes(arq.zipDosArquivos(arquivos), `${nomeBase} - imagens.zip`, ZIP);
    }, 'Não consegui virar as páginas em imagem.');
  }

  // ─── PDF → texto ───
  function gerarTexto() {
    if (!pdf) return;
    void fazer(async () => {
      setTexto(await textoDoPdf(pdf.bytes));
      setTextoDoOcr(false);
    }, 'Não consegui ler o texto do PDF.');
  }
  function lerComOcr() {
    if (!pdf) return;
    void fazer(async () => {
      setAndamento('Preparando o OCR (na primeira vez demora um pouco)…');
      const passo = andando('Páginas lidas');
      const lido = await textoPorOcr(pdf.bytes, (f, t) => setAndamento(passo(f, t)));
      setTexto(lido);
      setTextoDoOcr(true);
    }, 'Não consegui ler o PDF com o OCR.');
  }
  function baixarTexto() {
    if (!pdf || texto === null) return;
    baixarArquivo(texto, nomeBase + '.txt', 'text/plain');
  }
  function copiarTexto() {
    if (!texto) return;
    navigator.clipboard.writeText(texto).then(
      () => aviso({ tom: 'ok', titulo: 'Texto copiado' }),
      () => aviso({ tom: 'erro', titulo: 'O navegador não deixou copiar', texto: 'Selecione o texto e use Ctrl+C.' }),
    );
  }

  // ─── juntar e imagem → PDF ───
  async function bytesDaLista(itens: ItemDaLista[]) {
    return Promise.all(itens.map(i => (i.tipo === 'pdf' ? bytesDo(i.arquivo) : imagemParaPdf(i.arquivo))));
  }
  function juntarEBaixar() {
    if (juntar.itens.length < 2) return aviso({ tom: 'info', titulo: 'Escolha ao menos dois arquivos' });
    void fazer(async () => {
      const bytes = await regras.juntarArquivos(await bytesDaLista(juntar.itens), paginaDaImagem);
      baixarBytes(bytes, `${arq.semExtensao(juntar.itens[0].arquivo.name)} - juntado.pdf`, PDF);
    }, 'Não consegui juntar os arquivos.');
  }
  function imagensEmPdf() {
    if (!fotos.itens.length) return aviso({ tom: 'info', titulo: 'Escolha ao menos uma imagem' });
    void fazer(async () => {
      const bytes = await regras.pdfDeImagens((await bytesDaLista(fotos.itens)).map(b => ({ bytes: b })), paginaDaImagem);
      const nome = fotos.itens.length === 1 ? arq.semExtensao(fotos.itens[0].arquivo.name) : 'imagens';
      baixarBytes(bytes, nome + '.pdf', PDF);
    }, 'Não consegui montar o PDF das imagens.');
  }

  // ─── planilha ───
  function escolherPlanilha(fs: File[]) {
    const f = fs[0];
    if (!f) return;
    if (!ferramentas.planilha.formatoDaPlanilha(f.name)) return aviso({ tom: 'info', titulo: 'Escolha uma planilha', texto: 'Aceita .xls, .xlsx, .ods e .csv.' });
    setPlanilha(f);
  }
  function converterPlanilhaEscolhida() {
    if (!planilha) return;
    void fazer(async () => {
      const c = ferramentas.planilha.converterPlanilha(await bytesDo(planilha), planilha.name, destino);
      baixarBytes(c.bytes, c.nome, c.tipo);
    }, 'Não consegui converter a planilha.');
  }

  const descricao = FERRAMENTAS.find(f => f.valor === ferramenta)?.descricao ?? '';
  const tamanhoDoPdf = pdf ? arq.tamanhoLegivel(pdf.arquivo.size) : '';

  return {
    ferramenta, setFerramenta, descricao, ocupado, andamento,
    pdf, tamanhoDoPdf, escolherPdf, miniaturas,
    grupos, setGrupos, lidos, cortes, arquivosDaPagina, alternarCorte, umaPorArquivo, separar,
    giros, tiradas, giradas, girar, alternarTirada, paginas, setPaginas, aplicarNasDigitadas, desfazerPaginas, salvarPaginas,
    nivel, mudarNivel, comprimir, comprimido, baixarComprimido,
    modelo, setModelo, lugar, setLugar, primeiro, setPrimeiro, numeroDaPagina, numerar,
    formato, setFormato, resolucao, setResolucao, baixarImagem, baixarTodasAsImagens,
    texto, textoDoOcr, gerarTexto, lerComOcr, baixarTexto, copiarTexto,
    juntar, fotos, paginaDaImagem, setPaginaDaImagem, juntarEBaixar, imagensEmPdf,
    planilha, escolherPlanilha, limparPlanilha: () => setPlanilha(null), destino, setDestino, converterPlanilhaEscolhida,
  };
}
