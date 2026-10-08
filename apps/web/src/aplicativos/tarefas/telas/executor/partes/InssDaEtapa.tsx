// A conferência do INSS na etapa da folha, no desenho da Importação do banco (Vitor, 05/10/2026): a linha "INSS a recolher"
// com o Razão (XLS) e as Guias (PDF dos comprovantes) à direita, a grade dos meses (provisão, guia, diferença, baixa; clicar
// abre o mês) e a faixa Lançamentos sugeridos (o Grupo a grupo saiu: Vitor, 07/10/2026); embaixo, o fechamento do saldo.
import { Icone, LogoInss } from '@nads/ui';
import { useId, useState } from 'react';
import { FaixaQueAbre } from '../../../../../comum/FaixaQueAbre';
import type { InssDaEtapa as Inss } from '../useInssDaEtapa';
import { BotaoDeTeste, type ItemDeTeste } from '../../../../../comum/BotaoDeTeste';
import { useColunaAjustavel, ValorNaGrade } from '../../../../../comum/GradeDosMeses';
import type { RazaoDaFolha as VmFolha } from '../useRazaoDaFolha';
import { RazaoDaFolha } from './RazaoDaFolha';
import { MenuDeConta } from '../../../../extratudo/ferramentas/creditor/partes/MenuDeConta';

const BAIXA: Record<Inss['meses'][number]['baixa'], string> = { ok: '✓', falta: 'Falta', depois: 'Depois', fora: '—', 'sem-guia': '—' };

function Importar({ id, titulo, aceitar, varios, lendo, onArquivos }: { id: string; titulo: string; aceitar: string; varios?: boolean; lendo?: boolean; onArquivos: (fs: File[]) => void }) {
  if (lendo) return <span className="icon-btn icon-btn-sm imp-btn" title="Lendo…"><span className="btn-spinner" /></span>;
  return (
    <>
      <label htmlFor={id} className="icon-btn icon-btn-sm imp-btn" title={'Importar ' + titulo} aria-label={'Importar ' + titulo}><Icone nome="upload" /></label>
      <input id={id} type="file" multiple={varios} accept={aceitar} className="sr-only"
        onChange={e => { const fs = Array.from(e.target.files || []); e.target.value = ''; onArquivos(fs); }} />
    </>
  );
}

function Importado({ titulo, onExcluir }: { titulo: string; onExcluir: () => void }) {
  return (
    <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={onExcluir} title={titulo + ': importado. Clique para excluir.'} aria-label={'Excluir ' + titulo}>
      <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
    </button>
  );
}

export function InssDaEtapa({ inss, conferir, teste = [], folha, so }: {
  /** só uma parte (as abas Salários / INSS / FGTS da tela; Vitor, 07/10/2026); sem isso, tudo junto */
  so?: 'salarios' | 'inss' | 'fgts';
  inss: Inss; conferir?: string[]; teste?: ItemDeTeste[];
  /** as linhas de Salários a pagar e FGTS a recolher (a tela da etapa; Vitor, 07/10/2026) */
  folha?: { salarios: VmFolha; fgts: VmFolha };
}) {
  const idRazao = useId();
  const idGuias = useId();
  const [aberta, setAberta] = useState(true);
  const grade = useColunaAjustavel('inss', '96px', inss.meses.length);
  const salarios = folha?.salarios;
  const fgts = folha?.fgts;
  // o ⚡ de cada coisa a importar: o razão e as guias do INSS separados (para testar as guias também)
  const dev = teste.length > 0;
  const testeRazao: ItemDeTeste[] = dev ? [{ rotulo: 'Razão do INSS de teste', onClick: inss.implantarRazaoDeTeste }] : [];
  const testeGuias: ItemDeTeste[] = dev ? [{ rotulo: 'Guias do INSS de teste', onClick: inss.implantarGuiasDeTeste }] : [];
  return (
    <div className="executor-razao">
      <div className="imp-lista">
        {/* na ordem do nome da etapa: Salários, INSS e FGTS */}
        {salarios && (!so || so === 'salarios') && <RazaoDaFolha vm={salarios} dev={dev} />}
        {(!so || so === 'inss') && <div className="imp-bloco">
          <div className="imp-linha">
            <button type="button" className={'imp-seta' + (aberta ? ' aberta' : '')} aria-expanded={aberta} disabled={!inss.pronto}
              title={aberta ? 'Recolher a conferência' : 'Abrir a conferência'} aria-label="A conferência do INSS" onClick={() => setAberta(a => !a)}>
              <Icone nome="caretDown" />
            </button>
            {/* o logo do INSS (Vitor, 07/10/2026): cinza até importar */}
            <span className="imp-ico imp-logo"><LogoInss cor={inss.temRazao || inss.temGuias} /></span>
            <div className="imp-txt">
              <span><b>INSS a recolher</b>{inss.arquivoRazao && <span className="imp-conta">{inss.arquivoRazao}</span>}</span>
            </div>
            <div className="imp-resumo">{inss.resumo.length > 0 && <div>{inss.resumo.map(x => <span key={x}>{x}</span>)}</div>}</div>
            <div className="imp-grupos">
              <div className="imp-grupo" aria-label="Razão do INSS a recolher">
                <span className="imp-rotulo">Razão</span>
                {inss.temRazao ? <Importado titulo="o razão do INSS" onExcluir={inss.removerRazao} />
                  : <><BotaoDeTeste itens={testeRazao} /><Importar id={idRazao} titulo="o razão do INSS a recolher (XLS da conciliação do Alterdata)" aceitar=".xls,.xlsx,.ods" onArquivos={fs => { void inss.importarRazao(fs[0] || null); }} /></>}
              </div>
              <div className="imp-grupo" aria-label="Guias do INSS">
                <span className="imp-rotulo">Guias</span>
                {inss.temGuias ? <Importado titulo="as guias do INSS" onExcluir={inss.removerGuias} />
                  : <><BotaoDeTeste itens={testeGuias} /><Importar id={idGuias} titulo="as guias do INSS (PDF dos comprovantes de arrecadação)" aceitar=".pdf" varios lendo={inss.lendo} onArquivos={fs => { void inss.importarGuias(fs); }} /></>}
              </div>
            </div>
          </div>
          {inss.pronto && aberta && (
            <>
              <div className="imp-periodo-linha">
                <table className="imp-meses" style={grade.tabela}>
                  <colgroup><col style={{ width: grade.largura }} /></colgroup>
                  <thead>
                    <tr>
                      <th scope="col"><span className="sr-only">Mês</span>{grade.alca}</th>
                      {inss.meses.map(m => (
                        <th key={m.mes} scope="col" className={m.mes === inss.mesAberto ? 'atual' : undefined}>
                          <button type="button" className="imp-meses-mes" aria-current={m.mes === inss.mesAberto ? 'true' : undefined} onClick={() => inss.abrirMes(m.mes)}
                            title={m.mes === inss.mesAberto ? 'Voltar para o período todo' : 'Ver só ' + m.rotulo}>{m.rotulo}</button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr><th scope="row">Provisão</th>{inss.meses.map(m => <td key={m.mes} className={'num' + (m.mes === inss.mesAberto ? ' atual' : '')} title={m.foraDoRazao ? 'O razão começa depois deste mês' : undefined}>{m.foraDoRazao ? 'fora do razão' : <ValorNaGrade texto={m.provisao} />}</td>)}</tr>
                    <tr><th scope="row">Guia</th>{inss.meses.map(m => <td key={m.mes} className={'num' + (m.mes === inss.mesAberto ? ' atual' : '')}>{m.guia ? <ValorNaGrade texto={m.guia} /> : '—'}</td>)}</tr>
                    <tr><th scope="row">Diferença</th>{inss.meses.map(m => <td key={m.mes} className={'num' + (m.mes === inss.mesAberto ? ' atual' : '') + (m.diferenca && !m.bate ? ' ext-neg' : '')}>{m.diferenca ? <ValorNaGrade texto={m.diferenca} /> : '—'}</td>)}</tr>
                    <tr><th scope="row">Baixa</th>{inss.meses.map(m => (
                      <td key={m.mes} className={(m.mes === inss.mesAberto ? 'atual' : '') + (m.baixa === 'falta' ? ' ext-neg' : '')}
                        title={m.baixa === 'falta' ? 'Guia paga em ' + m.pagaEm + ' sem a baixa no razão' : m.baixa === 'depois' ? 'Paga em ' + (m.pagaEm || '?') + ', depois do período' : m.pagaEm ? 'Paga em ' + m.pagaEm : undefined}>
                        {BAIXA[m.baixa]}
                      </td>
                    ))}</tr>
                  </tbody>
                </table>
              </div>
              <FaixaQueAbre titulo="Lançamentos sugeridos" qtd={inss.sugestoes.length} aviso={inss.sugestoes.length > 0}>
                <div className="imp-mov-caixa">
                  {/* numa linha só (Vitor, 08/10/2026): o período, a conta do INSS a recolher (o mesmo menu de conta da tabela;
                      travada quando vem do balancete) e o Importar no meu Sistema (o .xls do Alterdata, as 8 colunas do Creditor) */}
                  <div className="tarefas-barra-topo">
                    <span className="imp-mov-periodo">Mostrando {inss.mostrando}</span>
                    {inss.sugestoes.length > 0 && (
                      <>
                        <span className="hint">Crédito</span>
                        <MenuDeConta valor={inss.contaInss} contas={inss.contas} onEscolher={inss.setContaInss} travado={inss.contaTravada} />
                        {inss.nomeDaContaInss && <span className="hint" title={inss.contaTravada ? 'Do balancete da empresa' : undefined}>{inss.nomeDaContaInss}</span>}
                        <span className="tarefas-barra-espaco" />
                        {inss.faltaContrapartida > 0 && <span className="hint">Falta a contrapartida de {inss.faltaContrapartida} {inss.faltaContrapartida === 1 ? 'lançamento' : 'lançamentos'}</span>}
                        <button type="button" className="btn btn-primary" disabled={!inss.podeExportar} onClick={inss.baixarXls}
                          title={inss.podeExportar ? 'Baixar o .xls de importação do Alterdata com todos os lançamentos do período' : 'Informe a conta do INSS a recolher e a contrapartida de cada lançamento'}>
                          <Icone nome="download" />Importar no meu Sistema
                        </button>
                      </>
                    )}
                  </div>
                  {!inss.sugestoes.length ? <p className="hint">Nada a lançar: o razão bate com as guias.</p> : (
                    <div className="imp-mov">
                      <table className="table-compact">
                        <thead><tr><th>Mês</th><th>Débito</th><th className="num">Valor</th><th>Histórico</th></tr></thead>
                        <tbody>
                          {inss.sugestoes.map(s => (
                            <tr key={s.id}>
                              <td>{s.mes}</td>
                              {/* só o Débito (Vitor, 07/10/2026: sem Tipo e sem Crédito — o crédito é o INSS a recolher, a conta de cima):
                                  a contrapartida de cada lançamento; quando ela é o crédito (provisão a maior), o aviso embaixo */}
                              <td>
                                <MenuDeConta valor={s.contrapartida} contas={inss.contas} onEscolher={c => inss.escolherContrapartida(s.chave, c)} />
                                <span className="hint" style={{ display: 'block', marginTop: 2 }}>{s.nomeDaContrapartida}{s.lado === 'credito' ? ' · vai a crédito (o INSS a recolher a débito)' : ''}</span>
                              </td>
                              <td className="num">{s.valor}</td>
                              <td className="wrap">{s.historico}</td>
                            </tr>
                          ))}
                          <tr className="imp-mov-anterior"><td colSpan={2}>Total</td><td className="num">{inss.totalSugerido}</td><td /></tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                  {inss.pagamentosSemGuia.length > 0 && (
                    <p className="hint">Pagamentos no razão sem guia com o mesmo valor: {inss.pagamentosSemGuia.join(' · ')}</p>
                  )}
                </div>
              </FaixaQueAbre>
              {inss.fechamento && (
                <div className="imp-faixa">
                  <div className="imp-faixa-corpo imp-mov-caixa">
                    <p>
                      <b>Fechamento em {inss.fechamento.fim}:</b> o razão está em {inss.fechamento.razao}; com os lançamentos sugeridos, fica em {inss.fechamento.ajustado}.
                      O certo é {inss.fechamento.esperado} (as guias pagas depois do período).
                    </p>
                    {inss.fechamento.antes
                      ? <p className="hint">Sobram {inss.fechamento.antes} que vêm de antes de {inss.fechamento.inicio}: importe o razão desde o mês anterior para achar.</p>
                      : <p className="hint">Com os lançamentos sugeridos, o saldo fecha.</p>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>}
        {fgts && (!so || so === 'fgts') && <RazaoDaFolha vm={fgts} dev={dev} />}
      </div>
      {(so === 'inss' ? !inss.temRazao && !inss.temGuias : !so && !inss.pronto && !inss.temRazao && !inss.temGuias && !salarios?.temRazao && !fgts?.temRazao) && (
        <div className="gh-blank">
          <Icone nome="checklist" />
          <h4>O que conferir</h4>
          {conferir && <ul className="executor-conferir">{conferir.map(x => <li key={x}>{x}</li>)}</ul>}
          <p>Importe nos ícones acima o razão de Salários a pagar e do FGTS a recolher (fica credor ou zera) e, para conferir o INSS, o razão do INSS a recolher e o PDF das guias pagas. Todos são opcionais.</p>
        </div>
      )}
    </div>
  );
}
