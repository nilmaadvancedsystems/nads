// Etapa Lançamentos do Creditor: as contas e históricos, os avisos (o arquivo que não fecha com o banco, os títulos
// fora) e o Baixar .xls. Sem a tabela por dia e sem a prévia das 8 colunas (Vitor, 05/10/2026: "não precisa").
import { creditor as cr } from '@nads/core';
import { Alerta, baixarBytes, Icone, Stat } from '@nads/ui';
import { MenuDeConta } from '../../partes/MenuDeConta';
import { useLancamentos, type CampoConta as IdCampo } from './useLancamentos';


export function Lancamentos() {
  const vm = useLancamentos();
  const baixar = () => { const a = vm.arquivo(); baixarBytes(a.bytes, a.nome, a.tipo); vm.baixou(); };
  return (
    <section>
      {/* os números em cima, numa linha só (Vitor, 05/10/2026) */}
      <div className="stat-grid">
        <Stat rotulo="Lançamentos" valor={vm.totais.qtd} grande={false} />
        <Stat rotulo="Principal" valor={cr.reais(vm.totais.principal)} grande={false} />
        <Stat rotulo="Mora" valor={cr.reais(vm.totais.mora)} grande={false} />
        <Stat rotulo="Descontos" valor={cr.reais(vm.totais.desconto)} grande={false} />
      </div>
      <div className="card">
        <div className="card-head">
          <h3>Contas</h3>
        </div>
        <div className="form-grid">
          {(Object.keys(vm.rotuloConta) as IdCampo[]).map(c => {
            const d = vm.ehDoBalancete(c) ? vm.detalhe[c as keyof typeof vm.detalhe] : null;
            return (
              <div key={c} className="field">
                {/* a conta do balancete no menu suspenso padrão (Vitor, 05/10/2026: no lugar da lista do navegador) */}
                <label>{vm.rotuloConta[c]}</label>
                <MenuDeConta valor={vm.contas[c]} contas={vm.opcoes} onEscolher={v => vm.mudarConta(c, v)} travado={c === 'banco' && d?.origem === 'Salva na empresa'} />
                {d && vm.carregada && (
                  <p className="hint" style={{ margin: '4px 0 0' }}>
                    <span className={'badge badge-' + d.tom}>{d.origem}</span>{d.nome && <> {d.nome}</>}
                    {d.aviso && <><br />{d.aviso}</>}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {vm.divergentes.length > 0 && (
        <Alerta titulo="O arquivo não fecha com o banco">
          {vm.divergentes.map(d => <p key={d} className="alert-text">{d}</p>)}
        </Alerta>
      )}

      {vm.fora.length > 0 && (
        <Alerta titulo={vm.fora.length + ' título(s) fora do arquivo'}>
          {vm.fora.map(t => <p key={t.id} className="alert-text">NF {t.nf} · {t.sacado} · {t.liquidacao} · {cr.reais(t.valor)}</p>)}
        </Alerta>
      )}


      {/* o Baixar .xls embaixo, no fim da página (Vitor, 05/10/2026) */}
      <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" type="button" disabled={!vm.podeBaixar} onClick={baixar}><Icone nome="download" />Baixar .xls</button>
      </div>
    </section>
  );
}
