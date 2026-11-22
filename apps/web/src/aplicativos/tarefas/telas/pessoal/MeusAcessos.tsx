// Minha página › Meus acessos (22/11/2026, ficha E21): os computadores liberados na conta e o "Não fui eu".
import { ConfigLinha, ConfigSecao, Esqueleto } from '@nads/ui';
import { useMeusAcessos } from './useMeusAcessos';

export function MeusAcessos() {
  const vm = useMeusAcessos();
  return (
    <ConfigSecao titulo="Computadores liberados">
      {vm.carregando ? <Esqueleto linhas={3} /> : vm.erro ? <p className="hint">{vm.erro}</p> : vm.acessos.length ? vm.acessos.map(s => (
        <ConfigLinha key={s.id} titulo={s.computador || 'Computador'} descricao={'Liberado em ' + s.quando}>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => void vm.naoFuiEu(s)}>Não fui eu</button>
        </ConfigLinha>
      )) : <p className="hint">Nenhum computador liberado na sua conta.</p>}
      <p className="hint" style={{ marginTop: 8 }}>Quando sua conta é liberada num computador, o nads avisa no seu celular. Se não foi você, toque em "Não fui eu".</p>
    </ConfigSecao>
  );
}
