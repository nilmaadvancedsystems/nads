'use strict';
// À parte do envios-do-nads.js para o teste (robo/teste-seguranca.js) rodar sem as dependências do robô.
/**
 * O envio do cliente pelo Mandei com a empresa, o cliente e o mês do link (auditoria de segurança, 24/11/2026): a regra aceitava
 * esses campos livres, e quem tinha um link gravava um "extrato" na pasta de outra empresa. O link (ticketsLinks/{ticket}) é
 * gravado pela equipe; sem ele, ou sem o envio dele, o arquivo não vai a lugar nenhum.
 */
function envioDoMandeiConferido(envio, link) {
  const e = link && link.envio;
  if (!e || e.codigo == null || !e.competencia) return Object.assign({}, envio, { erro: 'o link do Mandei não existe mais' });
  return Object.assign({}, envio, { codigo: String(e.codigo), cliente: String(e.cliente || ''), competencia: String(e.competencia) });
}

module.exports = { envioDoMandeiConferido };
