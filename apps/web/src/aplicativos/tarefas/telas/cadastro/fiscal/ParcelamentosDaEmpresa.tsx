// Cadastro › a empresa › Fiscal › Parcelamentos (Heverton, 20/10/2026: "Parcelamento (inserir dados)"): a lista (o
// órgão, a modalidade, o número, as pagas, o valor, o vencimento, a próxima e a situação) e o cadastro ou a edição logo
// abaixo. Os mesmos parcelamentos da página do Entregas. Peças do catálogo: ConfigSecao, Tabela padrão, MenuSuspenso,
// Segmentado, Vazio, Esqueleto.
import { BotaoIcone, ConfigSecao, Esqueleto, Icone, MenuSuspenso, Segmentado, useCarregando, Vazio } from '@nads/ui';
import { useParcelamentosDaEmpresa } from './useParcelamentosDaEmpresa';

export function ParcelamentosDaEmpresa({ rota }: { rota: string }) {
  const vm = useParcelamentosDaEmpresa(rota);
  useCarregando(vm.carregando);
  if (vm.carregando) return <Esqueleto linhas={4} />;
  if (vm.semCliente) return <Vazio icone="dinheiro" titulo="A empresa não está no Entregas" texto="Os parcelamentos moram no cadastro de clientes do Entregas (o robô confere as parcelas pagas por lá). Cadastre o cliente lá com o mesmo código." />;
  const f = vm.form;
  return (
    <>
      <ConfigSecao titulo="Parcelamentos" acao={vm.editando == null && <button type="button" className="btn btn-outline" onClick={vm.novo}><Icone nome="plus" width={16} height={16} />Novo parcelamento</button>}>
        {vm.exemplos && <p className="hint drive-aviso">Dados de exemplo: o parcelamento é inventado e nada vai para o banco.</p>}
        {vm.erroDeLeitura && <p className="feedback-erro">Não consegui ler: {vm.erroDeLeitura}</p>}
        {!vm.linhas.length ? <p className="fraco fis-parc-vazio">Nenhum parcelamento cadastrado para esta empresa.</p> : (
          <div className="table-wrap">
            <table className="table-compact">
              <thead><tr><th>Órgão</th><th>Modalidade</th><th>Número</th><th>1ª parcela</th><th>Parcelas</th><th className="num">Valor</th><th>Vencimento</th><th>Próxima</th><th>Situação</th><th /></tr></thead>
              <tbody>
                {vm.linhas.map(l => (
                  <tr key={l.id} className={l.aberto ? undefined : 'fraco'}>
                    <td>{l.orgao}</td><td>{l.modalidade || '—'}</td><td className="num">{l.numero || '—'}</td><td className="num">{l.primeira}</td>
                    <td>{l.parcelas}</td><td className="num">{l.valor}</td><td>{l.vencimento}</td><td className="num">{l.proxima || '—'}</td>
                    <td><span className={'badge ' + (l.aberto ? 'badge-ok' : 'badge-neutral')}>{l.situacao}</span></td>
                    <td><BotaoIcone icone="lapis" pequeno titulo="Editar o parcelamento" onClick={() => vm.editar(l.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ConfigSecao>
      {vm.editando != null && (
        <ConfigSecao titulo={vm.editando ? 'Editar o parcelamento' : 'Novo parcelamento'}>
          <form className="fis-parc-form" onSubmit={ev => { ev.preventDefault(); void vm.gravar(); }}>
            <label className="etq-campo"><span>Órgão</span>
              <MenuSuspenso rotulo={vm.orgaos.find(o => o.valor === f.orgao)?.rotulo || 'Escolher'} className="btn btn-outline" titulo="Órgão" largura={240}
                itens={vm.orgaos.map(o => ({ rotulo: o.rotulo, marcado: o.valor === f.orgao, onClick: () => vm.mudar({ orgao: o.valor }) }))} />
            </label>
            <label className="etq-campo"><span>Modalidade</span><input type="text" value={f.modalidade} onChange={ev => vm.mudar({ modalidade: ev.target.value })} placeholder="Ex.: Parcelamento simplificado" maxLength={120} /></label>
            <label className="etq-campo"><span>Número</span><input type="text" value={f.numero} onChange={ev => vm.mudar({ numero: ev.target.value })} placeholder="O nº do parcelamento ou da referência" maxLength={60} /></label>
            <label className="etq-campo"><span>Parcelas</span><input type="number" min={1} max={600} inputMode="numeric" value={f.parcelas} onChange={ev => vm.mudar({ parcelas: ev.target.value })} /></label>
            <label className="etq-campo"><span>1ª parcela (mês/ano)</span><input type="text" value={f.primeira} onChange={ev => vm.mudar({ primeira: ev.target.value })} placeholder="mm/aaaa" maxLength={7} /></label>
            <label className="etq-campo"><span>Valor da parcela</span><input type="text" inputMode="decimal" value={f.valor} onChange={ev => vm.mudar({ valor: ev.target.value })} placeholder="0,00" /></label>
            <div className="etq-campo"><span>Vencimento</span>
              <span className="fis-parc-dia">
                <Segmentado valor={f.dia === 'util' ? 'util' : 'dia'} opcoes={[{ valor: 'util', rotulo: 'Último dia útil' }, { valor: 'dia', rotulo: 'Dia fixo' }]}
                  onMudar={v => vm.mudar({ dia: v === 'util' ? 'util' : (f.dia === 'util' ? '20' : f.dia) })} />
                {f.dia !== 'util' && <input type="number" min={1} max={31} inputMode="numeric" value={f.dia} onChange={ev => vm.mudar({ dia: ev.target.value })} aria-label="Dia do vencimento" />}
              </span>
            </div>
            {vm.editando && (
              <label className="etq-campo"><span>Situação</span>
                <MenuSuspenso rotulo={vm.situacoes.find(s => s.valor === (f.status || 'ativo'))?.rotulo || 'Situação'} className="btn btn-outline" titulo="Situação" largura={220}
                  itens={vm.situacoes.map(s => ({ rotulo: s.rotulo, marcado: s.valor === (f.status || 'ativo'), onClick: () => vm.mudar({ status: s.valor }) }))} />
              </label>
            )}
            <label className="etq-campo fis-parc-obs"><span>Observação</span><input type="text" value={f.obs} onChange={ev => vm.mudar({ obs: ev.target.value })} maxLength={400} /></label>
            {vm.erro && <p className="feedback-erro fis-parc-obs">{vm.erro}</p>}
            <div className="modal-actions fis-parc-obs">
              <button type="button" className="btn btn-outline" onClick={vm.fechar}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={vm.gravando}><Icone nome="check" width={16} height={16} />{vm.editando ? 'Salvar' : 'Cadastrar'}</button>
            </div>
          </form>
        </ConfigSecao>
      )}
    </>
  );
}
