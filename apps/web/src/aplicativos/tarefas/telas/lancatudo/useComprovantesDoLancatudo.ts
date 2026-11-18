// ViewModel dos comprovantes do Lançatudo (18/11/2026: "quero a opção de adicionar comprovantes, não só extratos"; "com os
// comprovantes tem como saber o cliente e afins, de maneira mais fácil; ele também precisa puxar os comprovantes do drive").
// Do computador (PDF ou imagem) ou da pasta COMPROVANTES do mês no Drive (a mesma do Extrator: EXTRATOS/<ano>/<mês>/
// COMPROVANTES/<BANCO>): cada arquivo é lido aqui (o texto do PDF; o escaneado e a imagem, pelo OCR) e só a data, o valor, o
// favorecido e o CPF/CNPJ vão para o banco. O do Drive abre de novo pelo link do robô; o do computador, só nesta aba.
import { creditor as cr, extrator as x, lancatudo as lt } from '@nads/core';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ocrQueAvisa } from '../../../../comum/ocr';
import { driveDoExtrator } from '../../etapas/extrator/dados/fonte';
import type { useRegistroDoLancatudo } from './useRegistroDoLancatudo';

x.definirWorkerDoPdf(workerDoPdf);

type Vm = ReturnType<typeof useRegistroDoLancatudo>;

const ACEITAR = ['.pdf', '.png', '.jpg', '.jpeg'];
const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));
const letras = (ps: x.ItemDeTexto[][]) => ps.reduce((s, p) => s + p.reduce((t, i) => t + i.texto.length, 0), 0);
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** O texto do comprovante: o do PDF; o PDF escaneado e a imagem, pelo OCR. */
async function textoDoArquivo(nome: string, bytes: Uint8Array): Promise<string> {
  if (/\.(png|jpe?g)$/i.test(nome)) return lt.textoEmLinhas(await ocrQueAvisa(bytes, 'imagem'));
  const paginas = await x.itensDoPdf(bytes);
  if (letras(paginas) >= 30) return lt.textoEmLinhas(paginas);
  return lt.textoEmLinhas(await ocrQueAvisa(bytes, 'pdf'));
}

export interface ResumoDaLeitura { lidos: number; jaEstavam: number; erros: { nome: string; erro: string }[] }

export function useComprovantesDoLancatudo(vm: Vm) {
  const drive = driveDoExtrator();
  useSyncExternalStore(drive.assinar, drive.versao, drive.versao);
  const [lendo, setLendo] = useState('');
  const [resumo, setResumo] = useState<ResumoDaLeitura | null>(null);
  // os arquivos do computador desta aba (para ver de novo); o do Drive abre pelo link do robô
  const locais = useRef(new Map<string, string>());
  useEffect(() => () => { for (const u of locais.current.values()) URL.revokeObjectURL(u); }, []);

  async function ler(nome: string, bytes: Uint8Array, driveId?: string): Promise<lt.ComprovanteDoLancatudo> {
    const lido = lt.lerComprovante(await textoDoArquivo(nome, bytes));
    if (!lido) throw new Error('Não achei o valor neste arquivo (é um comprovante?).');
    return { id: novoId(), nome, ...(driveId ? { driveId } : {}), ...lido, em: new Date().toISOString(), por: vm.quem };
  }

  async function doComputador(arquivos: readonly File[]) {
    const r: ResumoDaLeitura = { lidos: 0, jaEstavam: 0, erros: [] };
    const novos: lt.ComprovanteDoLancatudo[] = [];
    for (const [i, f] of arquivos.entries()) {
      if (!ACEITAR.some(e => f.name.toLowerCase().endsWith(e))) { r.erros.push({ nome: f.name, erro: 'Só PDF ou imagem (PNG, JPG).' }); continue; }
      setLendo('Lendo ' + (i + 1) + ' de ' + arquivos.length + ': ' + f.name);
      try {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const c = await ler(f.name, bytes);
        locais.current.set(c.id, URL.createObjectURL(new Blob([bytes.slice()], { type: /\.pdf$/i.test(f.name) ? 'application/pdf' : 'image/' + (/png$/i.test(f.name) ? 'png' : 'jpeg') })));
        novos.push(c);
      } catch (e) { r.erros.push({ nome: f.name, erro: mensagem(e) }); }
    }
    const entraram = vm.guardarComprovantes(novos);
    r.lidos = entraram;
    r.jaEstavam = novos.length - entraram;
    setLendo('');
    setResumo(r);
  }

  const acesso = drive.acesso();
  const precisaEntrar = !drive.exemplos && acesso.pronto && !acesso.entrou;

  async function doDrive() {
    const r: ResumoDaLeitura = { lidos: 0, jaEstavam: 0, erros: [] };
    setResumo(null);
    setLendo('Procurando a pasta da empresa no Drive…');
    try {
      const pasta = await drive.pastaDoCliente(vm.empresa.codigo);
      if (!pasta) throw new Error('A empresa não tem pasta no Drive (pelo código ' + vm.empresa.codigo + ').');
      const doMes = x.comprovantesNoDrive(pasta.itens, pasta.raiz, [vm.competencia])[vm.competencia] || [];
      const doBanco = x.comprovantesDoBanco(doMes, cr.bancoDaLinha(vm.banco.nome, vm.banco.id), vm.bancos.length === 1);
      const ja = new Set(vm.comprovantes.map(c => c.driveId).filter(Boolean));
      const faltam = doBanco.filter(c => !ja.has(c.id));
      r.jaEstavam = doBanco.length - faltam.length;
      if (!doBanco.length) {
        r.erros.push({ nome: 'Drive', erro: 'Nenhum comprovante de ' + vm.banco.nome + ' em ' + vm.rotuloDoMes.toLowerCase() + ' na pasta EXTRATOS/' + vm.competencia.slice(0, 4) + '/' + vm.competencia.slice(5) + '/COMPROVANTES.' });
      }
      const novos: lt.ComprovanteDoLancatudo[] = [];
      for (const [i, c] of faltam.entries()) {
        setLendo('Baixando do Drive ' + (i + 1) + ' de ' + faltam.length + ': ' + c.nome);
        try {
          const bytes = new Uint8Array(await drive.baixar(c.id, c.nome, t => setLendo(t + ' (' + (i + 1) + ' de ' + faltam.length + ')')));
          setLendo('Lendo ' + (i + 1) + ' de ' + faltam.length + ': ' + c.nome);
          novos.push(await ler(c.nome, bytes, c.id));
        } catch (e) { r.erros.push({ nome: c.nome, erro: mensagem(e) }); }
      }
      r.lidos = vm.guardarComprovantes(novos);
      r.jaEstavam += novos.length - r.lidos;
    } catch (e) { r.erros.push({ nome: 'Drive', erro: mensagem(e) }); }
    setLendo('');
    setResumo(r);
  }

  /** abre a janela já (senão o navegador bloqueia) e põe o link do robô quando ele responder */
  function ver(c: Pick<lt.ComprovanteDoLancatudo, 'id' | 'nome' | 'driveId'>) {
    const local = locais.current.get(c.id);
    if (local) { window.open(local, '_blank'); return; }
    if (!c.driveId) { setResumo({ lidos: 0, jaEstavam: 0, erros: [{ nome: c.nome, erro: 'Veio do computador de quem enviou: o arquivo não ficou guardado no nads.' }] }); return; }
    const janela = window.open('', '_blank');
    janela?.document.write('<p style="font:14px sans-serif;padding:24px;color:#555">Buscando ' + c.nome.replace(/</g, '') + ' no Drive…</p>');
    drive.link(c.driveId, c.nome).then(url => { if (janela) janela.location.href = url; else window.open(url, '_blank'); },
      e => { janela?.close(); setResumo({ lidos: 0, jaEstavam: 0, erros: [{ nome: c.nome, erro: mensagem(e) }] }); });
  }

  return {
    lendo, resumo, fecharResumo: () => setResumo(null), aceitar: ACEITAR.join(','),
    doComputador: (fs: readonly File[]) => { void doComputador(fs); },
    doDrive: () => { void doDrive(); },
    precisaEntrar, entrarNoDrive: () => { drive.entrarComGoogle().catch(e => setResumo({ lidos: 0, jaEstavam: 0, erros: [{ nome: 'Drive', erro: mensagem(e) }] })); },
    ver, podeVer: (c: Pick<lt.ComprovanteDoLancatudo, 'id' | 'driveId'>) => !!c.driveId || locais.current.has(c.id),
  };
}
