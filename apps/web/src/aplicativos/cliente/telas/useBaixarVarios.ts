// Baixar vários num .zip (13/11/2026: "baixar vários de uma vez", depois "mesmo padrão nas outras abas"): a Central, as
// Guias e o Registro usam a mesma peça. Pega um arquivo por vez (o celular não aguenta tudo junto), mostra "Juntando 2 de
// 5…", monta o .zip sem compressão (o PDF já vem comprimido) com os nomes sem repetir, e o aviso diz se algum ficou de fora.
import { tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { baixarArquivo } from '../dados/baixar';
import { nomesParaOZip } from '../dados/biblioteca';

type Arquivo = { nome: string; arquivo: Blob } | { erro: string } | null;

export function useBaixarVarios() {
  const { toast } = useRetorno();
  const [juntando, setJuntando] = useState<{ feitos: number; total: number } | null>(null);

  /** junta e baixa; devolve se baixou alguma coisa */
  async function baixarVarios<T>(itens: readonly T[], pegar: (item: T) => Promise<Arquivo>, nomeDoZip: string): Promise<boolean> {
    if (!itens.length || juntando) return false;
    setJuntando({ feitos: 0, total: itens.length });
    try {
      const vieram: { nome: string; bytes: Uint8Array }[] = [];
      let faltaram = 0;
      for (const [n, item] of itens.entries()) {
        const r = await pegar(item).catch(() => null);
        if (r && !('erro' in r)) vieram.push({ nome: r.nome, bytes: new Uint8Array(await r.arquivo.arrayBuffer()) });
        else faltaram++;
        setJuntando({ feitos: n + 1, total: itens.length });
      }
      if (!vieram.length) { toast('Não deu para juntar os arquivos agora. Tente de novo.'); return false; }
      const nomes = nomesParaOZip(vieram.map(v => v.nome));
      const zip = t.zipSemCompressao(vieram.map((v, k) => ({ nome: nomes[k], bytes: v.bytes })));
      baixarArquivo(nomeDoZip, new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' }));
      const quantos = vieram.length + (vieram.length === 1 ? ' arquivo' : ' arquivos');
      toast(faltaram ? quantos + ' no .zip; ' + faltaram + ' não vieram agora.' : quantos + ' no .zip.');
      return true;
    } finally { setJuntando(null); }
  }

  return {
    juntando: juntando ? 'Juntando ' + juntando.feitos + ' de ' + juntando.total + '…' : '',
    baixarVarios,
  };
}
