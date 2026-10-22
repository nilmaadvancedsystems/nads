// ViewModel do Rateio de frete (Fiscal › Rateio de frete; Heverton, 22/10/2026: a planilha "RATEIO - FRETE"). Em vez de
// digitar: a empresa, a competência, Entradas ou Saídas e uma NF-e do "Baixar XMLs do SIEG"; a tela vem com o total dos
// produtos, o frete e o desconto da nota (editáveis) e os itens agrupados pela tributação (ou pelo CFOP, como na planilha).
// Clicar numa linha abre o frete dela pelos NCMs (a segunda parte da planilha). Sem XML, "Digitar" faz a planilha à mão.
// As contas: core tarefas.sieg.ratear (em centavos, a soma bate com a nota).
import { tarefas as t } from '@nads/core';
import { useState } from 'react';
import { competenciasDaTela } from '../../../casca/navegacao';
import { useRepo, useSieg } from '../../../dados/repo';

const r = t.sieg;
export type Fonte = 'nota' | 'manual';
export type Lado = 'recebidas' | 'emitidas';

/** "1.234,56", "1234.56" ou "1234,5" → número (vazio = 0). */
export function numero(texto: string): number {
  const s = String(texto || '').trim().replace(/\s|R\$/g, '');
  if (!s) return 0;
  const v = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(v) ? v : 0;
}
const campo = (v: number) => (v ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

interface LinhaDigitada { rotulo: string; valor: string; ipi: string }
const LINHAS_INICIAIS: LinhaDigitada[] = [{ rotulo: '', valor: '', ipi: '' }, { rotulo: '', valor: '', ipi: '' }];

export function useRateioDeFrete() {
  const repo = useRepo();
  const sieg = useSieg();
  const competencias = competenciasDaTela(12);
  const [fonte, setFonte] = useState<Fonte>('nota');
  const [codigo, setCodigo] = useState('');
  const [competencia, setCompetencia] = useState(competencias[0]);
  const [lado, setLado] = useState<Lado>('recebidas');
  const [chave, setChave] = useState('');
  const [agrupar, setAgrupar] = useState<t.sieg.AgruparPor>('tributacao');
  const [aberto, setAberto] = useState('');
  // o total, o frete e o desconto que a pessoa mudou (de qual nota; outra nota volta aos da nota)
  const [mudados, setMudados] = useState<{ de: string; total?: string; frete?: string; desconto?: string }>({ de: '' });
  const [digitadas, setDigitadas] = useState<LinhaDigitada[]>(LINHAS_INICIAIS);

  const empresas = repo.listarEmpresas().filter(e => e.codigo != null).map(e => ({ codigo: String(e.codigo), nome: e.nome }))
    .sort((a, b) => Number(a.codigo) - Number(b.codigo));
  const empresa = empresas.find(e => e.codigo === codigo) || null;

  // as NF-e e NFC-e do lado escolhido, com itens e sem as canceladas
  const doSieg = codigo ? sieg.notas(codigo, competencia) : null;
  const notas = (doSieg?.dados?.[lado] || []).filter(n => (n.tipo === 'NF-e' || n.tipo === 'NFC-e') && !n.cancelada && (n.itens || []).length);
  const nota = fonte === 'nota' ? notas.find(n => n.chave === chave) || null : null;
  const daNota = nota ? r.valoresDaNota(nota) : null;
  const grupos = nota ? r.gruposDaNota(nota, agrupar) : [];

  const deAgora = fonte === 'nota' ? chave : 'manual';
  const mudado = mudados.de === deAgora ? mudados : { de: deAgora };
  const texto = (k: 'total' | 'frete' | 'desconto') => mudado[k] ?? campo(daNota ? daNota[k] : 0);
  const mudar = (k: 'total' | 'frete' | 'desconto', v: string) => setMudados({ ...mudado, [k]: v });

  const linhas: (t.sieg.LinhaParaRatear & { id: string; detalhe: string })[] = fonte === 'nota'
    ? grupos.map(g => ({ id: g.id, rotulo: g.rotulo, detalhe: g.detalhe, valor: g.valor, ipi: g.ipi }))
    : digitadas.map((l, i) => ({ id: String(i), rotulo: l.rotulo.trim() || 'Linha ' + (i + 1), detalhe: '', valor: numero(l.valor), ipi: numero(l.ipi) })).filter(l => l.valor > 0);
  const rateio = r.ratear({ total: numero(texto('total')) || null, frete: numero(texto('frete')), desconto: numero(texto('desconto')), linhas });

  // o detalhe pelos NCMs: só pela nota (à mão não há NCM)
  const iAberto = linhas.findIndex(l => l.id === aberto);
  const grupoAberto = fonte === 'nota' && iAberto >= 0 ? grupos[iAberto] : null;
  const ncms = grupoAberto ? r.rateioDosNcms(grupoAberto, rateio.linhas[iAberto].frete, rateio.linhas[iAberto].desconto) : null;

  const avisos: string[] = [];
  if (daNota?.estimado && mudado.frete === undefined && mudado.desconto === undefined) {
    avisos.push('Esta nota foi baixada antes de o nads guardar o frete e o desconto: ' + (daNota.frete ? 'o frete' : 'o desconto') +
      ' veio da diferença entre o valor da nota e os produtos com o ST e o IPI (seguro e outras despesas entram junto). Confira com o DANFE ou baixe os XMLs de novo.');
  }
  if (nota && Math.abs(numero(texto('total')) - (daNota?.total || 0)) > 0.005 && rateio.total > rateio.soma.valor) {
    avisos.push('O total dos produtos é maior que a soma dos itens: a diferença fica com uma parte do frete, como na planilha.');
  }

  return {
    exemplos: sieg.exemplos,
    fonte, setFonte: (f: Fonte) => { setFonte(f); setAberto(''); },
    empresas, codigo, empresa: empresa ? empresa.codigo + ' · ' + empresa.nome : '',
    setCodigo: (c: string) => { setCodigo(c); setChave(''); setAberto(''); },
    competencia, rotuloCompetencia: t.rotuloCompetencia(competencia),
    competencias: competencias.map(c => ({ valor: c, rotulo: t.rotuloCompetencia(c) })),
    setCompetencia: (c: string) => { setCompetencia(c); setChave(''); setAberto(''); },
    lado, setLado: (l: Lado) => { setLado(l); setChave(''); setAberto(''); },
    carregando: !!codigo && !!doSieg && !doSieg.carregadas,
    semXml: !!codigo && !!doSieg?.carregadas && !doSieg.dados,
    notas: notas.map(n => {
      const outra = lado === 'recebidas' ? n.emitente : n.destinatario;
      return { chave: n.chave, rotulo: n.tipo + ' ' + n.numero + ' · ' + n.data + ' · ' + outra.nome + ' · R$ ' + campo(n.valor), comFrete: !!n.frete || !!n.desconto };
    }),
    chave, setChave: (c: string) => { setChave(c); setAberto(''); },
    nota: nota ? {
      titulo: nota.tipo + ' ' + nota.numero + (nota.serie ? ' · série ' + nota.serie : ''),
      data: nota.data, emitente: nota.emitente.nome, destinatario: nota.destinatario.nome, valor: nota.valor, itens: (nota.itens || []).length,
    } : null,
    agrupar, setAgrupar: (a: t.sieg.AgruparPor) => { setAgrupar(a); setAberto(''); },
    total: texto('total'), frete: texto('frete'), desconto: texto('desconto'),
    setTotal: (v: string) => mudar('total', v), setFrete: (v: string) => mudar('frete', v), setDesconto: (v: string) => mudar('desconto', v),
    mudouValores: mudado.total !== undefined || mudado.frete !== undefined || mudado.desconto !== undefined,
    voltarValores: () => setMudados({ de: deAgora }),
    avisos,
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
