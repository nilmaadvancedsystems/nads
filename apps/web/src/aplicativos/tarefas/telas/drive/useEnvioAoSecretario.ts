// ViewModel do "Enviar para o Claudio Secretário" (Tarefas › Drive): a janela (os arquivos escolhidos ou
// arrastados, o cliente — começa no cliente aberto no Explorador — e o mês) e o andamento de cada envio. Os
// arquivos sobem um de cada vez (em pedaços, pelo banco do Entregas); o robô grava em
// Claudio Secretario/<mês>/<cliente>, de onde a próxima rodada do arquivamento tira.
import { entregas as e } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { useDriveDoEntregas } from '../../dados/repo';

export interface EnvioNaTela { id: number; nome: string; texto: string; erro?: string }

const TEXTO: Record<e.AndamentoDoEnvio['status'], string> = {
  enviando: 'subindo', pendente: 'na fila do robô', gravando: 'o robô está gravando no Drive', pronto: 'pronto', erro: 'erro',
};

export function useEnvioAoSecretario(clienteAberto: e.PastaDeCliente | null) {
  const repo = useDriveDoEntregas();
  const { toast } = useRetorno();
  const [aberto, setAberto] = useState(false);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [competencia, setCompetencia] = useState(() => e.competenciaDe(new Date()));
  const [envios, setEnvios] = useState<EnvioNaTela[]>([]);
  const [subindo, setSubindo] = useState(false);
  const [vendoMeus, setVendoMeus] = useState(false);
  const meus = repo.meusEnvios();
  // parar de acompanhar ao sair da tela (o que já subiu, o robô grava do mesmo jeito)
  const paradas = useRef(new Set<() => void>());
  useEffect(() => {
    const lista = paradas.current;
    return () => { for (const p of lista) p(); };
  }, []);

  const clientes = e.buscarClientes(repo.mapa().clientes, '');
  const cliente = clientes.find(c => c.id === clienteId) || null;
  const destino: e.DestinoDoEnvio = { competencia, cliente: cliente?.nomePasta || cliente?.nome || '', codigo: cliente?.codigo || '' };
  const lista = arquivos.map(f => ({ nome: f.name, tamanho: e.tamanhoLegivel(f.size), problema: e.problemaDoArquivo({ nome: f.name, tamanho: f.size }) }));
  const bons = arquivos.filter(f => !e.problemaDoArquivo({ nome: f.name, tamanho: f.size }));

  function mudar(id: number, a: Partial<EnvioNaTela>) { setEnvios(l => l.map(x => (x.id === id ? { ...x, ...a } : x))); }
  const tirar = (id: number) => setEnvios(l => l.filter(x => x.id !== id));

  /** Manda um arquivo; resolve quando terminou de subir (o robô grava depois, e o aviso vem sozinho). */
  async function mandar(f: File, para: e.DestinoDoEnvio): Promise<void> {
    const id = Date.now() + Math.random();
    setEnvios(l => [...l, { id, nome: f.name, texto: f.name + ': preparando…' }]);
    let bytes: Uint8Array;
    try { bytes = new Uint8Array(await f.arrayBuffer()); } catch {
      mudar(id, { texto: f.name + ': não consegui ler o arquivo', erro: 'leitura' });
      setTimeout(() => tirar(id), 6000);
      return;
    }
    await new Promise<void>(subiu => {
      let parar = () => {};
      const acabar = () => { parar(); paradas.current.delete(parar); };
      parar = repo.enviar({ nome: f.name, bytes }, para, a => {
        if (a.status === 'enviando') {
          mudar(id, { texto: f.name + ': subindo' + (a.partes && a.partes > 1 ? ' (' + (a.enviadas || 0) + ' de ' + a.partes + ' partes)' : '') + '…' });
          return;
        }
        subiu();
        if (a.status === 'pronto') {
          acabar();
          tirar(id);
          toast('"' + (a.nomeFinal || f.name) + '" está em Claudio Secretario › ' + (a.pasta || '').split('/').join(' › ') + '.');
        } else if (a.status === 'erro') {
          acabar();
          mudar(id, { texto: f.name + ': ' + (a.erro || 'erro'), erro: a.erro || 'erro' });
          setTimeout(() => tirar(id), 8000);
        } else mudar(id, { texto: f.name + ': ' + TEXTO[a.status] + '…' });
      });
      paradas.current.add(parar);
    });
  }

  return {
    // Meus envios: o que a pessoa mandou nos últimos 30 dias e onde cada arquivo foi parar
    vendoMeus,
    verMeus: () => setVendoMeus(true),
    fecharMeus: () => setVendoMeus(false),
    meusCarregados: meus.carregados,
    meus: meus.lista.map(x => ({ ...x, situacao: e.situacaoDoEnvioFeito(x), quando: x.criadoEm ? new Date(x.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '' })),
    exemplos: repo.exemplos,
    aberto,
    /** abre a janela (com os arquivos arrastados, se vieram) já no cliente aberto no Explorador */
    abrir(fs: File[] = []) {
      setArquivos(fs.slice(0, e.MAX_ARQUIVOS_POR_ENVIO));
      setClienteId(clienteAberto?.id || '');
      setAberto(true);
    },
    fechar: () => setAberto(false),
    arquivos: lista,
    adicionar: (fs: File[]) => setArquivos(a => [...a, ...fs].slice(0, e.MAX_ARQUIVOS_POR_ENVIO)),
    tirarArquivo: (i: number) => setArquivos(a => a.filter((_, k) => k !== i)),
    maxArquivos: e.MAX_ARQUIVOS_POR_ENVIO,
    clientes: clientes.map(c => ({ id: c.id, rotulo: c.nomePasta || c.nome })),
    clienteId, setClienteId,
    competencia, setCompetencia,
    onde: e.ondeVai(destino),
    podeEnviar: bons.length > 0 && !subindo,
    quantos: bons.length,
    subindo,
    async enviar() {
      if (!bons.length || subindo) return;
      const para = { ...destino };
      const fila = bons.slice();
      setSubindo(true);
      setAberto(false);
      setArquivos([]);
      try { for (const f of fila) await mandar(f, para); } finally { setSubindo(false); }
    },
    envios,
  };
}

export type VmEnvio = ReturnType<typeof useEnvioAoSecretario>;
