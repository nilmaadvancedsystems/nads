// ViewModel da Central de documentos como biblioteca (12/11/2026: "retrabalhe completamente a central de documentos"; a
// escolhida: "biblioteca com pastas"). As pastas à esquerda (Tudo, Guias, Folha e DP, Notas, Do escritório, Enviados por
// você) com a contagem; a busca e o mês; a lista por mês de referência; ver (a janela de visualização) e baixar. As regras
// (o que entra, a pasta, o mês, o filtro) estão em dados/biblioteca.ts; aqui só o estado da tela e as ações.
import { formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { baixarArquivo } from '../dados/baixar';
import { bibliotecaDoCliente, contagemDasPastas, filtrarBiblioteca, PASTAS_DA_BIBLIOTECA, porMesDaBiblioteca, type ItemDaBiblioteca, type PastaDaBiblioteca } from '../dados/biblioteca';
import { repoAreaCliente } from '../dados/repo';
import { useVisualizar } from './useVisualizar';
import type { DaCasca } from './useAreaCliente';

const ROTULO_DA_PASTA = new Map(PASTAS_DA_BIBLIOTECA.map(p => [p.id, p.rotulo]));

export function useDocumentos({ token, area }: DaCasca) {
  const { toast } = useRetorno();
  const [pasta, setPasta] = useState<PastaDaBiblioteca | ''>('');
  const [busca, setBusca] = useState('');
  const [mes, setMes] = useState('');
  const [baixando, setBaixando] = useState('');
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

  const meses = [...new Set(itens.map(i => i.mes))];
  return {
    total: itens.length,
    // a pasta "Do escritório" só quando o escritório tem documentos para o cliente (o banco ainda não tem)
    pastas: [{ id: '' as const, rotulo: 'Tudo', icone: 'pastaAberta' as const, n: n.tudo },
      ...PASTAS_DA_BIBLIOTECA.filter(p => p.id !== 'escritorio' || n.escritorio > 0).map(p => ({ id: p.id, rotulo: p.rotulo, icone: p.icone, n: n[p.id] }))]
      .map(p => ({ ...p, ativa: p.id === pasta })),
    escolherPasta: (p: PastaDaBiblioteca | '') => setPasta(p),
    busca, mudarBusca: setBusca, mes, mudarMes: setMes,
    meses: meses.map(m => ({ valor: m, rotulo: formatos.capital(formatos.rot(m).toLowerCase()) })),
    grupos: porMesDaBiblioteca(filtrados).map(g => ({
      mes: g.mes, titulo: formatos.rot(g.mes).toUpperCase(),
      itens: g.itens.map(i => ({ ...i, rotuloDaPasta: ROTULO_DA_PASTA.get(i.pasta) ?? '', quando: i.data.slice(8, 10) + '/' + i.data.slice(5, 7) })),
    })),
    limpar: () => { setPasta(''); setMes(''); setBusca(''); },
    vista, baixando,
    ver: (i: ItemDaBiblioteca) => vista.ver(i.chave, () => pegar(i)),
    baixar: (i: ItemDaBiblioteca) => { void baixar(i); },
  };
}
