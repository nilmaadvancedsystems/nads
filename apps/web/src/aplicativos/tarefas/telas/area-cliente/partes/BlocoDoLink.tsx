// O bloco "Link do cliente" (Vitor, 16/10/2026), na janela da empresa do Cadastro: o endereço do link, de quando é e os
// botões. Peça do catálogo (Cartões). Sem link, diz isso e oferece "Gerar link"; quem não é admin nem diretor só vê o estado.
import { ConfigLinha, ConfigSecao, Icone } from '@nads/ui';
import { BotoesDoLink, type BotoesDoLinkProps } from './BotoesDoLink';

export function BlocoDoLink({ endereco, data, podeMexer, carregando, logo, gravandoLogo, aoEnviarLogo, aoTirarLogo, guiasAbertas, ...botoes }: Omit<BotoesDoLinkProps, 'temLink'> & {
  /** as guias que o cliente abriu pelo link (plano do Acessórias, 17/11/2026, ficha comprovante-de-leitura) */
  guiasAbertas?: { erro: string; lista: { chave: string; rotulo: string; quando: string }[] };
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
  // no desenho das outras seções da janela da empresa, linha a linha, sem a caixa (26/11/2026: "Box ta zuada, melhora isso ai")
  return (
    <ConfigSecao titulo="Link do cliente" acao={endereco ? <span className="badge badge-ok">Com link</span> : <span className="badge badge-neutral">Sem link</span>}>
      {carregando ? <ConfigLinha titulo="Procurando o link…" /> : endereco ? (
        <>
          <ConfigLinha titulo="Endereço" descricao={'Link secreto da Área do Cliente' + (data ? ' · de ' + data : '') + '. Quem tem o link vê as guias e abre solicitações, sem senha.'}>
            <span className="ac-link-curto num" title={endereco}><Icone nome="link" width={14} height={14} />{endereco}</span>
          </ConfigLinha>
          {podeMexer && <ConfigLinha titulo="Ações"><BotoesDoLink temLink {...botoes} /></ConfigLinha>}
        </>
      ) : (
        <ConfigLinha titulo="Acesso" descricao="Esta empresa ainda não tem acesso à Área do Cliente.">
          {podeMexer && <BotoesDoLink temLink={false} {...botoes} />}
        </ConfigLinha>
      )}
      {!carregando && !podeMexer && <ConfigLinha titulo="Quem mexe" descricao="Só o admin e os diretores geram, trocam e revogam o link." />}
      {aoEnviarLogo && (
        <ConfigLinha titulo="Logo" descricao={logo ? 'Aparece no topo da área, no lugar do ícone.' : 'Sem logo: o topo mostra o ícone do prédio.'}>
          <span className="ac-logo-acoes">
            <span className="ac-logo-previa" aria-hidden={!logo}>{logo ? <img src={logo} alt="Logo da empresa" /> : <Icone nome="predio" width={18} height={18} />}</span>
            {podeMexer && (
              <>
                <label className={'btn btn-sm' + (gravandoLogo ? ' disabled' : '')}>
                  <Icone nome="upload" width={16} height={16} />{logo ? 'Trocar' : 'Enviar logo'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={gravandoLogo}
                    onChange={ev => { const f = ev.target.files?.[0]; ev.target.value = ''; if (f) aoEnviarLogo(f); }} />
                </label>
                {logo && aoTirarLogo && <button type="button" className="btn btn-sm btn-outline" disabled={gravandoLogo} onClick={aoTirarLogo}>Tirar</button>}
              </>
            )}
          </span>
        </ConfigLinha>
      )}
      {endereco && guiasAbertas && (guiasAbertas.erro || guiasAbertas.lista.length > 0) && (
        <ConfigLinha titulo="Guias que o cliente abriu" descricao={guiasAbertas.erro || guiasAbertas.lista.map(g => g.rotulo + ' · ' + g.quando).join(' · ')} />
      )}
    </ConfigSecao>
  );
}
