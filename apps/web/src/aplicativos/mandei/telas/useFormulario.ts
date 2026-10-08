// ViewModel do formulário do cliente (Mandei, Vitor, 07/10/2026): o ticket do link (só o que o cliente precisa ver),
// as respostas de cada linha do item (Vitor, 08/10/2026: "ela responde por linha"; o item sem linhas responde inteiro:
// escolher, digitar) e os arquivos anexados. Vale até o fim do prazo do link; vencido, ou
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
  // um cliente por vez (o passo); depois do último, a revisão
  const [passo, setPasso] = useState(0);
  const [erro, setErro] = useState('');

  // abriu o link: fica marcado (a central vê "Aberto")
  useEffect(() => {
    const atual = codigo ? exemplo.doLink(codigo) : null;
    if (atual && m.linkValido(atual, codigo, new Date()) && !atual.links.find(l => l.codigo === codigo)?.abertoEm) exemplo.gravar(m.linkAberto(atual, codigo, new Date()));
  }, [codigo]);

  const vista = t ? m.vistaDoCliente(t) : null;
  const resposta = (id: string): m.RespostaDoItem => respostas[id] ?? vista?.respostas[id] ?? {};

  async function anexar(chave: string, fs: File[]) {
    setErro('');
    for (const f of fs) {
      const atual = exemplo.doLink(codigo);
      if (!atual || !m.linkValido(atual, codigo, new Date())) return;
      if (f.size > MAIOR_ARQUIVO_NO_EXEMPLO) { setErro(f.name + ': maior que 2 MB (no exemplo).'); continue; }
      const id = 'arq-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      if (!exemplo.guardarArquivo(id, await lerComoDataUrl(f))) { setErro(f.name + ': não coube neste navegador.'); continue; }
      exemplo.gravar(m.comArquivo(atual, { id, nome: f.name, tamanho: f.size, itemId: chave, enviadoEm: new Date().toISOString(), status: 'na-fila' }));
    }
  }

  /** a resposta de uma chave (a linha, ou o item sem linhas): a opção, o texto, os arquivos e o que ela pede */
  const daChave = (chave: string) => {
    const opcao = resposta(chave).opcao || '', texto = resposta(chave).texto || '';
    const explicar = m.pedeExplicacao(opcao);
    return {
      chave, opcao, texto, explicar, comprovar: m.pedeComprovante(opcao),
      arquivos: (vista?.arquivos || []).filter(a => a.itemId === chave).map(a => a.nome),
      // respondido = escolheu uma resposta e, se ela pede, explicou (Vitor, 07/10/2026: "não deixa dar próximo sem responder")
      respondido: !!opcao && (!explicar || !!texto.trim()),
    };
  };
  const itens = (vista?.itens || []).map(it => {
    const iniciais = it.titulo.split(/\s+/).filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join('') || it.titulo.slice(0, 2);
    // cada lançamento com a operação (Compra, Venda…) e a resposta dele; sem lançamentos, a resposta do item
    const linhas = (it.linhas || []).map((l, n) => ({ ...l, operacao: m.operacaoDaLinha(l), ...daChave(m.chaveDaLinha(it.id, n)) }));
    const doItem = daChave(it.id);
    const respostas = linhas.length ? linhas : [doItem];
    const semOpcao = respostas.some(x => !x.opcao), semTexto = respostas.some(x => x.explicar && !x.texto.trim());
    return { ...it, linhas, doItem, iniciais: iniciais.toUpperCase(), respondido: respostas.every(x => x.respondido),
      falta: semOpcao ? (linhas.length > 1 ? 'Responda cada linha para continuar' : 'Escolha uma resposta para continuar') : semTexto ? (linhas.length ? 'Explique e confirme (✓) para continuar' : 'Explique para continuar') : '',
      /** a revisão: o que respondeu em cada linha e quantos arquivos */
      resumo: linhas.length
        ? linhas.map(x => ({ chave: x.chave, linha: (x.nf && x.nf !== '—' ? 'NF ' + x.nf : x.conta || x.data) + ' · ' + x.valor, resposta: [x.opcao, x.texto].filter(Boolean).join(': ') }))
        : [{ chave: doItem.chave, linha: '', resposta: [doItem.opcao, doItem.texto].filter(Boolean).join(': ') }],
      anexos: respostas.reduce((n, x) => n + x.arquivos.length, 0) };
  });
  const respondidos = itens.filter(i => i.respondido).length;
  // só anda até o primeiro item sem resposta (a revisão só depois de todos)
  const pendente = itens.findIndex(i => !i.respondido);
  const limite = pendente < 0 ? itens.length : pendente;
  const dias = vista ? Math.max(0, Math.ceil((new Date(vista.validoAte).getTime() - Date.now()) / 86400000)) : 0;

  return {
    codigo, existe: !!t, valido, enviado, erro,
    quantos: itens.length, respondidos, dias,
    passo, revisao: passo >= itens.length, podeAvancar: passo < limite,
    irPara: (n: number) => { setPasso(Math.max(0, Math.min(limite, n))); window.scrollTo({ top: 0 }); },
    numero: vista?.numero || '', empresa: vista?.empresa || '', mensagem: vista?.mensagem || '',
    validoAte: vista ? dataBR(vista.validoAte) : '',
    itens,
    // trocou para uma resposta que não pede explicação: o texto digitado no "Outro" sai junto
    // a chave é a da linha ('<item>/<n>') ou a do item sem linhas
    escolher: (chave: string, opcao: string) => setRespostas(r => ({ ...r, [chave]: m.pedeExplicacao(opcao) ? { ...resposta(chave), opcao } : { ...resposta(chave), opcao, texto: '' } })),
    escrever: (chave: string, texto: string) => setRespostas(r => ({ ...r, [chave]: { ...resposta(chave), texto } })),
    anexar: (chave: string, fs: File[]) => { void anexar(chave, fs); },
    enviar: () => {
      const atual = exemplo.doLink(codigo);
      if (!atual || !m.linkValido(atual, codigo, new Date()) || pendente >= 0) return;
      exemplo.gravar(m.responder(atual, { ...atual.respostas, ...respostas }, new Date()));
      setEnviado(true);
    },
    voltar: () => { setEnviado(false); setPasso(0); },
  };
}
