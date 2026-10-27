// ViewModel da calculadora do Simples Nacional (Fiscal › Simples; Heverton, 22/10/2026: a "PLANILHA SIMPLES NACIONAL
// 2018.xlsx" do Fiscal no nads, "preenchido com os dados do próprio nads"). Os números do nads:
//   - o RBT12: o que o Fiscal informou na rotina do mês (etapa do PGDAS); sem ele, as saídas do SIEG (NF-e e NFC-e) dos 12
//     meses antes da competência, dizendo quantos meses tinham dado;
//   - a receita do mês: os XMLs do mês no SIEG (normal, ICMS-ST, monofásico; as NFS-e, com o ISS retido à parte);
//   - o anexo: o que o Fiscal marcou na rotina; sem ele, o I para a mercadoria e, para o serviço, o Fator R (com a folha)
//     ou o III;
//   - a folha do Fator R, dos mesmos 12 meses: o salário que o DP informou na etapa Folha e o FGTS das guias do FGTS
//     Digital; a CPP se digita (o nads não guarda).
// Cada número pode ser trocado à mão e a tela diz de onde veio. As contas são as da planilha (core sieg.calculadora).
import { empresas as emp, tarefas as t } from '@nads/core';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { competenciasDaTela } from '../../../casca/navegacao';
import { useExecucoes, useExecucoesDoPeriodo, useFgts, useRepo, useSieg } from '../../../dados/repo';

const s = t.sieg;

export type CampoDoSimples = 'rbt12' | 'normal' | 'st' | 'monofasico' | 'monofasicoESt' | 'servicos' | 'issRetido' | 'salario' | 'fgts' | 'cpp';
export type FonteDoNumero = 'SIEG' | 'Rotina do Fiscal' | 'Folha do DP' | 'FGTS Digital' | 'Digitado' | null;
export interface NumeroDoSimples { campo: CampoDoSimples; rotulo: string; valor: number; fonte: FonteDoNumero; detalhe: string; digitado: boolean }

const ANEXOS_DA_MERCADORIA: readonly t.sieg.Anexo[] = ['I', 'II'];
const ANEXOS_DO_SERVICO: readonly t.sieg.Anexo[] = ['III', 'IV', 'V'];
const DO_SIMPLES = ['Simples', 'MEI'];
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
const brl = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const anexoDoNumero = (n: unknown, opcoes: Record<number, t.sieg.Anexo>) => (typeof n === 'number' ? opcoes[n] || null : null);

const ROTULOS: Record<CampoDoSimples, string> = {
  rbt12: 'RBT12', normal: 'Mercadorias', st: 'Mercadorias com ICMS-ST', monofasico: 'Mercadorias monofásicas',
  monofasicoESt: 'Monofásicas e com ST', servicos: 'Serviços', issRetido: 'Serviços com ISS retido', salario: 'Salário bruto e pró-labore', fgts: 'FGTS', cpp: 'CPP (INSS patronal)',
};
/** o que cada tipo de receita deixa de pagar (a explicação curta da linha) */
export const SEM_O_QUE: Partial<Record<CampoDoSimples, string>> = { st: 'sem o ICMS', monofasico: 'sem PIS e Cofins', monofasicoESt: 'sem PIS, Cofins e ICMS', issRetido: 'sem o ISS' };

export function useCalculadoraDoSimples() {
  const repo = useRepo();
  const sieg = useSieg();
  const fgts = useFgts();
  // a empresa aberta em Minhas empresas (27/10/2026) chega já escolhida, pelo endereço (?empresa=código)
  const [params] = useSearchParams();
  const [codigo, setCodigo] = useState<number | null>(() => Number(params.get('empresa')) || null);
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState(0);
  const [competencia, setCompetenciaBruta] = useState(() => competenciasDaTela(1)[0]);
  const [mercadoriaEscolhida, setMercadoriaEscolhida] = useState<t.sieg.Anexo | null>(null);
  const [servicoEscolhido, setServicoEscolhido] = useState<t.sieg.Anexo | null>(null);
  const [digitados, setDigitados] = useState<Partial<Record<CampoDoSimples, number>>>({});

  const empresas = repo.listarEmpresas().filter(e => e.codigo != null);
  const empresa = codigo != null ? empresas.find(e => e.codigo === codigo) || null : null;
  const regimeDe = (e: { codigo: number | null; regime: string }) => t.regimeDaEmpresa(e.codigo) || e.regime || '';
  const q = busca.trim();
  // as do Simples primeiro (a busca mantém a ordem dela dentro de cada grupo)
  const achadas = q ? [...emp.buscarEmpresas(empresas, q)].sort((a, b) => Number(!DO_SIMPLES.includes(regimeDe(a))) - Number(!DO_SIMPLES.includes(regimeDe(b)))).slice(0, 8)
    .map(e => ({ ...e, regime: regimeDe(e) })) : [];
  const cod = codigo != null ? String(codigo) : '';
  const regime = empresa ? regimeDe(empresa) : '';

  // os 12 meses antes da competência: o RBT12 e a folha do Fator R
  const meses = s.competenciasDoPeriodo('12m', mesAnterior(competencia));
  const saidas = meses.map(c => ({ c, mes: sieg.doMes(c) }));
  const comSaidas = saidas.map(x => (cod ? s.faturamentoDasSaidas(x.mes.saidas.get(cod)) : null)).filter((v): v is number => v != null);
  const xml = cod ? sieg.notas(cod, competencia) : null;
  const fiscal = useExecucoes(competencia, 'fiscal');
  const daRotina = fiscal.execucoes.find(e => String(e.codigo) === cod)?.valores || {};
  const dp = useExecucoesDoPeriodo(meses, 'dp');
  const folhas = dp.porMes.map(m => m.execucoes.find(e => String(e.codigo) === cod)?.valores?.folha).filter((v): v is number => typeof v === 'number');
  const guias = meses.map(c => [...fgts.pedidos(c).porCnpj.values()].find(p => p.codigo === cod && p.valor)).filter(p => !!p);
  const valoresDasGuias = guias.map(p => lerValor(p!.valor)).filter((v): v is number => v != null);

  const doXml = useMemo(() => {
    const d = xml?.dados;
    if (!d) return null;
    return { seg: d.itensCortados ? null : s.segregacaoDasSaidas(d), serv: s.servicosDoMes(d) };
  }, [xml?.dados]);

  // os números do nads (antes do que a pessoa digitou)
  const sem = { valor: 0, fonte: null, detalhe: '' };
  const semXml = { ...sem, detalhe: doXml ? 'Os XMLs do mês não trouxeram os itens das notas.' : 'O nads não tem os XMLs deste mês (baixe na etapa Inicial da rotina do Fiscal).' };
  const deXml = (v: number | undefined, detalhe: string) => (doXml && v != null ? { valor: v, fonte: 'SIEG' as const, detalhe } : semXml);
  const nfe = 'Soma dos itens de venda das NF-e e NFC-e emitidas no mês (XMLs do SIEG), ';
  const rbt12DaRotina = typeof daRotina.rbt12 === 'number' ? daRotina.rbt12 : null;
  const doNads: Record<CampoDoSimples, { valor: number; fonte: FonteDoNumero; detalhe: string }> = {
    rbt12: rbt12DaRotina != null ? { valor: rbt12DaRotina, fonte: 'Rotina do Fiscal', detalhe: 'O RBT12 que o Fiscal informou na rotina de ' + t.rotuloCompetencia(competencia) + ' (etapa do PGDAS).' }
      : comSaidas.length ? { valor: centavos(comSaidas.reduce((a, b) => a + b, 0)), fonte: 'SIEG', detalhe: 'A soma das NF-e e NFC-e emitidas de ' + s.mesCurto(meses[0]) + ' a ' + s.mesCurto(meses[11]) + ' no SIEG (' + comSaidas.length + ' de 12 meses com dado). A NFS-e não entra.' }
        : { ...sem, detalhe: 'O nads não tem as saídas desses 12 meses. Digite o RBT12 do PGDAS.' },
    normal: deXml(doXml?.seg?.normal, nfe + 'sem ST e sem monofásico.'),
    st: deXml(doXml?.seg?.st, nfe + 'com ICMS por substituição (pelo CST/CSOSN ou pelo CFOP).'),
    monofasico: deXml(doXml?.seg?.monofasico, nfe + 'com NCM de PIS/Cofins monofásico.'),
    monofasicoESt: deXml(doXml?.seg?.monofasicoESt, nfe + 'monofásicas e com ST.'),
    servicos: doXml ? { valor: centavos(doXml.serv.total - doXml.serv.issRetido), fonte: 'SIEG', detalhe: 'NFS-e emitidas no mês sem o ISS retido (XMLs do SIEG).' } : semXml,
    issRetido: doXml ? { valor: doXml.serv.issRetido, fonte: 'SIEG', detalhe: 'NFS-e emitidas no mês com o ISS retido pelo tomador (XMLs do SIEG).' } : semXml,
    salario: folhas.length ? { valor: centavos(folhas.reduce((a, b) => a + b, 0)), fonte: 'Folha do DP', detalhe: 'O total da folha que o DP informou em ' + folhas.length + ' de 12 meses (etapa Folha de pagamento).' } : { ...sem, detalhe: 'O DP não informou a folha nesses meses.' },
    fgts: valoresDasGuias.length ? { valor: centavos(valoresDasGuias.reduce((a, b) => a + b, 0)), fonte: 'FGTS Digital', detalhe: valoresDasGuias.length + ' de 12 guias do FGTS Digital emitidas pelo robô.' } : { ...sem, detalhe: 'Nenhuma guia do FGTS Digital nesses meses.' },
    cpp: { ...sem, detalhe: 'O nads não guarda a CPP: digite a soma dos 12 meses.' },
  };
  const numero = (campo: CampoDoSimples): NumeroDoSimples => {
    const d = digitados[campo];
    return d != null ? { campo, rotulo: ROTULOS[campo], valor: d, fonte: 'Digitado', detalhe: 'Digitado aqui. O nads tinha ' + (doNads[campo].fonte ? brl(doNads[campo].valor) + ' (' + doNads[campo].fonte + ').' : 'nada.'), digitado: true }
      : { campo, rotulo: ROTULOS[campo], ...doNads[campo], digitado: false };
  };
  const n = Object.fromEntries((Object.keys(ROTULOS) as CampoDoSimples[]).map(c => [c, numero(c)])) as Record<CampoDoSimples, NumeroDoSimples>;

  const fator = s.fatorR([{ salario: n.salario.valor, fgts: n.fgts.valor, cpp: n.cpp.valor }], n.rbt12.valor);
  const temFolha = fator.folha > 0 && fator.fator != null;
  // o anexo: o escolhido aqui, o da rotina do Fiscal ou o do nads
  const mercadoriaDaRotina = anexoDoNumero(daRotina.anexoMercadorias, { 1: 'I', 2: 'II' });
  const servicoDaRotina = anexoDoNumero(daRotina.anexoServicos, { 3: 'III', 4: 'IV', 5: 'V' });
  const anexoDaMercadoria = mercadoriaEscolhida || mercadoriaDaRotina || 'I';
  const anexoDoServico = servicoEscolhido || servicoDaRotina || (temFolha && fator.anexo ? fator.anexo : 'III');

  const mercadorias = [n.normal, n.st, n.monofasico, n.monofasicoESt];
  const servicos = [n.servicos, n.issRetido];
  const temMercadoria = mercadorias.some(x => x.valor > 0);
  const temServico = servicos.some(x => x.valor > 0);
  const calculo = s.calculoDoSimples(n.rbt12.valor, s.PARCELAS_DA_RECEITA.map(p => ({ ...p, anexo: p.tipo === 'mercadoria' ? anexoDaMercadoria : anexoDoServico, valor: n[p.id as CampoDoSimples].valor })));
  const percentuais = (a: t.sieg.Anexo) => s.percentuaisEfetivos(a, n.rbt12.valor);
  // os anexos que contam (os das receitas que o mês tem; sem receita, o da mercadoria)
  const anexosUsados = [...(temMercadoria || !temServico ? [{ tipo: 'Mercadorias', anexo: anexoDaMercadoria }] : []),
    ...(temServico ? [{ tipo: 'Serviços', anexo: anexoDoServico }] : [])].map(x => ({ ...x, p: percentuais(x.anexo) }));

  const limpar = () => { setDigitados({}); setMercadoriaEscolhida(null); setServicoEscolhido(null); };
  const rbt12Meses = n.rbt12.fonte === 'SIEG' ? comSaidas.length : null;

  return {
    carregando: !!empresa && (saidas.some(x => !x.mes.carregado) || !!(xml && !xml.carregadas) || !dp.carregada || !fiscal.carregada),
    // a empresa
    empresa, busca, achadas, ativo, setAtivo, regime,
    /** a empresa não é do Simples no cadastro: a conta é só simulação */
    foraDoSimples: !!regime && !DO_SIMPLES.includes(regime),
    setBusca(v: string) { setBusca(v); setAtivo(0); },
    mover(d: number) { setAtivo(i => Math.max(0, Math.min(achadas.length - 1, i + d))); },
    escolher(e: { codigo: number | null }) { setCodigo(e.codigo); setBusca(''); limpar(); },
    escolherDestacado() { const e = achadas[ativo]; if (e) { setCodigo(e.codigo); setBusca(''); limpar(); } },
    trocarEmpresa() { setCodigo(null); limpar(); },
    competencia, setCompetencia(c: string) { setCompetenciaBruta(c); setDigitados({}); },
    rotuloDosMeses: s.mesCurto(meses[0]) + ' a ' + s.mesCurto(meses[11]),
    // o anexo
    anexosUsados,
    anexosDaMercadoria: ANEXOS_DA_MERCADORIA.map(a => ({ valor: a, rotulo: 'Anexo ' + a })),
    anexosDoServico: ANEXOS_DO_SERVICO.map(a => ({ valor: a, rotulo: 'Anexo ' + a })),
    anexoDaMercadoria, anexoDoServico,
    setAnexoDaMercadoria: (a: t.sieg.Anexo) => setMercadoriaEscolhida(a),
    setAnexoDoServico: (a: t.sieg.Anexo) => setServicoEscolhido(a),
    // os números
    rbt12: n.rbt12,
    /** quantos dos 12 meses tinham saídas no SIEG (null = o RBT12 não veio do SIEG) */
    rbt12Meses,
    mercadorias, servicos, temMercadoria, temServico,
    folha: [n.salario, n.fgts, n.cpp],
    digitar(campo: CampoDoSimples, texto: string) {
      const v = lerValor(texto);
      setDigitados(d => { const x = { ...d }; if (v == null) delete x[campo]; else x[campo] = v; return x; });
    },
    voltar(campo: CampoDoSimples) { setDigitados(d => { const x = { ...d }; delete x[campo]; return x; }); },
    // as contas
    calculo, fator, temFolha,
    /** o Fator R só importa para o serviço no Anexo III ou V */
    mostraFatorR: temServico && (anexoDoServico === 'III' || anexoDoServico === 'V'),
    aviso: s.avisoDeLimite('Simples', n.rbt12.valor),
  };
}

export type VmCalculadoraDoSimples = ReturnType<typeof useCalculadoraDoSimples>;
