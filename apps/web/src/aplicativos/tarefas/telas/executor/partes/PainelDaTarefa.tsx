// O painel de uma tarefa do Fiscal (a "checklist disfarçada", Vitor 06/10/2026), montado com as peças prontas do catálogo
// (Vitor: "resolva os elementos que já tinham sido criados… ao invés de usar os prontos"): os números no Stat, as
// comparações no ranking (rank), as notas por CFOP na tabela padrão (com a barra do rank), os avisos no Alerta, as
// marcas no badge e o vazio no gh-blank. Os gráficos novos (barras por dia, rosca, faixa 100%) saíram (Vitor: "não
// curti nenhum dos gráficos novos"): a composição virou o rank. Ao aparecer, anima (animarPainel.ts, animejs).
import { formatos, tarefas as t } from '@nads/core';
import { Alerta, Icone, Stat } from '@nads/ui';
import { useEffect, useRef, type ReactNode } from 'react';
import { ROTULO_DO_RELATORIO, type VmPainelDoFiscal } from '../usePainelDoFiscal';
import { animarPainel } from './animarPainel';
import { SiegDaEtapa } from './SiegDaEtapa';

const { reais } = formatos;
type Formato = 'reais' | 'int';

/** Um número que conta do zero ao aparecer (vai como o valor do Stat; animarPainel.ts conta). */
function Conta({ valor, formato = 'int' }: { valor: number; formato?: Formato }) {
  return <span data-conta={valor} data-formato={formato}>{formato === 'reais' ? reais(valor) : Math.round(valor).toLocaleString('pt-BR')}</span>;
}

/** A composição (por natureza do CFOP) no rank: o nome, a fatia e o valor, a barra pela fatia. */
const composicao = (f: readonly t.painel.FatiaDaComposicao[]) => f.map(x => ({
  chave: x.classe, nome: x.rotulo, valor: x.valor, texto: x.pct.toLocaleString('pt-BR') + '% · ' + reais(x.valor),
}));

function Vazio({ relatorio, competencia, importar }: { relatorio: t.RelatorioImportavel; competencia: string; importar?: () => void }) {
  return (
    <div className="gh-blank">
      <Icone nome="fileUp" />
      <h4>Sem {ROTULO_DO_RELATORIO[relatorio]} de {t.rotuloNumericoCompetencia(competencia)}</h4>
      <p>Importe o relatório do Alterdata para ver aqui.</p>
      {importar && <button type="button" className="btn btn-primary" onClick={importar}><Icone nome="upload" />Importar {ROTULO_DO_RELATORIO[relatorio]}</button>}
    </div>
  );
}

/** O ranking do catálogo (rank): cada linha com o nome, o valor e a barra. */
function Rank({ linhas }: { linhas: readonly { chave: string; nome: ReactNode; valor: number; texto: string; cor?: string }[] }) {
  const max = Math.max(...linhas.map(l => l.valor), 0);
  return (
    <div className="rank">
      {linhas.map(l => (
        <div key={l.chave} className="rank-item">
          <span className="rank-nome">{l.nome}</span><span className="rank-val">{l.texto}</span>
          <span className="rank-barra"><span style={{ width: max ? Math.max(l.valor > 0 ? 2 : 0, (l.valor / max) * 100) + '%' : 0, background: l.cor || 'var(--accent)' }} /></span>
        </div>
      ))}
    </div>
  );
}

/** As notas por CFOP na tabela padrão, com a barra do rank na coluna do valor. */
function TabelaPorCfop({ r }: { r: t.painel.ResumoDeNotas }) {
  const max = Math.max(...r.porCfop.map(l => l.valor), 0);
  return (
    <div className="table-wrap table-compact">
      <table>
        <thead><tr><th>CFOP</th><th>Natureza</th><th className="num">Notas</th><th className="num">Valor contábil</th></tr></thead>
        <tbody>
          {r.porCfop.map(l => (
            <tr key={l.cfop}>
              <td><b className="num">{l.cfop}</b></td>
              <td className="wrap">{l.desc} {(l.classe === 'st' || l.classe === 'devolucao') && <span className="badge badge-warn">{t.painel.CLASSES[l.classe]}</span>}</td>
              <td className="num">{l.qtd}</td>
              <td className="num graf-celula-barra">{reais(l.valor)}<span className="rank-barra"><span style={{ width: max ? (l.valor / max) * 100 + '%' : 0, background: 'var(--accent)' }} /></span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** SIEG × Alterdata: o Alerta verde quando bate; o amarelo com a diferença; nada sem a contagem. */
function Veredito({ sieg, importadas, oQue }: { sieg: number | null; importadas: number; oQue: string }) {
  if (sieg == null) return <p className="hint">O SIEG ainda não contou este mês (a contagem roda de madrugada).</p>;
  if (sieg === importadas) return <Alerta tom="ok" titulo={'As ' + oQue + ' batem com o SIEG'} texto={importadas + ' de ' + sieg + '.'} />;
  return importadas < sieg
    ? <Alerta titulo={'Faltam ' + (sieg - importadas) + ' ' + oQue + ' no Alterdata'} texto={'O SIEG tem ' + sieg + '; o Alterdata, ' + importadas + '. Importe as que faltam e reimporte o relatório.'} />
    : <Alerta titulo={(importadas - sieg) + ' ' + oQue + ' a mais que o SIEG'} texto={'O Alterdata tem ' + importadas + '; o SIEG, ' + sieg + '. Confira se há nota lançada duas vezes ou de outro mês.'} />;
}

function SemConta({ r }: { r: t.painel.ResumoDeNotas }) {
  return r.comConta ? null : <Alerta titulo="O relatório veio sem a conta contábil" texto="O Contábil precisa dela: ligue a coluna no Alterdata e reimporte." />;
}

function Corpo({ painel, vm, codigo, competencia, importar }: { painel: t.PainelDaTarefa; vm: VmPainelDoFiscal; codigo: string; competencia: string; importar: (r: t.RelatorioImportavel[]) => void }) {
  const comp = t.rotuloNumericoCompetencia(competencia);
  const pctDe = (classe: t.painel.ClasseDoCfop) => vm.base.find(f => f.classe === classe)?.pct || 0;
  const vazio = (r: t.RelatorioImportavel) => <Vazio relatorio={r} competencia={competencia} importar={() => importar([r])} />;
  switch (painel) {
    case 'sieg':
      return codigo ? <SiegDaEtapa tipo="contagem" codigo={codigo} competencia={competencia} /> : null;
    case 'sequencia':
      return codigo ? <SiegDaEtapa tipo="saidas" codigo={codigo} competencia={competencia} /> : null;
    case 'recebimento':
      return (
        <>
          <div className="stat-grid">
            <Stat rotulo="Emitidas no SIEG (NF-e e NFC-e)" valor={vm.sieg ? <Conta valor={vm.sieg.emitidasNFe} /> : '—'} />
            <Stat rotulo="Saídas no Alterdata" valor={<Conta valor={vm.importado.saidas} />} />
          </div>
          <Veredito sieg={vm.sieg?.emitidasNFe ?? null} importadas={vm.importado.saidas} oQue="saídas" />
        </>
      );
    case 'saidas':
    case 'entradas': {
      const r = painel === 'saidas' ? vm.saidas : vm.entradas;
      if (!r.qtd) return vazio(painel);
      return (
        <>
          <div className="stat-grid">
            <Stat rotulo={painel === 'saidas' ? 'Notas de saída' : 'Notas de entrada'} valor={<Conta valor={r.qtd} />} />
            <Stat rotulo="Valor contábil" valor={<Conta valor={r.total} formato="reais" />} cor={painel === 'saidas' ? 'saida' : 'entrada'} />
            <Stat rotulo="CFOPs" valor={<Conta valor={r.porCfop.length} />} />
          </div>
          {painel === 'saidas' && (pctDe('st') > 0 || pctDe('devolucao') > 0) && (
            <p className="hint graf-marcas">
              {pctDe('st') > 0 && <span className="badge badge-warn">{pctDe('st').toLocaleString('pt-BR')}% com ST</span>}
              {pctDe('devolucao') > 0 && <span className="badge badge-warn">{pctDe('devolucao').toLocaleString('pt-BR')}% devolução</span>}
            </p>
          )}
          <TabelaPorCfop r={r} />
          <SemConta r={r} />
        </>
      );
    }
    case 'faturamento':
      if (!vm.saidas.qtd) return vazio('saidas');
      return (
        <>
          <div className="stat-grid">
            <Stat rotulo={'Faturamento de ' + comp} valor={<Conta valor={vm.saidas.total} formato="reais" />} cor="saida" />
            <Stat rotulo="Notas no Alterdata" valor={<Conta valor={vm.saidas.qtd} />} />
            <Stat rotulo="Emitidas no SIEG" valor={vm.sieg ? <Conta valor={vm.sieg.emitidasNFe} /> : '—'} />
          </div>
          <Veredito sieg={vm.sieg?.emitidasNFe ?? null} importadas={vm.saidas.qtd} oQue="notas emitidas" />
        </>
      );
    case 'entradas-sieg':
      if (!vm.entradas.qtd) return vazio('entradas');
      return (
        <>
          <Rank linhas={[
            { chave: 'sieg', nome: 'Recebidas no SIEG (NF-e)', valor: vm.sieg?.recebidasNFe || 0, texto: vm.sieg ? String(vm.sieg.recebidasNFe) : '—', cor: 'var(--ink-faint)' },
            { chave: 'alt', nome: 'Entradas no Alterdata', valor: vm.entradas.qtd, texto: String(vm.entradas.qtd) },
          ]} />
          <Veredito sieg={vm.sieg?.recebidasNFe ?? null} importadas={vm.entradas.qtd} oQue="entradas" />
        </>
      );
    case 'iss-retido':
    case 'inss-retido': {
      if (!vm.importado.tomados && !vm.importado.prestados) return vazio('tomados');
      const r = painel === 'iss-retido' ? vm.issRetido : vm.inssRetido;
      const imposto = painel === 'iss-retido' ? 'ISS' : 'INSS';
      if (!r.qtd) return <Alerta tom="ok" titulo={'Nenhum ' + imposto + ' retido em ' + comp} texto="Nenhuma nota de serviço do mês tem retenção." />;
      return (
        <>
          <div className="stat-grid">
            <Stat rotulo={imposto + ' retido'} valor={<Conta valor={r.total} formato="reais" />} />
            <Stat rotulo="Notas com retenção" valor={<Conta valor={r.qtd} />} />
          </div>
          <Rank linhas={r.linhas.map((l, i) => ({ chave: l.numero + i, nome: <><b>{l.nome}</b> <span className="hint">{l.tipo} · nº {l.numero} · serviço {reais(l.valor)}</span></>, valor: l.retido, texto: reais(l.retido) }))} />
        </>
      );
    }
    case 'receitas':
    case 'irpj': {
      if (!vm.receita.length) return vazio('saidas');
      const receita = vm.receita.filter(f => f.classe === 'venda' || f.classe === 'st' || f.classe === 'servico').reduce((s, f) => s + f.valor, 0);
      return (
        <>
          <div className="stat-grid">
            <Stat rotulo={painel === 'irpj' ? 'Receita do mês (o trimestre soma os 3)' : 'Receita do mês'} valor={<Conta valor={receita} formato="reais" />} cor="saida" />
            <Stat rotulo="Serviços prestados" valor={<Conta valor={vm.prestados.total} formato="reais" />} />
          </div>
          <Rank linhas={composicao(vm.receita)} />
        </>
      );
    }
    case 'base':
      if (!vm.base.length) return vazio('saidas');
      return (
        <>
          <Rank linhas={composicao(vm.base)} />
          {(pctDe('st') > 0 || pctDe('devolucao') > 0) && <Alerta titulo="Tire da base o que já teve o imposto pago antes" texto={'As saídas com ST' + (pctDe('devolucao') ? ' e as devoluções' : '') + ' não entram na base.'} />}
        </>
      );
    case 'icms':
      if (!vm.saidas.qtd && !vm.entradas.qtd) return vazio('saidas');
      return (
        <>
          <div className="stat-grid">
            <Stat rotulo="Saídas (débitos)" valor={<Conta valor={vm.saidas.total} formato="reais" />} cor="saida" />
            <Stat rotulo="Entradas (créditos)" valor={<Conta valor={vm.entradas.total} formato="reais" />} cor="entrada" />
          </div>
          {vm.base.length > 0 && <Rank linhas={composicao(vm.base)} />}
        </>
      );
    case 'prestados':
      if (!vm.prestados.qtd) return vazio('prestados');
      return (
        <div className="stat-grid">
          <Stat rotulo="Notas de serviço" valor={<Conta valor={vm.prestados.qtd} />} />
          <Stat rotulo="Valor dos serviços" valor={<Conta valor={vm.prestados.total} formato="reais" />} />
          <Stat rotulo="ISS" valor={<Conta valor={vm.prestados.iss} formato="reais" />} />
        </div>
      );
    default:
      return null;
  }
}

export function PainelDaTarefa(p: { painel: t.PainelDaTarefa; vm: VmPainelDoFiscal; codigo: string; competencia: string; importar: (r: t.RelatorioImportavel[]) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // anima quando o painel aparece e quando os dados chegam (a importação ou o ⚡)
  const chave = p.painel + '|' + p.vm.importado.entradas + '|' + p.vm.importado.saidas + '|' + p.vm.importado.tomados + '|' + p.vm.importado.prestados + '|' + (p.vm.sieg ? 1 : 0);
  useEffect(() => { animarPainel(ref.current); }, [chave]);
  return <div ref={ref} className="graf-painel"><Corpo {...p} /></div>;
}
