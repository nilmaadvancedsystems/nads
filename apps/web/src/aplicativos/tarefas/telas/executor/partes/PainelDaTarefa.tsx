// O painel de uma tarefa do Fiscal (a "checklist disfarçada", Vitor 06/10/2026): os números, a tabelinha e o gráfico do
// que a tarefa confere — o SIEG, as notas por CFOP e por dia, o faturamento × SIEG, as retenções, a receita e a base.
import { formatos, tarefas as t } from '@nads/core';
import { Icone } from '@nads/ui';
import { ROTULO_DO_RELATORIO, type VmPainelDoFiscal } from '../usePainelDoFiscal';
import { BarrasPorDia, Numeros, TabelaComBarras, type LinhaDeBarra } from './Graficos';
import { SiegDaEtapa } from './SiegDaEtapa';

const { reais } = formatos;
const DESTAQUES = new Set<t.painel.ClasseDoCfop>(['st', 'devolucao']);

function Vazio({ relatorio, competencia }: { relatorio: t.RelatorioImportavel; competencia: string }) {
  return (
    <p className="pt-vazio"><Icone nome="fileUp" />Sem {ROTULO_DO_RELATORIO[relatorio]} de {t.rotuloNumericoCompetencia(competencia)} importadas. Importe o relatório para ver aqui.</p>
  );
}

const linhasPorCfop = (r: t.painel.ResumoDeNotas): LinhaDeBarra[] => r.porCfop.map(l => ({
  chave: l.cfop, rotulo: <><b className="num">{l.cfop}</b> {l.desc}</>, dica: t.painel.CLASSES[l.classe], valor: l.valor, texto: reais(l.valor),
  extra: l.qtd, destaque: DESTAQUES.has(l.classe),
}));

const linhasDaComposicao = (fatias: readonly t.painel.FatiaDaComposicao[]): LinhaDeBarra[] => fatias.map(f => ({
  chave: f.classe, rotulo: f.rotulo, valor: f.valor, texto: reais(f.valor), extra: f.pct.toLocaleString('pt-BR') + '%', destaque: DESTAQUES.has(f.classe),
}));

/** O número da comparação com o SIEG: igual (verde) ou a diferença (amarelo). */
function comparar(sieg: number | null, importadas: number) {
  if (sieg == null) return { rotulo: 'diferença (sem a contagem do SIEG)', valor: '—' };
  const dif = importadas - sieg;
  return dif === 0
    ? { rotulo: 'bate com o SIEG', valor: <Icone nome="check" />, tom: 'ok' as const }
    : { rotulo: dif > 0 ? 'a mais que o SIEG' : 'faltam no Alterdata', valor: Math.abs(dif), tom: 'atencao' as const };
}

function NotasPorCfop({ r, rotuloDia }: { r: t.painel.ResumoDeNotas; rotuloDia: string }) {
  return (
    <>
      <BarrasPorDia dias={r.porDia} formatar={reais} rotulo={rotuloDia} />
      <TabelaComBarras linhas={linhasPorCfop(r)} colunas={{ rotulo: 'CFOP', extra: 'Notas' }} />
      {!r.comConta && <p className="fraco pt-nota"><Icone nome="alert" />O relatório veio sem a conta contábil: o Contábil precisa dela (ligue a coluna no Alterdata e reimporte).</p>}
    </>
  );
}

function Retencoes({ r, imposto }: { r: t.painel.ResumoDeRetencao; imposto: string }) {
  if (!r.qtd) return <p className="pt-vazio"><Icone nome="checkCircle" />Nenhuma nota de serviço com {imposto} retido no mês.</p>;
  return (
    <>
      <Numeros itens={[{ rotulo: imposto + ' retido', valor: reais(r.total) }, { rotulo: r.qtd === 1 ? 'nota com retenção' : 'notas com retenção', valor: r.qtd }]} />
      <TabelaComBarras colunas={{ rotulo: 'Prestador / tomador', extra: 'Serviço', valor: 'Retido' }}
        linhas={r.linhas.map((l, i) => ({ chave: l.numero + i, rotulo: l.nome, dica: l.tipo + ' · nº ' + l.numero, valor: l.retido, texto: reais(l.retido), extra: reais(l.valor) }))} />
    </>
  );
}

export function PainelDaTarefa({ painel, vm, codigo, competencia }: { painel: t.PainelDaTarefa; vm: VmPainelDoFiscal; codigo: string; competencia: string }) {
  const comp = t.rotuloNumericoCompetencia(competencia);
  switch (painel) {
    case 'sieg':
      return codigo ? <SiegDaEtapa tipo="contagem" codigo={codigo} competencia={competencia} /> : null;
    case 'sequencia':
      return codigo ? <SiegDaEtapa tipo="saidas" codigo={codigo} competencia={competencia} /> : null;
    case 'recebimento':
      return (
        <Numeros itens={[
          { rotulo: 'emitidas no SIEG (NF-e e NFC-e)', valor: vm.sieg ? vm.sieg.emitidasNFe : '—' },
          { rotulo: 'saídas importadas', valor: vm.importado.saidas },
          comparar(vm.sieg?.emitidasNFe ?? null, vm.importado.saidas),
        ]} />
      );
    case 'saidas':
      if (!vm.saidas.qtd) return <Vazio relatorio="saidas" competencia={competencia} />;
      return (
        <>
          <Numeros itens={[{ rotulo: 'notas de saída', valor: vm.saidas.qtd }, { rotulo: 'valor contábil', valor: reais(vm.saidas.total) }, { rotulo: 'CFOPs', valor: vm.saidas.porCfop.length }]} />
          <NotasPorCfop r={vm.saidas} rotuloDia={'Saídas por dia de ' + comp} />
        </>
      );
    case 'faturamento':
      if (!vm.saidas.qtd) return <Vazio relatorio="saidas" competencia={competencia} />;
      return (
        <>
          <Numeros itens={[
            { rotulo: 'faturamento (saídas)', valor: reais(vm.saidas.total) },
            { rotulo: 'notas importadas', valor: vm.saidas.qtd },
            { rotulo: 'emitidas no SIEG', valor: vm.sieg ? vm.sieg.emitidasNFe : '—' },
            comparar(vm.sieg?.emitidasNFe ?? null, vm.saidas.qtd),
          ]} />
          <BarrasPorDia dias={vm.saidas.porDia} formatar={reais} rotulo={'Faturamento por dia de ' + comp} />
        </>
      );
    case 'entradas':
      if (!vm.entradas.qtd) return <Vazio relatorio="entradas" competencia={competencia} />;
      return (
        <>
          <Numeros itens={[{ rotulo: 'notas de entrada', valor: vm.entradas.qtd }, { rotulo: 'valor contábil', valor: reais(vm.entradas.total) }, { rotulo: 'CFOPs', valor: vm.entradas.porCfop.length }]} />
          <NotasPorCfop r={vm.entradas} rotuloDia={'Entradas por dia de ' + comp} />
        </>
      );
    case 'entradas-sieg':
      if (!vm.entradas.qtd) return <Vazio relatorio="entradas" competencia={competencia} />;
      return (
        <>
          <Numeros itens={[
            { rotulo: 'recebidas no SIEG (NF-e)', valor: vm.sieg ? vm.sieg.recebidasNFe : '—' },
            { rotulo: 'entradas importadas', valor: vm.entradas.qtd },
            comparar(vm.sieg?.recebidasNFe ?? null, vm.entradas.qtd),
          ]} />
          <TabelaComBarras linhas={linhasPorCfop(vm.entradas)} colunas={{ rotulo: 'CFOP', extra: 'Notas' }} />
        </>
      );
    case 'iss-retido':
      return vm.importado.tomados || vm.importado.prestados ? <Retencoes r={vm.issRetido} imposto="ISS" /> : <Vazio relatorio="tomados" competencia={competencia} />;
    case 'inss-retido':
      return vm.importado.tomados || vm.importado.prestados ? <Retencoes r={vm.inssRetido} imposto="INSS" /> : <Vazio relatorio="tomados" competencia={competencia} />;
    case 'receitas':
    case 'irpj': {
      if (!vm.receita.length) return <Vazio relatorio="saidas" competencia={competencia} />;
      const receita = vm.receita.filter(f => f.classe === 'venda' || f.classe === 'st' || f.classe === 'servico').reduce((s, f) => s + f.valor, 0);
      return (
        <>
          <Numeros itens={[
            { rotulo: painel === 'irpj' ? 'receita do mês (o trimestre soma os 3)' : 'receita do mês', valor: reais(receita) },
            { rotulo: 'serviços prestados', valor: reais(vm.prestados.total) },
          ]} />
          <TabelaComBarras linhas={linhasDaComposicao(vm.receita)} colunas={{ rotulo: 'Composição', extra: 'Fatia' }} />
        </>
      );
    }
    case 'base':
      if (!vm.base.length) return <Vazio relatorio="saidas" competencia={competencia} />;
      return <TabelaComBarras linhas={linhasDaComposicao(vm.base)} colunas={{ rotulo: 'Saídas por natureza', extra: 'Fatia' }} />;
    case 'icms':
      if (!vm.saidas.qtd && !vm.entradas.qtd) return <Vazio relatorio="saidas" competencia={competencia} />;
      return (
        <>
          <Numeros itens={[{ rotulo: 'saídas (débitos)', valor: reais(vm.saidas.total) }, { rotulo: 'entradas (créditos)', valor: reais(vm.entradas.total) }]} />
          <TabelaComBarras linhas={linhasDaComposicao(vm.base)} colunas={{ rotulo: 'Saídas por natureza', extra: 'Fatia' }} />
        </>
      );
    case 'prestados':
      if (!vm.prestados.qtd) return <Vazio relatorio="prestados" competencia={competencia} />;
      return <Numeros itens={[{ rotulo: 'notas de serviço', valor: vm.prestados.qtd }, { rotulo: 'valor dos serviços', valor: reais(vm.prestados.total) }, { rotulo: 'ISS', valor: reais(vm.prestados.iss) }]} />;
    default:
      return null;
  }
}
