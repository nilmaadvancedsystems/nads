// ViewModel da calculadora do Simples Nacional (Fiscal › Simples; Heverton, 22/10/2026: a "PLANILHA SIMPLES NACIONAL
// 2018.xlsx" do Fiscal no nads, "preenchido com os dados do próprio nads"). Escolhe a empresa e a competência (o mês da
// apuração) e já vem preenchida:
//   - o RBT12: as saídas do SIEG (NF-e e NFC-e emitidas) dos 12 meses antes da competência (core sieg.faturamento);
//   - a receita do mês segregada: os XMLs do mês no SIEG (normal, ICMS-ST, monofásico; as NFS-e, com o ISS retido à parte);
//   - a folha do Fator R, dos mesmos 12 meses: o salário que o DP informou na etapa Folha e o FGTS das guias do FGTS
//     Digital; a CPP se digita (o nads não guarda).
// Cada número pode ser trocado à mão e a tela diz de onde veio (SIEG, Folha do DP, FGTS Digital ou Digitado). As contas
// são as da planilha (core sieg.calculadora).
import { empresas as emp, tarefas as t } from '@nads/core';
import { useMemo, useState } from 'react';
import { competenciasDaTela } from '../../../casca/navegacao';
import { useExecucoesDoPeriodo, useFgts, useRepo, useSieg } from '../../../dados/repo';

const s = t.sieg;

export type CampoDoSimples = 'rbt12' | 'normal' | 'st' | 'monofasico' | 'monofasicoESt' | 'servicos' | 'issRetido' | 'salario' | 'fgts' | 'cpp';
export type FonteDoNumero = 'SIEG' | 'Folha do DP' | 'FGTS Digital' | 'Digitado' | null;
export interface NumeroDoSimples { campo: CampoDoSimples; rotulo: string; valor: number; fonte: FonteDoNumero; detalhe: string; digitado: boolean }

const ANEXOS_DA_MERCADORIA: readonly t.sieg.Anexo[] = ['I', 'II'];
const ANEXOS_DO_SERVICO: readonly t.sieg.Anexo[] = ['III', 'IV', 'V'];
const centavos = (v: number) => Math.round(v * 100) / 100;
/** "1.234,56" → 1234.56 (vazio = null: volta ao número do nads) */
const lerValor = (texto: string): number | null => {
  const x = texto.trim().replace(/[R$\s]/g, '');
  if (!x) return null;
  const n = Number(x.includes(',') ? x.replace(/\./g, '').replace(',', '.') : x);
  return Number.isFinite(n) && n >= 0 ? centavos(n) : null;
};
/** o mês antes de "AAAA-MM" */
const mesAnterior = (c: string) => { const [a, m] = c.split('-').map(Number); const d = new Date(a, m - 2, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };

export function useCalculadoraDoSimples() {
  const repo = useRepo();
  const sieg = useSieg();
  const fgts = useFgts();
  const [codigo, setCodigo] = useState<number | null>(null);
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState(0);
  const [competencia, setCompetenciaBruta] = useState(() => competenciasDaTela(1)[0]);
  const [anexoDaMercadoria, setAnexoDaMercadoria] = useState<t.sieg.Anexo>('I');
  const [anexoEscolhido, setAnexoEscolhido] = useState<t.sieg.Anexo | null>(null);
  const [digitados, setDigitados] = useState<Partial<Record<CampoDoSimples, number>>>({});

  const empresas = repo.listarEmpresas().filter(e => e.codigo != null);
  const empresa = codigo != null ? empresas.find(e => e.codigo === codigo) || null : null;
  const q = busca.trim();
  const achadas = q ? emp.buscarEmpresas(empresas, q).slice(0, 8) : [];
  const cod = codigo != null ? String(codigo) : '';

  // os 12 meses antes da competência: o RBT12 e a folha do Fator R
  const meses = s.competenciasDoPeriodo('12m', mesAnterior(competencia));
  const saidas = meses.map(c => ({ c, mes: sieg.doMes(c) }));
  const comSaidas = saidas.map(x => (cod ? s.faturamentoDasSaidas(x.mes.saidas.get(cod)) : null)).filter((v): v is number => v != null);
  const xml = cod ? sieg.notas(cod, competencia) : null;
  const dp = useExecucoesDoPeriodo(meses, 'dp');
  const folhas = dp.porMes.map(m => m.execucoes.find(e => String(e.codigo) === cod)?.valores?.folha).filter((v): v is number => typeof v === 'number');
  const guias = meses.map(c => [...fgts.pedidos(c).porCnpj.values()].find(p => p.codigo === cod && p.valor)).filter(p => !!p);
  const valoresDasGuias = guias.map(p => lerValor(p!.valor)).filter((v): v is number => v != null);

  const doXml = useMemo(() => {
    const d = xml?.dados;
    if (!d) return null;
    const seg = d.itensCortados ? null : s.segregacaoDasSaidas(d);
    const serv = s.servicosDoMes(d);
    return { seg, serv };
  }, [xml?.dados]);

  // os números do nads (antes do que a pessoa digitou)
  const doNads: Record<CampoDoSimples, { valor: number; fonte: FonteDoNumero; detalhe: string }> = (() => {
    const sem = { valor: 0, fonte: null, detalhe: '' };
    const deXml = (v: number | undefined, detalhe: string) => (doXml && v != null ? { valor: v, fonte: 'SIEG' as const, detalhe } : { ...sem, detalhe: doXml ? 'os XMLs do mês não trouxeram os itens' : 'sem os XMLs do mês no SIEG' });
    const nfe = 'XMLs do mês: NF-e e NFC-e emitidas';
    return {
      rbt12: comSaidas.length ? { valor: centavos(comSaidas.reduce((a, b) => a + b, 0)), fonte: 'SIEG', detalhe: 'saídas de ' + comSaidas.length + ' de 12 meses (' + s.mesCurto(meses[0]) + ' a ' + s.mesCurto(meses[11]) + '; sem a NFS-e)' } : { ...sem, detalhe: 'sem as saídas do SIEG nos 12 meses' },
      normal: deXml(doXml?.seg?.normal, nfe + ', sem ST e sem monofásico'),
      st: deXml(doXml?.seg?.st, nfe + ' com ICMS-ST (CST/CSOSN ou CFOP)'),
      monofasico: deXml(doXml?.seg?.monofasico, nfe + ' com NCM monofásico'),
      monofasicoESt: deXml(doXml?.seg?.monofasicoESt, nfe + ' monofásico e com ST'),
      servicos: doXml ? { valor: centavos(doXml.serv.total - doXml.serv.issRetido), fonte: 'SIEG', detalhe: 'XMLs do mês: NFS-e emitidas sem o ISS retido' } : { ...sem, detalhe: 'sem os XMLs do mês no SIEG' },
      issRetido: doXml ? { valor: doXml.serv.issRetido, fonte: 'SIEG', detalhe: 'XMLs do mês: NFS-e com o ISS retido pelo tomador' } : { ...sem, detalhe: 'sem os XMLs do mês no SIEG' },
      salario: folhas.length ? { valor: centavos(folhas.reduce((a, b) => a + b, 0)), fonte: 'Folha do DP', detalhe: 'o total da folha de ' + folhas.length + ' de 12 meses (etapa Folha de pagamento)' } : { ...sem, detalhe: 'o DP não informou a folha nesses meses' },
      fgts: valoresDasGuias.length ? { valor: centavos(valoresDasGuias.reduce((a, b) => a + b, 0)), fonte: 'FGTS Digital', detalhe: valoresDasGuias.length + ' de 12 guias emitidas pelo robô' } : { ...sem, detalhe: 'nenhuma guia do FGTS Digital nesses meses' },
      cpp: { ...sem, detalhe: 'o nads não guarda a CPP: digite a soma dos 12 meses' },
    };
  })();

  const ROTULOS: Record<CampoDoSimples, string> = {
    rbt12: 'RBT12 (receita bruta dos 12 meses anteriores)', normal: 'Mercadorias (normal)', st: 'Com ICMS-ST (sem o ICMS)', monofasico: 'Monofásico (sem PIS/Cofins)',
    monofasicoESt: 'Monofásico e ST (sem PIS/Cofins e ICMS)', servicos: 'Serviços (normal)', issRetido: 'Serviços com ISS retido (sem o ISS)', salario: 'Salário bruto e pró-labore', fgts: 'FGTS', cpp: 'CPP (INSS patronal)',
  };
  const numero = (campo: CampoDoSimples): NumeroDoSimples => {
    const d = digitados[campo];
    return d != null ? { campo, rotulo: ROTULOS[campo], valor: d, fonte: 'Digitado', detalhe: 'o nads tinha ' + (doNads[campo].fonte ? brl(doNads[campo].valor) + ' (' + doNads[campo].fonte + ')' : 'nada'), digitado: true }
      : { campo, rotulo: ROTULOS[campo], ...doNads[campo], digitado: false };
  };
  const n = Object.fromEntries((Object.keys(ROTULOS) as CampoDoSimples[]).map(c => [c, numero(c)])) as Record<CampoDoSimples, NumeroDoSimples>;

  const fator = s.fatorR([{ salario: n.salario.valor, fgts: n.fgts.valor, cpp: n.cpp.valor }], n.rbt12.valor);
  const temFolha = fator.folha > 0 && fator.fator != null;
  // o anexo do serviço: o escolhido; sem escolha, pelo Fator R (com a folha) ou o III (como na planilha, a mercadoria no I ou II)
  const anexoDoServicoPeloNads: t.sieg.Anexo = temFolha && fator.anexo ? fator.anexo : 'III';
  const anexoDoServico = anexoEscolhido || anexoDoServicoPeloNads;
  const motivoDoServico = anexoEscolhido ? 'escolhido' : temFolha ? 'pelo Fator R (' + pct(fator.fator) + ')' : 'sem a folha para o Fator R';

  const calculo = s.calculoDoSimples(n.rbt12.valor, s.PARCELAS_DA_RECEITA.map(p => ({ ...p, anexo: p.tipo === 'mercadoria' ? anexoDaMercadoria : anexoDoServico, valor: n[p.id as CampoDoSimples].valor })));
  const limpar = () => { setDigitados({}); setAnexoEscolhido(null); setAnexoDaMercadoria('I'); };

  return {
    exemplos: sieg.exemplos,
    carregando: !!empresa && (saidas.some(x => !x.mes.carregado) || !!(xml && !xml.carregadas) || !dp.carregada),
    // a empresa
    empresa, busca, achadas, ativo, setAtivo,
    setBusca(v: string) { setBusca(v); setAtivo(0); },
    mover(d: number) { setAtivo(i => Math.max(0, Math.min(achadas.length - 1, i + d))); },
    escolher(e: { codigo: number | null }) { setCodigo(e.codigo); setBusca(''); limpar(); },
    escolherDestacado() { const e = achadas[ativo]; if (e) { setCodigo(e.codigo); setBusca(''); limpar(); } },
    trocarEmpresa() { setCodigo(null); limpar(); },
    regime: empresa ? t.regimeDaEmpresa(empresa.codigo) || empresa.regime : '',
    // a competência e o anexo
    competencia, setCompetencia(c: string) { setCompetenciaBruta(c); setDigitados({}); },
    rotuloDosMeses: s.mesCurto(meses[0]) + ' a ' + s.mesCurto(meses[11]),
    anexosDaMercadoria: ANEXOS_DA_MERCADORIA.map(a => ({ valor: a, rotulo: 'Anexo ' + a })),
    anexosDoServico: ANEXOS_DO_SERVICO.map(a => ({ valor: a, rotulo: 'Anexo ' + a })),
    anexoDaMercadoria, setAnexoDaMercadoria,
    anexoDoServico, motivoDoServico, anexoDoServicoAutomatico: !anexoEscolhido,
    setAnexoDoServico: (a: t.sieg.Anexo) => setAnexoEscolhido(a),
    voltarAnexoAutomatico: () => setAnexoEscolhido(null),
    // os números
    mercadorias: [n.normal, n.st, n.monofasico, n.monofasicoESt],
    servicos: [n.servicos, n.issRetido],
    rbt12: n.rbt12,
    folha: [n.salario, n.fgts, n.cpp],
    digitar(campo: CampoDoSimples, texto: string) {
      const v = lerValor(texto);
      setDigitados(d => { const x = { ...d }; if (v == null) delete x[campo]; else x[campo] = v; return x; });
    },
    voltar(campo: CampoDoSimples) { setDigitados(d => { const x = { ...d }; delete x[campo]; return x; }); },
    temDigitado: Object.keys(digitados).length > 0 || !!anexoEscolhido || anexoDaMercadoria !== 'I',
    limpar,
    // as contas
    calculo, fator, temFolha,
    aviso: s.avisoDeLimite('Simples', n.rbt12.valor),
  };
}

export type VmCalculadoraDoSimples = ReturnType<typeof useCalculadoraDoSimples>;

function brl(v: number) { return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function pct(v: number | null) { return v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'; }
