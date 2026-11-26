// A prévia do arquivo recebido (26/11/2026: "quero poder ver o arquivo direto por aqui"; refeita no mesmo dia: "visualizacao
// horrivel", "esse jeito aqui ta terrivel"). O arquivo está no Drive do escritório: a tela acha o id dele no mapa do Drive
// (driveIndice, o mesmo do Explorador) e o robô da nuvem traz os bytes pelo banco (aberturasDrive, modo ler: até 4 MB). A
// janela é a JanelaDoArquivo da Área do Cliente (o PDF desenhado em páginas pelo pdf.js, sem o leitor do navegador).
// Arquivo que o mapa ainda não tem: pede ao robô para reler a pasta do cliente e procura de novo. As regras ficam em
// dados/arquivoDoRecebido.ts.
import { useEffect, useRef, useState } from 'react';
import { useDriveDoEntregas } from '../../../dados/repo';
import type { RecebidoDoCliente } from '../../../dados/areaCliente';
import { arquivoNaPasta, jeitoDaPrevia, partesDaPasta, pastaDoClienteNoMapa } from '../../../dados/arquivoDoRecebido';
import { paginasDoPdf } from '../../../../cliente/dados/paginasDoPdf';
import type { ArquivoAberto } from '../../../../cliente/partes/JanelaDoArquivo';

const ESPERA_MS = 90_000;

export interface PreviaDoRecebido {
  recebido: RecebidoDoCliente;
  nome: string;
  estado: 'buscando' | 'pronto' | 'erro';
  texto: string;
  /** pronto: o arquivo para a JanelaDoArquivo (a URL é do próprio navegador) */
  arquivo: ArquivoAberto | null;
  blob: Blob | null;
}

const TIPO = (nome: string) => {
  const j = jeitoDaPrevia(nome);
  if (j === 'pdf') return 'application/pdf';
  if (j === 'imagem') return 'image/' + ((/\.(\w+)$/.exec(nome)?.[1] || 'png').toLowerCase().replace('jpg', 'jpeg'));
  return 'application/octet-stream';
};

export function usePreviaDoRecebido() {
  const drive = useDriveDoEntregas();
  const [previa, setPrevia] = useState<PreviaDoRecebido | null>(null);
  const vez = useRef(0);
  // a URL do arquivo aberto sai da memória quando outro abre ou a janela fecha
  const url = useRef('');
  const soltar = () => { if (url.current) URL.revokeObjectURL(url.current); url.current = ''; };
  useEffect(() => soltar, []);

  /** espera o repositório do Drive chegar num estado (ele avisa a cada mudança) */
  function esperar<T>(ler: () => T | null | undefined, ms = ESPERA_MS): Promise<T> {
    return new Promise((ok, falha) => {
      let parar = () => {};
      const fim = setTimeout(() => { parar(); falha(new Error('o mapa do Drive não respondeu a tempo')); }, ms);
      const olhar = () => { const v = ler(); if (v != null) { clearTimeout(fim); parar(); ok(v); } };
      parar = drive.assinar(olhar);
      olhar();
    });
  }

  function relerPasta(pastaId: string): Promise<void> {
    return new Promise((ok, falha) => {
      let parar = () => {};
      const fim = setTimeout(() => { parar(); falha(new Error('o robô não releu a pasta a tempo')); }, ESPERA_MS);
      parar = drive.atualizarMapa(pastaId, a => {
        if (a.status === 'pronto') { clearTimeout(fim); parar(); ok(); }
        else if (a.status === 'erro') { clearTimeout(fim); parar(); falha(new Error(a.erro || 'erro do robô')); }
      });
    });
  }

  async function buscar(r: RecebidoDoCliente): Promise<Uint8Array> {
    const partes = partesDaPasta(r.pastaDrive);
    if (!partes) throw new Error('este recebido não diz em que pasta do Drive ficou');
    const nome = r.arquivoDrive || r.nome;
    const mapa = await esperar(() => { const m = drive.mapa(partes.ano); return m.carregado ? m : null; });
    if (mapa.erro) throw new Error('não consegui ler o mapa do Drive (' + mapa.erro + ')');
    const pasta = pastaDoClienteNoMapa(mapa.clientes, partes.cliente);
    if (!pasta) throw new Error('a pasta "' + partes.cliente + '" não está no mapa do Drive de ' + partes.ano);
    const achar = () => { const p = drive.itens(pasta.id); return p.carregados ? { item: arquivoNaPasta(p.itens, pasta.id, partes.dentro, nome) } : null; };
    let item = (await esperar(achar)).item;
    if (!item) {
      // o mapa ainda não tem o arquivo (chegou há pouco): o robô relê a pasta do cliente
      await relerPasta(pasta.id);
      item = await esperar(() => achar()?.item, 20_000).catch(() => null);
      if (!item) throw new Error('o arquivo não está mais na pasta ' + r.pastaDrive);
    }
    return drive.lerArquivo({ i: item.i, n: item.n });
  }

  return {
    previa,
    ver(r: RecebidoDoCliente) {
      const n = ++vez.current;
      const nome = r.arquivoDrive || r.nome;
      const base = { recebido: r, nome, arquivo: null, blob: null };
      if (drive.exemplos) { setPrevia({ ...base, estado: 'erro', texto: 'Nos dados de exemplo não há arquivo no Drive.' }); return; }
      setPrevia({ ...base, estado: 'buscando', texto: 'Buscando “' + nome + '” no Drive…' });
      buscar(r).then(async bytes => {
        const tipo = TIPO(nome);
        const blob = new Blob([bytes as BlobPart], { type: tipo });
        // o PDF em páginas (o pdf.js); sem conseguir, o visualizador do navegador
        const paginas = tipo === 'application/pdf' ? await paginasDoPdf(blob).catch(() => undefined) : undefined;
        if (vez.current !== n) return;
        soltar();
        url.current = URL.createObjectURL(blob);
        setPrevia({ ...base, estado: 'pronto', texto: '', blob, arquivo: { nome, url: url.current, tipo, ...(paginas ? { paginas } : {}) } });
      }, (err: Error) => { if (vez.current === n) setPrevia({ ...base, estado: 'erro', texto: 'Não consegui abrir: ' + err.message + '.' }); });
    },
    fechar() { vez.current++; soltar(); setPrevia(null); },
  };
}
