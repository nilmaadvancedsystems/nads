// Fiscal › Auditoria de itens (04/11/2026: o prompt "Gestor Fiscal e Auditor Tributário" adaptado como ferramenta do
// Fiscal). De cima para baixo: na barra, a planilha (xlsx, xls, ods ou csv) e "Exportar Excel" (opcional); os quatro
// números do diagnóstico combinado (Ambos, Somente ST, Somente Monofásico, Não), que filtram; e a tabela auditada na
// própria tela (04/11/2026: "eu queria que abrisse no proprio app uma tabela, não exportar direto pra excel"): todas as
// colunas da planilha, o NCM e a descrição parados na frente, e as 8 colunas da auditoria com os selos nas cores do
// prompt (verde, azul, amarelo, cinza). Só as peças do catálogo (Campo de arquivo, Botão, os números e o cartão do Fiscal,
// a busca curta, a Tabela da auditoria, o Selo da auditoria, Dica, Alerta, Vazio, Esqueleto).
import { tarefas as t } from '@nads/core';
import { Alerta, CampoArquivo, Dica, Esqueleto, Icone, useCarregando, Vazio, type NomeIcone } from '@nads/ui';
import { DIAGNOSTICOS, useAuditoriaDeItens } from './useAuditoriaDeItens';

type Valor = t.auditoriaItens.Valor;
const COLUNAS = t.auditoriaItens.COLUNAS_DA_AUDITORIA;
/** as colunas de texto longo da auditoria (o embasamento e o segmento): uma linha só, inteiras no título */
const LONGAS = new Set([5, 6, 7]);

/** o valor da planilha como aparece na tela: a data em dd/mm/aaaa, o número no jeito brasileiro */
function mostrar(v: Valor): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toLocaleDateString('pt-BR');
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  return String(v);
}

/** a cor do selo de uma coluna da auditoria (k = 0…7), as mesmas do Excel exportado; null = texto simples */
function corDoSelo(k: number, v: string): 'verde' | 'azul' | 'amarelo' | 'cinza' | null {
  if (k === 0) return v === 'SIM' ? 'azul' : v === 'NÃO' ? 'cinza' : null;
  if (k === 1) return v === 'SIM' ? 'verde' : v === 'NÃO' ? 'cinza' : null;
  if (k === 2) return v === 'Ambos' ? 'verde' : v === 'Somente Monofásico' ? 'azul' : v === 'Somente ST' ? 'amarelo' : v === 'Não' ? 'cinza' : null;
  if (k === 3) return v === 'Alíquota Zero' ? 'amarelo' : null;
  return null;
}

type Diagnostico = t.auditoriaItens.Diagnostico;

const ICONE: Record<Diagnostico, NomeIcone> = { Ambos: 'check', 'Somente ST': 'recibo', 'Somente Monofásico': 'fileText', Não: 'x' };
const DICA: Record<Diagnostico, string> = {
  Ambos: 'Monofásico no PIS/COFINS e com ICMS-ST em MG',
  'Somente ST': 'Com ICMS-ST em MG; PIS/COFINS com alíquota zero ou tributado',
  'Somente Monofásico': 'Monofásico no PIS/COFINS, sem ICMS-ST em MG',
  Não: 'Nem monofásico nem ICMS-ST',
};

/** as colunas paradas na frente: o NCM e, se veio, a descrição */
const fixa = (n: number, paradas: number) => (n === 0 ? 'aud-fixa aud-fixa-1' : n === 1 && paradas === 2 ? 'aud-fixa aud-fixa-2' : undefined);

export function AuditoriaDeItens() {
  const vm = useAuditoriaDeItens();
  useCarregando(vm.lendo);
  return (
    <section className="fxr">
      <div className="tarefas-barra-topo fxr-topo">
        <CampoArquivo id="auditoria-planilha" arquivo={vm.arquivo} aceitar=".xlsx,.xls,.ods,.csv" onEscolher={f => void vm.escolher(f)} />
        <span className="tarefas-barra-espaco" />
        <button type="button" className="btn btn-outline" disabled={!vm.total} onClick={vm.baixar} title="A mesma tabela num .xlsx, com as cores"><Icone nome="download" width={16} height={16} />Exportar Excel</button>
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
                  <input type="text" placeholder="Buscar na tabela" aria-label="Buscar o item" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
                </label>
              </div>
              {!vm.linhas.length ? <Vazio compacto titulo="Nenhum item com esse filtro" /> : (
                <div className="fxr-rola">
                  <table className="table-compact aud-tabela">
                    <thead>
                      <tr>
                        {vm.ordem.map((c, n) => <th key={'o' + c} className={fixa(n, vm.paradas)}>{vm.planilha!.cabecalho[c]}</th>)}
                        {COLUNAS.map((h, k) => <th key={h} className={k === 0 ? 'aud-primeira' : undefined}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {vm.linhas.map((l, i) => (
                        <tr key={i}>
                          {vm.ordem.map((c, n) => {
                            const v = l.valores[c];
                            const classe = [fixa(n, vm.paradas), typeof v === 'number' || n === 0 ? 'num' : ''].filter(Boolean).join(' ');
                            return <td key={'o' + c} className={classe || undefined} title={n === 1 && vm.paradas === 2 ? mostrar(v) : undefined}>{n === 0 ? t.auditoriaItens.ncmLimpo(l.item.ncm) : mostrar(v)}</td>;
                          })}
                          {t.auditoriaItens.valoresDaAuditoria(l.auditoria).map((v, k) => {
                            const cor = corDoSelo(k, v);
                            const classe = [k === 0 ? 'aud-primeira' : '', LONGAS.has(k) ? 'aud-longa' : k === 4 ? 'num' : ''].filter(Boolean).join(' ');
                            return <td key={k} className={classe || undefined} title={LONGAS.has(k) ? v : undefined}>{cor ? <span className={'badge aud-selo aud-' + cor}>{v}</span> : v}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {vm.fora > 0 && <p className="hint">Mais {vm.fora} itens: use a busca ou os números. No Excel exportado vão todos.</p>}
            </section>
          </>
        )}
    </section>
  );
}
