// As ações sobre o link do cliente (Vitor, 16/10/2026), as mesmas na página Links e no bloco "Link do cliente" da janela da
// empresa no Cadastro: gerar, copiar, mandar no WhatsApp com o texto pronto, trocar e revogar (estes dois pedem confirmação).
// Só o admin e os diretores mexem (os botões nem aparecem para os outros); ver quem tem link, todos veem.
import { extrator, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useOperador, type Operador } from '../../casca/operador';
import { enderecoDoLink, textoDoWhatsApp, type EmpresaDoLink } from '../../dados/areaCliente';
import { useAreaCliente, useTodosOsCadastros } from '../../dados/repo';

/** Quem gera, troca e revoga link: o admin e os diretores (Vitor, 16/10/2026). */
export const podeMexerNosLinks = (op: Operador | null) => !!op && (op.admin || op.nivel === 'diretor');

const motivo = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function useAcoesDoLink() {
  const repo = useAreaCliente();
  const cadastros = useTodosOsCadastros();
  const { toast, modal } = useRetorno();
  const op = useOperador().operador;
  /** o código da empresa que está gravando (para travar os botões dela) */
  const [ocupada, setOcupada] = useState<number | null>(null);

  async function trabalhar(codigo: number, f: () => Promise<void>, falhou: string) {
    if (ocupada != null) return;
    setOcupada(codigo);
    try { await f(); } catch (e) { toast(falhou + ' ' + motivo(e)); } finally { setOcupada(null); }
  }
  const confirmar = (titulo: string, texto: string, acao: string) => modal<boolean>({ icone: 'alert', titulo, texto,
    botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: acao, valor: true, variante: 'btn-primary' }] });

  return {
    pode: podeMexerNosLinks(op),
    ocupada,
    /** o WhatsApp do cadastro da empresa ('' = sem) */
    telefoneDe: (nome: string) => cadastros.porId.get(formatos.slug(nome))?.contato?.whatsapp || '',
    gerar: (e: EmpresaDoLink) => trabalhar(e.codigo, async () => { await repo.gerar(e); toast('Link gerado para ' + e.nome + '.'); }, 'Não deu para gerar o link.'),
    copiar(token: string) {
      void navigator.clipboard.writeText(enderecoDoLink(token)).then(() => toast('Link copiado.'), () => toast('Não consegui copiar; selecione o link e copie.'));
    },
    whatsapp(e: EmpresaDoLink, token: string) {
      const telefone = cadastros.porId.get(formatos.slug(e.nome))?.contato?.whatsapp || '';
      // sem número no cadastro, o WhatsApp abre para escolher o contato, com o texto já pronto
      window.open(extrator.linkDoWhatsApp(telefone, textoDoWhatsApp(e.nome, enderecoDoLink(token))), '_blank', 'noopener');
      if (!extrator.telefoneParaWhatsApp(telefone)) toast('A empresa não tem WhatsApp no cadastro: escolha o contato no WhatsApp.');
    },
    async trocar(e: EmpresaDoLink) {
      const ok = await confirmar('Trocar o link de ' + e.nome + '?', 'Sai um link novo e o antigo deixa de funcionar na hora. Quem tinha o link antigo precisa receber o novo.', 'Trocar');
      if (ok) await trabalhar(e.codigo, async () => { await repo.trocar(e); toast('Link trocado. O antigo não funciona mais.'); }, 'Não deu para trocar o link.');
    },
    async revogar(e: EmpresaDoLink) {
      const ok = await confirmar('Revogar o link de ' + e.nome + '?', 'O cliente deixa de ver a Área do Cliente agora. Você pode gerar outro link depois.', 'Revogar');
      if (ok) await trabalhar(e.codigo, async () => { await repo.revogar(e.codigo); toast('Link revogado.'); }, 'Não deu para revogar o link.');
    },
  };
}
