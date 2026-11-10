// Configurações › Admin › Releitura dos extratos (10/11/2026: "eu quero que a correção de um bug valha para todas as
// empresas"): um botão relê os extratos do Drive de todas as empresas com o leitor de agora, e a tabela diz, por empresa, o que
// foi relido, o que ficou como estava e por quê, o que não fecha com o saldo do banco e o que espera o PDF no Drive.
import { Alerta, Dica, Vazio } from '@nads/ui';
import { ComExtrator } from '../../../etapas/Provedores';
import { useReleituraDosExtratos, type LinhaDaReleitura } from './useReleituraDosExtratos';

function Detalhes({ l }: { l: LinhaDaReleitura }) {
  const itens = [
    ...l.mantidos.map(m => m.nome + ': ficou como estava (' + m.motivo + ')'),
    ...l.naoFecham.map(n => n + ': não fecha com o saldo do banco'),
    ...l.erros.map(e => e.nome + ': ' + e.erro),
  ];
  if (!itens.length) return <span className="fraco">—</span>;
  return <>{itens.map((t, i) => <div key={i} className="hint">{t}</div>)}</>;
}

function Conteudo() {
  const vm = useReleituraDosExtratos();
  if (!vm.podeUsar) return <Vazio icone="lock" titulo="Só para o admin" texto="A releitura mexe nos extratos de todas as empresas." />;
  const t = vm.totais;
  return (
    <section>
      <div className="card">
        <div className="card-head">
          <h3>Reler os extratos de todas as empresas
            <Dica texto="Depois de uma correção no leitor de extratos, ela só chegava na empresa que alguém abria. Aqui, os extratos do Drive de todas as empresas são lidos de novo com o leitor de agora. A leitura nova não entra se perderia um mês ou se deixaria de fechar com o saldo do banco." />
          </h3>
        </div>
        <p className="hint">Uma empresa por vez: baixa os PDFs do Drive, lê de novo e grava. Pode levar alguns minutos; deixe esta aba aberta até terminar.</p>
        {vm.semDrive && <Alerta titulo="Sem acesso ao Drive" texto="Entre com o login do Entregas (o mesmo do Buscar no Drive dos extratos) e volte aqui." />}
        <p>
          {vm.rodando
            ? <button type="button" className="btn btn-outline" onClick={vm.parar}>Parar depois desta empresa</button>
            : <button type="button" className="btn btn-primary" disabled={vm.semDrive} onClick={vm.relerTodas}>Reler todas as empresas</button>}
        </p>
        {vm.andamento && <p className="hint">Empresa {vm.andamento.feitas + 1} de {vm.andamento.total}: {vm.andamento.empresa} — {vm.andamento.passo}</p>}
        {vm.erro && <Alerta titulo="Não deu para começar" texto={vm.erro} />}
        {vm.terminou && !vm.erro && (
          <p className="hint">
            Pronto: {t.empresas} empresa(s), {t.relidos} extrato(s) relido(s), {t.mantidos} ficaram como estavam, {t.naoFecham} não fecham com o saldo do banco,
            {' '}{t.esperandoODrive} esperam o PDF no Drive (relidos ao abrir a empresa) e {t.erros} com erro.
          </p>
        )}
      </div>

      {vm.linhas.length > 0 && (
        <div className="card">
          <table className="table-compact">
            <thead>
              <tr><th>Empresa</th><th className="num">Relidos</th><th className="num">Não fecham</th><th className="num">Esperam o Drive</th><th>O que olhar</th></tr>
            </thead>
            <tbody>
              {vm.linhas.map(l => (
                <tr key={l.empresa}>
                  <td>{l.empresa}</td>
                  <td className="num">{l.relidos}</td>
                  <td className="num">{l.naoFecham.length}</td>
                  <td className="num">{l.esperandoODrive}</td>
                  <td><Detalhes l={l} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ReleituraDosExtratos() {
  return <ComExtrator><Conteudo /></ComExtrator>;
}
