// ViewModel do Rateio de frete (Fiscal › Rateio de frete; Heverton, 22/10/2026: a planilha "RATEIO - FRETE"). Um caminho de
// cima para baixo (22/10/2026: "mais intuitivas e não bagunçadas"): (1) a empresa (a busca da calculadora do Simples), o
// mês e Entradas ou Saídas; (2) as NF-e do mês numa tabela com busca, as com frete primeiro; clicar escolhe a nota; (3) o
// resumo da nota (produtos, frete e desconto, editáveis na linha) e o rateio pela tributação (ou pelo CFOP); clicar numa
// tributação abre o frete dela pelos NCMs. Sem XML, "digite os valores" faz a planilha à mão.
// As contas: core tarefas.sieg.ratear (em centavos, a soma bate com a nota).
import { empresas as emp, tarefas as t } from '@nads/core';
import { useState } from 'react';
import { competenciasDaTela } from '../../../casca/navegacao';
import { useRepo, useSieg } from '../../../dados/repo';

const r = t.sieg;
export type Fonte = 'nota' | 'manual';
export type Lado = 'recebidas' | 'emitidas';
type Campo = 'total' | 'frete' | 'desconto';

/** "1.234,56", "1234.56" ou "1234,5" → número (vazio = 0). */
export function numero(texto: string): number {
  const s = String(texto || '').trim().replace(/\s|R\$/g, '');
  if (!s) return 0;
  const v = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(v) ? v : 0;
}
/** dd/mm/aaaa → aaaammdd (para ordenar) */
const ordemDaData = (d: string) => d.split('/').reverse().join('');
/** quantas notas a tabela mostra de cada vez (o resto pela busca) */
const NOTAS_NA_TABELA = 12;

interface LinhaDigitada { rotulo: string; valor: string; ipi: string }
const LINHAS_INICIAIS: LinhaDigitada[] = [{ rotulo: '', valor: '', ipi: '' }, { rotulo: '', valor: '', ipi: '' }];

export function useRateioDeFrete() {
  const repo = useRepo();
  const sieg = useSieg();
  const [fonte, setFonte] = useState<Fonte>('nota');
  const [codigo, setCodigo] = useState<number | null>(null);
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState(0);
  const [competencia, setCompetencia] = useState(() => competenciasDaTela(1)[0]);
  const [lado, setLado] = useState<Lado>('recebidas');
  const [buscaDaNota, setBuscaDaNota] = useState('');
  const [chave, setChave] = useState('');
  const [agrupar, setAgrupar] = useState<t.sieg.AgruparPor>('tributacao');
  const [aberto, setAberto] = useState('');
  // a nota aberta no espelho (23/10/2026: "conferir as danfe direto pelo app")
  const [vendo, setVendo] = useState('');
  // o que a pessoa mudou nos valores (de qual nota; outra nota volta aos da nota)
  const [mudados, setMudados] = useState<{ de: string } & Partial<Record<Campo, number>>>({ de: '' });
  const [digitadas, setDigitadas] = useState<LinhaDigitada[]>(LINHAS_INICIAIS);

  // (1) a empresa
  const empresas = repo.listarEmpresas().filter(e => e.codigo != null);
  const empresa = codigo != null ? empresas.find(e => e.codigo === codigo) || null : null;
  const q = busca.trim();
  const achadas = q ? emp.buscarEmpresas(empresas, q).slice(0, 8) : [];
  const recomecar = () => { setChave(''); setAberto(''); setBuscaDaNota(''); };

  // (2) as NF-e do mês com itens, sem as canceladas; as com frete (ou desconto) primeiro, depois as mais novas
  const doSieg = empresa ? sieg.notas(String(empresa.codigo), competencia) : null;
  const daParte = (n: t.sieg.NotaDoSieg) => (lado === 'recebidas' ? n.emitente : n.destinatario);
  const todas = (doSieg?.dados?.[lado] || [])
    .filter(n => (n.tipo === 'NF-e' || n.tipo === 'NFC-e') && !n.cancelada && (n.itens || []).length)
    .map(n => ({ n, v: r.valoresDaNota(n) }))
    .sort((a, b) => Number(!!(b.v.frete || b.v.desconto)) - Number(!!(a.v.frete || a.v.desconto)) || ordemDaData(b.n.data).localeCompare(ordemDaData(a.n.data)));
  const qn = buscaDaNota.trim().toLowerCase();
  const achadasDaNota = todas.filter(({ n }) => !qn || [n.numero, n.data, daParte(n).nome, daParte(n).doc].join(' ').toLowerCase().includes(qn));

  const escolhida = fonte === 'nota' ? todas.find(x => x.n.chave === chave) || null : null;
  const nota = escolhida?.n || null;
  const daNota = escolhida?.v || null;
  const grupos = nota ? r.gruposDaNota(nota, agrupar) : [];

  // (3) os valores (os da nota ou os mudados) e o rateio
  const deAgora = fonte === 'nota' ? chave : 'manual';
  const mudado = mudados.de === deAgora ? mudados : { de: deAgora };
  const valor = (k: Campo) => mudado[k] ?? (daNota ? daNota[k] : 0);
  const linhas: (t.sieg.LinhaParaRatear & { id: string; detalhe: string })[] = fonte === 'nota'
    ? grupos.map(g => ({ id: g.id, rotulo: g.rotulo, detalhe: g.detalhe, valor: g.valor, ipi: g.ipi }))
    : digitadas.map((l, i) => ({ id: String(i), rotulo: l.rotulo.trim() || 'Linha ' + (i + 1), detalhe: '', valor: numero(l.valor), ipi: numero(l.ipi) })).filter(l => l.valor > 0);
  const rateio = r.ratear({ total: valor('total') || null, frete: valor('frete'), desconto: valor('desconto'), linhas });

  // o detalhe pelos NCMs: só pela nota (à mão não há NCM)
  const iAberto = linhas.findIndex(l => l.id === aberto);
  const grupoAberto = fonte === 'nota' && iAberto >= 0 ? grupos[iAberto] : null;
  const ncms = grupoAberto ? r.rateioDosNcms(grupoAberto, rateio.linhas[iAberto].frete, rateio.linhas[iAberto].desconto) : null;

  const estimado = !!daNota?.estimado && mudado.frete === undefined && mudado.desconto === undefined;

  return {
    exemplos: sieg.exemplos,
    fonte,
    digitar: () => { setFonte('manual'); setAberto(''); },
    voltarAsNotas: () => { setFonte('nota'); setAberto(''); },
    // a empresa
    empresa: empresa ? { codigo: empresa.codigo as number, nome: empresa.nome } : null,
    busca, setBusca: (v: string) => { setBusca(v); setAtivo(0); }, achadas, ativo, setAtivo,
    mover(d: number) { setAtivo(i => Math.max(0, Math.min(achadas.length - 1, i + d))); },
    escolher(e: { codigo: number | null }) { setCodigo(e.codigo); setBusca(''); recomecar(); },
    escolherDestacado() { const e = achadas[ativo]; if (e) { setCodigo(e.codigo); setBusca(''); recomecar(); } },
    trocarEmpresa() { setCodigo(null); recomecar(); },
    competencia, setCompetencia: (c: string) => { setCompetencia(c); recomecar(); },
    rotuloCompetencia: t.rotuloCompetencia(competencia),
    lado, setLado: (l: Lado) => { setLado(l); recomecar(); },
    // as notas
    carregando: !!empresa && !!doSieg && !doSieg.carregadas,
    semXml: !!empresa && !!doSieg?.carregadas && !doSieg.dados,
    quantasNotas: todas.length,
    buscaDaNota, setBuscaDaNota,
    notas: achadasDaNota.slice(0, NOTAS_NA_TABELA).map(({ n, v }) => ({
      chave: n.chave, numero: n.numero + (n.serie ? '/' + n.serie : ''), data: n.data, parte: daParte(n).nome,
      valor: n.valor, frete: v.frete, desconto: v.desconto, estimado: v.estimado,
    })),
    notasFora: Math.max(0, achadasDaNota.length - NOTAS_NA_TABELA),
    escolherNota: (c: string) => { setChave(c); setAberto(''); },
    /** o espelho da nota (a chave, as partes, os itens e os totais) */
    vendo: vendo ? (doSieg?.dados?.[lado] || []).find(n => n.chave === vendo) || null : null,
    verNota: (c: string) => setVendo(c),
    fecharNota: () => setVendo(''),
    trocarNota: () => { setChave(''); setAberto(''); },
    nota: nota ? { chave: nota.chave, titulo: nota.tipo + ' ' + nota.numero, data: nota.data, parte: daParte(nota).nome, valor: nota.valor } : null,
    // o resultado
    agrupar, setAgrupar: (a: t.sieg.AgruparPor) => { setAgrupar(a); setAberto(''); },
    total: valor('total'), frete: valor('frete'), desconto: valor('desconto'),
    mudar: (k: Campo, texto: string) => setMudados({ ...mudado, [k]: numero(texto) }),
    mudouValores: mudado.total !== undefined || mudado.frete !== undefined || mudado.desconto !== undefined,
    voltarValores: () => setMudados({ de: deAgora }),
    estimado,
    linhas: rateio.linhas.map((l, i) => ({ ...l, id: linhas[i].id, detalhe: linhas[i].detalhe })),
    rateio,
    aberto, abrir: (id: string) => setAberto(a => (a === id ? '' : id)),
    grupoAberto: grupoAberto ? grupoAberto.rotulo : '', ncms,
    // à mão
    digitadas,
    mudarDigitada: (i: number, k: keyof LinhaDigitada, v: string) => setDigitadas(ls => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l))),
    novaLinha: () => setDigitadas(ls => [...ls, { rotulo: '', valor: '', ipi: '' }]),
    tirarLinha: (i: number) => setDigitadas(ls => (ls.length > 1 ? ls.filter((_, j) => j !== i) : LINHAS_INICIAIS)),
  };
}

export type VmRateioDeFrete = ReturnType<typeof useRateioDeFrete>;
