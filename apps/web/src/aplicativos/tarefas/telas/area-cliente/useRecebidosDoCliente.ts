// ViewModel da página Recebidos da Área do Cliente (Vitor, 16/10/2026): o que os clientes mandaram pelo link (extratos,
// notas, comprovantes), com a busca e o filtro por tipo. O arquivo já está no Drive do cliente (o robô guarda).
import { areaCliente as ac } from '@nads/core';
import { useMemo, useState } from 'react';
import { useAreaCliente } from '../../dados/repo';
import type { RecebidoDoCliente } from '../../dados/areaCliente';

export type FiltroDosRecebidos = 'todos' | ac.TipoDeEnvio;
export const rotuloDoEnvio = (t: string) => ac.TIPOS_DE_ENVIO.find(x => x.valor === t)?.rotulo || t;
export const FILTROS_DOS_RECEBIDOS: readonly { valor: FiltroDosRecebidos; rotulo: string }[] = [{ valor: 'todos', rotulo: 'Todos' }, ...ac.TIPOS_DE_ENVIO];

const simples = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function useRecebidosDoCliente() {
  const repo = useAreaCliente();
  const [filtro, setFiltro] = useState<FiltroDosRecebidos>('todos');
  const [busca, setBusca] = useState('');
  const todos = repo.recebidos();
  const linhas = useMemo(() => {
    const q = simples(busca.trim());
    return todos.lista.filter(r => (filtro === 'todos' || r.tipo === filtro) && (!q || simples(r.empresa + ' ' + r.nome + ' ' + r.codigo).includes(q)));
  }, [todos.lista, filtro, busca]);
  // a recusa com o motivo (22/11/2026, Documentos do cliente): a janela escolhe um motivo pronto ou escreve
  const [recusando, setRecusando] = useState<RecebidoDoCliente | null>(null);
  const [motivo, setMotivo] = useState('');
  const [erroDaRecusa, setErroDaRecusa] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [recusados, setRecusados] = useState<Record<string, string>>({});
  return {
    recusa: {
      aberta: recusando, motivo, erro: erroDaRecusa, enviando, prontos: ac.MOTIVOS_DA_RECUSA,
      abrir: (r: RecebidoDoCliente) => { setRecusando(r); setMotivo(''); setErroDaRecusa(''); },
      fechar: () => { if (!enviando) setRecusando(null); },
      setMotivo: (m: string) => { setMotivo(m); setErroDaRecusa(''); },
      async confirmar() {
        if (!recusando) return;
        const e = ac.erroDaRecusa(motivo);
        if (e) { setErroDaRecusa(e); return; }
        setEnviando(true);
        try { await repo.recusar(recusando.id, motivo); setRecusados(x => ({ ...x, [recusando.id]: motivo.trim() })); setRecusando(null); }
        catch (err) { setErroDaRecusa(err instanceof Error ? err.message : 'Não deu para recusar agora.'); }
        finally { setEnviando(false); }
      },
    },
    /** o motivo da recusa (a do robô ou a que acabou de ser gravada) */
    recusaDe: (r: RecebidoDoCliente) => r.recusa?.motivo || recusados[r.id] || '',
    exemplos: repo.exemplos,
    carregando: !todos.carregada,
    erro: todos.erro,
    linhas, filtro, setFiltro, busca, setBusca,
    total: todos.lista.length,
    contagem: (f: FiltroDosRecebidos) => (f === 'todos' ? todos.lista.length : todos.lista.filter(r => r.tipo === f).length),
    tamanho: ac.tamanhoLegivel,
    data: (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''),
  };
}
