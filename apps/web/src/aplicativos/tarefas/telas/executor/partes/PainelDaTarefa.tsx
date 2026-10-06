// O painel de uma tarefa do Fiscal (a "checklist disfarçada", Vitor 06/10/2026), cada tarefa com o seu desenho (Vitor:
// "achei repetitivo"): o anel do SIEG × Alterdata no Recebimento, o destaque com as barras por dia no Faturamento, a
// tabelinha por CFOP na Conferência e na Tributação, o medidor no SINTEGRA, o ranking nas retenções, a rosca na receita,
// a faixa 100% na base de cálculo e a balança no ICMS. Ao aparecer, anima (animarPainel.ts, animejs).
import { formatos, tarefas as t } from '@nads/core';
import { Icone } from '@nads/ui';
import { useEffect, useRef } from 'react';
import { ROTULO_DO_RELATORIO, type VmPainelDoFiscal } from '../usePainelDoFiscal';
import { animarPainel } from './animarPainel';
import { Anel, Balanca, BarrasPorDia, Destaque, Faixa, Medidor, Ranking, Rosca, TabelaComBarras, type Fatia, type LinhaDeBarra } from './Graficos';
import { SiegDaEtapa } from './SiegDaEtapa';

const { reais } = formatos;
const DESTAQUES = new Set<t.painel.ClasseDoCfop>(['st', 'devolucao']);
/** a cor de cada classe de CFOP (sempre a mesma, na ordem da paleta) */
const COR: Record<t.painel.ClasseDoCfop, number> = { venda: 1, st: 2, servico: 3, devolucao: 4, remessa: 5, ativo: 6, outras: 7 };

function Vazio({ relatorio, competencia }: { relatorio: t.RelatorioImportavel; competencia: string }) {
  return (
    <p className="pt-vazio pt-entra"><Icone nome="fileUp" />Sem {ROTULO_DO_RELATORIO[relatorio]} de {t.rotuloNumericoCompetencia(competencia)} importadas. Importe o relatório para ver aqui.</p>
  );
}

const linhasPorCfop = (r: t.painel.ResumoDeNotas): LinhaDeBarra[] => r.porCfop.map(l => ({
  chave: l.cfop, rotulo: <><b className="num">{l.cfop}</b> {l.desc}</>, dica: t.painel.CLASSES[l.classe], valor: l.valor, texto: reais(l.valor),
  extra: l.qtd, destaque: DESTAQUES.has(l.classe),
}));

const fatias = (f: readonly t.painel.FatiaDaComposicao[]): Fatia[] => f.map(x => ({ chave: x.classe, rotulo: x.rotulo, valor: x.valor, pct: x.pct, cor: COR[x.classe] }));

function SemConta({ r }: { r: t.painel.ResumoDeNotas }) {
  return r.comConta ? null : <p className="fraco pt-nota pt-entra"><Icone nome="alert" />O relatório veio sem a conta contábil: o Contábil precisa dela (ligue a coluna no Alterdata e reimporte).</p>;
}

function Corpo({ painel, vm, codigo, competencia }: { painel: t.PainelDaTarefa; vm: VmPainelDoFiscal; codigo: string; competencia: string }) {
  const comp = t.rotuloNumericoCompetencia(competencia);
  const pctDe = (classe: t.painel.ClasseDoCfop) => vm.base.find(f => f.classe === classe)?.pct || 0;
  switch (painel) {
    case 'sieg':
      return codigo ? <SiegDaEtapa tipo="contagem" codigo={codigo} competencia={competencia} /> : null;
    case 'sequencia':
      return codigo ? <SiegDaEtapa tipo="saidas" codigo={codigo} competencia={competencia} /> : null;
    case 'recebimento':
      return <Anel sieg={vm.sieg ? vm.sieg.emitidasNFe : null} importadas={vm.importado.saidas} rotuloSieg="emitidas no SIEG (NF-e e NFC-e)" rotuloImportadas="saídas no Alterdata" />;
    case 'saidas':
      if (!vm.saidas.qtd) return <Vazio relatorio="saidas" competencia={competencia} />;
      return (
        <>
          <Destaque rotulo={'Saídas de ' + comp + ' (valor contábil)'} valor={vm.saidas.total} chips={[
            { icone: 'fileText', texto: vm.saidas.qtd + ' notas' }, { icone: 'hash', texto: vm.saidas.porCfop.length + ' CFOPs' },
            ...(pctDe('st') ? [{ icone: 'alert' as const, texto: pctDe('st').toLocaleString('pt-BR') + '% com ST', tom: 'atencao' as const }] : []),
            ...(pctDe('devolucao') ? [{ icone: 'repeat' as const, texto: pctDe('devolucao').toLocaleString('pt-BR') + '% devolução', tom: 'atencao' as const }] : []),
          ]} />
          <TabelaComBarras linhas={linhasPorCfop(vm.saidas)} colunas={{ rotulo: 'CFOP', extra: 'Notas' }} />
          <SemConta r={vm.saidas} />
        </>
      );
    case 'faturamento':
      if (!vm.saidas.qtd) return <Vazio relatorio="saidas" competencia={competencia} />;
      return (
        <>
          <Destaque rotulo={'Faturamento de ' + comp} valor={vm.saidas.total} chips={[
            { icone: 'fileText', texto: vm.saidas.qtd + ' notas no Alterdata' },
            vm.sieg ? (vm.sieg.emitidasNFe === vm.saidas.qtd ? { icone: 'checkCircle', texto: 'bate com as ' + vm.sieg.emitidasNFe + ' do SIEG' }
              : { icone: 'alert', texto: vm.sieg.emitidasNFe + ' emitidas no SIEG', tom: 'atencao' }) : { icone: 'clock', texto: 'SIEG ainda sem contagem' },
          ]} />
          <BarrasPorDia dias={vm.saidas.porDia} rotulo={'Faturamento por dia de ' + comp} />
        </>
      );
    case 'entradas':
      if (!vm.entradas.qtd) return <Vazio relatorio="entradas" competencia={competencia} />;
      return (
        <>
          <Destaque rotulo={'Entradas de ' + comp + ' (valor contábil)'} valor={vm.entradas.total} formato="reais"
            chips={[{ icone: 'fileText', texto: vm.entradas.qtd + ' notas' }, { icone: 'hash', texto: vm.entradas.porCfop.length + ' CFOPs' }]} />
          <TabelaComBarras linhas={linhasPorCfop(vm.entradas)} colunas={{ rotulo: 'CFOP', extra: 'Notas' }} />
          <SemConta r={vm.entradas} />
        </>
      );
    case 'entradas-sieg':
      if (!vm.entradas.qtd) return <Vazio relatorio="entradas" competencia={competencia} />;
      return (
        <>
          <Medidor itens={[
            { rotulo: 'Recebidas no SIEG (NF-e)', valor: vm.sieg ? vm.sieg.recebidasNFe : 0, tom: 'fraco' },
            { rotulo: 'Entradas no Alterdata', valor: vm.entradas.qtd },
          ]} />
          <p className="pt-veredito pt-entra">{!vm.sieg ? <><Icone nome="clock" />O SIEG ainda não contou este mês: confira pelo SINTEGRA.</>
            : vm.sieg.recebidasNFe === vm.entradas.qtd ? <><Icone nome="checkCircle" />As entradas batem com o SIEG.</>
              : <><Icone nome="alert" />{Math.abs(vm.sieg.recebidasNFe - vm.entradas.qtd)} de diferença: confira no SINTEGRA quais faltam.</>}</p>
        </>
      );
    case 'iss-retido':
    case 'inss-retido': {
      if (!vm.importado.tomados && !vm.importado.prestados) return <Vazio relatorio="tomados" competencia={competencia} />;
      const r = painel === 'iss-retido' ? vm.issRetido : vm.inssRetido;
      const imposto = painel === 'iss-retido' ? 'ISS' : 'INSS';
      if (!r.qtd) return <p className="pt-vazio pt-entra"><Icone nome="checkCircle" />Nenhuma nota de serviço com {imposto} retido em {comp}.</p>;
      return (
        <>
          <Destaque rotulo={imposto + ' retido em ' + comp} valor={r.total} chips={[{ icone: 'recibo', texto: r.qtd + (r.qtd === 1 ? ' nota' : ' notas') + ' com retenção' }]} />
          <Ranking linhas={r.linhas.map((l, i) => ({ chave: l.numero + i, nome: l.nome, dica: l.tipo + ' · nº ' + l.numero + ' · serviço ' + reais(l.valor), valor: l.retido }))} />
        </>
      );
    }
    case 'receitas':
    case 'irpj': {
      if (!vm.receita.length) return <Vazio relatorio="saidas" competencia={competencia} />;
      const receita = vm.receita.filter(f => f.classe === 'venda' || f.classe === 'st' || f.classe === 'servico').reduce((s, f) => s + f.valor, 0);
      return <Rosca fatias={fatias(vm.receita)} centro={receita} rotuloCentro={painel === 'irpj' ? 'receita do mês (o trimestre soma os 3)' : 'receita do mês'} />;
    }
    case 'base':
      if (!vm.base.length) return <Vazio relatorio="saidas" competencia={competencia} />;
      return (
        <>
          <Faixa fatias={fatias(vm.base)} />
          {(pctDe('st') > 0 || pctDe('devolucao') > 0) && (
            <p className="pt-veredito pt-entra"><Icone nome="alert" />Tire da base o que já teve o imposto pago antes (ST{pctDe('devolucao') ? ') e as devoluções' : ')'}.</p>
          )}
        </>
      );
    case 'icms': {
      if (!vm.saidas.qtd && !vm.entradas.qtd) return <Vazio relatorio="saidas" competencia={competencia} />;
      const dif = vm.saidas.total - vm.entradas.total;
      return <Balanca esquerda={{ rotulo: 'Saídas (débitos)', valor: vm.saidas.total }} direita={{ rotulo: 'Entradas (créditos)', valor: vm.entradas.total }}
        saldo={dif >= 0 ? 'saídas ' + reais(dif) + ' acima' : 'entradas ' + reais(-dif) + ' acima'} />;
    }
    case 'prestados':
      if (!vm.prestados.qtd) return <Vazio relatorio="prestados" competencia={competencia} />;
      return <Destaque rotulo={'Serviços prestados em ' + comp} valor={vm.prestados.total}
        chips={[{ icone: 'fileText', texto: vm.prestados.qtd + ' notas' }, { icone: 'recibo', texto: 'ISS ' + reais(vm.prestados.iss) }]} />;
    default:
      return null;
  }
}

export function PainelDaTarefa(p: { painel: t.PainelDaTarefa; vm: VmPainelDoFiscal; codigo: string; competencia: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // anima quando o painel aparece e quando os dados chegam (a importação ou o ⚡)
  const chave = p.painel + '|' + p.vm.importado.entradas + '|' + p.vm.importado.saidas + '|' + p.vm.importado.tomados + '|' + p.vm.importado.prestados + '|' + (p.vm.sieg ? 1 : 0);
  useEffect(() => { animarPainel(ref.current); }, [chave]);
  return <div ref={ref} className="pt-painel"><Corpo {...p} /></div>;
}
