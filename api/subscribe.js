export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Permitir apenas requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const data = req.body || {};
    
    // Configurações do ActiveCampaign
    const AC_API_KEY = process.env.ACTIVE_API_KEY;
    const AC_BASE_URL = 'https://ambientalpro.api-us1.com/api/3';
    
    if (!AC_API_KEY) {
      console.error("Erro: Variável de ambiente ACTIVE_API_KEY não configurada.");
      return res.status(500).json({ error: 'Erro de configuração interna do servidor.' });
    }

    // Extrair os dados recebidos do front-end
    const {
      name = '',
      email = '',
      whatsapp = '',
      graduation = '',
      education_area = '',
      utm_term = '',
      utm_campaign = '',
      utm_source = '',
      utm_medium = '',
      utm_content = ''
    } = data;

    if (!email) {
      return res.status(400).json({ error: 'O email é obrigatório.' });
    }

    // Obter a data atual no formato DD/MM/YYYY
    const currentDate = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    // Montar os campos personalizados filtrando valores vazios (evitar enviar string vazia se não precisar)
    const fieldValues = [
      { field: "772", value: utm_term },
      { field: "773", value: currentDate },
      { field: "774", value: graduation },
      { field: "775", value: education_area },
      { field: "776", value: utm_campaign },
      { field: "777", value: utm_source },
      { field: "778", value: utm_medium },
      { field: "779", value: utm_content }
    ].filter(f => f.value && f.value !== "");

    const contactPayload = {
      contact: {
        email: email,
        firstName: name,
        phone: whatsapp,
        fieldValues: fieldValues
      }
    };

    // Passo 1: Sincronizar contato (Cria ou Atualiza)
    const syncResponse = await fetch(`${AC_BASE_URL}/contact/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Token': AC_API_KEY
      },
      body: JSON.stringify(contactPayload)
    });

    if (!syncResponse.ok) {
      const errorData = await syncResponse.text();
      console.error("Erro da API do ActiveCampaign (Sync):", errorData);
      return res.status(syncResponse.status).json({ error: 'Falha ao sincronizar o contato.' });
    }

    const syncResult = await syncResponse.json();
    const contactId = syncResult.contact.id;

    // Passo 2: Adicionar a Tag (ID 453 - [L18][PÓS][GGSR] Lead)
    const tagPayload = {
      contactTag: {
        contact: contactId,
        tag: "453"
      }
    };

    const tagResponse = await fetch(`${AC_BASE_URL}/contactTags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Token': AC_API_KEY
      },
      body: JSON.stringify(tagPayload)
    });

    if (!tagResponse.ok) {
      const errorData = await tagResponse.text();
      console.error(`Erro da API do ActiveCampaign (Tags) para o contato ${contactId}:`, errorData);
      // Podemos prosseguir pois o lead principal foi criado com sucesso.
    }

    // Retorna sucesso para o front-end
    return res.status(200).json({ success: true, message: 'Inscrição registrada com sucesso!' });

  } catch (error) {
    console.error("Erro interno não tratado no Serverless Function:", error);
    return res.status(500).json({ error: 'Erro interno no processamento da requisição.' });
  }
}
