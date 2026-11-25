// Controle Forestry (o Controle contábil; 23/11/2026: a planilha "CONTROLE CONTÁBIL 2026" do Contábil no nads), no desenho do
// painel do DP (25/11/2026): a barra dos filtros e a linha do resumo com a busca e os ícones; a tabela no desenho do Relatório
// do Fiscal. Cada empresa: o mês feito (o menu JAN…DEZ, com a sugestão do executor ao lado), a
// situação calculada, a pendência e o menu ⋯ (abrir a empresa, não acompanhar, tirar do controle). Os dados e as ações
// são os do useControleDoContabil; a prévia da planilha abre na JanelaDaImportacao.
import { tarefas as t } from '@nads/core';
import { baixarBytes, Esqueleto, Icone, LogoExcel, MenuSuspenso, useCarregando, useRetorno } from '@nads/ui';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { MenuDeFiltro } from '../../dp/MenuDeFiltro';
import { Valor } from '../../fiscal/relatorio/PartesDoRelatorio';
import { JanelaDaImportacao } from './JanelaDaImportacao';
import { useControleDoContabil, type VmControleDoContabil } from './useControleDoContabil';
import './controleDoContabil.css';

type Linha = VmControleDoContabil['linhas'][number];

function MesFeito({ r, vm }: { r: Linha; vm: VmControleDoContabil }) {
  const rotulo = r.linha.feitaAte ? t.rotuloDoMesFeito(r.linha.feitaAte) : '—';
  const dica = 'Contabilidade de ' + r.nome + ' feita até: ' + (r.linha.feitaAte ? rotulo : 'nenhum mês');
  return (
    <span className="cc-mes">
      {vm.podeGravar ? (
        <MenuSuspenso className="cc-mes-botao" flutuante compacto titulo={'Feita até — ' + r.nome} dica={dica} rotulo={rotulo}
          itens={[{ valor: 0, rotulo: '— nenhum mês' }, ...vm.meses].map(m => ({
            rotulo: m.rotulo, marcado: m.valor === r.linha.feitaAte, onClick: () => vm.mudarMes(r.codigo, m.valor),
          }))} />
      ) : <span className="cc-mes-botao leitura" title={dica}>{rotulo}</span>}
      {r.sugestao != null && vm.podeGravar && (
        <button type="button" className="cc-sugestao" onClick={() => vm.aceitarSugestao(r.codigo)}
          title={'A rotina do Contábil está concluída no executor até ' + t.rotuloDoMesFeito(r.sugestao) + ': clique para marcar feita até ' + t.rotuloDoMesFeito(r.sugestao)}>
          <Icone nome="check" width={11} height={11} />{t.rotuloDoMesFeito(r.sugestao)}?
        </button>
      )}
    </span>
  );
}

export function ControleDoContabil() {
  const vm = useControleDoContabil();
  const f = vm.filtros;
  const navegar = useNavigate();
  const { modal } = useRetorno();
  useCarregando(vm.carregando);
  const [empresa, setEmpresa] = useState('');
  const arquivo = useRef<HTMLInputElement>(null);

  function adicionar(e: FormEvent) {
    e.preventDefault();
    if (vm.adicionar(empresa)) setEmpresa('');
  }
  async function naoAcompanhar(r: Linha) {
    let motivo = 'Arrendada';
    const ok = await modal({
      icone: 'pasta', titulo: 'Não acompanhar ' + r.nome + '?', texto: 'A empresa fica cinza no controle de ' + vm.ano + ' e sai da conta dos atrasos. Escreva o motivo:',
      corpo: <input type="text" className="input cc-motivo" defaultValue={motivo} maxLength={t.MAX_MOTIVO_PAUSA} aria-label="O motivo" autoFocus onChange={e => { motivo = e.target.value; }} />,
      botoes: [{ rotulo: 'Não acompanhar', valor: true, variante: 'btn-primary' }, { rotulo: 'Voltar', valor: false, variante: 'btn-outline' }],
    });
    if (ok) vm.pausar(r.codigo, motivo.trim() || 'Não acompanhar');
  }
  async function tirar(r: Linha) {
    const ok = await modal({
      icone: 'alert', titulo: 'Tirar ' + r.nome + ' do controle de ' + vm.ano + '?', texto: 'O mês feito e a observação dela somem deste ano. A empresa continua no Cadastro.',
      botoes: [{ rotulo: 'Tirar', valor: true, variante: 'btn-danger' }, { rotulo: 'Voltar', valor: false, variante: 'btn-outline' }],
    });
    if (ok) void vm.tirar(r.codigo);
  }
  const resumo: { valor: t.SituacaoContabil; rotulo: string; n: number }[] = [
    { valor: 'em-dia', rotulo: 'em dia', n: vm.resumo.emDia },
    { valor: 'atrasada', rotulo: vm.resumo.atrasadas === 1 ? 'atrasada' : 'atrasadas', n: vm.resumo.atrasadas },
    { valor: 'nao-iniciada', rotulo: vm.resumo.naoIniciadas === 1 ? 'não iniciada' : 'não iniciadas', n: vm.resumo.naoIniciadas },
    { valor: 'pausada', rotulo: 'não acompanhar', n: vm.resumo.pausadas },
  ];
  const listaId = 'cc-empresas-fora';

  // as barras no desenho do painel do DP (25/11/2026: "faz no mesmo estilo da do departamento pessoal"): os filtros em cima; embaixo, o
  // resumo à esquerda e, à direita, a busca e só os ícones (o Excel, o + Empresa e a planilha). A tabela é a de antes, a do Relatório
  // do Fiscal (25/11/2026: "curti mais o outro layout… da tabela"), com a faixa da situação à esquerda e a etiqueta
  return (
    <section className="dp-painel cc">
      <div className="tarefas-barra-topo dp-filtros-linha">
        <MenuSuspenso icone="calendar" className="btn btn-primary" rotulo={String(vm.ano)} titulo="Ano" dica="Trocar o ano"
          itens={vm.anos.map(a => ({ rotulo: String(a), marcado: a === vm.ano, onClick: () => vm.setAno(a) }))} />
        <MenuDeFiltro rotulo="Responsável" valor={f.responsavel} mudar={f.setResponsavel} opcoes={f.responsaveis} />
        <MenuDeFiltro rotulo="Situação" valor={f.situacao} mudar={f.setSituacao} opcoes={f.situacoes} todos="Todas" />
        <MenuDeFiltro rotulo="Regime" valor={f.regime} mudar={f.setRegime} opcoes={f.regimes} />
        {f.algum && <button type="button" className="btn btn-ghost dp-limpar" onClick={f.limpar}><Icone nome="x" />Limpar filtros</button>}
      </div>
      {vm.exemplos && <p className="hint drive-aviso">Dados de exemplo: o que se escreve fica só nesta aba.</p>}
      {!vm.podeGravar && <p className="hint">Só o Contábil preenche o controle; você está vendo.</p>}
      {vm.falhou && <p className="hint cc-erro">Não deu para ler o controle de {vm.ano}: confira a internet (ou a permissão do banco) e recarregue.</p>}

      {vm.carregando ? <Esqueleto linhas={8} /> : (
        <>
          <div className="tarefas-barra-topo dp-filtros-linha">
            <span className="cc-resumo" title={vm.esperado ? 'Em dia = feita até ' + vm.rotuloEsperado + '/' + vm.ano : undefined}>
              {resumo.map(s => (
                <button key={s.valor} type="button" className={'cc-resumo-item cc-' + s.valor + (f.situacao === s.valor ? ' ativo' : '')} disabled={!s.n && f.situacao !== s.valor}
                  onClick={() => f.setSituacao(f.situacao === s.valor ? '' : s.valor)} aria-pressed={f.situacao === s.valor}>
                  <b>{s.n}</b> {s.rotulo}
                </button>
              ))}
              {vm.esperado > 0 && <span className="hint cc-esperado">esperado: feita até {vm.rotuloEsperado}</span>}
            </span>
            <span className="tarefas-barra-espaco" />
            <label className="busca-curta">
              <Icone nome="search" />
              <input type="text" value={f.busca} onChange={e => f.setBusca(e.target.value)} placeholder="Buscar cliente" aria-label="Buscar cliente (nome, código ou observação)"
                onKeyDown={e => { if (e.key === 'Escape') f.setBusca(''); }} />
            </label>
            <button type="button" className="icon-btn" title="Exportar a tabela para o Excel" aria-label="Exportar a tabela para o Excel" disabled={!vm.linhas.length}
              onClick={() => { const x = vm.exportar(); baixarBytes(x.bytes, x.nome, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }}>
              <LogoExcel />
            </button>
            {vm.podeGravar && (
              <>
                {/* pôr uma empresa no controle (ou trazer as minhas do Cadastro), num menu do + */}
                <MenuSuspenso className="icon-btn" semSeta direita largura={320} titulo="Pôr empresa no controle" dica="Pôr empresa no controle" rotulo={<Icone nome="plus" />}
                  conteudo={fechar => (
                    <form className="cc-novo" onSubmit={e => { adicionar(e); fechar(); }}>
                      <input type="text" list={listaId} value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Empresa (código ou nome)" aria-label="Empresa para pôr no controle" autoFocus />
                      <datalist id={listaId}>{vm.paraAdicionar.map(x => <option key={x} value={x} />)}</datalist>
                      <button type="submit" className="btn btn-sm btn-primary" disabled={!empresa.trim()}><Icone nome="plus" />Pôr no controle</button>
                      {vm.minhasFora > 0 && (
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => { fechar(); void vm.trazerMinhas(); }} title="As empresas em que você é o responsável do Contábil no Cadastro e que ainda não estão no controle">
                          <Icone nome="usuario" />Trazer as minhas ({vm.minhasFora})
                        </button>
                      )}
                    </form>
                  )} />
                <button type="button" className="icon-btn" onClick={() => arquivo.current?.click()} title="Importar a planilha do Controle Forestry (.xlsx): mostra o que muda antes de gravar" aria-label="Importar planilha">
                  <Icone nome="fileUp" />
                </button>
                <input ref={arquivo} type="file" accept=".xlsx,.xls,.csv" hidden aria-label="A planilha do Controle Forestry"
                  onChange={e => { const a = e.target.files?.[0]; e.target.value = ''; if (a) void vm.lerArquivo(a); }} />
              </>
            )}
          </div>
          <section className="card fr-cartao" aria-label={'Controle Forestry ' + vm.ano}>
            {!vm.total ? (
              <div className="hint dp-vazio cc-vazio">
                <p>Nenhuma empresa no controle de {vm.ano}.</p>
                {vm.podeGravar && <p>Importe a planilha, ponha as empresas pelo <b>+</b> ou <button type="button" className="btn btn-sm btn-outline" onClick={() => void vm.copiarDoAnoAnterior()}>copie a lista de {vm.ano - 1}</button></p>}
              </div>
            ) : !vm.linhas.length ? <p className="hint dp-vazio">Nenhuma empresa com esses filtros.</p> : (
              <div className="fr-rola">
                <table className="fr-tabela cc-tabela">
                  <colgroup>
                    <col className="cc-c-cod" /><col className="cc-c-nome" /><col className="cc-c-regime" /><col className="cc-c-resp" />
                    <col className="cc-c-mes" /><col className="cc-c-sit" /><col className="cc-c-obs" /><col className="cc-c-acoes" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="fr-num">Nº</th><th>Empresa</th><th>Regime</th><th>Responsável</th>
                      <th className="fr-g" title="O último mês com a contabilidade feita">Feita até</th><th>Situação</th><th className="fr-g">Observações</th><th aria-label="Ações" />
                    </tr>
                  </thead>
                  <tbody>
                    {vm.linhas.map(r => (
                      <tr key={r.codigo} className={'cc-' + r.situacao + (r.atraso >= 2 ? ' cc-forte' : '')}>
                        <td className="fr-num fr-cod">{r.codigo}</td>
                        <td className="fr-cliente"><span title={r.noCadastro ? r.nome : r.nome + ' (não está no Cadastro)'}>{r.nome}</span></td>
                        <td className="cc-texto">{r.regime || '—'}</td>
                        <td className="cc-texto">{r.responsavel || '—'}</td>
                        <td className="fr-g"><MesFeito r={r} vm={vm} /></td>
                        <td><span className={'cc-sit cc-sit-' + r.situacao + (r.atraso >= 2 ? ' cc-forte' : '')} title={r.linha.pausada ? 'Não acompanhar: ' + r.linha.pausada : r.rotulo}>{r.linha.pausada ? r.linha.pausada : r.rotulo}</span></td>
                        <td className="fr-g"><Valor largo estreito valor={r.linha.observacao} rotulo={'Observação de ' + r.nome} pode={vm.podeGravar} aoSalvar={v => vm.mudarObservacao(r.codigo, v)} /></td>
                        <td className="fr-centro">
                          <MenuSuspenso className="icon-btn cc-acoes" flutuante compacto semSeta direita titulo={r.nome} dica={'Mais de ' + r.nome} rotulo={<Icone nome="mais" />}
                            itens={[
                              ...(r.caminho ? [{ rotulo: 'Abrir a empresa no mês que falta', onClick: () => navegar(r.caminho) }] : []),
                              ...(vm.podeGravar ? [
                                r.linha.pausada
                                  ? { rotulo: 'Voltar a acompanhar', onClick: () => vm.pausar(r.codigo, '') }
                                  : { rotulo: 'Não acompanhar…', onClick: () => void naoAcompanhar(r) },
                                { rotulo: 'Tirar do controle de ' + vm.ano, perigo: true, onClick: () => void tirar(r) },
                              ] : []),
                            ]} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      {vm.previa && <JanelaDaImportacao vm={vm} />}
    </section>
  );
}
