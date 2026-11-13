// O bloco "Link do cliente" (Vitor, 16/10/2026), na janela da empresa do Cadastro: o endereço do link, de quando é e os
// botões. Peça do catálogo (Cartões). Sem link, diz isso e oferece "Gerar link"; quem não é admin nem diretor só vê o estado.
import { Icone } from '@nads/ui';
import { BotoesDoLink, type BotoesDoLinkProps } from './BotoesDoLink';

export function BlocoDoLink({ endereco, data, podeMexer, carregando, logo, gravandoLogo, aoEnviarLogo, aoTirarLogo, ...botoes }: Omit<BotoesDoLinkProps, 'temLink'> & {
  /** o endereço completo ('' = a empresa não tem link) */
  endereco: string;
  /** 'dd/mm/aaaa' */
  data: string;
  podeMexer: boolean;
  carregando?: boolean;
  /** a logo da empresa no topo da Área do Cliente (12/11/2026): o data URL ('' = sem) */
  logo?: string;
  gravandoLogo?: boolean;
  aoEnviarLogo?: (arquivo: File) => void;
  aoTirarLogo?: () => void;
}) {
  return (
    <section className="card ac-bloco">
      <div className="card-head"><h3>Link do cliente</h3>{endereco ? <span className="badge badge-ok">Com link</span> : <span className="badge badge-neutral">Sem link</span>}</div>
      <div className="ac-bloco-corpo">
        {carregando ? <p className="fraco">Procurando o link…</p> : endereco ? (
          <>
            <p className="ac-endereco num" title={endereco}><Icone nome="link" width={16} height={16} />{endereco}</p>
            <p className="fraco">Link secreto da Área do Cliente{data ? ' · de ' + data : ''}. Quem tem o link vê as guias e abre chamados, sem senha.</p>
          </>
        ) : <p className="fraco">Esta empresa ainda não tem acesso à Área do Cliente.</p>}
        {!carregando && (podeMexer
          ? <BotoesDoLink temLink={!!endereco} {...botoes} />
          : <p className="fraco">Só o admin e os diretores geram, trocam e revogam o link.</p>)}
        {aoEnviarLogo && (
          <div className="ac-logo">
            <span className="ac-logo-previa" aria-hidden={!logo}>{logo ? <img src={logo} alt="Logo da empresa" /> : <Icone nome="predio" width={20} height={20} />}</span>
            <span className="ac-logo-txt">
              <b>Logo na Área do Cliente</b>
              <span className="fraco">{logo ? 'Aparece no topo da área, no lugar do ícone.' : 'Sem logo: o topo mostra o ícone do prédio.'}</span>
            </span>
            {podeMexer && (
              <span className="ac-logo-acoes">
                <label className={'btn btn-sm' + (gravandoLogo ? ' disabled' : '')}>
                  <Icone nome="upload" width={16} height={16} />{logo ? 'Trocar' : 'Enviar logo'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={gravandoLogo}
                    onChange={ev => { const f = ev.target.files?.[0]; ev.target.value = ''; if (f) aoEnviarLogo(f); }} />
                </label>
                {logo && aoTirarLogo && <button type="button" className="btn btn-sm btn-outline" disabled={gravandoLogo} onClick={aoTirarLogo}>Tirar</button>}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
