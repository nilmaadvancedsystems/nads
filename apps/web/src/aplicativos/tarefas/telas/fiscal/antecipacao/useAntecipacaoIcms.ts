// ViewModel da Antecipação ICMS-ES (Fiscal › Antecipação ICMS-ES; Heverton, 22/10/2026: a planilha "Antecipação ICMS-ES",
// do cliente 585). A empresa (a busca por código ou nome; fica no endereço, ?empresa=585) e o período (o mês, o ano até o
// mês ou os 12 meses); as notas de entrada interestaduais vêm dos XMLs do SIEG de cada mês (o "Baixar XMLs do SIEG");
// as contas, o resumo e o relatório no core (tarefas.sieg.*Antecipacao). A alíquota interna e a situação de cada linha
// ficam no cadastro da empresa (antecipacaoIcmsEs; a regra do cadastro já deixa a equipe gravar). Imprimir: o relatório
// da aba RELATÓRIO (A4 deitado), com os filtros de mês e situação da tabela.
// O período (26/10/2026: "melhore o filtro de mês e ano"): Mês (um mês), Ano (escolhe só o ano: janeiro a dezembro, ou até
// o mês de hoje no ano corrente) ou 12 meses (até o mês escolhido); nunca um mês que ainda não começou; fica no endereço
// (?periodo=…&mes=… ou &ano=…). Os meses sem os XMLs do SIEG são pedidos ao robô sozinhos, uma vez por aba (26/10/2026:
// "resolva o problema de não puxar do sieg"), e o aviso diz o que o robô está fazendo, a fila e o erro, se der.
import { empresas as emp, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { competenciasDaTela } from '../../../casca/navegacao';
import { useOperador } from '../../../casca/operador';
import { useCadastro, useDadosDaEmpresaNoEntregas, useRepo, useSieg } from '../../../dados/repo';
import { imprimirHtml } from '../../dp/imprimirHtml';

const s = t.sieg;
const cad = emp.cadastro;
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
/** "09 - Setembro", como o filtro da planilha */
const rotuloDoMes = (c: string) => c.slice(5, 7) + ' - ' + MESES[Number(c.slice(5, 7)) - 1];
/** o mês de hoje (aaaa-mm): o último que dá para escolher */
const mesDeHoje = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const PERIODOS = new Set(['mes', 'ano', '12m']);
// os meses já pedidos ao robô nesta aba (empresa_mês): não pede de novo a cada volta à tela
const pedidosNestaAba = new Set<string>();
const regimePorExtenso = (r: string) => ({ Simples: 'Simples Nacional', Presumido: 'Lucro Presumido', Real: 'Lucro Real' } as Record<string, string>)[r] || r;

export function useAntecipacaoIcms() {
  const repo = useRepo();
  const sieg = useSieg();
  const por = useOperador().operador?.nome || '';
  const { toast, aviso } = useRetorno();
  const [params, setParams] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState(0);
  const [mes, setMes] = useState('');
  const [situacao, setSituacao] = useState<t.sieg.SituacaoDaAntecipacao | ''>('');

  // o período, no endereço: o mês de trabalho por padrão, e nunca depois do mês de hoje
  const hoje = mesDeHoje();
  const deTrabalho = competenciasDaTela(1)[0];
  const periodo = (PERIODOS.has(params.get('periodo') || '') ? params.get('periodo') : 'ano') as t.sieg.PeriodoDoFaturamento;
  const mesNoEndereco = /^\d{4}-\d{2}$/.test(params.get('mes') || '') ? (params.get('mes') as string) : deTrabalho;
  const mesEscolhido = mesNoEndereco > hoje ? hoje : mesNoEndereco;
  const anoDeHoje = Number(hoje.slice(0, 4));
  const anoEscolhido = Math.min(Number(params.get('ano')) || Number(deTrabalho.slice(0, 4)), anoDeHoje);
  // no Ano, o último mês do ano escolhido (no ano de hoje, o mês de hoje)
  const competencia = periodo === 'ano' ? (anoEscolhido === anoDeHoje ? hoje : anoEscolhido + '-12') : mesEscolhido;
  const mudarParams = (mudar: (n: URLSearchParams) => void) => setParams(p => { const n = new URLSearchParams(p); mudar(n); return n; }, { replace: true });

  const lista = repo.listarEmpresas();
  const codigo = Number(params.get('empresa')) || null;
  const empresa = codigo != null ? lista.find(e => e.codigo === codigo) || null : null;
  const achados = busca.trim() ? emp.buscarEmpresas(lista, busca).slice(0, 8) : [];
  const escolher = (e: { codigo: number | null }) => {
    setBusca(''); setAtivo(0); setMes(''); setSituacao('');
    setParams(p => { const n = new URLSearchParams(p); if (e.codigo != null) n.set('empresa', String(e.codigo)); else n.delete('empresa'); return n; }, { replace: true });
  };

  const c = useCadastro(empresa?.nome || '', empresa?.codigo ?? null);
  const dados = useDadosDaEmpresaNoEntregas(empresa?.codigo ?? null);
  const competencias = s.competenciasDoPeriodo(periodo, competencia);
  const meses = empresa ? competencias.map(m => ({ competencia: m, ...sieg.notas(String(empresa.codigo), m) })) : [];
  const aliquotaGravada = c.cadastro.antecipacaoIcmsEs?.aliquota;
  const aliquota = aliquotaGravada ?? s.ALIQUOTA_INTERNA_ES;
  const marcas = Object.fromEntries(Object.entries(c.cadastro.antecipacaoIcmsEs?.situacoes || {}).map(([id, m]) => [id, m as t.sieg.MarcaDaAntecipacao]));
  const todas = s.calcularAntecipacao(s.linhasDaAntecipacao(meses.map(m => m.dados)), aliquota, marcas);
  const linhas = s.filtrarAntecipacao(todas, { mes, situacao });
  const resumo = s.resumoDaAntecipacao(todas);
  const semXml = meses.filter(m => m.carregadas && !m.dados).map(m => m.competencia);
  const antigos = meses.filter(m => m.dados && (m.dados.resumo || 1) < 4).map(m => m.competencia);
  const pedidosDosMeses = semXml.map(m => ({ mes: m, p: sieg.pedido(String(empresa?.codigo), m, 'xmls') }));
  const pedidos = pedidosDosMeses.filter(x => x.p && (x.p.status === 'pendente' || x.p.status === 'processando'));
  const comErro = pedidosDosMeses.filter(x => x.p?.status === 'erro');
  const robo = sieg.robo();

  // os meses sem os XMLs vão para o robô sozinhos (uma vez por aba; o robô junta os repetidos)
  const faltaPedir = empresa?.codigo != null && robo.ligado && !sieg.exemplos
    ? semXml.filter(m => !pedidosNestaAba.has(empresa.codigo + '_' + m) && !pedidos.some(x => x.mes === m)) : [];
  const chaveFaltaPedir = faltaPedir.join(',');
  useEffect(() => {
    if (!chaveFaltaPedir || empresa?.codigo == null) return;
    const cod = String(empresa.codigo);
    for (const m of chaveFaltaPedir.split(',')) pedidosNestaAba.add(cod + '_' + m);
    void (async () => {
      try { for (const m of chaveFaltaPedir.split(',')) await sieg.pedirXmls(cod, m); }
      catch (e) { aviso({ titulo: 'Não deu para pedir os XMLs ao robô', texto: e instanceof Error ? e.message : String(e), tom: 'erro' }); }
    })();
  }, [chaveFaltaPedir, empresa?.codigo, sieg, aviso]);

  /** o que dizer enquanto os XMLs não chegam: o robô fora do ar, o que ele está fazendo e a fila, ou o erro */
  function situacaoDoRobo(): string {
    if (comErro.length && !pedidos.length) return 'O robô não conseguiu baixar ' + comErro.map(x => s.mesCurto(x.mes)).join(', ') + ': ' + (comErro[0].p?.erro || 'erro sem detalhe') + '.';
    const sinal = Date.parse(robo.em);
    if (!robo.ligado || !sinal || Date.now() - sinal > 3 * 60_000) return 'O robô do SIEG está fora do ar' + (sinal ? ' desde ' + new Date(sinal).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '') + '; os XMLs vêm quando ele voltar.';
    const andando = pedidos.find(x => x.p?.status === 'processando');
    if (andando) return 'O robô está baixando ' + s.mesCurto(andando.mes) + (andando.p?.andamento ? ' (' + andando.p.andamento + ')' : '') + '; as notas entram sozinhas.';
    if (pedidos.length) return 'Na fila do robô' + (robo.naFila > 0 ? ' (' + robo.naFila + (robo.naFila === 1 ? ' pedido' : ' pedidos') + ' esperando)' : '') + (robo.situacao && robo.situacao !== 'livre' ? '; agora ele está ' + robo.situacao : '') + '. As notas entram sozinhas.';
    return 'Pedindo ao robô…';
  }

  const d = dados.dados;
  const dadosDaEmpresa: t.sieg.EmpresaDoRelatorio = {
    razaoSocial: d?.receita?.razaoSocial || empresa?.nome || '',
    cnpj: d?.documento ? cad.cnpjFormatado(d.documento) : c.cadastro.cnpj ? cad.cnpjFormatado(c.cadastro.cnpj) : '',
    inscricaoEstadual: d?.inscricaoEstadual || '',
    regime: regimePorExtenso(cad.regimeDoCadastro(c.cadastro) || empresa?.regime || ''),
    endereco: d?.endereco || d?.receita?.endereco || '',
    municipio: d?.cidade || '',
    responsavel: c.cadastro.responsaveis?.fiscal || '',
  };
  const anos = [...new Set(competencias.map(m => m.slice(0, 4)))];

  return {
    exemplos: sieg.exemplos,
    // a busca da empresa
    empresa: empresa ? { codigo: empresa.codigo, nome: empresa.nome } : null,
    busca, setBusca: (v: string) => { setBusca(v); setAtivo(0); },
    achados, ativo, setAtivo,
    mover: (passo: number) => setAtivo(a => (achados.length ? (a + passo + achados.length) % achados.length : 0)),
    escolherDestacado: () => { if (achados[ativo]) escolher(achados[ativo]); },
    escolher,
    trocar: () => escolher({ codigo: null }),
    fecharLista: () => setBusca(''),
    // o período
    periodo, setPeriodo: (v: string) => mudarParams(n => n.set('periodo', v)), periodos: s.PERIODOS_DO_FATURAMENTO,
    /** o mês (Mês e 12 meses), até o mês de hoje */
    competencia: mesEscolhido, setCompetencia: (v: string) => mudarParams(n => n.set('mes', v)), ultimoMes: hoje,
    /** o ano (Ano): os 3 últimos */
    ano: String(anoEscolhido), setAno: (v: string) => mudarParams(n => n.set('ano', v)),
    anos: [anoDeHoje - 2, anoDeHoje - 1, anoDeHoje].map(a => ({ valor: String(a), rotulo: String(a) })),
    rotuloDoPeriodo: periodo === 'mes' ? t.rotuloCompetencia(competencia)
      : periodo === 'ano' ? anoEscolhido + ' (' + (competencia.endsWith('-12') ? 'o ano inteiro' : 'janeiro a ' + MESES[Number(competencia.slice(5)) - 1].toLowerCase()) + ')'
        : '12 meses até ' + t.rotuloCompetencia(competencia),
    /** o mês de hoje está no período: as notas dele ainda vão chegando */
    mesAberto: competencias.includes(hoje),
    carregando: !!empresa && (meses.some(m => !m.carregadas) || !c.carregada),
    dadosDaEmpresa, carregandoEmpresa: !dados.carregado,
    // o que falta
    semXml: semXml.map(m => ({ chave: m, rotulo: s.mesCurto(m) })),
    pedindo: pedidos.length > 0 || faltaPedir.length > 0,
    comErro: comErro.length > 0 && !pedidos.length,
    situacaoDoRobo: situacaoDoRobo(),
    antigos: antigos.map(s.mesCurto),
    roboLigado: sieg.robo().ligado,
    async pedirXmls() {
      if (!empresa?.codigo) return;
      try {
        for (const m of semXml) { pedidosNestaAba.add(empresa.codigo + '_' + m); await sieg.pedirXmls(String(empresa.codigo), m); }
        toast('Pedido ao robô: os XMLs de ' + semXml.length + (semXml.length === 1 ? ' mês' : ' meses'));
      } catch (e) { aviso({ titulo: 'Não deu para pedir os XMLs', texto: e instanceof Error ? e.message : String(e), tom: 'erro' }); }
    },
    // o resumo e a tabela
    resumo,
    porMes: resumo.porMes.map(m => ({ ...m, rotulo: s.mesCurto(m.mes) })),
    situacoes: s.SITUACOES_DA_ANTECIPACAO,
    linhas, totais: s.totaisDaAntecipacao(linhas), total: todas.length,
    mes, setMes, mesesDasLinhas: resumo.porMes.map(m => ({ valor: m.mes, rotulo: rotuloDoMes(m.mes) + '/' + m.mes.slice(0, 4) })),
    situacao, setSituacao,
    // a alíquota interna (sem = a padrão do ES)
    aliquota, aliquotaPadrao: aliquotaGravada == null,
    mudarAliquota(texto: string) {
      if (!c.carregada || !empresa) return;
      const v = texto.trim() ? Number(texto.replace('%', '').replace(/\./g, '').replace(',', '.')) : null;
      const r = cad.definirAliquotaDaAntecipacao(c.cadastro, v, por, new Date());
      if ('erro' in r) { aviso({ titulo: 'Alíquota que não vale', texto: r.erro, tom: 'erro' }); return; }
      if (r !== c.cadastro) { c.salvar(r); toast(v == null ? 'Voltou à alíquota padrão (17%)' : 'Alíquota interna: ' + texto.trim().replace('%', '') + '%'); }
    },
    marcar(id: string, nova: t.sieg.SituacaoDaAntecipacao) {
      if (!c.carregada || !empresa) return;
      const r = cad.marcarSituacaoDaAntecipacao(c.cadastro, id, nova, por, new Date());
      if (r !== c.cadastro) c.salvar(r);
    },
    rotuloDaSituacao: s.rotuloDaSituacao,
    imprimir() {
      imprimirHtml(s.htmlDaAntecipacao({
        empresa: dadosDaEmpresa, linhas, aliquotaInterna: aliquota, elaboradoPor: por, emitidoEm: new Date(),
        filtros: { mes: mes ? rotuloDoMes(mes) : 'Todos (' + s.mesCurto(competencias[0]) + (competencias.length > 1 ? ' a ' + s.mesCurto(competencias[competencias.length - 1]) : '') + ')', ano: mes ? mes.slice(0, 4) : anos.join(' e '), situacao: situacao ? s.rotuloDaSituacao(situacao) : 'Todas' },
      }));
      toast('Relatório pronto: escolha a impressora');
    },
  };
}
