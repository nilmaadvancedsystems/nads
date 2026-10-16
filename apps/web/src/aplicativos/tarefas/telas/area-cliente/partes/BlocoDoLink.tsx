// O bloco "Link do cliente" (Vitor, 16/10/2026), na janela da empresa do Cadastro: o endereço do link, de quando é e os
// botões. Peça do catálogo (Cartões). Sem link, diz isso e oferece "Gerar link"; quem não é admin nem diretor só vê o estado.
import { Icone } from '@nads/ui';
import { BotoesDoLink, type BotoesDoLinkProps } from './BotoesDoLink';

export function BlocoDoLink({ endereco, data, podeMexer, carregando, ...botoes }: Omit<BotoesDoLinkProps, 'temLink'> & {
  /** o endereço completo ('' = a empresa não tem link) */
  endereco: string;
  /** 'dd/mm/aaaa' */
  data: string;
  podeMexer: boolean;
  carregando?: boolean;
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
      </div>
    </section>
  );
}
