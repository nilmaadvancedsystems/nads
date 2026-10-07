// ViewModel do formulário do cliente (Mandei, Vitor, 07/10/2026): o ticket do link (só o que o cliente precisa ver),
// as respostas de cada item (escolher, digitar) e os arquivos anexados. Vale até o fim do prazo do link; vencido, ou
// com o ticket resolvido, não aceita mais nada. Por enquanto com os dados de exemplo (comum/mandeiExemplo.ts).
import { mandei as m } from '@nads/core';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useParams } from 'react-router';
import { exemplo, MAIOR_ARQUIVO_NO_EXEMPLO } from '../../../comum/mandeiExemplo';

const lerComoDataUrl = (f: File) => new Promise<string>((ok, falha) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result));
  r.onerror = () => falha(r.error);
  r.readAsDataURL(f);
});

const dataBR = (iso: string) => { const d = new Date(iso); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); };

export function useFormulario() {
  const { codigo = '' } = useParams();
  useSyncExternalStore(exemplo.assinar, exemplo.versao, exemplo.versao);
  const t = codigo ? exemplo.doLink(codigo) : null;
  const valido = !!t && m.linkValido(t, codigo, new Date());
  const [respostas, setRespostas] = useState<Record<string, m.RespostaDoItem>>({});
  const [enviado, setEnviado] = useState(false);
  // a tela de entrada (Vitor, 07/10/2026): quem é, o que é o Mandei e um botão só para começar
  const [comecou, setComecou] = useState(false);
  const [erro, setErro] = useState('');

  // abriu o link: fica marcado (a central vê "Aberto")
  useEffect(() => {
    const atual = codigo ? exemplo.doLink(codigo) : null;
    if (atual && m.linkValido(atual, codigo, new Date()) && !atual.links.find(l => l.codigo === codigo)?.abertoEm) exemplo.gravar(m.linkAberto(atual, codigo, new Date()));
  }, [codigo]);

  const vista = t ? m.vistaDoCliente(t) : null;
  const resposta = (id: string): m.RespostaDoItem => respostas[id] ?? vista?.respostas[id] ?? {};

  async function anexar(itemId: string, fs: File[]) {
    setErro('');
    for (const f of fs) {
      const atual = exemplo.doLink(codigo);
      if (!atual || !m.linkValido(atual, codigo, new Date())) return;
      if (f.size > MAIOR_ARQUIVO_NO_EXEMPLO) { setErro(f.name + ': maior que 2 MB (no exemplo).'); continue; }
      const id = 'arq-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      if (!exemplo.guardarArquivo(id, await lerComoDataUrl(f))) { setErro(f.name + ': não coube neste navegador.'); continue; }
      exemplo.gravar(m.comArquivo(atual, { id, nome: f.name, tamanho: f.size, itemId, enviadoEm: new Date().toISOString(), status: 'na-fila' }));
    }
  }

  return {
    codigo, existe: !!t, valido, enviado, erro,
    comecou, comecar: () => setComecou(true),
    quantos: vista?.itens.length || 0,
    numero: vista?.numero || '', empresa: vista?.empresa || '', mensagem: vista?.mensagem || '',
    validoAte: vista ? dataBR(vista.validoAte) : '',
    itens: (vista?.itens || []).map(it => ({
      ...it, opcao: resposta(it.id).opcao || '', texto: resposta(it.id).texto || '',
      arquivos: (vista?.arquivos || []).filter(a => a.itemId === it.id).map(a => a.nome),
    })),
    escolher: (id: string, opcao: string) => setRespostas(r => ({ ...r, [id]: { ...resposta(id), opcao } })),
    escrever: (id: string, texto: string) => setRespostas(r => ({ ...r, [id]: { ...resposta(id), texto } })),
    anexar: (id: string, fs: File[]) => { void anexar(id, fs); },
    enviar: () => {
      const atual = exemplo.doLink(codigo);
      if (!atual || !m.linkValido(atual, codigo, new Date())) return;
      exemplo.gravar(m.responder(atual, { ...atual.respostas, ...respostas }, new Date()));
      setEnviado(true);
    },
    voltar: () => setEnviado(false),
  };
}
