// O módulo Desenvolvedor (Vitor, 13/11/2026: "um botão que só aparece ou funciona no modo dev que fica lá no nads, pode
// colocar como um módulo pra quem tá no modo dev"): a Área do Cliente de uma empresa e a Central dos robôs, abertas aqui
// dentro do nads. Só aparece com o modo desenvolvedor ligado (navegacao.ts). As telas leem o banco de verdade e não gravam
// nada: nem solicitação, envio ou pedido de DANFE do cliente, nem comando ou ajuste dos robôs (rotasDoModoDev.tsx).
import { Alerta, Esqueleto, Icone, Vazio } from '@nads/ui';
import { useOutrosSites } from './useOutrosSites';

export function OutrosSites() {
  const vm = useOutrosSites();
  return (
    <div className="outros-sites">
      <Alerta naLinha titulo="Só para ver" texto={'Estas telas leem o banco de verdade, mas no modo desenvolvedor nada é gravado nem enviado: nenhuma '
        + 'solicitação, envio de arquivo ou pedido de DANFE do cliente, e nenhum comando ou ajuste dos robôs.'} />

      <section className="card outros-sites-cartao">
        <div className="card-head">
          <h3><Icone nome="usuario" width={16} height={16} /> Área do Cliente</h3>
          <button type="button" className="btn btn-outline" onClick={vm.abrirExemplo}>Abrir o exemplo</button>
        </div>
        <p className="hint outros-sites-texto">A área da empresa como o cliente vê pelo link dele.</p>
        <label className="busca-curta larga">
          <Icone nome="search" width={16} height={16} />
          <input type="text" placeholder="Buscar a empresa pelo nome ou código" aria-label="Buscar a empresa" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
        </label>
        {vm.erro ? <Vazio icone="alert" titulo="Não deu para ler os links" texto={vm.erro} />
          : vm.carregando ? <Esqueleto linhas={4} />
          : !vm.total ? <Vazio icone="link" titulo="Nenhuma empresa tem link ainda" texto="O link é gerado no Cadastro, na janela da empresa." />
          : !vm.empresas.length ? <Vazio titulo="Nenhuma empresa com esse nome" />
          : (
            <ul className="outros-sites-lista">
              {vm.empresas.map(e => (
                <li key={e.codigo}>
                  <button type="button" className="outros-sites-item" onClick={() => vm.abrirArea(e.token)}>
                    <span className="outros-sites-codigo num">{e.codigo}</span>
                    <span className="outros-sites-nome">{e.nome}</span>
                    <Icone nome="chevronRight" width={16} height={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section className="card outros-sites-cartao">
        <div className="card-head">
          <h3><Icone nome="robo" width={16} height={16} /> Central dos robôs</h3>
          <button type="button" className="btn btn-primary" onClick={vm.abrirCentral}>Abrir a Central</button>
        </div>
        <p className="hint outros-sites-texto">Os robôs das três máquinas, as filas e os registros. Só olhar: os comandos não saem.</p>
      </section>
    </div>
  );
}
