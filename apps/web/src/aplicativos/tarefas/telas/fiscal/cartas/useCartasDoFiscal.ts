// ViewModel de Fiscal › Cartas (12/11/2026: "preciso de um envio de carta de balanco para varios clientes para o final do
// ano, e todo mês enviar mandar um cheklist do que ele tem que enviar"). Duas abas:
//   - Carta de balanço: o ano, o prazo do inventário e as empresas da pessoa com caixinha (o Fiscal marca quem tem
//     estoque); "Ver a carta" abre o PDF de um cliente (sem a assinatura, que o robô põe), "Mandar teste" manda a carta do
//     1º marcado só para o escritório e "Enviar" põe um pedido por cliente na fila do robô, depois de confirmar;
//   - Checklist do mês: quando sai (o último dia útil), o prazo do cliente (2º dia útil do mês seguinte), o que o robô já
//     mandou neste mês, pausar e tirar clientes.
// As regras são do core (cartasFiscal); a tela só desenha.
import { cartasFiscal as cf, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { useCartasDoFiscal, useRepo, useTodosOsCadastros } from '../../../dados/repo';
import { useEmpresasPermitidas } from '../../empresas/andamento';

export type AbaDasCartas = 'balanco' | 'checklist';

export interface LinhaDasCartas {
  codigo: number;
  nome: string;
  regime: string;
  email: string;
  situacao: cf.SituacaoDoCliente | undefined;
}

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const VAZIO: { carregados: boolean; lista: cf.RegistroDoEnvio[] } = { carregados: false, lista: [] };
const CONFIG_VAZIA: { carregado: boolean } & cf.ConfigDoChecklist = { carregado: false, ligado: true, fora: [] };
const mesDeHoje = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };

export function useTelaDasCartas() {
  const repo = useCartasDoFiscal();
  const cadastros = useTodosOsCadastros();
  const { toast, modal } = useRetorno();
  const [aba, setAba] = useState<AbaDasCartas>('balanco');
  const [ano, setAnoBruto] = useState(() => cf.anoSugeridoDoBalanco(new Date()));
  const [prazo, setPrazo] = useState(() => cf.prazoPadraoDoBalanco(cf.anoSugeridoDoBalanco(new Date())));
  const [busca, setBusca] = useState('');
  const [regime, setRegime] = useState('');
  const [marcados, setMarcados] = useState<ReadonlySet<number>>(new Set());
  const [pedindo, setPedindo] = useState('');

  // só as empresas da pessoa (12/11/2026: "quero apenas as empresas da pessoa"), como nas outras telas do Fiscal: a lista
  // do escritório filtrada pelo responsável do Fiscal (o admin e o diretor veem todas); o e-mail vem do Cadastro
  const permitidas = useEmpresasPermitidas();
  const empresasDaPessoa = permitidas.filtrar(useRepo().listarEmpresas());
  const porCodigo = useMemo(() => new Map([...cadastros.porId.values()].filter(c => c.codigo != null).map(c => [Number(c.codigo), c])), [cadastros.porId]);
  const clientes = empresasDaPessoa
    .filter(e => e.codigo != null)
    .map(e => {
      const c = cadastros.porId.get(formatos.slug(e.nome)) || porCodigo.get(e.codigo as number);
      return { codigo: e.codigo as number, nome: e.nome, regime: e.regime || c?.regime || '', email: (c?.contato?.email || '').trim() };
    })
    .sort((a, b) => a.codigo - b.codigo);
  const regimes = [...new Set(clientes.map(c => c.regime).filter(Boolean))].sort();
  const filtra = (c: { codigo: number; nome: string; regime: string }) =>
    (!regime || c.regime === regime) && (!busca.trim() || sem(c.nome).includes(sem(busca.trim())) || String(c.codigo) === busca.trim());

  // ── a Carta de balanço ── (cada aba só ouve o banco quando é aberta: menos leituras)
  const cartas = aba === 'balanco' ? repo.cartas(ano) : VAZIO;
  const situacaoDaCarta = useMemo(() => cf.situacaoPorCliente(cartas.lista, 'cartaBalanco', { ano }), [cartas.lista, ano]);
  const linhas: LinhaDasCartas[] = clientes.filter(filtra).map(c => ({ ...c, situacao: situacaoDaCarta[String(c.codigo)] }));
  const problema = cf.problemaDaCarta(ano, prazo);
  const marcadosDaTela = linhas.filter(l => marcados.has(l.codigo));
  const podeMarcar = (l: LinhaDasCartas) => cf.podeMandarDeNovo(l.situacao);
  const contagem = Object.values(situacaoDaCarta).reduce((c, s) => ({ ...c, [s.situacao]: (c[s.situacao] || 0) + 1 }), {} as Partial<Record<cf.SituacaoDoEnvio, number>>);

  function setAno(n: number) {
    setAnoBruto(n);
    setPrazo(cf.prazoPadraoDoBalanco(n));
    setMarcados(new Set());
  }
  function alternar(codigo: number) {
    setMarcados(m => { const n = new Set(m); if (n.has(codigo)) n.delete(codigo); else n.add(codigo); return n; });
  }
  function marcarTodos(sim: boolean) {
    setMarcados(m => {
      const n = new Set(m);
      for (const l of linhas) { if (sim && podeMarcar(l)) n.add(l.codigo); else n.delete(l.codigo); }
      return n;
    });
  }

  async function enviar() {
    const lista = marcadosDaTela.filter(podeMarcar);
    if (!lista.length || pedindo) return;
    if (problema) { toast('Não dá: ' + problema + '.'); return; }
    const ok = await modal({
      icone: 'envelope', titulo: 'Mandar a carta de balanço para ' + lista.length + (lista.length === 1 ? ' cliente?' : ' clientes?'),
      texto: 'Cada cliente recebe, no e-mail do cadastro, a Carta de balanço de ' + ano + ' e a Declaração de inventário, assinadas com o certificado do escritório, com o prazo até ' + cf.dataBr(prazo) + '.',
      botoes: [{ rotulo: 'Mandar', valor: true, variante: 'btn-primary' }, { rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }],
    });
    if (!ok) return;
    setPedindo('enviar');
    try {
      const n = await repo.pedirCartas({ ano, prazo, clientes: lista.map(l => ({ codigo: l.codigo, empresa: l.nome })) });
      toast(n + (n === 1 ? ' carta pedida' : ' cartas pedidas') + ' ao robô.');
      setMarcados(new Set());
    } catch (e) { toast('Não consegui pedir: ' + (e instanceof Error ? e.message : String(e))); } finally { setPedindo(''); }
  }

  /** a carta do 1º marcado (ou do 1º da lista) só para o escritório */
  async function mandarTeste() {
    const l = marcadosDaTela[0] || linhas[0];
    if (!l || pedindo) return;
    if (problema) { toast('Não dá: ' + problema + '.'); return; }
    setPedindo('teste');
    try {
      await repo.pedirCartas({ ano, prazo, clientes: [{ codigo: l.codigo, empresa: l.nome }], teste: true });
      toast('Teste pedido: a carta de ' + l.nome + ' vai só para o e-mail do escritório.');
    } catch (e) { toast('Não consegui pedir: ' + (e instanceof Error ? e.message : String(e))); } finally { setPedindo(''); }
  }

  /** abre o PDF da carta de um cliente numa aba nova (sem a assinatura digital: o robô assina no envio) */
  async function verCarta(l: { codigo: number; nome: string }) {
    if (problema) { toast('Não dá: ' + problema + '.'); return; }
    const aba = window.open('', '_blank');
    try {
      const { desenharCartaDeBalanco } = await import('./cartaDeBalancoPdf');
      const bytes = await desenharCartaDeBalanco(cf.dadosDaCarta({ empresa: l.nome, ano, prazo, hoje: new Date() }));
      const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: 'application/pdf' }));
      if (aba && !aba.closed) aba.location.href = url; else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    } catch (e) {
      try { aba?.close(); } catch { /* já fechou */ }
      toast('Não consegui abrir a carta: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  // ── o Checklist do mês ──
  const competencia = mesDeHoje();
  const registros = aba === 'checklist' ? repo.checklist(competencia) : VAZIO;
  const situacaoDoChecklist = useMemo(() => cf.situacaoPorCliente(registros.lista, 'checklistMensal', { competencia }), [registros.lista, competencia]);
  const config = aba === 'checklist' ? repo.config() : CONFIG_VAZIA;
  const fora = new Set(config.fora);
  const linhasDoChecklist = clientes.filter(filtra).map(c => ({ ...c, situacao: situacaoDoChecklist[String(c.codigo)], fora: fora.has(String(c.codigo)) }));
  const doChecklist = Object.values(situacaoDoChecklist).reduce((c, s) => ({ ...c, [s.situacao]: (c[s.situacao] || 0) + 1 }), {} as Partial<Record<cf.SituacaoDoEnvio, number>>);

  async function gravarConfig(c: cf.ConfigDoChecklist, aviso: string) {
    setPedindo('config');
    try { await repo.gravarConfig(c); toast(aviso); }
    catch (e) { toast('Não consegui gravar: ' + (e instanceof Error ? e.message : String(e))); } finally { setPedindo(''); }
  }

  return {
    exemplos: repo.exemplos, aba, setAba, busca, setBusca, regime, setRegime, regimes, pedindo,
    carregando: !cadastros.carregada || !permitidas.carregada,
    // a carta
    ano, setAno, prazo, setPrazo, problema, linhas, carregandoCartas: !cartas.carregados, contagem,
    marcado: (codigo: number) => marcados.has(codigo), podeMarcar, alternar, marcarTodos,
    todosMarcados: linhas.some(podeMarcar) && linhas.filter(podeMarcar).every(l => marcados.has(l.codigo)),
    quantosMarcados: marcadosDaTela.filter(podeMarcar).length, enviar, mandarTeste, verCarta,
    // o checklist
    competencia, mes: cf.mesPorExtenso(competencia), diaDoChecklist: cf.dataBr(cf.diaDoChecklist(competencia)),
    prazoDoChecklist: cf.dataBr(cf.prazoDoChecklist(competencia)), config, linhasDoChecklist, carregandoChecklist: !registros.carregados, doChecklist,
    pausar: (ligado: boolean) => gravarConfig({ ligado, fora: config.fora }, ligado ? 'O checklist do mês voltou a sair.' : 'O checklist do mês está pausado.'),
    alternarFora: (codigo: number, tirar: boolean) => gravarConfig(
      { ligado: config.ligado, fora: tirar ? [...config.fora, String(codigo)] : config.fora.filter(x => x !== String(codigo)) },
      tirar ? 'Esse cliente não recebe mais o checklist.' : 'Esse cliente volta a receber o checklist.'),
  };
}
