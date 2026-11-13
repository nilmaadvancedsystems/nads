// ViewModel da Central de documentos como biblioteca (12/11/2026: "retrabalhe completamente a central de documentos"; a
// escolhida: "biblioteca com pastas"; 13/11/2026: "preciso de mais melhoras", "tudo isso"). As pastas em cartões no alto
// (Tudo, Guias, Folha e DP, Notas, Do escritório, Enviados por você) com a contagem; a busca e o mês; a lista por mês de
// referência; ver (a janela de visualização, com as setas para o anterior e o próximo) e baixar; marcar vários (ou o mês
// inteiro) e baixar num .zip. As regras (o que entra, a pasta, o mês, o filtro, os nomes do .zip) estão em
// dados/biblioteca.ts; aqui só o estado da tela e as ações.
import { formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useLocation } from 'react-router';
import { baixarArquivo } from '../dados/baixar';
import { bibliotecaDoCliente, contagemDasPastas, filtrarBiblioteca, nomeDoZip, PASTAS_DA_BIBLIOTECA, porMesDaBiblioteca, type ItemDaBiblioteca, type PastaDaBiblioteca } from '../dados/biblioteca';
import { repoAreaCliente } from '../dados/repo';
import { useBaixarVarios } from './useBaixarVarios';
import { useVisualizar } from './useVisualizar';
import type { DaCasca, PedidoDaTela } from './useAreaCliente';

const PASTA = new Map(PASTAS_DA_BIBLIOTECA.map(p => [p.id, p]));

export function useDocumentos({ token, area }: DaCasca) {
  const { toast } = useRetorno();
  const [pasta, setPasta] = useState<PastaDaBiblioteca | ''>('');
  // a busca geral abre esta tela com a busca já preenchida (13/11/2026)
  const { state } = useLocation();
  const [busca, setBusca] = useState(() => ((state ?? {}) as PedidoDaTela).busca ?? '');
  const [mes, setMes] = useState('');
  const [baixando, setBaixando] = useState('');
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  const vista = useVisualizar();

  const itens = bibliotecaDoCliente({
    guias: area.guias, documentosDp: area.documentosDp, danfes: area.danfes,
    documentos: area.secoes.documentos ? area.documentos : [], envios: area.envios,
  });
  const n = contagemDasPastas(itens);
  const filtrados = filtrarBiblioteca(itens, { pasta, mes, busca });

  /** o arquivo do item, pelo repositório da origem (a guia, o documento do DP, a DANFE, o do escritório) */
  function pegar(i: ItemDaBiblioteca): Promise<{ nome: string; arquivo: Blob } | { erro: string } | null> {
    switch (i.origem.tipo) {
      case 'guia': return repoAreaCliente.baixarGuia(token, i.origem.id);
      case 'dp': return repoAreaCliente.baixarDocumentoDp(token, i.origem.id);
      case 'danfe': return repoAreaCliente.pedirDanfe(token, i.origem.chave ?? '');
      case 'escritorio': return repoAreaCliente.baixarDocumento(token, i.origem.id);
      default: return Promise.resolve({ erro: 'O que você enviou fica com o escritório.' });
    }
  }
  async function baixar(i: ItemDaBiblioteca) {
    setBaixando(i.chave);
    try {
      const r = await pegar(i);
      if (!r) toast('Não achamos este arquivo agora. Fale com o escritório.');
      else if ('erro' in r) toast(r.erro);
      else baixarArquivo(r.nome, r.arquivo);
    } finally { setBaixando(''); }
  }

  // a ordem da lista na tela: as setas da janela de visualização andam por ela (só os que abrem)
  const grupos = porMesDaBiblioteca(filtrados);
  const naOrdem = grupos.flatMap(g => g.itens).filter(i => i.abre);
  const porChave = new Map(naOrdem.map(i => [i.chave, i]));
  const setas = vista.setas(naOrdem.map(i => i.chave), chave => pegar(porChave.get(chave)!));
  const marcadosNaTela = naOrdem.filter(i => marcados.has(i.chave));
  const zip = useBaixarVarios();
  const baixarVarios = async (lista: readonly ItemDaBiblioteca[], mes?: string) => {
    if (await zip.baixarVarios(lista.filter(i => i.abre), pegar, nomeDoZip(area.resumo?.empresas?.[0]?.nome ?? '', mes))) setMarcados(new Set());
  };

  const meses = [...new Set(itens.map(i => i.mes))];
  return {
    total: itens.length,
    // a pasta "Do escritório" só quando o escritório tem documentos para o cliente (o banco ainda não tem)
    pastas: [{ id: '' as const, rotulo: 'Tudo', icone: 'pastaAberta' as const, tom: 'neutro' as const, n: n.tudo },
      ...PASTAS_DA_BIBLIOTECA.filter(p => p.id !== 'escritorio' || n.escritorio > 0).map(p => ({ id: p.id, rotulo: p.curto ?? p.rotulo, icone: p.icone, tom: p.tom, n: n[p.id] }))]
      .map(p => ({ ...p, ativa: p.id === pasta })),
    escolherPasta: (p: PastaDaBiblioteca | '') => setPasta(p),
    busca, mudarBusca: setBusca, mes, mudarMes: setMes,
    meses: meses.map(m => ({ valor: m, rotulo: formatos.capital(formatos.rot(m).toLowerCase()) })),
    grupos: grupos.map(g => ({
      mes: g.mes, titulo: formatos.rot(g.mes).toUpperCase(),
      // o mês inteiro num .zip (os que abrem)
      abrem: g.itens.filter(i => i.abre).length,
      baixarMes: () => { void baixarVarios(g.itens, g.mes); },
      itens: g.itens.map(i => ({ ...i, rotuloDaPasta: PASTA.get(i.pasta)?.rotulo ?? '', tomDaPasta: PASTA.get(i.pasta)?.tom ?? 'neutro', quando: i.data.slice(8, 10) + '/' + i.data.slice(5, 7), marcado: marcados.has(i.chave) })),
    })),
    // marcar vários e baixar num .zip
    marcar: (chave: string) => setMarcados(m => { const n2 = new Set(m); if (n2.has(chave)) n2.delete(chave); else n2.add(chave); return n2; }),
    marcadosN: marcadosNaTela.length,
    todosMarcados: naOrdem.length > 0 && marcadosNaTela.length === naOrdem.length,
    marcarTodos: () => setMarcados(m => (naOrdem.every(i => m.has(i.chave)) ? new Set() : new Set(naOrdem.map(i => i.chave)))),
    desmarcar: () => setMarcados(new Set()),
    baixarMarcados: () => { void baixarVarios(marcadosNaTela); },
    juntando: zip.juntando,
    // as setas da janela de visualização
    ...setas,
    limpar: () => { setPasta(''); setMes(''); setBusca(''); },
    vista, baixando,
    ver: (i: ItemDaBiblioteca) => vista.ver(i.chave, () => pegar(i)),
    baixar: (i: ItemDaBiblioteca) => { void baixar(i); },
  };
}
