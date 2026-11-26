// ViewModel da seção Documentos da Área do Cliente refeita (26/11/2026: "quero que esse modulo seja completamente refeito…
// o mais bonito e de facil entendimento possivel"). Duas listas: os Recebidos (o que os clientes mandaram; tocar abre a
// prévia ao lado, com o Recusar; 26/11/2026: "quero poder ver o arquivo direto por aqui") e os Enviados (o que eu mandei ao
// cliente por esta tela; 26/11/2026: "tem que ter a opcao de subir um arquivo por aqui"). As regras ficam em
// dados/documentosDaArea.ts.
import { areaCliente as ac } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { extrator, tarefas as t } from '@nads/core';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useAreaCliente, useDriveDoEntregas, useGmailDoEntregas } from '../../../dados/repo';
import { useEmpresasDaPessoa } from '../base/useEmpresasDaPessoa';
import type { RecebidoDoCliente } from '../../../dados/areaCliente';
import { areaPeloNome, cnpjsDoTexto, empresaDoArquivo, enviadosAoCliente, filtroInicial, filtrosDosRecebidos, recebidosDoFiltro, rotuloDaArea, type FiltroDosRecebidos } from '../../../dados/documentosDaArea';
import { bate, dataEHora, haQuanto, mensagemDoErro } from '../base/comum';
import { useEnviarAoCliente, type EmpresaParaEnviar } from '../base/useEnviarAoCliente';
import { usePreviaDoRecebido } from './usePreviaDoRecebido';
import { baixarArquivo } from '../../../../cliente/dados/baixar';

// o pdf.js lê o CNPJ do PDF para achar a empresa (como o Subir a guia do Executor)
extrator.definirWorkerDoPdf(workerDoPdf);

export type AbaDosDocumentos = 'recebidos' | 'enviados';

export function useDocumentos() {
  const repo = useAreaCliente();
  const drive = useDriveDoEntregas();
  const { toast } = useRetorno();
  const agora = useMemo(() => new Date(), []);
  const [aba, setAba] = useState<AbaDosDocumentos>('recebidos');
  const [busca, setBusca] = useState('');
  // só as empresas da pessoa (26/11/2026: "a pessoa vai ver apenas as empresas dela")
  const daPessoa = useEmpresasDaPessoa();
  const doBanco = repo.recebidos();
  const todos = useMemo(() => ({ ...doBanco, carregada: doBanco.carregada && daPessoa.carregada, lista: doBanco.lista.filter(r => daPessoa.pode(r.codigo)) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doBanco, daPessoa.carregada, daPessoa.filtra, daPessoa.empresas]);
  // a recusa que acabou de ser gravada (o robô anota no recebido logo depois)
  const [recusados, setRecusados] = useState<Record<string, string>>({});
  const idsRecusados = useMemo(() => new Set(Object.keys(recusados)), [recusados]);
  const [escolhido, setEscolhido] = useState<FiltroDosRecebidos | null>(null);
  const filtro = escolhido ?? (todos.carregada ? filtroInicial(todos.lista, agora) : 'todos');
  const linhas = useMemo(
    () => recebidosDoFiltro(todos.lista, filtro, agora, idsRecusados).filter(r => bate(busca, r.codigo, r.empresa, r.nome, r.guia)),
    [todos.lista, filtro, agora, idsRecusados, busca],
  );

  // ---------- a prévia e a recusa ----------
  const previa = usePreviaDoRecebido();
  const [aberto, setAberto] = useState<RecebidoDoCliente | null>(null);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erroDaRecusa, setErroDaRecusa] = useState('');
  const [gravando, setGravando] = useState(false);
  const recusaDe = (r: RecebidoDoCliente) => r.recusa?.motivo || recusados[r.id] || '';
  function abrir(r: RecebidoDoCliente) { setAberto(r); setRecusando(false); previa.ver(r); }

  // o Hoje leva para cá com ?abrir=<id>: abre o arquivo ao lado, uma vez, e tira o parâmetro do endereço
  const [params, setParams] = useSearchParams();
  const pedido = params.get('abrir');
  useEffect(() => {
    if (!pedido || !todos.carregada) return;
    const r = todos.lista.find(x => x.id === pedido);
    setParams(p => { const n = new URLSearchParams(p); n.delete('abrir'); return n; }, { replace: true });
    if (r) { setAba('recebidos'); setEscolhido('todos'); abrir(r); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, todos.carregada]);

  // ---------- o enviar ao cliente ----------
  const envio = useEnviarAoCliente();
  const [enviando, setEnviando] = useState(false);
  const [empresa, setEmpresa] = useState<EmpresaParaEnviar | null>(null);
  const [area, setArea] = useState<ac.AreaDoEscritorio>('societario');
  // a empresa e a área pelo próprio arquivo (26/11/2026, o dono: "ele tem que detectar isso automatico, cliente e setor"):
  // a área pelo nome; a empresa pelo CNPJ do PDF (ou o código/nome no nome do arquivo), só entre as que têm Área do Cliente.
  // A pessoa ainda troca
  const gmail = useGmailDoEntregas();
  const [adivinhado, setAdivinhado] = useState('');
  // (26/11/2026: "tenho que poder selecionar mais de um arquivo") olha todos: a área do primeiro que diz; a empresa pelo CNPJ
  // do nome ou de dentro do PDF de qualquer um deles
  async function adivinhar(fs: readonly File[]) {
    const a = fs.map(f => areaPeloNome(f.name)).find(Boolean) ?? null;
    if (a) setArea(a);
    let e: EmpresaParaEnviar | null = null;
    for (const f of fs) {
      let cnpjs = cnpjsDoTexto(f.name);
      if (!cnpjs.length && /\.pdf$/i.test(f.name) && f.size <= ac.MAIOR_ENVIO_AO_CLIENTE) {
        try {
          const bytes = new Uint8Array(await f.arrayBuffer());
          if (extrator.ehPdf(bytes)) cnpjs = cnpjsDoTexto(t.linhasDasPaginas(await extrator.itensDoPdf(bytes)).map(l => l.join(' ')).join(' '));
        } catch { /* sem leitura: fica o nome do arquivo */ }
      }
      e = empresaDoArquivo(empresas, f.name, cnpjs, gmail.documentos());
      if (e) break;
    }
    setEmpresa(atual => atual ?? e);
    setAdivinhado([e ? 'a empresa' : '', a ? 'a área' : ''].filter(Boolean).join(' e '));
  }
  const [arquivos, setArquivos] = useState<File[]>([]);
  // o envio de vários, um atrás do outro: em qual está e quais já foram
  const [vez, setVez] = useState<{ atual: number; total: number } | null>(null);
  const [enviadosAgora, setEnviadosAgora] = useState<string[]>([]);
  const erroDe = (f: File) => ac.erroDoEnvioAoCliente({ nome: f.name, tamanho: f.size });
  // só as empresas com link: o robô do PC só publica a pasta DO ESCRITÓRIO de quem tem acesso (revisão de 26/11/2026)
  const comLink = repo.links().lista;
  const empresas = useMemo(() => daPessoa.empresas.filter(x => x.codigo != null && comLink.some(l => l.codigo === x.codigo)).map(x => ({ codigo: x.codigo as number, nome: x.nome })), [daPessoa.empresas, comLink]);
  const nomeDaEmpresa = (codigo: string | number) => empresas.find(x => String(x.codigo) === String(codigo))?.nome ?? '';
  const enviados = enviadosAoCliente(drive.meusEnvios().lista).filter(x => bate(busca, x.nome, x.codigo, nomeDaEmpresa(x.codigo)));

  return {
    exemplos: repo.exemplos,
    carregando: !todos.carregada,
    erro: todos.erro,
    aba, setAba: (a: AbaDosDocumentos) => { setAba(a); setBusca(''); },
    contaEnviados: enviadosAoCliente(drive.meusEnvios().lista).length,
    busca, setBusca,
    filtro, setFiltro: setEscolhido,
    filtros: filtrosDosRecebidos(todos.lista, agora, idsRecusados),
    total: todos.lista.length,
    linhas: linhas.map(r => ({
      r, recusa: recusaDe(r), quando: haQuanto(r.recebidoEm, agora), quandoCompleto: dataEHora(r.recebidoEm),
      tamanho: ac.tamanhoLegivel(r.tamanho), tipo: ac.TIPOS_DE_ENVIO.find(t => t.valor === r.tipo)?.rotulo ?? r.tipo,
    })),

    // o recebido aberto ao lado, com a prévia
    aberto, previa: previa.previa,
    abrir,
    // as setas da janela (← e →): o anterior e o próximo da lista do filtro
    ...(() => {
      const i = aberto ? linhas.findIndex(x => x.id === aberto.id) : -1;
      return {
        anterior: i > 0 ? () => abrir(linhas[i - 1]) : undefined,
        proximo: i >= 0 && i < linhas.length - 1 ? () => abrir(linhas[i + 1]) : undefined,
        posicao: i >= 0 ? (i + 1) + ' de ' + linhas.length : undefined,
      };
    })(),
    /** baixa o arquivo aberto (já está no navegador) */
    baixarAberto() {
      const p = previa.previa;
      if (p?.blob) baixarArquivo(p.nome, p.blob);
    },
    /** "462 · 3M EMPREENDIMENTOS · Extrato do banco · recebido há 1 h" */
    subDoAberto: (r: RecebidoDoCliente) => r.codigo + ' · ' + r.empresa + ' · ' + (ac.TIPOS_DE_ENVIO.find(t => t.valor === r.tipo)?.rotulo ?? r.tipo) + (r.guia ? ' · ' + r.guia : '') + ' · ' + dataEHora(r.recebidoEm),
    fechar() { setAberto(null); setRecusando(false); previa.fechar(); },
    recusaDe,
    detalhe: (r: RecebidoDoCliente) => [
      { rotulo: 'Tipo', valor: ac.TIPOS_DE_ENVIO.find(t => t.valor === r.tipo)?.rotulo ?? r.tipo },
      ...(r.guia ? [{ rotulo: 'Da guia', valor: r.guia }] : []),
      { rotulo: 'Tamanho', valor: ac.tamanhoLegivel(r.tamanho) },
      { rotulo: 'Recebido', valor: dataEHora(r.recebidoEm) },
      { rotulo: 'Pasta no Drive', valor: r.pastaDrive ? r.pastaDrive.split(/[\\/]/).join(' › ') : 'O robô ainda está guardando' },
    ],

    // a recusa (com o motivo que o cliente vê)
    recusa: {
      aberta: recusando, motivo, erro: erroDaRecusa, gravando, prontos: ac.MOTIVOS_DA_RECUSA,
      abrir: () => { setRecusando(true); setMotivo(''); setErroDaRecusa(''); },
      fechar: () => { if (!gravando) setRecusando(false); },
      setMotivo: (m: string) => { setMotivo(m); setErroDaRecusa(''); },
      async confirmar() {
        if (!aberto) return;
        const e = ac.erroDaRecusa(motivo);
        if (e) { setErroDaRecusa(e); return; }
        setGravando(true);
        try {
          await repo.recusar(aberto.id, motivo);
          setRecusados(x => ({ ...x, [aberto.id]: motivo.trim() }));
          setRecusando(false);
          toast('Recusado. O cliente vê o motivo e o "Falta mandar" volta para ele.');
        } catch (err) { setErroDaRecusa(mensagemDoErro(err, 'Não deu para recusar agora.')); }
        finally { setGravando(false); }
      },
    },

    // o enviar ao cliente
    enviar: {
      aberta: enviando,
      abrir(paraEmpresa?: EmpresaParaEnviar) { setEnviando(true); setEmpresa(paraEmpresa ?? null); setArquivos([]); setArea('societario'); setAdivinhado(''); setVez(null); setEnviadosAgora([]); envio.limpar(); },
      fechar() { if (!envio.ocupado) { setEnviando(false); envio.limpar(); } },
      empresas, empresa, setEmpresa,
      area, setArea, areas: ac.AREAS_DO_ESCRITORIO,
      /** os arquivos escolhidos (mais um lote junta aos que já estão; o mesmo nome não repete) */
      arquivos: arquivos.map(f => ({ nome: f.name, tamanho: ac.tamanhoLegivel(f.size), erro: erroDe(f) })),
      escolher(fs: readonly File[]) {
        if (!fs.length) return;
        const juntos = [...arquivos, ...fs.filter(f => !arquivos.some(x => x.name === f.name && x.size === f.size))];
        setArquivos(juntos); envio.limpar(); setEnviadosAgora([]);
        void adivinhar(juntos);
      },
      tirar(nome: string) { setArquivos(l => l.filter(f => f.name !== nome)); },
      /** o que foi adivinhado pelo arquivo ("Empresa e área pelo arquivo; confira") */
      adivinhado,
      andamento: envio.andamento,
      /** "Arquivo 2 de 3" enquanto manda vários */
      vez: vez && vez.total > 1 ? 'Arquivo ' + vez.atual + ' de ' + vez.total : '',
      enviadosAgora,
      ocupado: envio.ocupado || !!vez,
      pode: !!empresa && arquivos.length > 0 && arquivos.every(f => !erroDe(f)) && !envio.ocupado && !vez,
      async confirmar() {
        if (!empresa || !arquivos.length) return;
        const feitos: string[] = [];
        try {
          for (let i = 0; i < arquivos.length; i++) {
            setVez({ atual: i + 1, total: arquivos.length });
            const r = await envio.enviar(arquivos[i], empresa, area);
            feitos.push(r.nomeFinal);
          }
          setEnviadosAgora(feitos);
          setAba('enviados');
        } catch { /* o andamento já diz o motivo; os que foram ficam em Enviados por mim */ }
        finally { setVez(null); setArquivos(l => l.filter(f => !feitos.includes(f.name))); }
      },
      outro() { setArquivos([]); setEnviadosAgora([]); envio.limpar(); },
    },

    // os enviados por mim
    enviados: enviados.map(x => ({ ...x, empresa: nomeDaEmpresa(x.codigo), areaRotulo: rotuloDaArea(x.area), quando: haQuanto(x.criadoEm, agora), quandoCompleto: dataEHora(x.criadoEm) })),
  };
}
