// ViewModel de Cadastro › Usuários: a equipe do Entregas numa lista (quem é, o cargo, os papéis que tem, se está ativa e
// os computadores liberados); clicar numa pessoa abre a janela dela (cargo, papéis, ativo e computadores — só o admin
// muda), e o "Novo usuário" abre a janela de criar o acesso (Vitor, 05/10/2026: "novo usuário vai ser uma tela
// flutuante como as configurações, na aba de usuários").
import { usuarios } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { BASE, temNivelDiretor } from '../../../casca/navegacao';
import { useOperador } from '../../../casca/operador';
import { useAcesso } from '../../../dados/repo';

export type FiltroDeUsuarios = 'todos' | 'online' | 'ativos' | 'inativos';
type Janela = { tipo: 'novo' } | { tipo: 'pessoa'; uid: string } | null;

export function useUsuariosDoNads() {
  const repo = useAcesso();
  const { toast, modal } = useRetorno();
  const { operador } = useOperador();
  const admin = !!operador?.admin;
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroDeUsuarios>('todos');
  const [janela, setJanela] = useState<Janela>(null);
  // o link de nova senha gerado agora (15/10/2026), de quem é
  const [linkDeSenha, setLinkDeSenha] = useState<{ uid: string; link: string } | null>(null);
  const [gerandoSenha, setGerandoSenha] = useState(false);
  // o relógio do "online" (quem parou de bater o ponto sai sem a lista mudar)
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => { const r = setInterval(() => setAgora(new Date()), 30 * 1000); return () => clearInterval(r); }, []);
  const equipe = repo.equipe();
  const sessoes = repo.sessoes();
  const q = busca.trim().toLowerCase();

  async function tentar(f: () => Promise<void>, ok: string) {
    if (!admin) { toast('Só um administrador muda a equipe.'); return; }
    try { await f(); toast(ok); } catch (err) { toast('Não consegui salvar: ' + (err as Error).message); }
  }
  // o que cada linha está fazendo ("revogar:<id>"): o botão dela mostra que trabalha e trava (revisão da UI, 18/10/2026)
  const [fazendo, setFazendo] = useState<ReadonlySet<string>>(new Set());
  async function comLinha(chave: string, f: () => Promise<void>) {
    if (fazendo.has(chave)) return;
    setFazendo(s => new Set(s).add(chave));
    try { await f(); } finally { setFazendo(s => { const n = new Set(s); n.delete(chave); return n; }); }
  }

  const todas = equipe.lista
    .map(p => ({
      ...p,
      cargo: p.departamento || p.nivel ? usuarios.rotuloDoCargo(p) : '',
      iniciais: usuarios.iniciais(p.nome),
      rotulosDosPapeis: usuarios.PAPEIS.filter(x => p.papeis.includes(x.id)).map(x => x.rotulo),
      computadores: sessoes.filter(s => s.uid === p.uid),
      online: p.ativo && usuarios.estaOnline(p.vistoNoNads, agora),
      // o departamento (a etiqueta colorida) e o nível; os papéis que não vêm do cargo (o do departamento e o staff ficam de fora)
      departamentoRotulo: usuarios.DEPARTAMENTOS.find(d => d.id === p.departamento)?.rotulo || '',
      nivelRotulo: usuarios.NIVEIS.find(n => n.id === p.nivel)?.rotulo || '',
      papeisAMais: usuarios.PAPEIS.filter(x => p.papeis.includes(x.id) && x.id !== p.departamento).map(x => x.rotulo),
      presenca: usuarios.rotuloDaPresenca(p.vistoNoNads, agora),
      // a empresa e a etapa do Contábil em que ela está agora (Vitor, 09/11/2026)
      atividade: p.ativo && operador && usuarios.veAtividade(operador, p) ? usuarios.atividadeAtual(p.ondeNoNads, agora) : null,
    }))
    // quem está online primeiro, depois os ativos, depois os inativos
    .sort((a, b) => Number(b.online) - Number(a.online) || Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome));

  const linhas = todas
    .filter(p => filtro === 'todos' || (filtro === 'online' ? p.online : filtro === 'ativos' ? p.ativo : !p.ativo))
    // a busca pelo cargo é só do admin (quem não é admin não vê o cargo, então não pode achar por ele)
    .filter(p => !q || (p.nome + ' ' + p.email + (admin ? ' ' + p.cargo : '')).toLowerCase().includes(q));

  return {
    exemplos: repo.exemplos,
    admin,
    carregando: !equipe.carregada,
    busca, setBusca,
    filtro, setFiltro,
    contagem: { todos: todas.length, online: todas.filter(p => p.online).length, ativos: todas.filter(p => p.ativo).length, inativos: todas.filter(p => !p.ativo).length },
    linhas,
    // em grupos (sem busca, em Todos): quem está online agora, o resto da equipe e os inativos
    grupos: filtro !== 'todos' || q ? [{ titulo: '', itens: linhas }] : [
      { titulo: 'Online agora', itens: linhas.filter(p => p.online) },
      { titulo: 'Usuários', itens: linhas.filter(p => p.ativo && !p.online) },
      { titulo: 'Inativos', itens: linhas.filter(p => !p.ativo) },
    ].filter(g => g.itens.length),
    // as janelas: a da pessoa (os dados ao vivo) e a de criar o acesso
    pessoa: janela?.tipo === 'pessoa' ? todas.find(p => p.uid === janela.uid) || null : null,
    novoAberto: janela?.tipo === 'novo',
    abrirPessoa: (uid: string) => setJanela({ tipo: 'pessoa', uid }),
    abrirNovo: () => setJanela({ tipo: 'novo' }),
    fechar: () => setJanela(null),
    departamentos: usuarios.DEPARTAMENTOS,
    niveis: usuarios.NIVEIS_ESCOLHIVEIS,
    papeis: usuarios.PAPEIS,
    mudarCargo: (p: usuarios.Usuario, departamento: usuarios.Departamento | null, nivel: usuarios.Nivel | null) => {
      // o nível do Dono não muda por aqui, e ninguém vira Dono pelo app (12/11/2026): só o Deixar de ser dono, do próprio Dono
      if ((p.nivel === 'dono' && nivel !== 'dono') || (nivel === 'dono' && p.nivel !== 'dono')) { toast('O nível do Dono não muda por aqui.'); return Promise.resolve(); }
      return tentar(() => repo.salvarCargo(p.uid, departamento, nivel), 'Cargo de ' + p.nome + ' salvo.');
    },
    /** o Dono vendo a própria ficha: só ele tem o Deixar de ser dono */
    ehODonoQueVe: (p: usuarios.Usuario) => p.nivel === 'dono' && operador?.nivel === 'dono' && !!operador.email && operador.email.trim().toLowerCase() === p.email.trim().toLowerCase(),
    /**
     * O Dono deixa de ser (Vitor, 12/11/2026: "somente deixar de ser dono para quem está na função dono"): volta a Diretor,
     * com o mesmo departamento. Virar Dono, nunca pelo app.
     */
    async deixarDeSerDono(p: usuarios.Usuario) {
      const ok = await modal<boolean>({ icone: 'alert', titulo: 'Deixar de ser dono?', texto: 'Você volta a Diretor. Para ser Dono de novo, só pedindo ao desenvolvedor.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Deixar de ser dono', valor: true, variante: 'btn-danger' }] });
      if (!ok) return;
      await tentar(() => repo.salvarCargo(p.uid, p.departamento, 'diretor'), 'Você deixou de ser Dono e voltou a Diretor.');
    },
    alternarPapel(p: usuarios.Usuario, papel: usuarios.Papel) {
      // o Financeiro: só o Diretor autoriza, e quem é Diretor já tem, sem como desligar (Vitor, 09/11/2026)
      if (papel === 'financeiro' && (!temNivelDiretor(operador) || usuarios.nivelDeDiretor(p.nivel))) return Promise.resolve();
      const tem = p.papeis.includes(papel);
      const novos = tem ? p.papeis.filter(x => x !== papel) : [...p.papeis, papel];
      return tentar(() => repo.salvarPapeis(p.uid, novos), (tem ? 'Tirei ' : 'Dei ') + 'o papel ' + (usuarios.PAPEIS.find(x => x.id === papel)?.rotulo || papel) + (tem ? ' de ' : ' a ') + p.nome + '.');
    },
    async ativar(p: usuarios.Usuario) {
      if (p.ativo) {
        const ok = await modal<boolean>({ icone: 'alert', titulo: 'Desativar ' + p.nome + '?', texto: 'A conta deixa de entrar no nads e no Entregas (os robôs e as telas respeitam o "ativo").',
          botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Desativar', valor: true, variante: 'btn-danger' }] });
        if (!ok) return;
      }
      await tentar(() => repo.ativar(p.uid, !p.ativo), p.nome + (p.ativo ? ' desativado.' : ' ativado.'));
    },
    /** o link de nova senha da pessoa (só o admin; vale 24 h e uma vez): a pessoa abre e escolhe a senha */
    linkDeSenha: (uid: string) => (linkDeSenha?.uid === uid ? linkDeSenha.link : ''),
    gerandoSenha,
    async gerarLinkDeSenha(p: usuarios.Usuario) {
      if (!admin) { toast('Só um administrador gera o link de nova senha.'); return; }
      if (gerandoSenha) return;
      setGerandoSenha(true);
      try {
        const codigo = await repo.criarConviteDeSenha(p.uid);
        setLinkDeSenha({ uid: p.uid, link: location.origin + BASE + '/convite/' + codigo });
        toast('Link de nova senha de ' + p.nome + ' criado: vale 24 horas.');
      } catch (err) { toast('Não consegui gerar o link: ' + (err as Error).message); } finally { setGerandoSenha(false); }
    },
    /**
     * O e-mail de entrada (Vitor, 12/11/2026: "coloca email aqui pro diretor conseguir mudar tbm"): só o Diretor e o Dono
     * trocam; o do Dono, só o Dono. Quem troca de fato é o robô da nuvem (repo.trocarEmail espera ele terminar).
     */
    podeTrocarEmail: (p: usuarios.Usuario) => admin && temNivelDiretor(operador) && (p.nivel !== 'dono' || operador?.nivel === 'dono'),
    async trocarEmail(p: usuarios.Usuario, email: string): Promise<boolean> {
      const novo = email.trim().toLowerCase();
      if (!usuarios.ehEmailDeLogin(novo)) { toast('Escreva um e-mail válido (por exemplo, nome@nilma.local).'); return false; }
      if (novo === p.email.trim().toLowerCase()) return true;
      if (equipe.lista.some(x => x.uid !== p.uid && x.email.trim().toLowerCase() === novo)) { toast('Esse e-mail já é o login de outra pessoa.'); return false; }
      let deu = false;
      await comLinha('email:' + p.uid, async () => {
        try { await repo.trocarEmail(p.uid, novo); deu = true; toast('E-mail de ' + p.nome + ' trocado. Agora ' + p.nome + ' entra com ' + novo + '.'); } catch (err) { toast('Não troquei o e-mail: ' + (err as Error).message); }
      });
      return deu;
    },
    copiar: (link: string) => { void navigator.clipboard.writeText(link).then(() => toast('Link copiado.'), () => toast('Não consegui copiar; selecione o link e copie.')); },
    fazendo: (chave: string) => fazendo.has(chave),
    revogar: (s: usuarios.SessaoLiberada) => comLinha('revogar:' + s.id, () => tentar(() => repo.revogar(s), 'Liberação de ' + s.nome + ' (' + s.computador + ') revogada: o código não vale mais.')),
    quando: (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''),
  };
}

export type VmUsuarios = ReturnType<typeof useUsuariosDoNads>;
