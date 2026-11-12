// Carteira › Enviar holerites, o lado do Financeiro (12/11/2026: "o cara do financeiro pode upar o holerite e o comprovante
// de pagamento, aparecendo pra pessoa"): no mês, uma linha por pessoa da equipe com o holerite e o comprovante dela (ou o
// que falta), o Enviar de cada um e o Tirar (enviou errado).
import { carteira, formatos } from '@nads/core';
import { BotaoIcone, Icone, useCarregando } from '@nads/ui';
import { SeletorDoMes } from './comum';
import { JanelaDoDocumento } from './JanelaDoDocumento';
import { useEnviarHolerites } from './useCarteiraDaPessoa';

export function EnviarHolerites() {
  const vm = useEnviarHolerites();
  const { m, pessoas, comHolerite, enviando, setEnviando } = vm;
  useCarregando(vm.carregando);

  const celula = (uid: string, nome: string, tipo: carteira.TipoDeDocumento) => {
    const ds = vm.docsDe(uid, tipo);
    return (
      <td>
        {ds.map(d => (
          <span key={d.id} className="cart-doc-na-linha">
            <button type="button" className="btn btn-ghost btn-sm" title={d.arquivo} onClick={() => vm.abrir(d)}>
              <Icone nome="checkCircle" />{d.valor != null ? formatos.reais(d.valor) : 'Enviado'}
            </button>
            <BotaoIcone icone="lixeira" titulo="Tirar" pequeno onClick={() => void vm.tirar(d)} />
          </span>
        ))}
        {!ds.length && <button type="button" className="btn btn-outline btn-sm" onClick={() => setEnviando({ uid, nome, tipo })}><Icone nome="upload" />Enviar</button>}
      </td>
    );
  };

  return (
    <section className="dp-painel">
      {enviando && <JanelaDoDocumento para={enviando} competencia={m.mes} fechar={() => setEnviando(null)} />}
      <div className="tarefas-barra-topo dp-filtros-linha">
        <SeletorDoMes {...m} />
        <span className="fraco">{comHolerite} de {pessoas.length} com o holerite de {carteira.mesPorExtenso(m.mes)}</span>
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}
      <p className="registro-dica"><Icone nome="dinheiro" />O pagamento em si (o salário, a comissão) também pode ir para a Carteira pelas Contas a pagar: na conta, escolha o funcionário.</p>
      <section className="card dp-lista">
        <div className="table-wrap">
          <table className="dp-tabela">
            <thead><tr><th>Pessoa</th><th>Holerite</th><th>Comprovante de pagamento</th></tr></thead>
            <tbody>
              {pessoas.map(u => (
                <tr key={u.uid}>
                  <td><b>{u.nome}</b>{!u.ativo && <span className="fraco"> · inativo</span>}</td>
                  {celula(u.uid, u.nome, 'holerite')}
                  {celula(u.uid, u.nome, 'comprovante')}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
