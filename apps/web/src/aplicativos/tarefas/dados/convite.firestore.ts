// O convite do nads (15/10/2026: "a redefinição de senha e o link de cadastro para usuários"), no banco do Entregas e
// com as regras de lá (firestore.rules, convites/{codigo}): o código é a senha — quem tem o link entra.
//   tipo 'novo'   a pessoa cria a própria conta: o login no Firebase Auth e usuarios/{uid} com exatamente os papéis
//                 do convite (a regra confere) e o cargo (departamento e nível) que o admin escolheu
//   tipo 'reset'  a pessoa troca a senha da conta dela (uidAlvo): o navegador não troca a senha de outra conta, quem
//                 troca é o serviço de contas (Apps Script do Entregas), cujo endereço vem no próprio convite
// Vale 24 horas e uma vez só. A página do convite é pública (sem login); tudo roda numa instância à parte do Firebase.
import { usuarios } from '@nads/core';
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, initializeFirestore, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { bancoDoEntregas, comAppAParte } from './entregas.firestore';

/** O começo do endereço do serviço de contas (Apps Script publicado como aplicativo web). */
const SERVICO_DE_CONTAS = 'https://script.google.com/macros/s/';

export interface ConviteDoNads {
  codigo: string;
  tipo: 'novo' | 'reset';
  roles: string[];
  departamento: usuarios.Departamento | null;
  nivel: usuarios.Nivel | null;
  /** reset: o nome da pessoa */
  nome: string;
  /** reset: o login da pessoa */
  email: string;
  contasUrl: string;
  usado: boolean;
  vencido: boolean;
}

/** O convite pelo código (null = não existe). */
export async function lerConvite(codigo: string): Promise<ConviteDoNads | null> {
  if (!/^[a-z0-9]{16,64}$/i.test(codigo)) return null;
  const s = await getDoc(doc(bancoDoEntregas(), 'convites', codigo));
  if (!s.exists()) return null;
  const d = s.data();
  const expira = d.expiraEm instanceof Timestamp ? d.expiraEm.toMillis() : 0;
  return {
    codigo,
    tipo: d.tipo === 'reset' ? 'reset' : 'novo',
    roles: Array.isArray(d.roles) ? d.roles.map(String) : [],
    departamento: usuarios.ehDepartamento(d.departamento) ? d.departamento : null,
    nivel: usuarios.ehNivel(d.nivel) ? d.nivel : null,
    nome: String(d.nome || ''),
    email: String(d.email || ''),
    contasUrl: String(d.contasUrl || ''),
    usado: d.usado === true,
    vencido: !expira || expira < Date.now(),
  };
}

const mensagemDoAuth = (e: unknown) => {
  const c = String((e as { code?: string })?.code || '');
  return c === 'auth/email-already-in-use' ? 'Já existe um acesso com esse nome. Escolha outro (por exemplo, com o sobrenome).'
    : c === 'auth/weak-password' ? 'A senha é fraca demais.'
      : c === 'auth/network-request-failed' ? 'Sem internet. Tente de novo.'
        : 'Não deu certo (' + (c || String((e as Error)?.message || e)) + ').';
};

/** O convite 'novo': cria o login e o cadastro da pessoa e queima o convite. Devolve o login (e-mail). */
export async function aceitarCadastro(c: ConviteDoNads, nome: string, senha: string): Promise<string> {
  const limpo = nome.trim().replace(/\s+/g, ' ');
  const email = usuarios.emailDoNome(limpo);
  return comAppAParte(async app => {
    const auth = getAuth(app);
    let uid: string;
    try { uid = (await createUserWithEmailAndPassword(auth, email, senha)).user.uid; } catch (e) { throw new Error(mensagemDoAuth(e), { cause: e }); }
    const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
    const agora = new Date().toISOString();
    await setDoc(doc(db, 'usuarios', uid), {
      nome: limpo, email, roles: c.roles, codigoConvite: c.codigo, ativo: true, criadoEm: agora,
      ...(c.departamento ? { departamento: c.departamento } : {}), ...(c.nivel ? { nivel: c.nivel } : {}),
    });
    await updateDoc(doc(db, 'convites', c.codigo), { usado: true, usadoEm: agora, nome: limpo }).catch(() => undefined);
    await signOut(auth).catch(() => undefined);
    return email;
  });
}

/** O convite 'reset': o serviço de contas troca a senha; depois entra uma vez com ela e queima o convite. */
export async function trocarSenhaPeloConvite(c: ConviteDoNads, senha: string): Promise<void> {
  // só o serviço de contas do Entregas (Apps Script): a trava de rede (scripts/conexoes.mjs) confere esta linha
  if (!c.contasUrl.startsWith(SERVICO_DE_CONTAS)) throw new Error('O convite veio sem o endereço do serviço de contas. Peça um link novo.');
  let resp: { ok?: boolean; erro?: string } | null;
  try {
    // text/plain evita o preflight de CORS, que o Apps Script não responde (como no Entregas)
    const r = await fetch(c.contasUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ acao: 'resetar', codigo: c.codigo, senha }) });
    resp = await r.json();
  } catch (e) { throw new Error('Não consegui falar com o serviço de contas. Tente de novo.', { cause: e }); }
  if (!resp || !resp.ok) throw new Error((resp && resp.erro) || 'O serviço de contas recusou a troca.');
  if (!c.email) return;
  await comAppAParte(async app => {
    const auth = getAuth(app);
    await signInWithEmailAndPassword(auth, c.email, senha);
    await updateDoc(doc(initializeFirestore(app, {}), 'convites', c.codigo), { usado: true, usadoEm: new Date().toISOString() });
    await signOut(auth);
  }).catch(() => undefined);
}
