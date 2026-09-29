// ViewModel da Importação do Extrator: duas caixas (extratos bancários e lançamentos contábeis),
// cada uma com vários arquivos de uma vez. Lê cada arquivo no navegador (o arquivo não é guardado),
// pergunta "apenas novas / sobrepor" quando já existe lançamento nas mesmas datas e mostra o
// resultado na mensagem flutuante. Embaixo, os arquivos importados, com Excluir.
import { extrator as x } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useSessao } from '../../casca/sessao';

/** 'aaaa-mm' do mês passado (a competência que o escritório trabalha). */
function mesPassado(): string {
  const d = new Date();
  const m = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0');
}

export interface ConfigCaixa {
  lado: x.Lado;
  titulo: string;
  icone: 'landmark' | 'list';
  dica: string;
  formato: string;
  aceitar: string;
  idArquivo: string;
}

export const CAIXAS: ConfigCaixa[] = [
  {
    lado: 'banco', titulo: 'Extratos bancários', icone: 'landmark', idArquivo: 'fExtrato',
    formato: 'PDF do banco (também aceita OFX)', aceitar: x.EXTENSOES_EXTRATO.join(','),
    dica: 'Pode escolher vários PDFs de uma vez. Lê data, histórico e valor de cada lançamento; o PDF não é guardado.',
  },
  {
    lado: 'sistema', titulo: 'Lançamentos contábeis', icone: 'list', idArquivo: 'fSistema',
    formato: 'Razão da conta do banco em Excel, CSV ou PDF', aceitar: x.EXTENSOES_SISTEMA.join(','),
    dica: 'Precisa das colunas de data, histórico e valor (ou débito e crédito). Débito na conta do banco conta como entrada.',
  },
];

/** O que a mensagem flutuante mostra (a View desenha). */
export interface Mensagem {
  tom: 'erro' | 'ok';
  titulo: string;
  textos: { texto: string; tom?: 'aviso' }[];
}

const NOME: Record<x.Lado, string> = { banco: 'o extrato', sistema: 'o sistema' };

function novoId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function useImportacao() {
  const s = useSessao();
  const { toast, modal } = useRetorno();
  const [params] = useSearchParams();
  const competenciaDeTeste = /^\d{4}-\d{2}$/.test(params.get('competencia') || '') ? (params.get('competencia') as string) : mesPassado();
  const [escolhidos, setEscolhidos] = useState<Record<x.Lado, File[]>>({ banco: [], sistema: [] });
  const [lendo, setLendo] = useState<x.Lado | null>(null);
  const [mensagem, setMensagemBruta] = useState<Mensagem | null>(null);
  const [seqMensagem, setSeq] = useState(0);
  const setMensagem = (m: Mensagem | null) => { setMensagemBruta(m); setSeq(v => v + 1); };
  const fecharMensagem = useCallback(() => setMensagemBruta(null), []);

  function escolher(lado: x.Lado, fs: File[]) {
    setMensagemBruta(null);
    setEscolhidos(e => {
      const nomes = new Set(e[lado].map(f => f.name + f.size));
      return { ...e, [lado]: e[lado].concat(fs.filter(f => !nomes.has(f.name + f.size))) };
    });
  }
  function tirar(lado: x.Lado, i: number) {
    setEscolhidos(e => ({ ...e, [lado]: e[lado].filter((_, k) => k !== i) }));
  }

  async function importar(lado: x.Lado) {
    const fs = escolhidos[lado];
    setMensagemBruta(null);
    if (!fs.length) { setMensagem({ tom: 'erro', titulo: 'Escolha o arquivo', textos: [{ texto: lado === 'banco' ? 'Selecione os PDFs do extrato antes de importar.' : 'Selecione o razão da conta do banco antes de importar.' }] }); return; }
    setLendo(lado);
    const lidos: x.ArquivoLido[] = [];
    for (const f of fs) lidos.push(await x.lerArquivo(f.name, new Uint8Array(await f.arrayBuffer()), lado));
    await gravarLidos(lado, lidos);
  }

  /** O que vem depois de ler: pergunta o modo (se já houver movimento nas datas), importa e avisa. */
  async function gravarLidos(lado: x.Lado, lidos: x.ArquivoLido[]) {
    const falhas = lidos.filter(l => l.erro || !l.lancamentos.length);
    const bons = lidos.filter(l => !l.erro && l.lancamentos.length);
    if (!bons.length) {
      setLendo(null);
      setMensagem({ tom: 'erro', titulo: 'Nada para importar', textos: falhas.map(f => ({ texto: f.nome + ': ' + (f.erro || 'nenhum lançamento') })) });
      return;
    }
    const qtdLida = bons.reduce((t, l) => t + l.lancamentos.length, 0);
    let modo: x.ModoImportacao | 'primeira' = 'primeira';
    const existentes = x.jaTemNoPeriodo(s.empresa, lado, bons);
    if (existentes) {
      const escolha = await modal<x.ModoImportacao | null>({
        icone: 'upload', titulo: 'Como importar ' + NOME[lado] + '?',
        html: 'Já existem <b>' + existentes + ' lançamento(s)</b> nas datas destes arquivos; os arquivos têm <b>' + qtdLida + '</b>.<br><br>' +
          '<b>Importar apenas novas</b> — mantém o que já está guardado e só acrescenta o que ainda não existe (mesma data, valor e histórico).<br><br>' +
          '<b>Sobrepor o movimento</b> — apaga o que está guardado nessas datas e fica com o que veio nos arquivos.',
        botoes: [{ rotulo: 'Cancelar', valor: null, variante: 'btn-outline' }, { rotulo: 'Sobrepor o movimento', valor: 'sobrepor', variante: 'btn-danger' }, { rotulo: 'Importar apenas novas', valor: 'novas', variante: 'btn-primary' }],
      });
      if (!escolha) { setLendo(null); toast('Importação cancelada — nada foi alterado.'); return; }
      modo = escolha;
    }
    const res = x.importar(s.empresa, lado, bons, modo, new Date(), novoId);
    s.aplicar(() => res.empresa);
    setLendo(null);
    setEscolhidos(e => ({ ...e, [lado]: [] }));
    const textos: Mensagem['textos'] = [];
    if (res.jaExistiam) textos.push({ texto: res.jaExistiam + ' já estavam guardados e ficaram como estavam.' });
    if (res.substituidos) textos.push({ texto: res.substituidos + ' lançamento(s) que estavam guardados nessas datas foram substituídos.' });
    for (const f of falhas) textos.push({ texto: f.nome + ' ficou de fora: ' + (f.erro || 'nenhum lançamento') + '.', tom: 'aviso' });
    setMensagem({ tom: 'ok', titulo: res.gravados + ' lançamento(s) importado(s)' + (modo === 'sobrepor' ? ' — movimento sobreposto' : ''), textos });
  }

  /**
   * PROTÓTIPO: importa um extrato ou razão inventado da competência (a da tarefa, quando vem na URL;
   * senão, o mês passado), pelo mesmo caminho de um arquivo de verdade. O nome do arquivo diz TESTE.
   */
  async function importarTeste(lado: x.Lado) {
    setMensagemBruta(null);
    setLendo(lado);
    await gravarLidos(lado, [x.arquivoDeTeste(lado, competenciaDeTeste)]);
  }

  async function excluir(id: string) {
    const a = s.empresa.arquivos.find(v => v.id === id);
    if (!a) return;
    const ok = await modal<boolean>({
      icone: 'alert', titulo: 'Excluir este arquivo?',
      html: 'Os <b>' + a.lancamentos.length + ' lançamento(s)</b> de <b>' + escapar(a.nome) + '</b> saem da conferência. Dá para importar de novo depois.',
      botoes: [{ rotulo: 'Voltar', valor: false, variante: 'btn-outline' }, { rotulo: 'Excluir', valor: true, variante: 'btn-danger' }],
    });
    if (!ok) return;
    excluirJa(id);
  }

  /** Exclui sem perguntar (quem pediu já perguntou: a etapa da Tarefas). */
  const excluirJa = useCallback((id: string) => {
    const a = s.empresa.arquivos.find(v => v.id === id);
    if (!a) return;
    s.aplicar(e => x.excluirArquivo(e, id, new Date()));
    setMensagemBruta({ tom: 'ok', titulo: 'Arquivo excluído', textos: [{ texto: a.nome }] });
    setSeq(v => v + 1);
  }, [s]);

  const arquivos = s.empresa.arquivos.slice().sort((a, b) => b.importadoEm.localeCompare(a.importadoEm)).map(a => ({
    id: a.id, lado: a.lado, nome: a.nome, qtd: a.lancamentos.length,
    periodo: x.rotuloPeriodo(x.periodo(a.lancamentos)), quando: a.importadoEm,
  }));

  return {
    caixas: CAIXAS.map(c => ({ ...c, escolhidos: escolhidos[c.lado], lendo: lendo === c.lado })),
    escolher, tirar, importar, importarTeste, excluir, excluirJa,
    ocupado: lendo !== null,
    mensagem, seqMensagem, fecharMensagem,
    arquivos,
  };
}

function escapar(t: string): string {
  return t.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
}
