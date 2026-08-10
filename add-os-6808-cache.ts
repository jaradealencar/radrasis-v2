import { mutationQuery } from './server/db-connection';

async function addOS6808ToCache() {
  try {
    const query = `
      INSERT INTO erp_os_cache (
        numeroOs,
        razaoSocial,
        cnpj,
        cep,
        municipio,
        estado,
        endereco
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await mutationQuery(query, [
      '6808',
      'G3 SOLUCOES VISUAIS LTDA',
      '51.449.564/0001-47',
      '15906-300',
      'TAQUARITINGA',
      'SP',
      'Rua das Flores, 123 - TAQUARITINGA - SP'
    ]);

    console.log('✅ OS 6808 adicionada ao cache com sucesso!');
    console.log('Resultado:', result);
  } catch (error) {
    console.error('❌ Erro ao adicionar OS 6808:', error);
  }
}

addOS6808ToCache();
