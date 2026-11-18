// ViewModel do bloco "Pessoas com senha" da janela da empresa (18/11/2026; o dono: "a area de cliente vai ter senha de
// acesso", "Uma por pessoa"; desenho em docs/acessorias/desenho-senha-por-pessoa.md): quem da empresa cliente entra na Área
// com e-mail e senha, e a chave "Exigir senha" do link. A senha a pessoa cria sozinha ("Criar ou trocar a senha" na tela de
// entrar); o escritório nunca vê nem escolhe senha. Só o admin e os diretores mexem (como no link).
import { areaCliente as ac } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useAreaCliente } from '../../dados/repo';

const ROTULO = { pronto: 'Pode entrar', esperando: 'Criando o acesso…', erro: 'Não deu certo' } as const;

const motivo = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  return /permission|insufficient/i.test(m) ? 'o banco ainda não aceita (falta publicar a regra nova)' : m;
};

export function usePessoasComSenha(codigo: number, token: string, podeMexer: boolean) {
  const repo = useAreaCliente();
  const { toast, modal } = useRetorno();
  const confirmar = (titulo: string, texto: string, acao: string) => modal<boolean>({ icone: 'alert', titulo, texto,
    botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: acao, valor: true, variante: 'btn-primary' }] });
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [gravando, setGravando] = useState(false);
  const todas = repo.pessoas();
  const daEmpresa = todas.lista.filter(p => p.codigo === codigo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const senha = token ? repo.exigeSenha(token) : { carregado: true, ligado: false };
  const prontas = daEmpresa.filter(p => p.situacao === 'pronto').length;

  async function adicionar() {
    const problema = ac.erroDaPessoa({ nome, email });
    setErro(problema);
    if (problema || gravando) return;
    if (daEmpresa.some(p => p.email === ac.normalizarEmail(email))) { setErro('Esta pessoa já tem acesso a esta empresa.'); return; }
    setGravando(true);
    try {
      await repo.adicionarPessoa(codigo, nome, email);
      setNome(''); setEmail('');
      toast('Pessoa cadastrada. Em alguns minutos ela já pode criar a senha na tela de entrar da Área do Cliente.');
    } catch (e) { setErro('Não deu para cadastrar: ' + motivo(e)); } finally { setGravando(false); }
  }

  async function tirar(id: string, quem: string) {
    if (!(await confirmar('Tirar o acesso de ' + quem + '?', 'A pessoa sai da Área do Cliente desta empresa na hora, mesmo se estiver com ela aberta.', 'Tirar o acesso'))) return;
    try { await repo.tirarPessoa(id); toast('Acesso tirado.'); } catch (e) { toast('Não deu para tirar: ' + motivo(e)); }
  }

  async function mudarSenha(ligado: boolean) {
    if (!token) return;
    if (ligado && !prontas) { toast('Cadastre pelo menos uma pessoa (e espere ficar "Pode entrar") antes de exigir senha.'); return; }
    const ok = await confirmar(ligado ? 'Exigir senha neste link?' : 'Voltar a abrir sem senha?',
      ligado ? 'Daqui em diante só quem está na lista entra, com o e-mail e a senha. O link sozinho passa a pedir login.'
        : 'Quem tiver o link volta a ver a Área do Cliente sem senha.', ligado ? 'Exigir senha' : 'Abrir sem senha');
    if (!ok) return;
    try { await repo.mudarExigeSenha(token, ligado); toast(ligado ? 'Pronto: o link agora pede senha.' : 'O link voltou a abrir sem senha.'); }
    catch (e) { toast('Não deu para mudar: ' + motivo(e)); }
  }

  return {
    mostra: !!token,
    podeMexer,
    carregando: !todas.carregada,
    erroDaLista: todas.erro ? (/permission|insufficient/i.test(todas.erro) ? 'O banco ainda não deixa ver as pessoas (falta publicar a regra nova).' : 'Não consegui ler as pessoas.') : '',
    pessoas: daEmpresa.map(p => ({ id: p.id, nome: p.nome, email: p.email, situacao: ROTULO[p.situacao], tom: p.situacao === 'pronto' ? 'ok' : p.situacao === 'erro' ? 'danger' : 'neutral', erro: p.erro })),
    nome, mudarNome: setNome, email, mudarEmail: setEmail, erro, gravando,
    adicionar: () => void adicionar(),
    tirar: (id: string, quem: string) => void tirar(id, quem),
    exigeSenha: senha.ligado, senhaCarregada: senha.carregado, podeExigir: prontas > 0,
    mudarSenha: (ligado: boolean) => void mudarSenha(ligado),
  };
}
