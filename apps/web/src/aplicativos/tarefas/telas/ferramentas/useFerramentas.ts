// O ViewModel das Ferramentas (30/10/2026, o botão ao lado da engrenagem na gaveta): separar, juntar, girar e tirar
// páginas, PDF para imagem ou texto e a conversão de planilha. Tudo no navegador: o arquivo não sai do computador.
import { ferramentas } from '@nads/core';
import { baixarArquivo, baixarBytes, useRetorno } from '@nads/ui';
import { useState } from 'react';
import { imagensDoPdf, textoDoPdf } from './pdfParaArquivos';

export type Ferramenta = 'separar' | 'juntar' | 'paginas' | 'imagens' | 'texto' | 'planilha';

export const FERRAMENTAS: { valor: Ferramenta; rotulo: string }[] = [
  { valor: 'separar', rotulo: 'Separar' },
  { valor: 'juntar', rotulo: 'Juntar' },
  { valor: 'paginas', rotulo: 'Girar e tirar' },
  { valor: 'imagens', rotulo: 'PDF → imagem' },
  { valor: 'texto', rotulo: 'PDF → texto' },
  { valor: 'planilha', rotulo: 'Planilha' },
];

/** O PDF escolhido, guardado só na tela. */
interface PdfEscolhido { arquivo: File; bytes: Uint8Array; total: number }

const semExtensao = (nome: string) => nome.replace(/\.[^.]+$/, '');
const bytesDo = async (arquivo: File) => new Uint8Array(await arquivo.arrayBuffer());
/** Uma pausa entre um download e o outro: o navegador deixa de bloquear quando eles vêm espaçados. */
const pausa = () => new Promise(ok => setTimeout(ok, 400));

export function useFerramentas() {
  const { aviso } = useRetorno();
  const [ferramenta, setFerramenta] = useState<Ferramenta>('separar');
  const [ocupado, setOcupado] = useState(false);
  const [pdf, setPdf] = useState<PdfEscolhido | null>(null);
  // separar: um grupo por arquivo, separados por ponto e vírgula ("1-3; 4-6")
  const [grupos, setGrupos] = useState('');
  // girar e tirar: as páginas e o giro
  const [paginas, setPaginas] = useState('');
  const [graus, setGraus] = useState<90 | 180 | 270>(90);
  // juntar: os PDFs na ordem em que saem
  const [juntar, setJuntar] = useState<File[]>([]);
  // as leituras: as imagens das páginas e o texto (null = ainda não lido)
  const [imagens, setImagens] = useState<Blob[]>([]);
  const [texto, setTexto] = useState<string | null>(null);
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
    }
  }

  async function escolherPdf(arquivo: File | null) {
    if (!arquivo) return;
    await fazer(async () => {
      const bytes = await bytesDo(arquivo);
      const total = await ferramentas.pdf.contarPaginas(bytes);
      setPdf({ arquivo, bytes, total });
      setGrupos('');
      setPaginas('');
      setImagens([]);
      setTexto(null);
    }, 'Não consegui abrir esse PDF.');
  }

  function separar() {
    if (!pdf) return;
    const partes = grupos.split(';').map(g => g.trim()).filter(Boolean);
    if (!partes.length) return aviso({ tom: 'info', titulo: 'Escreva os grupos', texto: 'Por exemplo: 1-3; 4-6. Cada grupo vira um arquivo.' });
    const lidos = partes.map(g => ferramentas.pdf.paginasDoTexto(g, pdf.total));
    const errado = lidos.find(l => l.erro);
    if (errado) return aviso({ tom: 'info', titulo: 'Páginas não entendidas', texto: errado.erro });
    void fazer(async () => {
      const saidas = await ferramentas.pdf.separarPdf(pdf.bytes, lidos.map(l => l.paginas));
      for (const [i, bytes] of saidas.entries()) {
        baixarBytes(bytes, `${semExtensao(pdf.arquivo.name)} - parte ${i + 1}.pdf`, 'application/pdf');
        await pausa();
      }
    }, 'Não consegui separar o PDF.');
  }

  function editarPaginas(acao: 'girar' | 'remover') {
    if (!pdf) return;
    const lidas = ferramentas.pdf.paginasDoTexto(paginas, pdf.total);
    if (lidas.erro) return aviso({ tom: 'info', titulo: 'Páginas não entendidas', texto: lidas.erro });
    void fazer(async () => {
      const bytes = acao === 'girar'
        ? await ferramentas.pdf.girarPaginas(pdf.bytes, lidas.paginas, graus)
        : await ferramentas.pdf.removerPaginas(pdf.bytes, lidas.paginas);
      baixarBytes(bytes, `${semExtensao(pdf.arquivo.name)} - ${acao === 'girar' ? 'girado' : 'sem páginas'}.pdf`, 'application/pdf');
    }, acao === 'girar' ? 'Não consegui girar as páginas.' : 'Não consegui tirar as páginas.');
  }

  function adicionarParaJuntar(arquivos: File[]) {
    const pdfs = arquivos.filter(f => /\.pdf$/i.test(f.name));
    if (pdfs.length < arquivos.length) aviso({ tom: 'info', titulo: 'Só entram PDFs', texto: 'Os arquivos que não são PDF ficaram de fora.' });
    setJuntar(atual => [...atual, ...pdfs]);
  }

  function trocarDeLugar(i: number, para: number) {
    setJuntar(atual => {
      if (para < 0 || para >= atual.length) return atual;
      const nova = [...atual];
      [nova[i], nova[para]] = [nova[para], nova[i]];
      return nova;
    });
  }

  function tirarDoJuntar(i: number) {
    setJuntar(atual => atual.filter((_, n) => n !== i));
  }

  function juntarEBaixar() {
    if (juntar.length < 2) return aviso({ tom: 'info', titulo: 'Escolha ao menos dois PDFs' });
    void fazer(async () => {
      const bytes = await ferramentas.pdf.juntarPdfs(await Promise.all(juntar.map(bytesDo)));
      baixarBytes(bytes, 'juntado.pdf', 'application/pdf');
    }, 'Não consegui juntar os PDFs.');
  }

  function gerarImagens() {
    if (!pdf) return;
    void fazer(async () => setImagens(await imagensDoPdf(pdf.bytes)), 'Não consegui virar as páginas em imagem.');
  }

  async function baixarImagem(i: number) {
    if (!pdf) return;
    baixarBytes(new Uint8Array(await imagens[i].arrayBuffer()), `${semExtensao(pdf.arquivo.name)} - pág ${i + 1}.png`, 'image/png');
  }

  function baixarTodasAsImagens() {
    void (async () => {
      for (let i = 0; i < imagens.length; i++) {
        await baixarImagem(i);
        await pausa();
      }
    })();
  }

  function gerarTexto() {
    if (!pdf) return;
    void fazer(async () => setTexto(await textoDoPdf(pdf.bytes)), 'Não consegui ler o texto do PDF.');
  }

  function baixarTexto() {
    if (!pdf || texto === null) return;
    baixarArquivo(texto, semExtensao(pdf.arquivo.name) + '.txt', 'text/plain');
  }

  function converterPlanilhaEscolhida() {
    if (!planilha) return;
    void fazer(async () => {
      const c = ferramentas.planilha.converterPlanilha(await bytesDo(planilha), planilha.name, destino);
      baixarBytes(c.bytes, c.nome, c.tipo);
    }, 'Não consegui converter a planilha.');
  }

  return {
    ferramenta, setFerramenta, ocupado,
    pdf, escolherPdf, grupos, setGrupos, separar,
    paginas, setPaginas, graus, setGraus, editarPaginas,
    juntar, adicionarParaJuntar, trocarDeLugar, tirarDoJuntar, juntarEBaixar,
    imagens, gerarImagens, baixarImagem, baixarTodasAsImagens,
    texto, gerarTexto, baixarTexto,
    planilha, setPlanilha, destino, setDestino, converterPlanilhaEscolhida,
  };
}
