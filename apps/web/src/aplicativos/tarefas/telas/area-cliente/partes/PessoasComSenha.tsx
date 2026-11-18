// O bloco "Pessoas com senha" na janela da empresa (18/11/2026; o dono: "a area de cliente vai ter senha de acesso", "Uma
// por pessoa"): a lista de quem entra com e-mail e senha, o cadastro de uma pessoa nova e a chave "Exigir senha" do link.
import { Icone } from '@nads/ui';
import type { usePessoasComSenha } from '../usePessoasComSenha';

export function PessoasComSenha({ vm }: { vm: ReturnType<typeof usePessoasComSenha> }) {
  if (!vm.mostra) return null;
  return (
    <section className="card ac-bloco">
      <div className="card-head">
        <h3>Pessoas com senha</h3>
        {vm.exigeSenha ? <span className="badge badge-ok">Exige senha</span> : <span className="badge badge-neutral">Abre sem senha</span>}
      </div>
      <div className="ac-bloco-corpo">
        <p className="fraco">Cada pessoa entra com o próprio e-mail e uma senha que ela mesma cria na tela de entrar. O escritório nunca vê a senha.</p>
        {vm.erroDaLista && <p className="fraco">{vm.erroDaLista}</p>}
        {vm.carregando ? <p className="fraco">Procurando as pessoas…</p> : vm.pessoas.length ? (
          <ul className="ac-pessoas">
            {vm.pessoas.map(p => (
              <li key={p.id}>
                <span className="ac-pessoa-quem"><b>{p.nome}</b><span className="fraco">{p.email}</span>{p.erro && <span className="fraco">{p.erro}</span>}</span>
                <span className={'badge badge-' + p.tom}>{p.situacao}</span>
                {vm.podeMexer && <button type="button" className="btn btn-sm btn-outline" onClick={() => vm.tirar(p.id, p.nome)}>Tirar</button>}
              </li>
            ))}
          </ul>
        ) : <p className="fraco">Ninguém ainda. Enquanto não houver ninguém e a chave estiver desligada, o link abre sem senha, como sempre.</p>}
        {vm.podeMexer && (
          <>
            <div className="ac-pessoa-nova">
              <input type="text" placeholder="Nome" aria-label="Nome da pessoa" value={vm.nome} onChange={e => vm.mudarNome(e.target.value)} />
              <input type="email" placeholder="E-mail" aria-label="E-mail da pessoa" value={vm.email} onChange={e => vm.mudarEmail(e.target.value)} />
              <button type="button" className="btn btn-sm" disabled={vm.gravando} onClick={vm.adicionar}><Icone nome="plus" width={16} height={16} />Dar acesso</button>
            </div>
            {vm.erro && <p className="fraco" role="alert">{vm.erro}</p>}
            <label className="ac-exige-senha">
              <input type="checkbox" checked={vm.exigeSenha} disabled={!vm.senhaCarregada || (!vm.exigeSenha && !vm.podeExigir)} onChange={e => vm.mudarSenha(e.target.checked)} />
              <span><b>Exigir senha</b><span className="fraco"> · {vm.exigeSenha ? 'o link sozinho não abre mais; só quem está na lista entra.' : vm.podeExigir ? 'liga quando todos da empresa já tiverem senha.' : 'precisa de pelo menos uma pessoa que já pode entrar.'}</span></span>
            </label>
          </>
        )}
      </div>
    </section>
  );
}
