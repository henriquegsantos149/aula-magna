// Cache em memória para evitar requisições repetidas lentas ao ActiveCampaign na Vercel
let cachedAcFields = null;
let cachedAcFieldsTime = 0;
let cachedAcTags = null;
let cachedAcTagsTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

// Aguarda a entrega durante a requisição; não deixa trabalho solto após a resposta.
async function sendIamaWebhook(payload) {
  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch('https://services.leadconnectorhq.com/hooks/CjEOBshy5Npf1Ri3eL4n/webhook-trigger/f0c49ef6-827f-4f91-8f28-204be8d7209b', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(payload)
    });
    const result = {
      integration: 'iama-leadconnector',
      outcome: response.ok ? 'accepted' : 'http_error',
      status: response.status,
      elapsed_ms: Date.now() - startedAt
    };
    if (response.ok) console.info('Webhook IAMA:', result);
    else console.warn('Webhook IAMA:', result);
    return result;
  } catch (error) {
    const result = {
      integration: 'iama-leadconnector',
      outcome: controller.signal.aborted ? 'timeout' : 'network_error',
      error: error.name,
      elapsed_ms: Date.now() - startedAt
    };
    console.warn('Webhook IAMA:', result);
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  let webhookDelivery;
  const respond = async (status, body) => {
    // Também aguardar em retornos antecipados/erros do ActiveCampaign.
    if (webhookDelivery) await webhookDelivery;
    return res.status(status).json(body);
  };
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
    return await respond(405, { error: 'Method Not Allowed' });
  }

  try {
    const data = req.body || {};
    
    // Configurações do ActiveCampaign
    const AC_API_KEY = process.env.ACTIVE_API_KEY;
    const AC_BASE_URL = 'https://ambientalpro.api-us1.com/api/3';
    
    if (!AC_API_KEY && data.origin !== 'iama') {
      console.error("Erro: Variável de ambiente ACTIVE_API_KEY não configurada.");
      return await respond(500, { error: 'Erro de configuração interna do servidor.' });
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
      return await respond(400, { error: 'O email é obrigatório.' });
    }

    if (origin === 'iama') {
      const limits = [[name, 100], [email, 254], [education_area, 120], [whatsapp, 16]];
      if (limits.some(([value, limit]) => typeof value !== 'string' || value.length > limit)
        || whatsapp.replace(/\D/g, '').length > 15) {
        return await respond(400, { error: 'Um dos campos excede o limite de caracteres permitido.' });
      }
    }

    // Função para remover acentos e caracteres especiais das buscas de título
    const normalizeText = (str) =>
      (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    // Obter a data atual no fuso horário de São Paulo
    const currentDateBR = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const dateParts = currentDateBR.split('/');
    const currentDateYYYYMMDD = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}` : currentDateBR;
    // Data e hora no formato aceito pelos campos datetime do ActiveCampaign (São Paulo não tem horário de verão: -03:00)
    const currentTimeBR = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });
    const currentDateTimeISO = `${currentDateYYYYMMDD}T${currentTimeBR}-03:00`;

    // Normalização das UTMs recebidas
    const utm_term_val = utm_term || data.l20psggsr_utm_term || data.l19psggsr_utm_term || '';
    const utm_campaign_val = utm_campaign || data.l20psggsr_utm_campaign || data.l19psggsr_utm_campaign || '';
    const utm_source_val = utm_source || data.l20psggsr_utm_source || data.l19psggsr_utm_source || '';
    const utm_medium_val = utm_medium || data.l20psggsr_utm_medium || data.l19psggsr_utm_medium || '';
    const utm_content_val = utm_content || data.l20psggsr_utm_content || data.l19psggsr_utm_content || '';

    // Iniciar antes de qualquer chamada ou validação de configuração do ActiveCampaign.
    if (origin === 'iama') {
      const nameParts = (name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      webhookDelivery = sendIamaWebhook({
        origin,
        name,
        firstName,
        lastName,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: whatsapp,
        whatsapp,
        graduation,
        education_area,
        utm_content: utm_content_val,
        utm_term: utm_term_val,
        utm_campaign: utm_campaign_val,
        utm_source: utm_source_val,
        utm_medium: utm_medium_val,
        registered_at: currentDateTimeISO,
        tag: '[AM][BF][POS][IAMA] Lead',
        tags: ['[AM][BF][POS][IAMA] Lead']
      });
      if (!AC_API_KEY) {
        console.error('Erro: Variável de ambiente ACTIVE_API_KEY não configurada.');
        return await respond(500, { error: 'Erro de configuração interna do servidor.' });
      }
    }

    // Passo 0: Buscar a lista de campos customizados dinamicamente do ActiveCampaign (com cache)
    let acFields = [];
    const now = Date.now();
    if (cachedAcFields && (now - cachedAcFieldsTime < CACHE_TTL_MS)) {
      acFields = cachedAcFields;
    } else {
      try {
        const pageSize = 100;
        for (let offset = 0; offset < 5000; offset += pageSize) {
          const fieldsRes = await fetch(`${AC_BASE_URL}/fields?limit=${pageSize}&offset=${offset}`, {
            headers: { 'Api-Token': AC_API_KEY }
          });
          if (!fieldsRes.ok) break;
          const fieldsData = await fieldsRes.json();
          const page = fieldsData.fields || [];
          acFields = acFields.concat(page);
          if (page.length < pageSize) break;
        }
        if (acFields.length > 0) {
          cachedAcFields = acFields;
          cachedAcFieldsTime = now;
        }
      } catch (err) {
        console.warn("Aviso: Falha ao carregar campos customizados do ActiveCampaign dinamicamente:", err);
      }
    }

    // Função para obter o valor formatado correto com base no tipo real do campo no ActiveCampaign
    const getFieldValueForField = (fieldId, fallbackVal, withTime = false) => {
      const found = acFields.find(f => String(f.id) === String(fieldId));
      if (found) {
        if (withTime && found.type === 'datetime') return currentDateTimeISO;
        return (found.type === 'date' || found.type === 'datetime') ? currentDateYYYYMMDD : currentDateBR;
      }
      return fallbackVal;
    };

    let fieldValues = [];
    let tagId = "";

    // Configuração baseada na origem da requisição
    if (origin === 'iama' || origin === 'ggsr') {
      const campaignPrefix = origin === 'iama' ? '[AM][BF][POS][IAMA]' : '[AM][BF][POS][GGSR]';
      const campaignValues = [
        ['UTM Content', utm_content_val],
        ['UTM Term', utm_term_val],
        ['UTM Data de Inscrição', null],
        ['UTM Possui Graduação', graduation],
        ['UTM Área de Formação', education_area],
        ['UTM Campaign', utm_campaign_val],
        ['UTM Source', utm_source_val],
        ['UTM Medium', utm_medium_val]
      ];
      const resolvedFields = campaignValues.map(([title, value]) => {
        const matches = acFields.filter(field =>
          normalizeText(field.title).trim() === normalizeText(`${campaignPrefix} ${title}`)
        );
        return { title, value, field: matches.length === 1 ? matches[0] : null };
      });
      if (resolvedFields.some(item => !item.field)) {
        console.warn(`Campos da campanha ${origin.toUpperCase()} ausentes ou duplicados no ActiveCampaign:`,
          resolvedFields.filter(item => !item.field).map(item => item.title));
        // Se o webhook foi entregue com sucesso, não bloqueia o usuário com 503
        const webhookResult = await webhookDelivery;
        if (webhookResult && webhookResult.outcome === 'accepted') {
          return res.status(200).json({ success: true, message: 'Inscrição registrada com sucesso!' });
        }
        return await respond(503, { error: 'Configuração da campanha indisponível. Tente novamente em instantes.' });
      }

      // Resolver a tag exata, incluindo contas com mais de uma página de tags (com cache)
      const campaignTags = [];
      let allTags = [];
      if (cachedAcTags && (now - cachedAcTagsTime < CACHE_TTL_MS)) {
        allTags = cachedAcTags;
      } else {
        for (let offset = 0; offset < 5000; offset += 100) {
          const tagsResponse = await fetch(`${AC_BASE_URL}/tags?limit=100&offset=${offset}`, {
            headers: { 'Api-Token': AC_API_KEY }
          });
          if (!tagsResponse.ok) break;
          const tagsData = await tagsResponse.json();
          const page = tagsData.tags || [];
          allTags.push(...page);
          if (page.length < 100) break;
        }
        if (allTags.length > 0) {
          cachedAcTags = allTags;
          cachedAcTagsTime = now;
        }
      }
      campaignTags.push(...allTags.filter(tag =>
        normalizeText(tag.tag).trim() === normalizeText(`${campaignPrefix} Lead`)
      ));

      if (campaignTags.length !== 1) {
        console.warn(`Tag da campanha ${origin.toUpperCase()} ausente ou duplicada no ActiveCampaign.`);
        const webhookResult = await webhookDelivery;
        if (webhookResult && webhookResult.outcome === 'accepted') {
          return res.status(200).json({ success: true, message: 'Inscrição registrada com sucesso!' });
        }
        return await respond(503, { error: 'Tag da campanha indisponível. Tente novamente em instantes.' });
      }
      tagId = String(campaignTags[0].id);
      fieldValues = resolvedFields.map(({ field, value }) => ({
        field: String(field.id),
        value: value === null ? getFieldValueForField(field.id, currentDateBR, true) : value
      })).filter(field => field.value && field.value !== '');
    } else {
      return await respond(400, { error: 'Origem de inscrição inválida.' });
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
      if (origin === 'iama') {
        const webhookResult = await webhookDelivery;
        if (webhookResult && webhookResult.outcome === 'accepted') {
          return res.status(200).json({ success: true, message: 'Inscrição registrada com sucesso!' });
        }
      }
      return await respond(syncResponse.status, { error: 'Falha ao sincronizar o contato.' });
    }

    const syncResult = await syncResponse.json();
    const contactId = syncResult.contact.id;

    // Passo 1.5: Buscar os fieldValues existentes do contato e atualizar (PUT) ou criar (POST) explicitamente
    try {
      const existingFvRes = await fetch(`${AC_BASE_URL}/contacts/${contactId}/fieldValues`, {
        headers: { 'Api-Token': AC_API_KEY }
      });

      let existingMap = new Map();
      if (existingFvRes.ok) {
        const existingData = await existingFvRes.json();
        if (Array.isArray(existingData.fieldValues)) {
          existingData.fieldValues.forEach(item => {
            existingMap.set(String(item.field), String(item.id));
          });
        }
      }

      const fvResults = await Promise.allSettled(
        fieldValues.map(fv => {
          const fieldIdStr = String(fv.field);
          if (existingMap.has(fieldIdStr)) {
            const fvRecordId = existingMap.get(fieldIdStr);
            return fetch(`${AC_BASE_URL}/fieldValues/${fvRecordId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Api-Token': AC_API_KEY
              },
              body: JSON.stringify({
                fieldValue: {
                  contact: contactId,
                  field: fv.field,
                  value: fv.value
                }
              })
            });
          } else {
            return fetch(`${AC_BASE_URL}/fieldValues`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Api-Token': AC_API_KEY
              },
              body: JSON.stringify({
                fieldValue: {
                  contact: contactId,
                  field: fv.field,
                  value: fv.value
                }
              })
            });
          }
        })
      );

      // Logar campos rejeitados pelo ActiveCampaign (ex.: data em formato inválido)
      for (let i = 0; i < fvResults.length; i++) {
        const r = fvResults[i];
        if (r.status === 'rejected') {
          console.error(`Falha de rede no campo ${fieldValues[i].field}:`, r.reason);
        } else if (!r.value.ok) {
          const errText = await r.value.text().catch(() => '');
          console.error(`ActiveCampaign rejeitou o campo ${fieldValues[i].field} (valor "${fieldValues[i].value}"):`, errText);
        }
      }
    } catch (fvError) {
      console.error("Erro ao sincronizar fieldValues no ActiveCampaign:", fvError);
    }

    // Passo 2: Adicionar a Tag
    if (tagId) {
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
    }

    // Retorna sucesso para o front-end
    return await respond(200, { success: true, message: 'Inscrição registrada com sucesso!' });

  } catch (error) {
    console.error("Erro interno não tratado no Serverless Function:", error);
    return await respond(500, { error: 'Erro interno no processamento da requisição.' });
  }
}
