// Fiscal › Auditoria de itens (04/11/2026: o prompt "Gestor Fiscal e Auditor Tributário" adaptado como ferramenta do
// Fiscal). De cima para baixo: na barra, a planilha (xlsx, xls, ods ou csv) e "Baixar auditada"; os quatro números do
// diagnóstico combinado (Ambos, Somente ST, Somente Monofásico, Não), que filtram; e a tabela dos itens com o
// PIS/COFINS e o ICMS-ST de MG de cada um (o embasamento no título da célula). Só as peças do catálogo (Campo de arquivo,
// Botão, os números e o cartão do Fiscal, a busca curta, a Tabela padrão, o rótulo, Dica, Alerta, Vazio, Esqueleto).
import { tarefas as t } from '@nads/core';
import { Alerta, CampoArquivo, Dica, Esqueleto, Icone, useCarregando, Vazio, type NomeIcone } from '@nads/ui';
import { DIAGNOSTICOS, useAuditoriaDeItens } from './useAuditoriaDeItens';

type Diagnostico = t.auditoriaItens.Diagnostico;

const ICONE: Record<Diagnostico, NomeIcone> = { Ambos: 'check', 'Somente ST': 'recibo', 'Somente Monofásico': 'fileText', Não: 'x' };
const DICA: Record<Diagnostico, string> = {
  Ambos: 'Monofásico no PIS/COFINS e com ICMS-ST em MG',
  'Somente ST': 'Com ICMS-ST em MG; PIS/COFINS com alíquota zero ou tributado',
  'Somente Monofásico': 'Monofásico no PIS/COFINS, sem ICMS-ST em MG',
  Não: 'Nem monofásico nem ICMS-ST',
};

function SimNao({ sim }: { sim: boolean }) {
  return <span className={'badge ' + (sim ? 'badge-ok' : 'badge-neutral')}>{sim ? 'SIM' : 'NÃO'}</span>;
}

export function AuditoriaDeItens() {
  const vm = useAuditoriaDeItens();
  useCarregando(vm.lendo);
  return (
    <section className="fxr">
      <div className="tarefas-barra-topo fxr-topo">
        <CampoArquivo id="auditoria-planilha" arquivo={vm.arquivo} aceitar=".xlsx,.xls,.ods,.csv" onEscolher={f => void vm.escolher(f)} />
        <span className="tarefas-barra-espaco" />
        <button type="button" className="btn btn-primary" disabled={!vm.total} onClick={vm.baixar}><Icone nome="download" width={16} height={16} />Baixar auditada</button>
      </div>

      {vm.erro ? (
        <Alerta naLinha titulo="Não consegui ler a planilha" texto={vm.erro + ' O cabeçalho precisa ter uma coluna NCM; Descrição, CFOP, CST/CSOSN e CEST ajudam.'} />
      ) : vm.lendo ? <Esqueleto linhas={8} numeros={4} />
        : !vm.planilha ? (
          <section className="card fxr-cartao">
            <Vazio icone="fileSearch" titulo="Escolha a planilha de itens"
              texto="Uma linha por item, com o NCM (e, se tiver, a descrição, o CFOP, o CST ou CSOSN e o CEST). Cada item ganha o PIS/COFINS (monofásico, alíquota zero ou tributado) e o ICMS-ST de Minas; a planilha auditada sai com as colunas originais e mais 8. O arquivo não sai do computador." />
          </section>
        ) : !vm.total ? (
          <section className="card fxr-cartao"><Vazio icone="fileSearch" titulo="Nenhum item com NCM" texto="A coluna NCM foi achada, mas está vazia." /></section>
        ) : (
          <>
            {(vm.semDescricao || !vm.temSituacao) && (
              <Alerta naLinha titulo={vm.semDescricao ? 'Sem a coluna de descrição' : 'Sem CFOP e CST/CSOSN'}
                texto={vm.semDescricao
                  ? 'A auditoria vai só pelo NCM: confira os itens que dependem da descrição (a dupla conformidade do Anexo VII).'
                  : 'O ICMS-ST vai pelo NCM nos capítulos do Anexo VII. Com o CFOP e o CST/CSOSN da nota, o que a nota diz vale mais (ex.: CFOP 5405, CSOSN 500).'} />
            )}
            <div className="fxr-numeros fxr-numeros-4">
              {DIAGNOSTICOS.map(d => (
                <button key={d} type="button" className={'fxr-numero' + (vm.filtro === d ? ' active' : '')} aria-pressed={vm.filtro === d} title={DICA[d]} onClick={() => vm.setFiltro(d)}>
                  <span className="fxr-numero-icone"><Icone nome={ICONE[d]} width={18} height={18} /></span>
                  <span className="fxr-numero-txt">
                    <span className="fxr-numero-rotulo">{d}</span>
                    <span className="fxr-numero-valor num">{vm.contagem[d]}</span>
                  </span>
                </button>
              ))}
            </div>
            <section className="card fxr-cartao">
              <div className="fxr-cartao-topo">
                <h3 className="fxr-cartao-titulo">Itens<Dica texto="O ICMS-ST pelo NCM usa o resumo dos capítulos do Anexo VII do RICMS/MG (Dec. 48.589/2023): confira a descrição no anexo. O CFOP e o CST/CSOSN da nota, quando vêm, valem mais que o NCM." /></h3>
                <span className="fxr-total num">{vm.quantasFiltradas} de {vm.total}{vm.semNcm ? ' · ' + vm.semNcm + ' sem NCM' : ''}</span>
                <span className="tarefas-barra-espaco" />
                <label className="busca-curta">
                  <Icone nome="search" width={16} height={16} />
                  <input type="text" placeholder="Descrição ou NCM" aria-label="Buscar o item" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
                </label>
              </div>
              {!vm.linhas.length ? <Vazio compacto titulo="Nenhum item com esse filtro" /> : (
                <div className="fxr-rola">
                  <table className="table-compact fxr-tabela">
                    <thead>
                      <tr>
                        <th>NCM</th><th>Descrição</th>{vm.temSituacao && <><th>CFOP</th><th>CST/CSOSN</th></>}
                        <th>Monofásico</th><th>ICMS-ST</th><th>Diagnóstico</th><th>PIS/COFINS</th><th className="num">CST saída</th><th>Segmento ST</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vm.linhas.map((l, i) => {
                        const a = l.auditoria!;
                        return (
                          <tr key={i}>
                            <td className="num">{t.auditoriaItens.ncmLimpo(l.item.ncm)}</td>
                            <td className="wrap">{l.item.descricao || <span className="fraco">—</span>}</td>
                            {vm.temSituacao && <><td className="num">{l.item.cfop || <span className="fraco">—</span>}</td><td className="num">{l.item.csosn || l.item.cst || <span className="fraco">—</span>}</td></>}
                            <td><SimNao sim={a.monofasico} /></td>
                            <td title={a.baseSt}><SimNao sim={a.st} /></td>
                            <td>{a.diagnostico}</td>
                            <td title={a.basePisCofins}>{a.regime}</td>
                            <td className="num">{a.cstPisCofins}</td>
                            <td className="wrap" title={a.baseSt}>{a.segmentoSt}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {vm.fora > 0 && <p className="hint">Mais {vm.fora} itens: use a busca ou os números. Na planilha auditada vão todos.</p>}
            </section>
          </>
        )}
    </section>
  );
}
