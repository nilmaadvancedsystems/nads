// ViewModel dos XMLs que o cliente mandou (Vitor, 08/10/2026: "quero um botão juntamente à importação do Alterdata para
// importar os XMLs que os clientes mandam"): soltar os .xml ou o .zip, ler no navegador, mandar ao robô e acompanhar.
// O robô fica com os XMLs do cliente (os de outra empresa ficam de fora), junta com os do Drive, lança as notas no nads
// (as tabelas de verificação e a sequência das saídas) e salva no Drive só os novos.
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { lerXmlsDosArquivos } from '../../dados/arquivosXml';
import { useSieg } from '../../dados/repo';
import type { PedidoSieg } from '../../dados/sieg';

const PASSOS = ['Enviado ao robô', 'O robô pegou', 'Lendo os XMLs do cliente', 'Lendo as notas no nads', 'Salvando na pasta do cliente no Drive', 'Pronto'];
const PELA_FASE = { baixando: 2, entregando: 2, nads: 3, drive: 4, pronto: 5 } as const;
const rodando = (p: PedidoSieg | null) => !!p && (p.status === 'pendente' || p.status === 'processando');

export function useXmlsDoCliente(codigo: string, competencia: string) {
  const repo = useSieg();
  const { toast } = useRetorno();
  const [lidos, setLidos] = useState<{ xmls: string[]; ignorados: number; arquivos: number } | null>(null);
  const [lendo, setLendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const pedido = codigo ? repo.pedido(codigo, competencia, 'xmlsCliente') : null;
  const p = enviado ? pedido : null;
  const atual = !p ? 0 : p.status === 'pendente' ? 1 : p.status === 'processando' ? (p.fase ? PELA_FASE[p.fase] : 2) : p.status === 'concluido' ? 5 : 0;
  const pronto = atual === 5;
  return {
    exemplos: repo.exemplos,
    lendo,
    lidos,
    /** soltar ou escolher os arquivos (.xml e .zip): lê tudo no navegador */
    async soltar(arquivos: File[]) {
      if (!arquivos.length || lendo) return;
      setLendo(true);
      setEnviado(false);
      try {
        const r = await lerXmlsDosArquivos(arquivos);
        // juntando com o que já tinha sido solto (sem repetir o mesmo XML)
        setLidos(v => {
          const xmls = [...new Set([...(v?.xmls || []), ...r.xmls])];
          return { xmls, ignorados: (v?.ignorados || 0) + r.ignorados, arquivos: (v?.arquivos || 0) + arquivos.length };
        });
      } catch (err) { toast('Não consegui ler os arquivos: ' + (err instanceof Error ? err.message : String(err))); }
      finally { setLendo(false); }
    },
    limpar: () => { setLidos(null); setEnviado(false); },
    enviando: enviando || rodando(p),
    async enviar() {
      if (!lidos?.xmls.length || enviando || !codigo) return;
      setEnviando(true);
      try { await repo.enviarXmlsDoCliente(codigo, competencia, lidos.xmls); setEnviado(true); }
      catch (err) { toast('Não consegui mandar os XMLs: ' + (err instanceof Error ? err.message : String(err))); }
      finally { setEnviando(false); }
    },
    /** o andamento do robô (as peças da janela do SIEG, aqui dentro da janela de importar) */
    andamento: p ? {
      erro: p.status === 'erro' ? p.erro || 'o robô não conseguiu' : '',
      pronto,
      pct: pronto ? 100 : typeof p.pct === 'number' && p.status === 'processando' ? Math.max(2, Math.min(99, p.pct)) : [3, 8, 40, 82, 90, 100][atual],
      detalhe: p.status === 'processando' ? p.andamento : '',
      passos: PASSOS.map((texto, i) => ({ texto, feito: i < atual || pronto, atual: i === atual && !pronto })),
      numeros: p.numeros ? { doCliente: p.numeros.doCliente || 0, deOutros: p.numeros.deOutros || 0, novos: p.numeros.novos, xmls: p.numeros.xmls } : null,
      resultado: pronto && p.resultado ? p.resultado.emitidas + ' notas emitidas e ' + p.resultado.recebidas + ' recebidas no mês · na pasta ' + p.resultado.pasta : '',
    } : null,
  };
}

export type VmXmlsDoCliente = ReturnType<typeof useXmlsDoCliente>;
