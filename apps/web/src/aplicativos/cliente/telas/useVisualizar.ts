// A pré-visualização (12/11/2026): pega o arquivo (a guia, o documento do DP) pelo repositório, abre na JanelaDoArquivo
// (o PDF desenhado em imagens, página por página) e, no Baixar, salva o mesmo arquivo (sem buscar de novo). O endereço temporário do arquivo é solto quando fecha.
import { useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { baixarArquivo } from '../dados/baixar';
import { paginasDoPdf } from '../dados/paginasDoPdf';
import type { ArquivoAberto } from '../partes/JanelaDoArquivo';

export function useVisualizar() {
  const { toast } = useRetorno();
  const [aberto, setAberto] = useState<(ArquivoAberto & { arquivo: Blob }) | null>(null);
  const [abrindo, setAbrindo] = useState('');
  useEffect(() => () => { if (aberto) URL.revokeObjectURL(aberto.url); }, [aberto]);

  async function ver(id: string, pegar: () => Promise<{ nome: string; arquivo: Blob } | { erro: string } | null>) {
    setAbrindo(id);
    try {
      const r = await pegar();
      if (!r) { toast('Não achamos este arquivo agora. Fale com o escritório.'); return; }
      if ('erro' in r) { toast(r.erro); return; }
      // o PDF vira imagens (o celular não mostra PDF na página); se o pdf.js falhar, fica o visualizador do navegador
      const paginas = r.arquivo.type === 'application/pdf' ? await paginasDoPdf(r.arquivo).catch(() => undefined) : undefined;
      setAberto({ nome: r.nome, arquivo: r.arquivo, tipo: r.arquivo.type, url: URL.createObjectURL(r.arquivo), paginas });
    } finally { setAbrindo(''); }
  }

  return {
    aberto, abrindo,
    ver: (id: string, pegar: () => Promise<{ nome: string; arquivo: Blob } | { erro: string } | null>) => { void ver(id, pegar); },
    baixar: () => { if (aberto) baixarArquivo(aberto.nome, aberto.arquivo); },
    fechar: () => setAberto(null),
  };
}
