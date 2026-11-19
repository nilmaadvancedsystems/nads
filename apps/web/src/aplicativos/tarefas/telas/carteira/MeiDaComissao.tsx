// O MEI na janela da comissão (Vitor, 19/11/2026): na Abertura e na Alteração de MEI, o cartão CNPJ (upou, já registra a empresa
// no Cadastro, porte MEI; fica só o ×) e a senha gov do MEI no cofre, com o nome do cliente (Adicionar; já tendo, Atualizar).
import { CampoArquivo, Icone } from '@nads/ui';
import { useId } from 'react';
import { Propriedade } from '../financeiro/partes/Propriedade';
import { useMeiDaComissao } from './useMeiDaComissao';

export function MeiDaComissao({ nome, aoLerCartao }: { nome: string; aoLerCartao?: (nomeDaEmpresa: string) => void }) {
  const vm = useMeiDaComissao(nome, aoLerCartao);
  const id = useId();
  return (
    <>
      <Propriedade icone="fileText" rotulo="Cartão CNPJ">
        {vm.cartao ? (
          <span className="mei-cartao">
            <span className="mei-cartao-txt"><b title={vm.nomeDaEmpresa}>{vm.nomeDoCartao}</b><span className="hint num">CNPJ {vm.cnpj}</span>
              {/* já registrada ao upar: só o aviso, numa linha (19/11/2026) */}
              {vm.registro && <span className="hint mei-cartao-registro">{vm.registro === 'registrando' ? 'Registrando no sistema…' : vm.registro === 'ja' ? 'Já estava no sistema' : 'Registrada no sistema como MEI'}</span>}</span>
            <button type="button" className="icon-btn icon-btn-sm" onClick={vm.tirarCartao} title="Tirar o cartão" aria-label="Tirar o cartão CNPJ"><Icone nome="x" /></button>
          </span>
        ) : (
          <>
            <label htmlFor={id} className={'btn btn-outline' + (vm.lendo ? ' is-locked' : '')} title="O cartão CNPJ em PDF (o comprovante de inscrição da Receita): só é lido, não fica guardado">
              <Icone nome="upload" />{vm.lendo ? 'Lendo…' : 'Upar o cartão CNPJ'}
            </label>
            <CampoArquivo semCaixa id={id} aceitar=".pdf" desabilitado={vm.lendo} onEscolher={f => { void vm.lerCartao(f); }} />
          </>
        )}
      </Propriedade>
      {vm.erro && <p className="registro-dica"><Icone nome="alert" />{vm.erro}</p>}
      <Propriedade icone="lock" rotulo="Senha gov">
        {!vm.senha ? (
          <button type="button" className="btn btn-outline" onClick={vm.abrirSenha} title={vm.temSenha ? 'A senha gov.br deste cliente já está no cofre: trocar pela atual' : 'Guardar a senha gov.br do MEI no cofre, com o nome do cliente'}>
            <Icone nome={vm.temSenha ? 'girar' : 'plus'} />{vm.temSenha ? 'Atualizar senha gov' : 'Adicionar senha gov'}
          </button>
        ) : (
          <span className="mei-senha">
            {!vm.temSenha && (
              <input type="text" inputMode="numeric" placeholder="CPF" aria-label="CPF da conta gov.br" maxLength={14} value={vm.senha.cpf}
                onChange={e => vm.setSenha({ ...vm.senha!, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) })} />
            )}
            <input type="password" placeholder="Senha gov.br" aria-label="Senha gov.br" autoComplete="new-password" value={vm.senha.senha}
              onChange={e => vm.setSenha({ ...vm.senha!, senha: e.target.value })} />
            <button type="button" className="btn btn-primary" disabled={!!vm.faltaNaSenha || vm.guardando} title={vm.faltaNaSenha || 'Guardar no cofre'} onClick={() => { void vm.guardarSenha(); }}>
              {vm.guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" className="icon-btn icon-btn-sm" onClick={vm.fecharSenha} title="Cancelar" aria-label="Cancelar"><Icone nome="x" /></button>
          </span>
        )}
      </Propriedade>
    </>
  );
}
