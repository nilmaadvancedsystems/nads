// Embaixo do item Pró-labore do checklist da Contabilização da Folha (Vitor, 14/10/2026): o ícone de importar o razão do
// Pró-labore a pagar (importado, o check que vira × e tira) e, com ele, só a conta do crédito, o dia útil do pagamento (1º
// ao 5º do mês seguinte) e o ícone do "Importar no meu Sistema" (o .xls do Alterdata). A relação do razão não aparece.
import { CampoArquivo, Icone, MenuSuspenso, MenuSuspenso as Menu } from '@nads/ui';
import { useEffect, useId, useRef, useState } from 'react';
import { usePagamentosDoProLabore } from '../usePagamentosDoProLabore';
import { BotaoImportarNoAlterdata } from '../../../../../comum/BotaoImportarNoAlterdata';
import { BotaoDiario } from '../../../../../comum/BotaoDiario';
import { ComRoboDoRazao, MenuDeImportar } from '../../../etapas/extrator/telas/tarefa/BotaoVitorDoRazao';
import { useColunaAjustavel, ValorNaGrade } from '../../../../../comum/GradeDosMeses';
import type { PagamentosDoProLabore as VmProLabore } from '../usePagamentosDoProLabore';

/** travado: o item Pró-labore marcado no checklist — os botões ficam travados (Vitor, 14/10/2026) */
export function PagamentosDoProLabore({ empresa, codigo, contaDoItem, travado, meses, aoFicarTudoPago }: {
  empresa: string; codigo: number | null; contaDoItem: string; travado?: boolean; meses?: readonly string[];
  /** tudo pago no período: marca o item do checklist (Vitor, 18/11/2026: "dando tudo pago, voce da o check automatico"); uma vez por tela */
  aoFicarTudoPago?: () => void;
}) {
  const vm = usePagamentosDoProLabore(empresa, codigo, contaDoItem, meses);
  const marcou = useRef(false);
  useEffect(() => {
    if (!vm.tudoPago || travado || marcou.current || !aoFicarTudoPago) return;
    marcou.current = true;
    aoFicarTudoPago();
  }, [vm.tudoPago, travado, aoFicarTudoPago]);
  // gerar os lançamentos só se a pessoa quiser (18/11/2026: "so deixa a importacao se o cara quiser, nao deixa aparecer de cara"):
  // a conta, o dia útil e o Baixar ficam atrás do "Gerar lançamentos" (para todos desde 18/11/2026)
  const [gerar, setGerar] = useState(false);
  const mostrarGerar = gerar;
  const id = useId();
  // o botão Vitor (18/11/2026: "coloca o botao vitor para o robo puxar o razao"; "puxou, pode publicar"): o ⬆ ganha o menu com
  // o robô do PC dele (só para a conta dele) puxando o razão da conta do Pró-labore no período
  const contaDoRobo = contaDoItem.split(' — ')[0].trim();
  const doComputador = (
    <>
      <label htmlFor={id} className={'icon-btn icon-btn-sm imp-btn' + (travado ? ' is-locked' : '')} aria-disabled={travado || undefined} title="Importar o razão do Pró-labore a pagar (XLS da conciliação do Alterdata)" aria-label="Importar o razão do pró-labore"><Icone nome="upload" /></label>
      <CampoArquivo semCaixa id={id} aceitar=".xls,.xlsx,.ods" desabilitado={travado} onEscolher={f => { void vm.importar(f); }} />
    </>
  );
  return (
    <>
    <div className="btn-row" style={{ justifyContent: 'flex-start', alignItems: 'center' }}>
      {vm.temRazao ? (
        <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" disabled={travado} onClick={vm.remover} title={'Razão do pró-labore importado: ' + vm.arquivo + '. Clique para tirar.'} aria-label="Tirar o razão do pró-labore">
          <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
        </button>
      ) : (
        <>
          <BotaoDiario onClick={vm.usarDiario} />
          {meses && meses.length && contaDoRobo ? (
            <ComRoboDoRazao codigo={codigo} empresa={empresa} conta={contaDoRobo} meses={meses} importar={f => vm.importar(f)} retomar>
              {robo => (robo
                ? <MenuDeImportar titulo={'o razão do Pró-labore (' + contaDoRobo + ')'} aceitar=".xls,.xlsx,.ods" travado={!!travado} robo={robo} onArquivos={fs => { if (fs[0]) void vm.importar(fs[0]); }} />
                : doComputador)}
            </ComRoboDoRazao>
          ) : doComputador}
        </>
      )}
      {vm.temRazao && vm.qtd > 0 && !mostrarGerar && (
        <button type="button" className="btn btn-outline" disabled={travado} onClick={() => setGerar(true)}
          title={'Montar os ' + vm.qtd + ' pagamentos que faltam (' + vm.total + ') para importar no Alterdata'}>
          <Icone nome="plus" />Gerar lançamentos
        </button>
      )}
      {vm.temRazao && (vm.qtd ? mostrarGerar && (
        <>
          {/* a conta do pagamento no menu (18/11/2026: só o caixa e os bancos conta movimento do plano, "deixa o dropdown bonitinho") */}
          <MenuDaContaDoPagamento valor={vm.conta} nome={vm.nomeDaConta} contas={vm.contasDePagamento} travado={!!travado} onEscolher={vm.escolherConta} />
          {travado
            ? <button type="button" className="btn btn-outline" disabled>{vm.diaUtil}º dia útil</button>
            : <MenuSuspenso rotulo={vm.diaUtil + 'º dia útil'} className="btn btn-outline" dica="O dia útil do pagamento, no mês seguinte à competência" largura={160}
              itens={[1, 2, 3, 4, 5].map(n => ({ rotulo: n + 'º dia útil', marcado: vm.diaUtil === n, onClick: () => vm.escolherDiaUtil(n) }))} />}
          {/* um botão só: importar daqui ou baixar a planilha (18/11/2026; o importar está desligado, fica o Baixar) */}
          <BotaoImportarNoAlterdata {...vm.importacao} disabled={travado || !vm.podeExportar} motivo="Escolha a conta do crédito" baixar={vm.baixarXls} />
        </>
      ) : <span className="hint">O razão já zera</span>)}
    </div>
    {/* os meses, pago ou não (18/11/2026) */}
    {vm.meses && vm.meses.length > 0 && <MesesDoProLabore vm={vm} />}
    </>
  );
}

const SITUACAO: Record<NonNullable<VmProLabore['meses']>[number]['situacao'], { texto: string; classe: string }> = {
  pago: { texto: 'Pago', classe: 'badge badge-ok' },
  parcial: { texto: 'Parcial', classe: 'badge badge-warn' },
  falta: { texto: 'Não pago', classe: 'badge badge-bad' },
  sem: { texto: '—', classe: 'hint' },
};

/**
 * O pró-labore mês a mês, na grade dos meses (Vitor, 18/11/2026: "coloca um saldo mensal embaixo para eu ver quais pagamentos
 * faltam... usa aquele layout dos meses, pago ou nao pago"; "para depois decidir se quero gerar os lancamentos"): a situação
 * no alto e, embaixo, o líquido, o pago, o que falta e o saldo da conta no fim do mês.
 */
function MesesDoProLabore({ vm }: { vm: VmProLabore }) {
  const meses = vm.meses!;
  const grade = useColunaAjustavel('prolabore', '80px', meses.length);
  const linha = (rotulo: string, valor: (m: (typeof meses)[number]) => string, titulo?: string, classe?: (m: (typeof meses)[number]) => string) => (
    <tr><th scope="row" title={titulo}>{rotulo}</th>{meses.map(m => <td key={m.mes} className={'num ' + (classe ? classe(m) : '')}>{valor(m) ? <ValorNaGrade texto={valor(m)} /> : '—'}</td>)}</tr>
  );
  return (
    <div className="prolabore-meses">
      <p className="hint">{vm.resumoDosMeses}{vm.faltaDeAntes && ' · de antes do razão falta ' + vm.faltaDeAntes}</p>
      <table className="imp-meses" style={grade.tabela}>
        <colgroup><col style={{ width: grade.largura }} /></colgroup>
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Mês</span>{grade.alca}</th>
            {meses.map(m => <th key={m.mes} scope="col"><span className="imp-meses-mes">{m.rotulo}</span></th>)}
          </tr>
        </thead>
        <tbody>
          <tr><th scope="row">Situação</th>{meses.map(m => (
            <td key={m.mes} title={m.pagoEm ? 'Pago em ' + m.pagoEm : undefined}><span className={SITUACAO[m.situacao].classe}>{SITUACAO[m.situacao].texto}</span></td>
          ))}</tr>
          {linha('Líquido', m => m.liquido, 'O pró-labore do mês menos o INSS descontado: o que tem de ser pago')}
          {linha('Pago', m => m.pago, 'Os pagamentos desta competência (sem a competência no histórico, abatem das mais antigas)')}
          {linha('Falta', m => m.falta, 'O que ainda falta pagar da competência', m => (m.falta ? 'ext-neg' : ''))}
          {linha('Saldo', m => m.saldo, 'O saldo da conta no fim do mês, da coluna Saldo do razão')}
        </tbody>
      </table>
    </div>
  );
}

/** A conta do pagamento do pró-labore: o botão com o código e o nome; aberto, o caixa e os bancos (o código e, embaixo, o nome). */
function MenuDaContaDoPagamento({ valor, nome, contas, travado, onEscolher }: { valor: string; nome: string; contas: readonly { codigo: string; nome: string }[]; travado: boolean; onEscolher: (codigo: string) => void }) {
  const rotulo = valor ? valor + (nome ? ' · ' + nome : '') : 'Pagar por qual conta?';
  const menu = (
    <Menu rotulo={rotulo} className={'btn btn-outline prolabore-conta' + (valor ? '' : ' vazio')} largura={300} dica="A conta do crédito: o caixa ou o banco que pagou" flutuante
      conteudo={fechar => (
        <>
          {contas.map(c => (
            <button key={c.codigo} type="button" className="popover-item" role="menuitemradio" aria-checked={c.codigo === valor}
              onClick={() => { fechar(); onEscolher(c.codigo); }}>
              <Icone nome={/caixa/i.test(c.nome) ? 'dinheiro' : 'landmark'} />
              <span className="popover-texto"><b>{c.codigo}</b><br /><span className="hint">{c.nome}</span></span>
              {c.codigo === valor && <Icone nome="check" />}
            </button>
          ))}
          {!contas.length && <p className="hint">Sem o plano de contas: importe o balancete na Conferência.</p>}
        </>
      )} />
  );
  return travado ? <span className="seletor-travado" inert aria-disabled="true">{menu}</span> : menu;
}
