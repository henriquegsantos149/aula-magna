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
      origin = 'ggsr',
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

    // Obter a data atual
    const currentDate = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const currentDateISO = new Date().toISOString();

    let fieldValues = [];
    let tagId = "";

    // Normalização das UTMs recebidas
    const utm_term_val = utm_term || data.l20psggsr_utm_term || data.l19psggsr_utm_term || '';
    const utm_campaign_val = utm_campaign || data.l20psggsr_utm_campaign || data.l19psggsr_utm_campaign || '';
    const utm_source_val = utm_source || data.l20psggsr_utm_source || data.l19psggsr_utm_source || '';
    const utm_medium_val = utm_medium || data.l20psggsr_utm_medium || data.l19psggsr_utm_medium || '';
    const utm_content_val = utm_content || data.l20psggsr_utm_content || data.l19psggsr_utm_content || '';

    // Configuração baseada na origem da requisição
    if (origin === 'iama') {
      fieldValues = [
        { field: "844", value: utm_term_val },
        { field: "847", value: currentDateISO },
        { field: "845", value: graduation },
        { field: "846", value: education_area },
        { field: "840", value: utm_campaign_val },
        { field: "841", value: utm_source_val },
        { field: "842", value: utm_medium_val },
        { field: "843", value: utm_content_val }
      ].filter(f => f.value && f.value !== "");
      
      tagId = "470"; // [L02][PÓS][IA.MA] Lead
    } else {
      // [L20][PÓS][GGSR] Tracking Fields & Tag
      fieldValues = [
        { field: "848", value: utm_term_val },             // [L20][PÓS][GGSR] UTM Term
        { field: "849", value: currentDateISO },            // [L20][PÓS][GGSR] UTM Data de Inscrição
        { field: "850", value: graduation },                // [L20][PÓS][GGSR] UTM Possui Graduação
        { field: "851", value: education_area },            // [L20][PÓS][GGSR] UTM Área de Formação
        { field: "852", value: utm_campaign_val },          // [L20][PÓS][GGSR] UTM Campaign
        { field: "853", value: utm_source_val },            // [L20][PÓS][GGSR] UTM Source
        { field: "854", value: utm_medium_val },            // [L20][PÓS][GGSR] UTM Medium
        { field: "855", value: utm_content_val }            // [L20][PÓS][GGSR] UTM Content
      ].filter(f => f.value && f.value !== "");
      
      tagId = "473"; // [L20][PÓS][GGSR] Lead
    }

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

    // Passo 2: Adicionar a Tag
    const tagPayload = {
      contactTag: {
        contact: contactId,
        tag: tagId
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
