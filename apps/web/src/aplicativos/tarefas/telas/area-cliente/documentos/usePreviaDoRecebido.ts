// A prévia do arquivo recebido (26/11/2026: "quero poder ver o arquivo direto por aqui", na página Recebidos). O arquivo
// está no Drive do escritório; a tela acha o id dele no mapa do Drive (driveIndice, o mesmo do Explorador) e pede ao
// robô da nuvem uma cópia temporária (aberturasDrive, modo abrir: 30 min). Arquivo que o mapa ainda não tem: pede ao
// robô para reler a pasta do cliente e procura de novo. As regras ficam em dados/arquivoDoRecebido.ts.
import type { entregas as e } from '@nads/core';
import { useRef, useState } from 'react';
import { useDriveDoEntregas } from '../../../dados/repo';
import type { RecebidoDoCliente } from '../../../dados/areaCliente';
import { arquivoNaPasta, jeitoDaPrevia, partesDaPasta, pastaDoClienteNoMapa } from '../../../dados/arquivoDoRecebido';

const ESPERA_MS = 90_000;

export interface PreviaDoRecebido {
  recebido: RecebidoDoCliente;
  nome: string;
  jeito: 'imagem' | 'pdf' | 'outro';
  estado: 'buscando' | 'pronto' | 'erro';
  texto: string;
  url: string;
}

export function usePreviaDoRecebido() {
  const drive = useDriveDoEntregas();
  const [previa, setPrevia] = useState<PreviaDoRecebido | null>(null);
  const vez = useRef(0);

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

  function pedirAoRobo(pedido: e.PedidoAoDrive): Promise<string> {
    return new Promise((ok, falha) => {
      let parar = () => {};
      const fim = setTimeout(() => { parar(); falha(new Error('o robô não respondeu a tempo. Confira se ele está online e tente de novo')); }, ESPERA_MS);
      parar = drive.pedir(pedido, a => {
        if (a.status === 'pronto' && a.url) { clearTimeout(fim); parar(); ok(a.url); }
        else if (a.status === 'erro') { clearTimeout(fim); parar(); falha(new Error(a.erro || 'erro do robô')); }
      });
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

  async function buscar(r: RecebidoDoCliente): Promise<string> {
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
    return pedirAoRobo({ modo: 'abrir', fileId: item.i, nome: item.n });
  }

  return {
    previa,
    ver(r: RecebidoDoCliente) {
      const n = ++vez.current;
      const nome = r.arquivoDrive || r.nome;
      const base = { recebido: r, nome, jeito: jeitoDaPrevia(nome), url: '' };
      if (drive.exemplos) { setPrevia({ ...base, estado: 'erro', texto: 'Nos dados de exemplo não há arquivo no Drive.' }); return; }
      setPrevia({ ...base, estado: 'buscando', texto: 'Buscando o arquivo no Drive…' });
      buscar(r).then(
        url => { if (vez.current === n) setPrevia({ ...base, estado: 'pronto', texto: '', url }); },
        (err: Error) => { if (vez.current === n) setPrevia({ ...base, estado: 'erro', texto: 'Não consegui abrir: ' + err.message + '.' }); },
      );
    },
    fechar() { vez.current++; setPrevia(null); },
  };
}
