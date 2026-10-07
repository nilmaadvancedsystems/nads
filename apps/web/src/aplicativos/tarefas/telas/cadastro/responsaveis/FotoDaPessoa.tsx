// A foto da pessoa antes do nome (Vitor, 07/10/2026), no desenho da lista de Usuários: a foto de perfil, ou as iniciais.
export function FotoDaPessoa({ foto, iniciais }: { foto: string | null; iniciais: string }) {
  return foto ? <img className="usuarios-foto foto-mini" src={foto} alt="" /> : <span className="usuarios-foto usuarios-iniciais foto-mini" aria-hidden="true">{iniciais}</span>;
}

/** O nome com a foto antes. */
export function PessoaComFoto({ nome, foto, iniciais }: { nome: string; foto: string | null; iniciais: string }) {
  return <span className="pessoa-com-foto"><FotoDaPessoa foto={foto} iniciais={iniciais} />{nome}</span>;
}
