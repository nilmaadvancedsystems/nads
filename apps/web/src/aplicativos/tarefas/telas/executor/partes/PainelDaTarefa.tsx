// O painel de uma tarefa do Fiscal (a "checklist disfarçada", Vitor 06/10/2026), montado com as peças prontas do catálogo
// (Vitor: "resolva os elementos que já tinham sido criados… ao invés de usar os prontos"): os números no Stat, as
// comparações no ranking (rank), as notas por CFOP na tabela padrão (com a barra do rank), os avisos no Alerta, as
// marcas no badge e o vazio no gh-blank. Os gráficos novos (barras por dia, rosca, faixa 100%) saíram (Vitor: "não
// curti nenhum dos gráficos novos"): a composição virou o rank. Ao aparecer, anima (animarPainel.ts, animejs).
// A verificação (Vitor, 07/10/2026): NCM, CST e CEST nas entradas e saídas; os serviços com NBS, descrição, valor e o que
// cada nota retém; o faturamento com saídas e entradas lado a lado e a folha que o DP informou. Clicar numa linha (por
// CFOP ou por NCM/CST/CEST) abre as notas dela na janela do catálogo (Vitor, 07/10/2026: "quando eu clique, abra os
// detalhes da nota").
import { conferencia as c, formatos, tarefas as t } from '@nads/core';
import { Alerta, BotaoAcao, Icone, Stat } from '@nads/ui';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ROTULO_DO_RELATORIO, type VmPainelDoFiscal } from '../usePainelDoFiscal';
import { animarPainel } from './animarPainel';
import { GuiaParaSubir } from './GuiaParaSubir';
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

/** As notas de uma linha (o que abre na janela). */
interface NotasAbertas { titulo: string; notas: readonly c.Nota[] }

/** A linha que abre as notas: o clique, o Enter e o espaço. */
const abre = (abrir: () => void) => ({
  className: 'graf-linha-abre', role: 'button', tabIndex: 0, title: 'Ver as notas', onClick: abrir,
  onKeyDown: (e: KeyboardEvent<HTMLTableRowElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } },
});

/** As notas por CFOP na tabela padrão, com a barra do rank na coluna do valor. */
function TabelaPorCfop({ r, abrir }: { r: t.painel.ResumoDeNotas; abrir: (n: NotasAbertas) => void }) {
  const max = Math.max(...r.porCfop.map(l => l.valor), 0);
  return (
    <div className="table-wrap table-compact">
      <table>
        <thead><tr><th>CFOP</th><th>Natureza</th><th className="num">Notas</th><th className="num">Valor contábil</th></tr></thead>
        <tbody>
          {r.porCfop.map(l => (
            <tr key={l.cfop} {...abre(() => abrir({ titulo: 'CFOP ' + l.cfop + ' · ' + l.desc, notas: l.notas }))}>
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
  if (sieg === importadas) return <Alerta naLinha tom="ok" titulo={'As ' + oQue + ' batem com o SIEG'} texto={importadas + ' de ' + sieg + '.'} />;
  return importadas < sieg
    ? <Alerta naLinha titulo={'Faltam ' + (sieg - importadas) + ' ' + oQue + ' no Alterdata'} texto={'O SIEG tem ' + sieg + '; o Alterdata, ' + importadas + '. Importe as que faltam e reimporte o relatório.'} />
    : <Alerta naLinha titulo={(importadas - sieg) + ' ' + oQue + ' a mais que o SIEG'} texto={'O Alterdata tem ' + importadas + '; o SIEG, ' + sieg + '. Confira se há nota lançada duas vezes ou de outro mês.'} />;
}

/** De onde vem a tabela de verificação: os XMLs do SIEG (08/10/2026) ou o relatório do Alterdata. */
function Origem({ xml, quando }: { xml: boolean; quando?: string }) {
  return <p className="hint" style={{ margin: '8px 0 4px' }}>{xml ? 'Dos XMLs do SIEG' + (quando ? ' (baixados em ' + quando + ')' : '') + ': item por item, como está na nota.' : 'Do relatório do Alterdata.'}</p>;
}

/** Os itens por NCM, CST e CEST (dos XMLs do SIEG, ou do relatório do Alterdata quando traz as colunas). */
function TabelaFiscal({ r, abrir, xml, quando }: { r: t.painel.ResumoFiscal; abrir: (n: NotasAbertas) => void; xml?: boolean; quando?: string }) {
  if (!r.temColunas) return <p className="hint">Sem NCM, CST e CEST: baixe os XMLs do SIEG (na etapa Inicial) ou exporte do Alterdata com essas colunas e reimporte.</p>;
  return (
    <>
    <Origem xml={!!xml} quando={quando} />
    <div className="table-wrap table-compact">
      <table>
        <thead><tr><th>NCM</th><th>CST</th><th>CEST</th><th className="num">Itens</th><th className="num">Valor</th></tr></thead>
        <tbody>
          {r.linhas.map(l => (
            <tr key={l.ncm + '|' + l.cst + '|' + l.cest} {...abre(() => abrir({ titulo: ['NCM ' + (l.ncm || '—'), 'CST ' + (l.cst || '—'), l.cest ? 'CEST ' + l.cest : ''].filter(Boolean).join(' · '), notas: l.notas }))}>
              <td><b>{l.ncm || '—'}</b></td><td>{l.cst || '—'}</td><td>{l.cest || '—'}</td>
              <td className="num">{l.itens}</td><td className="num">{reais(l.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

/** As notas que estão nos XMLs do SIEG e ainda não no Alterdata (pelo número). */
function FaltamNoAlterdata({ faltam, oQue, baixar, baixando }: { faltam: readonly t.sieg.NotaQueFalta[]; oQue: string; baixar: (chaves: string[]) => void; baixando: boolean }) {
  if (!faltam.length) return <Alerta naLinha tom="ok" titulo={'Todas as ' + oQue + ' dos XMLs estão no Alterdata'} texto="Conferido pelo número de cada nota." />;
  return (
    <>
      <Alerta naLinha titulo={faltam.length + ' ' + oQue + (faltam.length === 1 ? ' está' : ' estão') + ' nos XMLs e não no Alterdata'} texto="Baixe o .zip só com elas, importe no Alterdata e reimporte o relatório.">
        {/* o .zip só com as que faltam (08/10/2026: "3"): o robô pega essas notas no SIEG pela chave */}
        <div className="sieg-acoes" style={{ marginTop: 8 }}>
          <BotaoAcao className="btn btn-primary" carregando={baixando} textoCarregando="O robô está montando o .zip…" onClick={() => baixar(faltam.map(n => n.chave).filter(Boolean))}>
            <Icone nome="download" />Baixar .zip das que faltam ({faltam.length})
          </BotaoAcao>
        </div>
      </Alerta>
      <div className="table-wrap table-compact">
        <table>
          <thead><tr><th>Nota</th><th>Data</th><th className="num">Valor</th></tr></thead>
          <tbody>
            {faltam.slice(0, 50).map(n => (
              <tr key={n.tipo + n.numero + n.nome}>
                <td className="wrap"><b>{n.nome}</b><span className="hint" style={{ display: 'block', margin: 0 }}>{n.tipo} · nº {n.numero}</span></td>
                <td>{n.data}</td><td className="num">{reais(n.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {faltam.length > 50 && <p className="hint">E mais {faltam.length - 50}.</p>}
    </>
  );
}

/** Os itens das notas emitidas com a tributação para revisar (09/10/2026: "erros de tributação apontados sozinhos"). */
function ErrosDeTributacao({ erros }: { erros: readonly t.sieg.ErroDeTributacao[] }) {
  if (!erros.length) return <Alerta naLinha tom="ok" titulo="Tributação das notas emitidas sem nada para revisar" texto="CST/CSOSN pelo regime, a substituição tributária e o CEST conferidos item por item nos XMLs." />;
  const notas = new Set(erros.map(e => e.numero)).size;
  return (
    <>
      <Alerta naLinha titulo={erros.length + (erros.length === 1 ? ' item para revisar' : ' itens para revisar') + ' em ' + notas + (notas === 1 ? ' nota' : ' notas')}
        texto="Conferido nos XMLs: o CST/CSOSN pelo regime da empresa, o CFOP de substituição tributária e o CEST." />
      <div className="table-wrap table-compact">
        <table>
          <thead><tr><th>Nota</th><th>NCM</th><th>CFOP</th><th>CST</th><th>CEST</th><th>O que revisar</th></tr></thead>
          <tbody>
            {erros.slice(0, 80).map((e, i) => (
              <tr key={e.numero + '|' + e.ncm + '|' + e.problema + '|' + i}>
                <td className="wrap"><b>{e.nome}</b><span className="hint" style={{ display: 'block', margin: 0 }}>{e.tipo} · nº {e.numero} · {e.data}</span></td>
                <td>{e.ncm || '—'}</td><td>{e.cfop || '—'}</td><td>{e.cst || '—'}</td><td>{e.cest || '—'}</td>
                <td className="wrap">{e.problema}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {erros.length > 80 && <p className="hint">E mais {erros.length - 80}.</p>}
    </>
  );
}

/** XML x Alterdata nota a nota (09/10/2026: "valores, não só quantidade"): valor diferente, cancelada lançada, lançada sem XML. */
function ValoresNotaANota({ c }: { c: t.sieg.ConferenciaDeValores | null }) {
  if (!c) return null;
  const grupos: [string, t.sieg.NotaQueNaoFecha[], string][] = [
    ['com o valor diferente do XML', c.diferentes, 'O valor lançado (a soma das linhas da nota) não bate com o total do XML.'],
    ['canceladas no SIEG e lançadas', c.canceladasLancadas, 'Tire do Alterdata (ou lance como cancelada).'],
    ['lançadas que não estão nos XMLs', c.semXml, 'Confira se a nota existe, se é deste mês ou se o número está certo.'],
  ];
  if (!grupos.some(([, l]) => l.length)) return <Alerta naLinha tom="ok" titulo="Os valores batem nota a nota com os XMLs" texto="Nenhuma diferença de valor, nenhuma cancelada lançada e nada lançado fora dos XMLs." />;
  return (
    <>
      {grupos.filter(([, l]) => l.length).map(([titulo, lista, texto]) => (
        <div key={titulo}>
          <Alerta naLinha titulo={lista.length + (lista.length === 1 ? ' nota ' : ' notas ') + titulo} texto={texto} />
          <div className="table-wrap table-compact">
            <table>
              <thead><tr><th>Nota</th><th>Data</th><th className="num">No XML</th><th className="num">No Alterdata</th><th className="num">Diferença</th></tr></thead>
              <tbody>
                {lista.slice(0, 50).map(n => (
                  <tr key={titulo + n.numero + n.nome}>
                    <td className="wrap"><b>{n.nome}</b><span className="hint" style={{ display: 'block', margin: 0 }}>nº {n.numero}</span></td>
                    <td>{n.data}</td><td className="num">{n.noXml ? reais(n.noXml) : '—'}</td><td className="num">{reais(n.noAlterdata)}</td><td className="num">{reais(n.diferenca)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lista.length > 50 && <p className="hint">E mais {lista.length - 50}.</p>}
        </div>
      ))}
    </>
  );
}

// ---------- o Presumido e o Real pelos XMLs (13/10/2026: "agora monte a rotina do lucro presumido e real") ----------

type Informar = (chave: string, valor: number) => void;
const lerReais = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));
const emReais = (v: number | null | undefined) => (v != null ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
const pctBr = (v: number) => v.toLocaleString('pt-BR') + '%';

/** Um valor em reais que a pessoa informa: grava ao sair do campo (ou no Enter). */
function CampoEmReais({ rotulo, valor, salvar, semRotulo }: { rotulo: string; valor: number | null; salvar?: (v: number) => void; semRotulo?: boolean }) {
  const campo = (
    <input key={rotulo + '|' + valor} type="text" inputMode="decimal" placeholder="0,00" defaultValue={emReais(valor)} disabled={!salvar} aria-label={rotulo}
      onBlur={e => { const v = lerReais(e.target.value); if (e.target.value.trim() && Number.isFinite(v) && v >= 0 && v !== valor) salvar?.(v); }}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
  );
  if (semRotulo) return campo;
  return <label className="field dp-filtro"><span className="hint">{rotulo}</span>{campo}</label>;
}

/** Os XMLs do mês foram lidos antes de o robô guardar o ICMS de cada item (o resumo 1): baixar de novo. */
function SemImpostosNoXml({ vm }: { vm: VmPainelDoFiscal }) {
  if (!vm.lucro || vm.lucro.temImpostos) return null;
  return <Alerta naLinha titulo="Baixe os XMLs de novo" texto="Os XMLs deste mês foram lidos antes de o robô guardar o ICMS de cada item: baixe de novo do SIEG (na etapa Inicial) para tirar o ICMS da base e calcular o ICMS e os créditos." />;
}
const semXml = (o: string) => <p className="hint">Baixe os XMLs do SIEG (na etapa Inicial) para calcular {o}.</p>;

/** O PIS/COFINS do mês: cumulativo no Presumido, não cumulativo no Real (com os créditos). */
function PisCofinsPrevia({ vm }: { vm: VmPainelDoFiscal }) {
  if (!vm.lucro) return semXml('a prévia do PIS/COFINS');
  const regime: t.sieg.RegimeDoLucro = vm.regime === 'Real' ? 'Real' : 'Presumido';
  const r = vm.lucro.receitas;
  const p = t.sieg.pisCofins(regime, r, regime === 'Real' ? vm.lucro.creditos : null);
  const linha = (rotulo: string, pis: number, cofins: number, forte = false) => (
    <tr><td>{forte ? <b>{rotulo}</b> : rotulo}</td><td className="num">{forte ? <b>{reais(pis)}</b> : reais(pis)}</td><td className="num">{forte ? <b>{reais(cofins)}</b> : reais(cofins)}</td></tr>
  );
  return (
    <>
      <SemImpostosNoXml vm={vm} />
      <div className="stat-grid">
        <Stat rotulo="Base do mês" valor={<Conta valor={p.base} formato="reais" />} />
        <Stat rotulo={'PIS a pagar (' + pctBr(p.aliquotas.pis) + ')'} valor={<Conta valor={p.aPagar.pis} formato="reais" />} />
        <Stat rotulo={'COFINS a pagar (' + pctBr(p.aliquotas.cofins) + ')'} valor={<Conta valor={p.aPagar.cofins} formato="reais" />} />
      </div>
      <div className="table-wrap table-compact">
        <table>
          <thead><tr><th>A base</th><th className="num">Valor</th></tr></thead>
          <tbody>
            <tr><td>Receita de mercadorias</td><td className="num">{reais(r.mercadorias)}</td></tr>
            {r.devolucoes > 0 && <tr><td>(−) Devoluções de venda</td><td className="num">{reais(r.devolucoes)}</td></tr>}
            {r.semPisCofins > 0 && <tr><td>(−) Sem PIS/COFINS (monofásico, ST, alíquota zero, isenta)</td><td className="num">{reais(r.semPisCofins)}</td></tr>}
            {r.icmsDestacado > 0 && <tr><td>(−) ICMS destacado nas notas</td><td className="num">{reais(r.icmsDestacado)}</td></tr>}
            {r.servicos > 0 && <tr><td>(+) Serviços prestados (NFS-e)</td><td className="num">{reais(r.servicos)}</td></tr>}
            <tr><td><b>Base</b></td><td className="num"><b>{reais(p.base)}</b></td></tr>
          </tbody>
        </table>
      </div>
      <div className="table-wrap table-compact">
        <table>
          <thead><tr><th>Apuração</th><th className="num">PIS</th><th className="num">COFINS</th></tr></thead>
          <tbody>
            {linha('Débito', p.debito.pis, p.debito.cofins)}
            {regime === 'Real' && linha('(−) Créditos das entradas', p.credito.pis, p.credito.cofins)}
            {p.retido.pis + p.retido.cofins > 0 && linha('(−) Retido nas notas de serviço', p.retido.pis, p.retido.cofins)}
            {linha('A pagar', p.aPagar.pis, p.aPagar.cofins, true)}
            {p.saldoCredor.pis + p.saldoCredor.cofins > 0 && linha('Saldo credor para o mês seguinte', p.saldoCredor.pis, p.saldoCredor.cofins)}
          </tbody>
        </table>
      </div>
      <p className="hint">
        Prévia para conferir: o que vale é a apuração no Alterdata{regime === 'Real' ? ' e a EFD-Contribuições' : ''}.{' '}
        {regime === 'Presumido' ? 'Cumulativo: sem créditos.' : 'Os créditos de energia, aluguel e depreciação vêm do Contábil e não estão aqui.'}
        {' '}Sem o CST do PIS na nota, o monofásico sai pela lista resumida de NCMs.
      </p>
    </>
  );
}

/** Os créditos de PIS/COFINS do Real pelas notas recebidas: as compras sem o ICMS, sem os monofásicos, e os fretes. */
function CreditosReal({ vm }: { vm: VmPainelDoFiscal }) {
  if (!vm.lucro) return semXml('os créditos');
  const c = vm.lucro.creditos;
  const a = t.sieg.ALIQUOTAS_PIS_COFINS.Real;
  const cred = (pct: number) => Math.round(c.base * pct) / 100;
  return (
    <>
      <SemImpostosNoXml vm={vm} />
      <div className="stat-grid">
        <Stat rotulo="Base dos créditos" valor={<Conta valor={c.base} formato="reais" />} />
        <Stat rotulo={'Crédito de PIS (' + pctBr(a.pis) + ')'} valor={<Conta valor={cred(a.pis)} formato="reais" />} />
        <Stat rotulo={'Crédito de COFINS (' + pctBr(a.cofins) + ')'} valor={<Conta valor={cred(a.cofins)} formato="reais" />} />
      </div>
      <div className="table-wrap table-compact">
        <table>
          <thead><tr><th>Das notas recebidas</th><th className="num">Valor</th></tr></thead>
          <tbody>
            <tr><td>Compras de mercadorias e insumos (sem o ICMS)</td><td className="num">{reais(c.compras)}</td></tr>
            <tr><td>Fretes (CT-e)</td><td className="num">{reais(c.fretes)}</td></tr>
            <tr><td><b>Base dos créditos</b></td><td className="num"><b>{reais(c.base)}</b></td></tr>
            {c.monofasicos > 0 && <tr><td className="hint">Compras de monofásicos (sem crédito na revenda)</td><td className="num hint">{reais(c.monofasicos)}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="hint">As compras saem do CFOP de venda do fornecedor: confira as de uso e consumo e as de ativo, que não dão crédito direto. O frete só dá crédito quando é da compra ou da venda.</p>
    </>
  );
}

/** O ICMS do mês pelos XMLs: os débitos das saídas, os créditos das compras e das devoluções, o saldo anterior. */
function IcmsApuracao({ vm, valores, informar }: { vm: VmPainelDoFiscal; valores?: Record<string, number>; informar?: Informar }) {
  const i = t.sieg.icmsDoMes(vm.lucro?.xmlDados || null, valores?.icmsSaldoAnterior ?? 0);
  return (
    <>
      <div className="tarefas-filtros dp-filtros">
        <CampoEmReais rotulo="Saldo credor do mês anterior" valor={valores?.icmsSaldoAnterior ?? null} salvar={informar ? v => informar('icmsSaldoAnterior', v) : undefined} />
      </div>
      <div className="stat-grid">
        <Stat rotulo="Débitos (saídas)" valor={<Conta valor={i.debitos} formato="reais" />} cor="saida" />
        <Stat rotulo={'Créditos (' + i.notasDeCompra + (i.notasDeCompra === 1 ? ' nota de compra' : ' notas de compra') + ')'} valor={<Conta valor={i.creditos} formato="reais" />} cor="entrada" />
        <Stat rotulo={i.aPagar > 0 ? 'ICMS a recolher' : 'Saldo credor para o mês seguinte'} valor={<Conta valor={i.aPagar > 0 ? i.aPagar : i.saldoCredor} formato="reais" />} />
      </div>
      {(i.stRetido > 0 || i.ipiSaidas > 0 || i.ipiEntradas > 0) && (
        <div className="stat-grid">
          {i.stRetido > 0 && <Stat rotulo="ICMS-ST retido nas saídas (guia própria)" valor={<Conta valor={i.stRetido} formato="reais" />} />}
          {i.ipiSaidas > 0 && <Stat rotulo="IPI das saídas" valor={<Conta valor={i.ipiSaidas} formato="reais" />} />}
          {i.ipiEntradas > 0 && <Stat rotulo="IPI das compras" valor={<Conta valor={i.ipiEntradas} formato="reais" />} />}
        </div>
      )}
      <p className="hint">Prévia para conferir: o que vale é a apuração no Alterdata e a DAPI. Os créditos contam todas as compras pelo CFOP do fornecedor: tire as de uso e consumo; o ativo entra pelo CIAP (1/48 por mês).</p>
    </>
  );
}

/** O IRPJ e a CSLL: o trimestre no Presumido (os três meses), a estimativa do mês no Real. */
function IrpjPrevia({ vm, competencia, valores, informar }: { vm: VmPainelDoFiscal; competencia: string; valores?: Record<string, number>; informar?: Informar }) {
  if (!vm.lucro) return semXml('o IRPJ e a CSLL');
  const real = vm.regime === 'Real';
  const P = t.sieg.PRESUNCOES;
  const pm = P[valores?.presuncaoMerc ?? 0]?.id ?? 'comercio';
  const ps = P[valores?.presuncaoServ ?? 2]?.id ?? 'servicos';
  const doMes = { ...t.sieg.receitaParaIrpj(competencia, vm.lucro.receitas), origem: 'Os XMLs deste mês', falta: false, digitavel: false };
  const manual = (c: string, k: 'Merc' | 'Serv') => 'ir' + c.replace('-', '') + k;
  const outros = real ? [] : vm.outrosMeses.map(m => {
    const v = m.valores;
    if (typeof v.irMerc === 'number') return { competencia: m.competencia, mercadorias: v.irMerc, servicos: v.irServ || 0, irrf: v.irIrrf || 0, csll: v.irCsll || 0, origem: 'A rotina do mês', falta: false, digitavel: false };
    const merc = valores?.[manual(m.competencia, 'Merc')], serv = valores?.[manual(m.competencia, 'Serv')];
    return { competencia: m.competencia, mercadorias: merc ?? 0, servicos: serv ?? 0, irrf: 0, csll: 0, origem: 'Digitado', falta: merc == null && serv == null, digitavel: true };
  });
  const linhas = [...outros, doMes];
  const r = t.sieg.irpjCsll(linhas, { mercadorias: pm, servicos: ps }, valores?.irOutras ?? 0);
  const faltam = outros.filter(o => o.falta);
  const opcoes = P.map((p, k) => <option key={p.id} value={k}>{p.rotulo} (IRPJ {pctBr(p.irpj)}, CSLL {pctBr(p.csll)})</option>);
  const lin = (rotulo: string, ir: number, cs: number, forte = false) => (
    <tr><td>{forte ? <b>{rotulo}</b> : rotulo}</td><td className="num">{forte ? <b>{reais(ir)}</b> : reais(ir)}</td><td className="num">{forte ? <b>{reais(cs)}</b> : reais(cs)}</td></tr>
  );
  return (
    <>
      <SemImpostosNoXml vm={vm} />
      <div className="tarefas-filtros dp-filtros">
        <label className="field dp-filtro">
          <span className="hint">Presunção das mercadorias</span>
          <select className="select-compact" value={P.findIndex(p => p.id === pm)} disabled={!informar} onChange={e => informar?.('presuncaoMerc', Number(e.target.value))}>{opcoes}</select>
        </label>
        <label className="field dp-filtro">
          <span className="hint">Presunção dos serviços</span>
          <select className="select-compact" value={P.findIndex(p => p.id === ps)} disabled={!informar} onChange={e => informar?.('presuncaoServ', Number(e.target.value))}>{opcoes}</select>
        </label>
        <CampoEmReais rotulo={real ? 'Receitas financeiras e ganhos do mês' : 'Receitas financeiras e ganhos do trimestre'} valor={valores?.irOutras ?? null} salvar={informar ? v => informar('irOutras', v) : undefined} />
      </div>
      {faltam.length > 0 && <Alerta naLinha titulo={'Falta a receita de ' + faltam.map(f => t.rotuloNumericoCompetencia(f.competencia)).join(' e ')} texto="Abra a rotina desse mês (com os XMLs baixados) para trazer sozinho, ou digite a receita na tabela." />}
      {r.acimaDaLc224 && <Alerta naLinha titulo="Receita acima de R$ 5 milhões no ano" texto="A LC 224/2025 aumenta a presunção da parte da receita acima desse limite: confira o cálculo no Alterdata." />}
      <div className="table-wrap table-compact">
        <table>
          <thead><tr><th>Mês</th><th className="num">Mercadorias</th><th className="num">Serviços</th><th className="num">IRRF retido</th><th className="num">CSLL retida</th><th>De onde</th></tr></thead>
          <tbody>
            {linhas.map(l => (
              <tr key={l.competencia}>
                <td><b>{t.rotuloNumericoCompetencia(l.competencia)}</b></td>
                <td className="num">{l.digitavel ? <CampoEmReais semRotulo rotulo={'Mercadorias de ' + l.competencia} valor={l.falta ? null : l.mercadorias} salvar={informar ? v => informar(manual(l.competencia, 'Merc'), v) : undefined} /> : reais(l.mercadorias)}</td>
                <td className="num">{l.digitavel ? <CampoEmReais semRotulo rotulo={'Serviços de ' + l.competencia} valor={l.falta ? null : l.servicos} salvar={informar ? v => informar(manual(l.competencia, 'Serv'), v) : undefined} /> : reais(l.servicos)}</td>
                <td className="num">{reais(l.irrf)}</td><td className="num">{reais(l.csll)}</td>
                <td>{l.falta ? <span className="badge badge-warn">Falta</span> : <span className="hint">{l.origem}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-wrap table-compact">
        <table>
          <thead><tr><th>{real ? 'Estimativa do mês' : 'O trimestre'}</th><th className="num">IRPJ</th><th className="num">CSLL</th></tr></thead>
          <tbody>
            {lin('Base (presunção' + (r.receita.outras ? ' e outras receitas' : '') + ')', r.base.irpj, r.base.csll)}
            {lin('Imposto (15% e 9%)', r.irpj, r.csll)}
            {r.adicional > 0 && lin('Adicional do IRPJ (10% acima de R$ ' + (20000 * r.meses).toLocaleString('pt-BR') + ')', r.adicional, 0)}
            {r.retido.irpj + r.retido.csll > 0 && lin('(−) Retido nas notas de serviço', r.retido.irpj, r.retido.csll)}
            {lin('A pagar', r.aPagar.irpj, r.aPagar.csll, true)}
          </tbody>
        </table>
      </div>
      <p className="hint">
        Prévia para conferir: o que vale é a apuração no Alterdata.{' '}
        {real
          ? 'Estimativa pela receita: se o balancete do Contábil der menos, use a suspensão ou a redução.'
          : 'Em cota única ou em até 3 cotas (cada uma de pelo menos R$ 1.000; abaixo de R$ 2.000, cota única): IRPJ em ' + r.cotas.irpj + ', CSLL em ' + r.cotas.csll + '.'}
      </p>
    </>
  );
}

/** O PGDAS-D pelos XMLs (13/10/2026): o RBT12 e os anexos (informados na etapa), o aviso de limite, a receita separada em
 * monofásico e ST (o que se segrega no PGDAS) e a prévia do DAS. É prévia: o que vale é o PGDAS. */
function PgdasPrevia({ vm, valores, informar }: { vm: VmPainelDoFiscal; valores?: Record<string, number>; informar?: (chave: string, valor: number) => void }) {
  const rbt12 = valores?.rbt12 ?? null;
  const anexoMerc: t.sieg.Anexo = valores?.anexoMercadorias === 2 ? 'II' : 'I';
  const anexoServ: t.sieg.Anexo = valores?.anexoServicos === 4 ? 'IV' : valores?.anexoServicos === 5 ? 'V' : 'III';
  const [texto, setTexto] = useState(rbt12 != null ? rbt12.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
  const lido = Number(texto.replace(/\./g, '').replace(',', '.'));
  const valido = texto.trim() !== '' && Number.isFinite(lido) && lido >= 0;
  const s = vm.segregacao;
  const sv = vm.servicosDoMes;
  const aviso = rbt12 != null ? t.sieg.avisoDeLimite(vm.regime, rbt12) : null;
  const previa = rbt12 != null && (s?.total || sv?.total) ? t.sieg.previaDoDas(rbt12, [
    { rotulo: 'Mercadorias (normal)', anexo: anexoMerc, valor: s?.normal || 0 },
    { rotulo: 'Monofásico (sem PIS/COFINS)', anexo: anexoMerc, valor: s?.monofasico || 0, semPisCofins: true },
    { rotulo: 'Com ST (sem ICMS)', anexo: anexoMerc, valor: s?.st || 0, semIcms: true },
    { rotulo: 'Monofásico e ST (sem PIS/COFINS e ICMS)', anexo: anexoMerc, valor: s?.monofasicoESt || 0, semPisCofins: true, semIcms: true },
    { rotulo: 'Serviços', anexo: anexoServ, valor: sv ? sv.total - sv.issRetido : 0 },
    { rotulo: 'Serviços com ISS retido (sem ISS)', anexo: anexoServ, valor: sv?.issRetido || 0, semIss: true },
  ]) : null;
  const pct = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 4 }) + '%';
  return (
    <>
      {vm.regime && vm.regime !== 'Simples' && vm.regime !== 'MEI' && <p className="hint">Esta empresa está como {vm.regime} no cadastro: a prévia é do Simples.</p>}
      <form className="tarefas-filtros dp-filtros" onSubmit={e => { e.preventDefault(); if (valido && informar) informar('rbt12', lido); }}>
        <label className="field dp-filtro">
          <span className="hint">RBT12 (receita bruta dos últimos 12 meses)</span>
          <input type="text" inputMode="decimal" placeholder="0,00" value={texto} onChange={e => setTexto(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary" disabled={!valido || !informar}><Icone nome="check" />Salvar o RBT12</button>
        <label className="field dp-filtro">
          <span className="hint">Anexo das mercadorias</span>
          <select className="select-compact" value={anexoMerc} disabled={!informar} onChange={e => informar?.('anexoMercadorias', e.target.value === 'II' ? 2 : 1)}>
            <option value="I">Anexo I (comércio)</option><option value="II">Anexo II (indústria)</option>
          </select>
        </label>
        <label className="field dp-filtro">
          <span className="hint">Anexo dos serviços</span>
          <select className="select-compact" value={anexoServ} disabled={!informar} onChange={e => informar?.('anexoServicos', e.target.value === 'IV' ? 4 : e.target.value === 'V' ? 5 : 3)}>
            <option value="III">Anexo III</option><option value="IV">Anexo IV</option><option value="V">Anexo V</option>
          </select>
        </label>
      </form>
      {aviso && <Alerta naLinha titulo={aviso.nivel === 'passou' ? 'Limite passado' : 'Perto do limite'} texto={aviso.texto} />}
      {!vm.xml ? <p className="hint">Baixe os XMLs do SIEG (na etapa Inicial) para separar a receita e calcular a prévia.</p> : (
        <>
          {s && s.total > 0 && (
            <>
              <div className="stat-grid">
                <Stat rotulo="Receita de mercadorias" valor={<Conta valor={s.total} formato="reais" />} />
                <Stat rotulo="Monofásico (PIS/COFINS)" valor={<Conta valor={s.monofasico + s.monofasicoESt} formato="reais" />} />
                <Stat rotulo="Com ST (ICMS)" valor={<Conta valor={s.st + s.monofasicoESt} formato="reais" />} />
              </div>
              {s.porGrupo.length > 0 && (
                <div className="table-wrap table-compact">
                  <table>
                    <thead><tr><th>Monofásico</th><th>NCMs</th><th className="num">Receita</th></tr></thead>
                    <tbody>{s.porGrupo.map(g => <tr key={g.grupo}><td><b>{g.grupo}</b></td><td className="wrap">{g.ncms.slice(0, 12).join(', ')}{g.ncms.length > 12 ? ' e mais ' + (g.ncms.length - 12) : ''}</td><td className="num">{reais(g.valor)}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </>
          )}
          {previa ? (
            <>
              <div className="table-wrap table-compact">
                <table>
                  <thead><tr><th>Parcela da receita</th><th>Anexo</th><th className="num">Receita</th><th className="num">Alíquota efetiva</th><th className="num">Aplicada</th><th className="num">DAS</th></tr></thead>
                  <tbody>
                    {previa.parcelas.map(p => (
                      <tr key={p.rotulo}><td className="wrap">{p.rotulo}</td><td>{p.anexo} · faixa {p.faixa}</td><td className="num">{reais(p.valor)}</td><td className="num">{pct(p.efetiva)}</td><td className="num">{pct(p.aplicada)}</td><td className="num">{reais(p.das)}</td></tr>
                    ))}
                    <tr><td colSpan={5}><b>Prévia do DAS</b></td><td className="num"><b>{reais(previa.total)}</b></td></tr>
                  </tbody>
                </table>
              </div>
              {previa.economia > 0 && <Alerta naLinha tom="ok" titulo={'A segregação tira ' + reais(previa.economia) + ' do DAS'} texto="Informe no PGDAS-D a receita com monofásico (PIS/COFINS), com ST (ICMS) e com ISS retido, como na tabela." />}
            </>
          ) : rbt12 == null ? <p className="hint">Informe o RBT12 para calcular a prévia do DAS.</p> : null}
          <p className="hint">Prévia para conferir: o que vale é o PGDAS-D. Monofásico pela lista resumida de NCMs (combustíveis, medicamentos, perfumaria, pneus, autopeças, veículos e bebidas frias); confira os casos fora dela.</p>
        </>
      )}
    </>
  );
}

/** As retenções das NFS-e do mês como entram na REINF (13/10/2026): R-2010, R-2020 e R-4020. */
function ReinfDasNotas({ linhas }: { linhas: readonly t.sieg.LinhaDaReinf[] }) {
  if (!linhas.length) return null;
  return (
    <>
      <p className="hint" style={{ margin: '12px 0 4px' }}><b>Para a REINF</b> (das retenções das NFS-e do mês)</p>
      <div className="table-wrap table-compact">
        <table>
          <thead><tr><th>Evento</th><th>Prestador / tomador</th><th className="num">Notas</th><th className="num">Base</th><th className="num">INSS</th><th className="num">IRRF</th><th className="num">PIS</th><th className="num">COFINS</th><th className="num">CSLL</th></tr></thead>
          <tbody>
            {linhas.map(l => (
              <tr key={l.evento + l.doc}>
                <td><span className="badge badge-neutral">{l.evento}</span></td>
                <td className="wrap"><b>{l.nome}</b><span className="hint" style={{ display: 'block', margin: 0 }}>{l.doc}</span></td>
                <td className="num">{l.notas}</td><td className="num">{reais(l.base)}</td>
                <td className="num">{l.inss ? reais(l.inss) : '—'}</td><td className="num">{l.irrf ? reais(l.irrf) : '—'}</td>
                <td className="num">{l.pis ? reais(l.pis) : '—'}</td><td className="num">{l.cofins ? reais(l.cofins) : '—'}</td><td className="num">{l.csll ? reais(l.csll) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Os serviços do mês com NBS, descrição, valor e o que cada nota retém (lido da nota). */
function TabelaDeServicos({ linhas }: { linhas: readonly t.painel.ServicoNaVerificacao[] }) {
  const semColunas = !linhas.some(l => l.nbs || l.descricao);
  return (
    <>
      <div className="table-wrap table-compact">
        <table>
          <thead><tr><th>Nota</th><th>NBS</th><th>Descrição</th><th className="num">Valor</th><th>Retidos</th></tr></thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={l.tipo + l.numero + i}>
                <td className="wrap"><b>{l.nome}</b><span className="hint" style={{ display: 'block', margin: 0 }}>{l.tipo} · nº {l.numero}</span></td>
                <td className="num">{l.nbs || '—'}</td>
                <td className="wrap">{l.descricao || '—'}</td>
                <td className="num">{reais(l.valor)}</td>
                <td>{l.retencoes.length
                  ? <span className="graf-marcas">{l.retencoes.map(r => <span key={r.imposto} className="badge badge-warn">{r.imposto} {reais(r.valor)}</span>)}</span>
                  : <span className="hint" style={{ margin: 0 }}>nenhuma</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {semColunas && <p className="hint">O relatório não trouxe NBS e descrição do serviço: exporte do Alterdata com essas colunas e reimporte.</p>}
    </>
  );
}

/** O DP informa o total da folha do mês (o Fiscal vê ao lado do faturamento). */
function FolhaTotal({ valor, informar }: { valor: number | null; informar?: (v: number) => void }) {
  const [texto, setTexto] = useState(valor != null ? valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
  const lido = Number(texto.replace(/\./g, '').replace(',', '.'));
  const valido = texto.trim() !== '' && Number.isFinite(lido) && lido >= 0;
  return (
    <>
      <div className="stat-grid">
        <Stat rotulo="Total da folha informado" valor={valor != null ? <Conta valor={valor} formato="reais" /> : '—'} />
      </div>
      <form className="graf-marcas" onSubmit={e => { e.preventDefault(); if (valido && informar) informar(lido); }}>
        <input className="field" inputMode="decimal" placeholder="Total da folha do mês (salários, pró-labore e encargos)" value={texto} onChange={e => setTexto(e.target.value)} style={{ maxWidth: 360 }} />
        <button type="submit" className="btn btn-primary" disabled={!valido || !informar}><Icone nome="check" />Salvar</button>
      </form>
      <p className="hint">O Fiscal vê este valor ao lado do faturamento (Conferência de Faturamento × Notas Emitidas).</p>
    </>
  );
}

/** A janela com as notas de uma linha (a janela do catálogo: a da empresa no Cadastro e a do e-mail). Fecha no ×, no Esc e fora. */
function JanelaDasNotas({ aberta, fechar }: { aberta: NotasAbertas; fechar: () => void }) {
  useEffect(() => {
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [fechar]);
  const notas = aberta.notas;
  const qtd = new Set(notas.map(n => n.numero + '|' + n.nome + '|' + n.data)).size;
  const total = notas.reduce((s, n) => s + (Number(n.valor) || 0), 0);
  const tem = (k: 'conta' | 'ncm' | 'cst' | 'cest' | 'lanc') => notas.some(n => n[k]);
  return (
    <div className="cad-janela-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="cad-janela" role="dialog" aria-modal="true" aria-label={aberta.titulo}>
        <header className="cad-janela-topo">
          <span className="cad-janela-empresa"><span className="cad-janela-nome">{aberta.titulo}</span></span>
          <button type="button" className="btn btn-ghost cad-janela-x" onClick={fechar} aria-label="Fechar" title="Fechar (Esc)"><Icone nome="x" /></button>
        </header>
        <div className="cad-janela-conteudo">
          <div className="stat-grid">
            <Stat rotulo="Notas" valor={String(qtd)} />
            <Stat rotulo="Itens" valor={String(notas.length)} />
            <Stat rotulo="Valor" valor={reais(total)} />
          </div>
          <div className="table-wrap table-compact">
            <table>
              <thead>
                <tr>
                  <th>Data</th><th>Nota</th><th>Fornecedor / cliente</th><th>CFOP</th>
                  {tem('lanc') && <th>Lanç.</th>}{tem('conta') && <th>Conta</th>}
                  {tem('ncm') && <th>NCM</th>}{tem('cst') && <th>CST</th>}{tem('cest') && <th>CEST</th>}
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {[...notas].sort((a, b) => a.data.split('/').reverse().join('').localeCompare(b.data.split('/').reverse().join('')) || a.numero.localeCompare(b.numero)).map((n, i) => (
                  <tr key={n.numero + '|' + i}>
                    <td className="num">{n.data}</td>
                    <td className="num"><b>{n.numero}</b></td>
                    <td className="wrap">{n.nome}{n.doc && <span className="hint" style={{ display: 'block', margin: 0 }}>{n.doc}</span>}</td>
                    <td className="num">{n.cfop}</td>
                    {tem('lanc') && <td className="num">{n.lanc || '—'}</td>}{tem('conta') && <td className="num">{n.conta || '—'}</td>}
                    {tem('ncm') && <td>{n.ncm || '—'}</td>}{tem('cst') && <td>{n.cst || '—'}</td>}{tem('cest') && <td>{n.cest || '—'}</td>}
                    <td className="num">{reais(n.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function SemConta({ r }: { r: t.painel.ResumoDeNotas }) {
  return r.comConta ? null : <Alerta naLinha titulo="O relatório veio sem a conta contábil" texto="O Contábil precisa dela: ligue a coluna no Alterdata e reimporte." />;
}

/** O que o relatório (início e fim) recebe do executor: o regime e as etapas que entram no mês. */
export interface DadosDoRelatorio {
  regime: string;
  etapas: readonly { id: string; nome: string; secao: string; situacao: t.SituacaoEtapa; por: string; em: string }[];
}

interface PropsDoPainel {
  painel: t.PainelDaTarefa; vm: VmPainelDoFiscal; codigo: string; competencia: string; importar: (r: t.RelatorioImportavel[]) => void;
  /** os valores da execução aberta (o total da folha que o DP informou) e como informar um */
  valores?: Record<string, number>; informar?: (chave: string, valor: number) => void;
  relatorio?: DadosDoRelatorio;
}

const SITUACAO: Record<t.SituacaoEtapa, { rotulo: string; badge: string }> = {
  pendente: { rotulo: 'A fazer', badge: 'badge-neutral' }, feita: { rotulo: 'Feita', badge: 'badge-ok' },
  dispensada: { rotulo: 'Não se aplica', badge: 'badge-neutral' }, interrompida: { rotulo: 'Parada', badge: 'badge-warn' },
};
const quando = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

/** O relatório do início: o regime, as etapas do mês, o SIEG e o que já foi importado (e o que falta). */
function RelatorioInicio({ vm, relatorio, competencia, importar }: { vm: VmPainelDoFiscal; relatorio?: DadosDoRelatorio; competencia: string; importar: (r: t.RelatorioImportavel[]) => void }) {
  const tipos: { id: t.RelatorioImportavel; notas: number; valor: number | null }[] = [
    { id: 'entradas', notas: vm.entradas.qtd, valor: vm.entradas.total }, { id: 'saidas', notas: vm.saidas.qtd, valor: vm.saidas.total },
    { id: 'tomados', notas: vm.importado.tomados, valor: null }, { id: 'prestados', notas: vm.prestados.qtd, valor: vm.prestados.total },
  ];
  const faltam = tipos.filter(x => !x.notas).map(x => x.id);
  const secoes = [...new Set((relatorio?.etapas || []).map(e => e.secao))];
  return (
    <>
      <div className="stat-grid">
        <Stat rotulo="Regime" valor={relatorio?.regime || '—'} grande={false} />
        <Stat rotulo={'Etapas em ' + t.rotuloNumericoCompetencia(competencia)} valor={<Conta valor={relatorio?.etapas.length || 0} />} />
        <Stat rotulo="Emitidas no SIEG" valor={vm.sieg ? <Conta valor={vm.sieg.emitidasNFe} /> : '—'} />
        <Stat rotulo="Recebidas no SIEG" valor={vm.sieg ? <Conta valor={vm.sieg.recebidasNFe} /> : '—'} />
      </div>
      <div className="table-wrap table-compact">
        <table>
          <thead><tr><th>Relatório do Alterdata</th><th className="num">Notas</th><th className="num">Valor</th><th>Situação</th></tr></thead>
          <tbody>
            {tipos.map(x => (
              <tr key={x.id}>
                <td>{ROTULO_DO_RELATORIO[x.id]}</td><td className="num">{x.notas || '—'}</td>
                <td className="num">{x.valor != null && x.notas ? reais(x.valor) : '—'}</td>
                <td>{x.notas ? <span className="badge badge-ok">Importado</span> : <span className="badge badge-warn">Falta</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {faltam.length > 0 && (
        <Alerta naLinha titulo={'Falta importar: ' + faltam.map(x => ROTULO_DO_RELATORIO[x]).join(', ')} texto="Importe agora ou na etapa Importação no Alterdata.">
          <button type="button" className="btn btn-outline" onClick={() => importar(faltam)}><Icone nome="upload" />Importar</button>
        </Alerta>
      )}
      {secoes.length > 0 && (
        <div className="table-wrap table-compact">
          <table>
            <thead><tr><th>O que entra no mês</th><th>Etapas</th></tr></thead>
            <tbody>
              {secoes.map(s => <tr key={s}><td><b>{s}</b></td><td className="wrap">{(relatorio?.etapas || []).filter(e => e.secao === s).map(e => e.nome).join(' · ')}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** O relatório do fim: os números do mês, cada etapa com quem fez e quando, e o que ficou pendente. */
function RelatorioFim({ vm, relatorio, competencia }: { vm: VmPainelDoFiscal; relatorio?: DadosDoRelatorio; competencia: string }) {
  const etapas = relatorio?.etapas || [];
  const abertas = etapas.filter(e => e.situacao === 'pendente' || e.situacao === 'interrompida');
  const retido = vm.servicos.reduce((s, x) => s + x.retido, 0);
  return (
    <>
      <div className="stat-grid">
        <Stat rotulo={'Faturamento de ' + t.rotuloNumericoCompetencia(competencia)} valor={<Conta valor={vm.saidas.total} formato="reais" />} cor="saida" />
        <Stat rotulo="Entradas" valor={<Conta valor={vm.entradas.total} formato="reais" />} cor="entrada" />
        <Stat rotulo="Serviços prestados" valor={<Conta valor={vm.prestados.total} formato="reais" />} />
        <Stat rotulo="Total retido" valor={<Conta valor={retido} formato="reais" />} />
        <Stat rotulo="Folha do mês (DP)" valor={vm.folhaDoDp != null ? <Conta valor={vm.folhaDoDp} formato="reais" /> : '—'} />
      </div>
      {abertas.length
        ? <Alerta naLinha titulo={abertas.length === 1 ? '1 etapa ainda aberta' : abertas.length + ' etapas ainda abertas'} texto={abertas.map(e => e.nome).join(', ')} />
        : <Alerta naLinha tom="ok" titulo="Mês fechado" texto="Todas as etapas do mês estão feitas." />}
      <div className="table-wrap table-compact">
        <table>
          <thead><tr><th>Etapa</th><th>Situação</th><th>Quem</th><th>Quando</th></tr></thead>
          <tbody>
            {etapas.map(e => (
              <tr key={e.id}>
                <td><span className="hint" style={{ margin: 0 }}>{e.secao} › </span>{e.nome}</td>
                <td><span className={'badge ' + SITUACAO[e.situacao].badge}>{SITUACAO[e.situacao].rotulo}</span></td>
                <td>{e.por || '—'}</td><td className="num">{quando(e.em) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="graf-marcas"><button type="button" className="btn btn-outline" onClick={() => window.print()}><Icone nome="impressora" />Imprimir</button></div>
    </>
  );
}

function Corpo({ painel, vm, codigo, competencia, importar, valores, informar, abrir, relatorio }: PropsDoPainel & { abrir: (n: NotasAbertas) => void }) {
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
      const fiscal = painel === 'saidas' ? vm.fiscalSaidas : vm.fiscalEntradas;
      const doXml = painel === 'saidas' ? vm.doXml.saidas : vm.doXml.entradas;
      // sem o relatório do Alterdata: o que os XMLs já mostram, e o importar
      if (!r.qtd) return doXml ? <>{vazio(painel)}{painel === 'saidas' && <ErrosDeTributacao erros={vm.errosTributacao} />}<TabelaFiscal r={fiscal} abrir={abrir} xml quando={vm.xml?.quando} /></> : vazio(painel);
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
          <TabelaPorCfop r={r} abrir={abrir} />
          {vm.xml && <ValoresNotaANota c={painel === 'saidas' ? vm.valoresSaidas : vm.valoresEntradas} />}
          {vm.xml && painel === 'saidas' && <ErrosDeTributacao erros={vm.errosTributacao} />}
          {vm.xml && <FaltamNoAlterdata faltam={painel === 'saidas' ? vm.faltamSaidas : vm.faltamEntradas} oQue={painel === 'saidas' ? 'notas emitidas' : 'notas recebidas'} baixar={c => { void vm.baixarFaltam(c); }} baixando={vm.baixandoFaltam} />}
          <TabelaFiscal r={fiscal} abrir={abrir} xml={doXml} quando={vm.xml?.quando} />
          <SemConta r={r} />
        </>
      );
    }
    case 'faturamento': {
      if (!vm.saidas.qtd && !vm.entradas.qtd) return vazio('saidas');
      const folha = vm.folhaDoDp;
      const linha = (rotulo: string, sai: ReactNode, ent: ReactNode) => <tr><td>{rotulo}</td><td className="num">{sai}</td><td className="num">{ent}</td></tr>;
      return (
        <>
          <div className="stat-grid">
            <Stat rotulo={'Faturamento de ' + comp} valor={<Conta valor={vm.saidas.total} formato="reais" />} cor="saida" />
            <Stat rotulo="Folha do mês (DP)" valor={folha != null ? <Conta valor={folha} formato="reais" /> : '—'} />
            <Stat rotulo="Folha ÷ faturamento" valor={folha != null && vm.saidas.total ? (Math.round((folha / vm.saidas.total) * 1000) / 10).toLocaleString('pt-BR') + '%' : '—'} />
          </div>
          {folha == null && <p className="hint">O DP ainda não informou o total da folha deste mês (na etapa Folha de pagamento).</p>}
          {/* saídas e entradas lado a lado (Vitor, 07/10/2026) */}
          <div className="table-wrap table-compact">
            <table>
              <thead><tr><th /><th className="num">Saídas</th><th className="num">Entradas</th></tr></thead>
              <tbody>
                {linha('Notas no Alterdata', vm.saidas.qtd, vm.entradas.qtd)}
                {linha('No SIEG', vm.sieg ? vm.sieg.emitidasNFe : '—', vm.sieg ? vm.sieg.recebidasNFe : '—')}
                {linha('Diferença', vm.sieg ? vm.saidas.qtd - vm.sieg.emitidasNFe : '—', vm.sieg ? vm.entradas.qtd - vm.sieg.recebidasNFe : '—')}
                {linha('Valor contábil', reais(vm.saidas.total), reais(vm.entradas.total))}
                {linha('CFOPs', vm.saidas.porCfop.length, vm.entradas.porCfop.length)}
              </tbody>
            </table>
          </div>
          <Veredito sieg={vm.sieg?.emitidasNFe ?? null} importadas={vm.saidas.qtd} oQue="notas emitidas" />
        </>
      );
    }
    case 'servicos': {
      if (!vm.importado.tomados && !vm.importado.prestados && !vm.doXml.servicos) return vazio('tomados');
      const comRetencao = vm.servicos.filter(s => s.retido > 0);
      return (
        <>
          <div className="stat-grid">
            <Stat rotulo="Notas de serviço" valor={<Conta valor={vm.servicos.length} />} />
            <Stat rotulo="Com retenção" valor={<Conta valor={comRetencao.length} />} />
            <Stat rotulo="Total retido" valor={<Conta valor={comRetencao.reduce((s, x) => s + x.retido, 0)} formato="reais" />} />
          </div>
          <Origem xml={vm.doXml.servicos} quando={vm.xml?.quando} />
          <TabelaDeServicos linhas={vm.servicos} />
          <ReinfDasNotas linhas={vm.reinf} />
        </>
      );
    }
    case 'pgdas':
      return <PgdasPrevia vm={vm} valores={valores} informar={informar} />;
    case 'interestaduais':
      if (!vm.entradas.qtd) return vazio('entradas');
      if (!vm.interestaduais.qtd) return <Alerta naLinha tom="ok" titulo={'Nenhuma entrada de fora do estado em ' + comp} texto="Sem Antecipação, ST ou DIFAL das entradas neste mês." />;
      return (
        <>
          <div className="stat-grid">
            <Stat rotulo="Entradas interestaduais" valor={<Conta valor={vm.interestaduais.qtd} />} />
            <Stat rotulo="Valor" valor={<Conta valor={vm.interestaduais.total} formato="reais" />} cor="entrada" />
          </div>
          <Rank linhas={vm.interestaduais.linhas.map(l => ({ chave: l.nome, nome: <><b>{l.nome}</b> <span className="hint">{l.qtd} {l.qtd === 1 ? 'nota' : 'notas'} · CFOP {l.ufCfop}</span></>, valor: l.valor, texto: reais(l.valor) }))} />
        </>
      );
    case 'relatorio-inicio':
      return <RelatorioInicio vm={vm} relatorio={relatorio} competencia={competencia} importar={importar} />;
    case 'relatorio-fim':
      return <RelatorioFim vm={vm} relatorio={relatorio} competencia={competencia} />;
    case 'folha-total':
      return <FolhaTotal valor={valores?.folha ?? null} informar={informar ? v => informar('folha', v) : undefined} />;
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
      if (!r.qtd) return <Alerta naLinha tom="ok" titulo={'Nenhum ' + imposto + ' retido em ' + comp} texto="Nenhuma nota de serviço do mês tem retenção." />;
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
    case 'guia-das':
    case 'guia-dae': {
      const chave = painel === 'guia-das' ? 'guiaDas' : 'guiaDae';
      return codigo ? <GuiaParaSubir guia={painel === 'guia-das' ? 'DAS' : 'DAE'} codigo={codigo} competencia={competencia} enviadas={valores?.[chave] ?? 0} marcar={informar ? n => informar(chave, n) : undefined} /> : null;
    }
    case 'piscofins':
      return <PisCofinsPrevia vm={vm} />;
    case 'creditos':
      return <CreditosReal vm={vm} />;
    case 'irpj':
      return <IrpjPrevia vm={vm} competencia={competencia} valores={valores} informar={informar} />;
    case 'receitas': {
      if (!vm.receita.length) return vazio('saidas');
      const receita = vm.receita.filter(f => f.classe === 'venda' || f.classe === 'st' || f.classe === 'servico').reduce((s, f) => s + f.valor, 0);
      return (
        <>
          <div className="stat-grid">
            <Stat rotulo="Receita do mês" valor={<Conta valor={receita} formato="reais" />} cor="saida" />
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
          {(pctDe('st') > 0 || pctDe('devolucao') > 0) && <Alerta naLinha titulo="Tire da base o que já teve o imposto pago antes" texto={'As saídas com ST' + (pctDe('devolucao') ? ' e as devoluções' : '') + ' não entram na base.'} />}
        </>
      );
    case 'icms':
      // pelos XMLs quando já trazem o ICMS de cada item (13/10/2026); senão, os totais do Alterdata
      if (vm.lucro?.temImpostos) return <IcmsApuracao vm={vm} valores={valores} informar={informar} />;
      if (!vm.saidas.qtd && !vm.entradas.qtd) return vazio('saidas');
      return (
        <>
          <SemImpostosNoXml vm={vm} />
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

export function PainelDaTarefa(p: PropsDoPainel) {
  const ref = useRef<HTMLDivElement>(null);
  // anima quando o painel aparece e quando os dados chegam (a importação ou o ⚡)
  const chave = p.painel + '|' + p.vm.importado.entradas + '|' + p.vm.importado.saidas + '|' + p.vm.importado.tomados + '|' + p.vm.importado.prestados + '|' + (p.vm.sieg ? 1 : 0);
  useEffect(() => { animarPainel(ref.current); }, [chave]);
  // as notas de uma linha, na janela
  const [aberta, setAberta] = useState<NotasAbertas | null>(null);
  return (
    <>
      <div ref={ref} className="graf-painel"><Corpo {...p} abrir={setAberta} /></div>
      {/* no body: a faixa animada (transform) prenderia a janela fixa dentro dela */}
      {aberta && createPortal(<JanelaDasNotas aberta={aberta} fechar={() => setAberta(null)} />, document.body)}
    </>
  );
}
