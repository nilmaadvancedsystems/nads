// ViewModel do Importar planilha (15/10/2026: "quero que ele leia uma planilha com clientes que já pagaram para gerar para
// mim"; "a data da nota = a da planilha"): lê o relatório de recebimentos do banco (código, nome, data, valor), acha cada
// cliente na lista do escritório, traz o CPF/CNPJ, o e-mail e o telefone que o nads tem (como a busca da Nova nota), busca o
// endereço dos CNPJs na Receita (um por vez, com pausa: a API pública limita) e mostra a prévia com a situação de cada linha.
// Só as prontas vêm marcadas; "Emitir" pede uma nota por linha marcada (o robô emite), depois de confirmar o ambiente.
import { empresas, formatos, nfse } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { useOperador } from '../../casca/operador';
import { contatosDoEntregas, dadosDaEmpresaNoEntregas, empresasNovas, repoDoCadastro } from '../../dados/fonte';
import { consultarCnpj } from '../../dados/receita';
import { useNfse } from '../../dados/repo';
import { foneSoDigitos } from './formatosDaNota';

type Cliente = empresas.EmpresaDoEscritorio;
type Endereco = NonNullable<nfse.TomadorNfse['endereco']>;
interface Base { rec: nfse.Recebimento; empresa: Cliente | null; nome: string; documento: string; email: string; fone: string }
interface EstadoDoEndereco { estado: 'buscando' | 'ok' | 'falhou'; endereco: Endereco | null }

/** a pausa entre as consultas na Receita (as APIs públicas limitam o ritmo) */
const PAUSA_DA_RECEITA_MS = 400;
const pausa = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export interface LinhaImportada {
  indice: number;
  codigo: number;
  /** o nome no nads (o da planilha, quando o código não está na lista) */
  cliente: string;
  documento: string;
  valor: number;
  data: string;
  descricao: string;
  /** vazio = pronta */
  problema: string;
  situacao: string;
  tom: 'ok' | 'warn' | 'bad' | 'neutral';
  buscando: boolean;
  pronta: boolean;
  marcada: boolean;
}

export function useImportarPlanilha() {
  const repo = useNfse();
  const { toast, modal } = useRetorno();
  const por = useOperador().operador?.nome || '';
  const cfg = repo.config();
  const config = cfg.config ?? nfse.CONFIG_PADRAO;
  const faltas = cfg.carregada ? nfse.faltasNaConfig(cfg.config, !!cfg.tokenGravadoEm) : ['a configuração do emissor'];

  const [arquivo, setArquivo] = useState('');
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const [avisos, setAvisos] = useState<string[]>([]);
  const [base, setBase] = useState<Base[]>([]);
  const [enderecos, setEnderecos] = useState<Record<string, EstadoDoEndereco>>({});
  const [marcas, setMarcas] = useState<Record<number, boolean>>({});
  // o que já foi pedido: 'ok', ou o erro que o pedido deu
  const [pedidas, setPedidas] = useState<Record<number, string>>({});
  const [progresso, setProgresso] = useState<{ feitas: number; total: number } | null>(null);
  // a rodada vale até outro arquivo (ou fechar a janela): a busca na Receita da anterior para
  const rodada = useRef(0);
  useEffect(() => () => { rodada.current++; }, []);

  const doc = (b: Base) => nfse.soDigitos(b.documento);
  const ehCnpj = (b: Base) => !!b.empresa && doc(b).length === 14 && nfse.documentoValido(doc(b));
  const cnpjs = [...new Set(base.filter(ehCnpj).map(doc))];

  async function buscarEnderecos(lista: string[], minha: number) {
    for (const c of lista) {
      if (minha !== rodada.current) return;
      setEnderecos(e => ({ ...e, [c]: { estado: 'buscando', endereco: null } }));
      let feito: EstadoDoEndereco;
      try {
        const d = await consultarCnpj(c);
        feito = { estado: d.endereco ? 'ok' : 'falhou', endereco: d.endereco };
      } catch {
        feito = { estado: 'falhou', endereco: null };
      }
      if (minha !== rodada.current) return;
      setEnderecos(e => ({ ...e, [c]: feito }));
      await pausa(PAUSA_DA_RECEITA_MS);
    }
  }

  async function lerArquivo(f: File) {
    const minha = ++rodada.current;
    setArquivo(f.name); setLendo(true); setErro(''); setAvisos([]); setBase([]); setEnderecos({}); setMarcas({}); setPedidas({});
    try {
      const { recebimentos, avisos: av } = nfse.lerArquivoDeRecebimentos(await f.arrayBuffer());
      setAvisos(av);
      if (!recebimentos.length) { setErro('Não achei nenhuma linha de recebimento nesta planilha.'); return; }
      const lista: readonly Cliente[] = [...empresas.EMPRESAS_COM_DP, ...empresasNovas()];
      const [doEntregas, contatos] = await Promise.all([dadosDaEmpresaNoEntregas(), contatosDoEntregas()]);
      const codigos = [...new Set(recebimentos.map(r => r.codigo))];
      const cadastros = new Map(await Promise.all(codigos.map(async c => {
        const e = lista.find(x => x.codigo === c);
        return [c, e ? await repoDoCadastro().obter(e.nome, e.codigo) : null] as const;
      })));
      if (minha !== rodada.current) return;
      const novo: Base[] = recebimentos.map(rec => {
        const empresa = lista.find(x => x.codigo === rec.codigo) || null;
        const cad = cadastros.get(rec.codigo);
        const d = doEntregas.get(rec.codigo);
        const c = contatos.get(rec.codigo);
        return {
          rec, empresa, nome: empresa ? d?.receita?.razaoSocial || empresa.nome : rec.nome,
          documento: nfse.soDigitos(cad?.cnpj || d?.documento || ''),
          email: cad?.contato?.email || c?.email || '',
          fone: foneSoDigitos(cad?.contato?.whatsapp || c?.whatsapp || ''),
        };
      });
      setBase(novo);
      void buscarEnderecos([...new Set(novo.filter(b => b.empresa && b.documento.length === 14 && nfse.documentoValido(b.documento)).map(b => b.documento))], minha);
    } catch (err) {
      setErro('Não consegui ler o arquivo: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      if (minha === rodada.current) setLendo(false);
    }
  }

  function pedidoDe(b: Base): { tomador: nfse.TomadorNfse; servico: nfse.ServicoNfse; empresaCodigo: number | null } {
    const tomador: nfse.TomadorNfse = { documento: doc(b), nome: b.nome.trim() };
    if (b.email.trim()) tomador.email = b.email.trim();
    if (b.fone) tomador.fone = b.fone;
    const e = enderecos[doc(b)]?.endereco;
    if (e) tomador.endereco = e;
    return { tomador, servico: { descricao: nfse.descricaoPadrao(b.rec.data, config.descricao), valor: b.rec.valor, competencia: b.rec.data }, empresaCodigo: b.rec.codigo };
  }

  // a nota que já existe do cliente no mês da data (não conta a recusada nem a cancelada)
  const existentes = repo.notas().lista.filter(n => n.status !== 'erro' && n.status !== 'cancelada');

  const linhas: LinhaImportada[] = base.map((b, indice) => {
    const e = enderecos[doc(b)];
    const mes = b.rec.data.slice(0, 7);
    let problema = '';
    let tom: LinhaImportada['tom'] = 'bad';
    let buscando = false;
    if (pedidas[indice] === 'ok') { problema = 'Pedida'; tom = 'ok'; }
    else if (!b.empresa) problema = 'Código não está na lista do escritório';
    else if (!b.documento) problema = 'Sem CPF/CNPJ';
    else if (!nfse.documentoValido(b.documento)) problema = 'CPF/CNPJ não confere';
    else if (doc(b).length === 14 && (!e || e.estado === 'buscando')) { problema = 'Buscando endereço…'; tom = 'warn'; buscando = true; }
    else if (doc(b).length === 14 && !e?.endereco) problema = 'Sem endereço na Receita';
    else if (existentes.some(n => n.empresaCodigo === b.rec.codigo && n.servico.competencia.slice(0, 7) === mes)) { problema = 'Já tem nota deste cliente em ' + mes.slice(5) + '/' + mes.slice(0, 4); tom = 'warn'; }
    else if (pedidas[indice]) problema = 'Não pediu: ' + pedidas[indice];
    else {
      const p = pedidoDe(b);
      const conferido = nfse.conferirPedido(p);
      if (conferido.length) problema = conferido[0];
    }
    const pronta = !problema;
    return {
      indice, codigo: b.rec.codigo, cliente: b.empresa?.nome || b.rec.nome, documento: b.documento, valor: b.rec.valor, data: b.rec.data,
      descricao: nfse.descricaoPadrao(b.rec.data, config.descricao), problema, situacao: pronta ? 'Pronta' : problema, tom: pronta ? 'ok' : tom, buscando, pronta,
      marcada: pronta && (marcas[indice] ?? true),
    };
  });

  const prontas = linhas.filter(l => l.pronta);
  const marcadas = linhas.filter(l => l.marcada);
  const totalMarcado = marcadas.reduce((s, l) => s + l.valor, 0);
  const feitos = cnpjs.filter(c => enderecos[c] && enderecos[c].estado !== 'buscando').length;
  const falharam = cnpjs.filter(c => enderecos[c]?.estado === 'falhou');

  async function emitir() {
    if (!marcadas.length || progresso || faltas.length) return;
    const producao = config.ambiente === 'producao';
    const total = formatos.reais(totalMarcado);
    const sim = await modal<boolean>({
      icone: 'alert',
      titulo: 'Emitir ' + marcadas.length + (marcadas.length === 1 ? ' nota' : ' notas') + ' em ' + (producao ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO') + '?',
      texto: (producao ? 'Elas passam a valer: vão para a prefeitura com valor fiscal.' : 'Ambiente de homologação: as notas não têm valor fiscal.') + ' Total de ' + total + '.',
      botoes: [{ rotulo: 'Emitir', valor: true, variante: 'btn-primary' }, { rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }],
    });
    if (!sim) return;
    const minha = rodada.current;
    let ok = 0;
    for (let i = 0; i < marcadas.length; i++) {
      if (minha !== rodada.current) return;
      setProgresso({ feitas: i, total: marcadas.length });
      const idx = marcadas[i].indice;
      try {
        await repo.pedir(pedidoDe(base[idx]), por);
        setPedidas(p => ({ ...p, [idx]: 'ok' }));
        ok++;
      } catch (err) {
        setPedidas(p => ({ ...p, [idx]: err instanceof Error ? err.message : String(err) }));
      }
    }
    setProgresso(null);
    toast(ok === marcadas.length ? ok + (ok === 1 ? ' nota pedida' : ' notas pedidas') + ': o robô emite em instantes.' : ok + ' de ' + marcadas.length + ' notas pedidas; veja as que deram erro na lista.');
  }

  return {
    ambiente: config.ambiente, faltas, exemplos: repo.exemplos,
    arquivo, lendo, erro, avisos, lerArquivo,
    linhas,
    resumo: { total: linhas.length, prontas: prontas.length, comProblema: linhas.filter(l => !l.pronta && l.problema !== 'Pedida' && !l.buscando).length, valor: linhas.reduce((s, l) => s + l.valor, 0) },
    enderecos: { feitos, total: cnpjs.length, andando: cnpjs.length > 0 && feitos < cnpjs.length, falharam: falharam.length },
    buscarDeNovo: () => { void buscarEnderecos(falharam, rodada.current); },
    marcar(indice: number) {
      if (linhas[indice]?.pronta) setMarcas(m => ({ ...m, [indice]: !(m[indice] ?? true) }));
    },
    todasMarcadas: prontas.length > 0 && marcadas.length === prontas.length,
    marcarTodas() {
      const marcar = marcadas.length !== prontas.length;
      setMarcas(Object.fromEntries(prontas.map(l => [l.indice, marcar])));
    },
    marcadas: marcadas.length, totalMarcado, progresso, emitir,
  };
}
