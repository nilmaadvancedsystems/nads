// Um PDF com guias de vários clientes vira um arquivo por cliente, antes de subir no lote do Fiscal ou do DP (plano do
// Acessórias, 17/11/2026, ficha E16-pdf-com-varios-clientes; frase do dono: "Separar PDF (E16)"). Tudo no navegador: o
// texto de cada página (pdf.js), de quem é cada página pelo CNPJ/CPF do Cadastro (core: entregas.paginasPorCliente) e o
// corte (core: ferramentas.pdf.separarPdf). A pessoa vê a lista e confirma; nada sobe sem confirmar. PDF de uma página,
// ou com um cliente só, sobe como veio. O robô não muda: os arquivos separados entram no lote como se a pessoa tivesse
// subido um a um.
import { entregas, ferramentas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { createElement } from 'react';
import { useTodosOsCadastros } from '../../dados/repo';
import { textoPorPagina } from './pdfParaArquivos';

export interface ArquivoParaSubir { nome: string; bytes: Uint8Array }

interface PdfSeparado { origem: string; partes: { nome: string; rotulo: string }[] }

const paginas = (n: number) => n + (n === 1 ? ' página' : ' páginas');

/**
 * Devolve uma função que recebe os arquivos escolhidos e devolve os que vão subir (com os PDFs de vários clientes já
 * separados), ou null quando a pessoa cancela.
 */
export function useSepararPorCliente(): (arquivos: ArquivoParaSubir[]) => Promise<ArquivoParaSubir[] | null> {
  const { modal, toast } = useRetorno();
  const cadastros = useTodosOsCadastros();
  const lista = [...cadastros.porId.values()];
  const clientes = lista.filter(c => c.codigo != null && c.cnpj).map(c => ({ codigo: c.codigo as number, documento: c.cnpj as string }));
  const nomeDe = (codigo: number) => lista.find(c => c.codigo === codigo)?.nome || '';

  return async arquivos => {
    const saida: ArquivoParaSubir[] = [];
    const separados: PdfSeparado[] = [];
    const semTexto: string[] = [];
    // os mesmos arquivos, sem separar (o "Subir sem separar")
    const comoVieram = [...arquivos];
    for (const a of arquivos) {
      if (!/\.pdf$/i.test(a.nome)) { saida.push(a); continue; }
      let textos: string[];
      try { textos = await textoPorPagina(a.bytes); } catch { saida.push(a); continue; }
      if (textos.length < 2) { saida.push(a); continue; }
      if (textos.every(t => !t.trim())) { semTexto.push(a.nome); saida.push(a); continue; }
      const r = entregas.paginasPorCliente(textos, clientes);
      if (r.grupos.length < 2) { saida.push(a); continue; }
      const grupos = [...r.grupos.map(g => g.paginas), ...(r.semCliente.length ? [r.semCliente] : [])];
      const pdfs = await ferramentas.pdf.separarPdf(a.bytes, grupos);
      const base = a.nome.replace(/\.pdf$/i, '');
      const partes = r.grupos.map((g, i) => ({ nome: base + ' - ' + g.codigo + '.pdf', bytes: pdfs[i], rotulo: g.codigo + ' · ' + (nomeDe(g.codigo) || 'cliente') + ' (' + paginas(g.paginas.length) + ')' }));
      if (r.semCliente.length) partes.push({ nome: base + ' - sem cliente.pdf', bytes: pdfs[pdfs.length - 1], rotulo: 'Sem cliente: a revisão do lote pede para escolher (' + paginas(r.semCliente.length) + ')' });
      saida.push(...partes.map(p => ({ nome: p.nome, bytes: p.bytes })));
      separados.push({ origem: a.nome, partes });
    }
    if (semTexto.length) toast('Não deu para ler o texto de ' + semTexto.join(', ') + ' (PDF de foto). Se tiver guias de vários clientes, suba separado.');
    if (!separados.length) return saida;

    const total = separados.reduce((n, s) => n + s.partes.length, 0);
    const escolha = await modal<'separar' | 'inteiro' | null>({
      titulo: 'Separar as guias por cliente',
      texto: separados.length === 1
        ? 'Este PDF tem guias de ' + separados[0].partes.filter(p => !p.nome.endsWith(' - sem cliente.pdf')).length + ' clientes. Vira um arquivo por cliente:'
        : separados.length + ' PDFs têm guias de vários clientes. Viram ' + total + ' arquivos:',
      corpo: createElement('div', null, separados.map(s => createElement('div', { key: s.origem, style: { marginBottom: 8 } },
        createElement('p', { className: 'fraco' }, s.origem),
        createElement('ul', null, s.partes.map(p => createElement('li', { key: p.nome }, p.rotulo)))))),
      botoes: [
        { rotulo: 'Cancelar', valor: null, variante: 'btn-outline' },
        { rotulo: 'Subir sem separar', valor: 'inteiro', variante: 'btn-outline' },
        { rotulo: 'Separar e subir', valor: 'separar', variante: 'btn-primary' },
      ],
    });
    return escolha === 'separar' ? saida : escolha === 'inteiro' ? comoVieram : null;
  };
}
