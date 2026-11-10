// ViewModel do "Enviar para o Claudio Secretário" (Tarefas › Drive): a janela (os arquivos escolhidos ou
// arrastados, o cliente — começa no cliente aberto no Explorador — e o mês) e o andamento de cada envio. Os
// arquivos sobem um de cada vez (em pedaços, pelo banco do Entregas); o robô grava em
// Claudio Secretario/<mês>/<cliente>, de onde a próxima rodada do arquivamento tira. Duas opções (Vitor, 10/11/2026): 100%
// automático ou "Ajudar o Claude", com os clientes e os meses dos arquivos (nenhum, um ou vários).
import { entregas as e } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { useDriveDoEntregas } from '../../dados/repo';
import { textoDoPdf } from '../ferramentas/pdfParaArquivos';

export interface EnvioNaTela { id: number; nome: string; texto: string; erro?: string }

const TEXTO: Record<e.AndamentoDoEnvio['status'], string> = {
  enviando: 'subindo', pendente: 'na fila do robô', gravando: 'o robô está gravando no Drive', pronto: 'pronto', erro: 'erro',
};

/** O nome e o texto do arquivo, para achar nele o cliente e o mês (PDF de foto e formato binário: só o nome). */
async function textoDoArquivo(f: File): Promise<string> {
  try {
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (/\.pdf$/i.test(f.name)) return f.name + '\n' + await textoDoPdf(bytes);
    if (/\.(xml|txt|csv|ofx|ofc)$/i.test(f.name)) return f.name + '\n' + new TextDecoder('latin1').decode(bytes);
  } catch { /* não deu para ler: fica o nome e o Claude decide */ }
  return f.name;
}

const rotuloDoMes = (m: string) => m.slice(5, 7) + '/' + m.slice(0, 4);

export function useEnvioAoSecretario(clienteAberto: e.PastaDeCliente | null) {
  const repo = useDriveDoEntregas();
  const { toast } = useRetorno();
  const [aberto, setAberto] = useState(false);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [modo, setModo] = useState<'automatico' | 'ajuda'>('automatico');
  const [clientesIds, setClientesIds] = useState<string[]>([]);
  const [meses, setMeses] = useState<string[]>([]);
  const [envios, setEnvios] = useState<EnvioNaTela[]>([]);
  const [subindo, setSubindo] = useState(false);
  const [vendoMeus, setVendoMeus] = useState(false);
  const meus = repo.meusEnvios();
  // parar de acompanhar ao sair da tela (o que já subiu, o robô grava do mesmo jeito). Só os que já subiram param: parar um
  // que ainda está subindo calava o aviso de "subiu", e os arquivos seguintes da fila nunca eram mandados
  const paradas = useRef(new Set<() => void>());
  const saiu = useRef(false);
  useEffect(() => {
    saiu.current = false;
    const lista = paradas.current;
    return () => { saiu.current = true; for (const p of lista) p(); lista.clear(); };
  }, []);

  const clientes = e.buscarClientes(repo.mapa().clientes, '');
  const mesDaFila = e.competenciaDe(new Date());
  const escolhidos = modo === 'ajuda' ? clientesIds.flatMap(id => clientes.filter(c => c.id === id)) : [];
  const daAjuda: e.ClienteDaAjuda[] = escolhidos.map(c => ({ nome: c.nome, cliente: c.nomePasta || c.nome, codigo: c.codigo || '' }));
  const mesesDaAjuda = modo === 'ajuda' ? meses : [];
  const lista = arquivos.map(f => ({ nome: f.name, tamanho: e.tamanhoLegivel(f.size), problema: e.problemaDoArquivo({ nome: f.name, tamanho: f.size }) }));
  const bons = arquivos.filter(f => !e.problemaDoArquivo({ nome: f.name, tamanho: f.size }));

  function mudar(id: number, a: Partial<EnvioNaTela>) { setEnvios(l => l.map(x => (x.id === id ? { ...x, ...a } : x))); }
  const tirar = (id: number) => setEnvios(l => l.filter(x => x.id !== id));

  /** Manda um arquivo; resolve quando terminou de subir (o robô grava depois, e o aviso vem sozinho). */
  async function mandar(f: File, destino: Promise<e.DestinoDoEnvio>): Promise<void> {
    const id = Date.now() + Math.random();
    setEnvios(l => [...l, { id, nome: f.name, texto: f.name + ': preparando…' }]);
    let bytes: Uint8Array;
    try { bytes = new Uint8Array(await f.arrayBuffer()); } catch {
      mudar(id, { texto: f.name + ': não consegui ler o arquivo', erro: 'leitura' });
      setTimeout(() => tirar(id), 6000);
      return;
    }
    const para = await destino;
    await new Promise<void>(subiu => {
      let parar = () => {};
      const acabar = () => { parar(); paradas.current.delete(parar); };
      parar = repo.enviar({ nome: f.name, bytes }, para, a => {
        if (a.status === 'enviando') {
          mudar(id, { texto: f.name + ': subindo' + (a.partes && a.partes > 1 ? ' (' + (a.enviadas || 0) + ' de ' + a.partes + ' partes)' : '') + '…' });
          return;
        }
        subiu();
        // a tela saiu enquanto subia: o arquivo está na fila do robô, ninguém mais acompanha (a fila segue para o próximo)
        if (saiu.current) { acabar(); return; }
        paradas.current.add(parar);
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
      setModo(clienteAberto ? 'ajuda' : 'automatico');
      setClientesIds(clienteAberto ? [clienteAberto.id] : []);
      setMeses([]);
      setAberto(true);
    },
    fechar: () => setAberto(false),
    arquivos: lista,
    adicionar: (fs: File[]) => setArquivos(a => [...a, ...fs].slice(0, e.MAX_ARQUIVOS_POR_ENVIO)),
    tirarArquivo: (i: number) => setArquivos(a => a.filter((_, k) => k !== i)),
    maxArquivos: e.MAX_ARQUIVOS_POR_ENVIO,
    modo, setModo,
    clientes: clientes.filter(c => !clientesIds.includes(c.id)).map(c => ({ id: c.id, rotulo: c.nomePasta || c.nome })),
    clientesEscolhidos: escolhidos.map(c => ({ id: c.id, rotulo: c.nomePasta || c.nome })),
    adicionarCliente: (id: string) => { if (id) setClientesIds(l => (l.includes(id) ? l : [...l, id])); },
    tirarCliente: (id: string) => setClientesIds(l => l.filter(x => x !== id)),
    meses: meses.map(m => ({ valor: m, rotulo: rotuloDoMes(m) })),
    adicionarMes: (m: string) => setMeses(l => (l.includes(m) ? l : [...l, m].sort())),
    tirarMes: (m: string) => setMeses(l => l.filter(x => x !== m)),
    onde: e.ondeVaiNaAjuda(daAjuda, mesesDaAjuda, mesDaFila),
    podeEnviar: bons.length > 0 && !subindo,
    quantos: bons.length,
    subindo,
    async enviar() {
      if (!bons.length || subindo) return;
      const c = daAjuda.slice(), ms = mesesDaAjuda.slice();
      // só abre o arquivo quando precisa escolher entre vários
      const destinoDe = async (f: File) => e.destinoDaAjuda(c.length > 1 || ms.length > 1 ? await textoDoArquivo(f) : '', c, ms, mesDaFila);
      const fila = bons.slice();
      setSubindo(true);
      setAberto(false);
      setArquivos([]);
      try { for (const f of fila) await mandar(f, destinoDe(f)); } finally { setSubindo(false); }
    },
    envios,
  };
}

export type VmEnvio = ReturnType<typeof useEnvioAoSecretario>;
