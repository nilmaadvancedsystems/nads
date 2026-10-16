// Os botões do link do cliente (Vitor, 16/10/2026): sem link, "Gerar link"; com link, Copiar, WhatsApp (com o texto pronto),
// Trocar e Revogar. Peça do catálogo (Botões). Só aparecem para o admin e os diretores.
import { Icone, LogoWhatsApp } from '@nads/ui';

export interface BotoesDoLinkProps {
  temLink: boolean;
  /** gravando: trava os botões (e o Gerar mostra a rodinha) */
  ocupado?: boolean;
  aoGerar: () => void;
  aoCopiar: () => void;
  aoWhatsApp: () => void;
  aoTrocar: () => void;
  aoRevogar: () => void;
}

export function BotoesDoLink(p: BotoesDoLinkProps) {
  if (!p.temLink) {
    return (
      <span className="ac-botoes">
        <button type="button" className="btn btn-primary" disabled={p.ocupado} onClick={p.aoGerar}>
          {p.ocupado ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="link" width={16} height={16} />}Gerar link
        </button>
      </span>
    );
  }
  return (
    <span className="ac-botoes">
      <button type="button" className="btn" disabled={p.ocupado} onClick={p.aoCopiar} title="Copiar o link"><Icone nome="copiar" width={16} height={16} />Copiar</button>
      <button type="button" className="btn" disabled={p.ocupado} onClick={p.aoWhatsApp} title="Abrir o WhatsApp com o texto pronto">
        <span className="pedir-app"><LogoWhatsApp /></span>WhatsApp
      </button>
      <button type="button" className="btn btn-outline" disabled={p.ocupado} onClick={p.aoTrocar} title="Gerar outro link e desligar o antigo"><Icone nome="repeat" width={16} height={16} />Trocar</button>
      <button type="button" className="btn btn-danger" disabled={p.ocupado} onClick={p.aoRevogar} title="Apagar o link: o cliente deixa de ver a área"><Icone nome="x" width={16} height={16} />Revogar</button>
    </span>
  );
}
