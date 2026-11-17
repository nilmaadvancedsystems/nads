// A pré-visualização (12/11/2026): pega o arquivo (a guia, o documento do DP) pelo repositório, abre na JanelaDoArquivo
// (o PDF desenhado em imagens, página por página) e, no Baixar, salva o mesmo arquivo (sem buscar de novo). O endereço temporário do arquivo é solto quando fecha.
import { useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { baixarArquivo } from '../dados/baixar';
import { paginasDoPdf } from '../dados/paginasDoPdf';
import type { ArquivoAberto } from '../partes/JanelaDoArquivo';

export function useVisualizar() {
  const { toast } = useRetorno();
  const [aberto, setAberto] = useState<(ArquivoAberto & { arquivo: Blob; id: string }) | null>(null);
  const [abrindo, setAbrindo] = useState('');
  useEffect(() => () => { if (aberto) URL.revokeObjectURL(aberto.url); }, [aberto]);

  async function ver(id: string, pegar: () => Promise<{ nome: string; arquivo: Blob } | { erro: string } | null>) {
    setAbrindo(id);
    try {
      const r = await pegar();
      if (!r) { toast('Não achamos este arquivo agora. Fale com o escritório.'); return; }
      if ('erro' in r) { toast(r.erro); return; }
      // o PDF vira imagens (o celular não mostra PDF na página); se o pdf.js falhar, fica o visualizador do navegador
      // (13/11/2026) com limite de tempo: se o desenho demorar mais de 8 s, abre no visualizador do navegador em vez de ficar preso
      const paginas = r.arquivo.type === 'application/pdf'
        ? await Promise.race([paginasDoPdf(r.arquivo).catch(() => undefined), new Promise<undefined>(ok => setTimeout(() => ok(undefined), 8000))])
        : undefined;
      setAberto({ id, nome: r.nome, arquivo: r.arquivo, tipo: r.arquivo.type, url: URL.createObjectURL(r.arquivo), paginas });
    } finally { setAbrindo(''); }
  }

  type Pegar = (id: string) => Promise<{ nome: string; arquivo: Blob } | { erro: string } | null>;
  /** as setas da janela andando pela lista da tela (13/11/2026: o mesmo padrão em todas as abas) */
  function setas(ids: readonly string[], pegar: Pegar) {
    const k = aberto ? ids.indexOf(aberto.id) : -1;
    const ir = (j: number) => { void ver(ids[j], () => pegar(ids[j])); };
    return {
      posicao: k >= 0 ? (k + 1) + ' de ' + ids.length : '',
      anterior: k > 0 ? () => ir(k - 1) : undefined,
      proximo: k >= 0 && k < ids.length - 1 ? () => ir(k + 1) : undefined,
    };
  }

  return {
    aberto, abrindo, setas,
    ver: (id: string, pegar: () => Promise<{ nome: string; arquivo: Blob } | { erro: string } | null>) => { void ver(id, pegar); },
    baixar: () => { if (aberto) baixarArquivo(aberto.nome, aberto.arquivo); },
    fechar: () => setAberto(null),
  };
}
