// Card do resultado do Verificar por conta: abas por conta, resumo (.vc-resumo), "O que explica a
// diferença" (.vc-comp), pendências (.vc-pend) e os botões. Origem: conferencia.html ~L1299-1308;
// vcRenderResultado (~L4122-4205), vcComposicao (~L4110).
import { formatos } from '@nads/core';
import { baixarArquivo, Icone, Segmentado } from '@nads/ui';
import { useEffect, useRef } from 'react';
import type { useVerificarConta } from '../useVerificarConta';
import { AlertaVerde, SecaoVc, TabelaFaltando, TabelaVc } from './Tabelas';

type Vm = ReturnType<typeof useVerificarConta>;
type Res = NonNullable<Vm['resultado']>;
const { brl } = formatos;

function Numero({ rotulo, valor, cls }: { rotulo: string; valor: string; cls?: 'ok' | 'bad' }) {
  return <div className={'vc-num' + (cls ? ' ' + cls : '')}><p className="vc-num-rot">{rotulo}</p><p className="vc-num-val">{valor}</p></div>;
}

function Conta({ conta, fonte }: { conta: { codigo: string; nome: string }; fonte: string }) {
  return (
    <div className="vc-resumo-conta">
      <p className="vc-resumo-rot">Conta contábil</p>
      <p className="vc-resumo-nome"><b>{conta.codigo}</b> — {conta.nome}</p>
      {fonte && <p className="vc-resumo-fonte">{fonte}</p>}
    </div>
  );
}

export function Resultado({ vm, r }: { vm: Vm; r: Res }) {
  // conferiu: rola até o resultado (scrollIntoView do original)
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (vm.seqResultado) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [vm.seqResultado]);
  return (
    <div className="card" id="vcResultadoCard" ref={ref}>
      {r.abas && <Segmentado id="vcAbas" valor={r.aba} opcoes={r.abas} onMudar={vm.escolherAba} />}
      {r.porConta ? <PorConta r={r} p={r.porConta} /> : r.todas && <Todas vm={vm} r={r} t={r.todas} />}
      <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-outline" id="vcBtCsv" type="button" onClick={() => { const a = vm.csv(); if (a) baixarArquivo(a.texto, a.nome); }}>Baixar resultado</button>
        {/* Sem pendência, o "Ok" quem dá é o sistema (aviso automático que redireciona sozinho —
            ver conferir() no ViewModel). Não existe botão de Ok manual: o usuário só reconfere. */}
        <button className="btn btn-primary" id="vcBtReimportar" type="button" onClick={vm.reimportar}>Corrigi, quero reconferir</button>
      </div>
    </div>
  );
}

/** Uma conta (várias contas): o relatório dela e o que sobrou nela; faltando fica em Todas. */
function PorConta({ r, p }: { r: Res; p: NonNullable<Res['porConta']> }) {
  return (
    <>
      <div className="vc-resumo" id="vcStats">
        <Conta conta={p.conta} fonte={r.fonte} />
        <div className="vc-resumo-nums">
          <Numero rotulo="Relatório da conta" valor={brl(p.somaConta)} />
          <Numero rotulo="Pendências na conta" valor={brl(p.pendencias)} cls={p.pendZero ? 'ok' : 'bad'} />
        </div>
      </div>
      <div id="vcResultado">
        {!p.dups.length && !p.mais.length ? <AlertaVerde titulo="Nenhuma pendência nessa conta" margem="16px 0 0" /> : (
          <div className="vc-pend">
            <div className="vc-pend-head"><h3>Pendências</h3></div>
            {p.dups.length > 0 && <SecaoVc titulo={'Duplicadas na conta (' + p.dups.length + ')'} valor={p.somaDups}><TabelaVc linhas={p.dups} /></SecaoVc>}
            {p.mais.length > 0 && <SecaoVc titulo={'A mais na conta (' + p.mais.length + ')'} valor={p.somaMais}><TabelaVc linhas={p.mais} /></SecaoVc>}
          </div>
        )}
      </div>
    </>
  );
}

function Todas({ vm, r, t }: { vm: Vm; r: Res; t: NonNullable<Res['todas']> }) {
  const secaoIcms = t.icms.length > 0 && (
    <SecaoVc className="vc-secao vc-secao-icms" titulo={'ICMS (' + t.icms.length + ')'} valor={t.somaIcms}><TabelaVc linhas={t.icms} cls="" /></SecaoVc>
  );
  return (
    <>
      <div className="vc-resumo" id="vcStats">
        <Conta conta={t.conta} fonte={r.fonte} />
        <div className="vc-resumo-nums">
          <Numero rotulo={t.multi ? 'Relatório das contas' : 'Relatório da conta'} valor={brl(t.somaRazao)} />
          <Numero rotulo="Notas fiscais" valor={brl(t.somaFiscal)} />
          <Numero rotulo="Diferença" valor={brl(t.diferenca)} cls={t.zero ? 'ok' : 'bad'} />
        </div>
        {t.composicao && (
          <div className="vc-comp">
            <p className="vc-comp-tit">O que explica a diferença</p>
            <div className="vc-comp-grid">
              {t.composicao.map(it => (
                <div key={it.rotulo} className={'vc-comp-item' + (it.zero ? ' zero' : '')}>
                  <p className="vc-num-rot">{it.rotulo}</p><p className="vc-comp-val">{it.zero ? '—' : brl(it.valor)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div id="vcResultado">
        {r.limpo ? (
          <>
            <AlertaVerde titulo={'Nenhuma pendência ' + (t.multi ? 'nessas contas' : 'nessa conta')} margem="16px 0 0">
              <p className="alert-text">Todas as notas bateram com {t.multi ? 'os relatórios. As contas ficam' : 'o relatório. A conta fica'} <b>Ok</b> no Relatório.</p>
            </AlertaVerde>
            {secaoIcms && <div className="vc-pend vc-icms">{secaoIcms}</div>}
          </>
        ) : (
          <div className="vc-pend">
            <div className="vc-pend-head">
              <h3>Pendências</h3>
              {t.podeConferir && (t.conferido
                ? <button type="button" className="btn btn-sm vc-conferido-on" title="Marcada como conferida com pendências — clique pra desfazer" onClick={vm.alternarConferido}><Icone nome="check" />Conferido</button>
                : <button type="button" className="btn btn-sm btn-outline" title="Seguir com essas pendências e marcar a conta como conferida" onClick={vm.alternarConferido}>Marcar como conferido</button>)}
            </div>
            {t.faltando.length > 0 && <SecaoVc titulo={'Faltando na conta (' + t.faltando.length + ')'} valor={t.somaFaltando}><TabelaFaltando linhas={t.faltando} /></SecaoVc>}
            {t.qtdDuplicadas > 0 && <SecaoVc titulo={'Duplicadas na conta (' + t.qtdDuplicadas + ')'} valor={t.somaDuplicadas}><TabelaVc linhas={t.duplicadas} /></SecaoVc>}
            {t.aMais.length > 0 && <SecaoVc titulo={'A mais na conta (' + t.aMais.length + ')'} valor={t.somaAMais}><TabelaVc linhas={t.aMais} /></SecaoVc>}
            {secaoIcms}
          </div>
        )}
      </div>
    </>
  );
}
