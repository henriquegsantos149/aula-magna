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

    if (origin === 'iama') {
      const limits = [[name, 100], [email, 254], [education_area, 120], [whatsapp, 16]];
      if (limits.some(([value, limit]) => typeof value !== 'string' || value.length > limit)
        || whatsapp.replace(/\D/g, '').length > 15) {
        return res.status(400).json({ error: 'Um dos campos excede o limite de caracteres permitido.' });
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

    // Passo 0: Buscar a lista de campos customizados dinamicamente do ActiveCampaign
    // A conta tem mais de 500 campos (os L20 têm IDs > 900), então é preciso paginar
    let acFields = [];
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
    } catch (err) {
      console.warn("Aviso: Falha ao carregar campos customizados do ActiveCampaign dinamicamente:", err);
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

    // Normalização das UTMs recebidas
    const utm_term_val = utm_term || data.l20psggsr_utm_term || data.l19psggsr_utm_term || '';
    const utm_campaign_val = utm_campaign || data.l20psggsr_utm_campaign || data.l19psggsr_utm_campaign || '';
    const utm_source_val = utm_source || data.l20psggsr_utm_source || data.l19psggsr_utm_source || '';
    const utm_medium_val = utm_medium || data.l20psggsr_utm_medium || data.l19psggsr_utm_medium || '';
    const utm_content_val = utm_content || data.l20psggsr_utm_content || data.l19psggsr_utm_content || '';

    let fieldValues = [];
    let tagId = "";

    // Configuração baseada na origem da requisição
    if (origin === 'iama') {
      const campaignPrefix = '[AM][BF][POS][IAMA]';
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
        console.error('Campos da campanha IAMA ausentes ou duplicados:',
          resolvedFields.filter(item => !item.field).map(item => item.title));
        return res.status(503).json({ error: 'Configuração da campanha indisponível. Tente novamente em instantes.' });
      }

      // Resolver a tag exata, incluindo contas com mais de uma página de tags.
      const campaignTags = [];
      for (let offset = 0; offset < 5000; offset += 100) {
        const tagsResponse = await fetch(`${AC_BASE_URL}/tags?limit=100&offset=${offset}`, {
          headers: { 'Api-Token': AC_API_KEY }
        });
        if (!tagsResponse.ok) throw new Error('Falha ao carregar tags da campanha IAMA.');
        const tagsData = await tagsResponse.json();
        const page = tagsData.tags || [];
        campaignTags.push(...page.filter(tag =>
          normalizeText(tag.tag).trim() === normalizeText(`${campaignPrefix} Lead`)
        ));
        if (page.length < 100) break;
      }
      if (campaignTags.length !== 1) {
        return res.status(503).json({ error: 'Tag da campanha indisponível. Tente novamente em instantes.' });
      }
      tagId = String(campaignTags[0].id);
      fieldValues = resolvedFields.map(({ field, value }) => ({
        field: String(field.id),
        value: value === null ? getFieldValueForField(field.id, currentDateBR, true) : value
      })).filter(field => field.value && field.value !== '');
    } else {
      // Montagem padrão para GGSR
      fieldValues = [
        // L20
        { field: "896", value: utm_term_val },             // [L20][PÓS][GGSR] UTM Term
        { field: "907", value: getFieldValueForField("907", currentDateBR, true) }, // [L20][PÓS][GGSR] UTM Data de Inscrição
        { field: "898", value: graduation },                // [L20][PÓS][GGSR] UTM Possui Graduação
        { field: "899", value: education_area },            // [L20][PÓS][GGSR] UTM Área de Formação
        { field: "900", value: utm_campaign_val },          // [L20][PÓS][GGSR] UTM Campaign
        { field: "904", value: utm_source_val },            // [L20][PÓS][GGSR] UTM Source
        { field: "902", value: utm_medium_val },            // [L20][PÓS][GGSR] UTM Medium
        { field: "903", value: utm_content_val },           // [L20][PÓS][GGSR] UTM Content

        // Fallbacks adicionais de Data para GGSR
        { field: "849", value: getFieldValueForField("849", currentDateBR) }, // [L19][PÓS][GGSR] Data de Inscrição
        { field: "773", value: getFieldValueForField("773", currentDateBR) }, // [L18][PÓS][GGSR] Data de Inscrição
        { field: "401", value: getFieldValueForField("401", currentDateBR) }, // [LISTA DE ESPERA] [POS GGSR] Data de Inscrição
        { field: "352", value: getFieldValueForField("352", currentDateBR) }, // [WEBINARIO] [POS] [GGSR] [L1] Data de Inscrição
        { field: "539", value: getFieldValueForField("539", currentDateBR) }, // [MÓDULO ZERO: PÓS GGSR] Data de Inscrição
        { field: "43",  value: getFieldValueForField("43", currentDateBR) },  // Data
        { field: "3",   value: getFieldValueForField("3", currentDateBR) }   // Inscricao mais recente
      ];

      // Adicionar dinamicamente todos os campos que contêm GGSR/POS/L20/Aula e Data/Inscricao descobertos no ActiveCampaign
      if (acFields.length > 0) {
        acFields.forEach(field => {
          const normTitle = normalizeText(field.title);
          // Apenas campos L20 do GGSR (evita gravar data em campos de outros cursos, ex.: [POS] [GEOPROCESSAMENTO])
          const isL20GgsrDate = normTitle.includes('l20') && normTitle.includes('ggsr') && (normTitle.includes('data') || normTitle.includes('inscric'));

          if (isL20GgsrDate) {
            const val = field.type === 'datetime' ? currentDateTimeISO : field.type === 'date' ? currentDateYYYYMMDD : currentDateBR;
            const existingIndex = fieldValues.findIndex(fv => String(fv.field) === String(field.id));
            if (existingIndex >= 0) {
              fieldValues[existingIndex].value = val;
            } else {
              fieldValues.push({ field: String(field.id), value: val });
            }
          }
        });
      }

      fieldValues = fieldValues.filter(f => f.value && f.value !== "");
      tagId = "486"; // [L20][PÓS][GGSR] Lead
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

    // Envio adicional da IAMA: falhas não alteram a inscrição nem as UTMs do ActiveCampaign.
    if (origin === 'iama') {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      try {
        const webhookResponse = await fetch('https://services.leadconnectorhq.com/hooks/CjEOBshy5Npf1Ri3eL4n/webhook-trigger/f0c49ef6-827f-4f91-8f28-204be8d7209b', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            origin,
            name,
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
            tag: '[AM][BF][POS][IAMA] Lead'
          })
        });
        if (!webhookResponse.ok) {
          console.warn('Webhook IAMA retornou status:', webhookResponse.status);
        }
      } catch (error) {
        console.warn('Webhook IAMA não entregue:', error.name);
      } finally {
        clearTimeout(timeout);
      }
    }

    // Retorna sucesso para o front-end
    return res.status(200).json({ success: true, message: 'Inscrição registrada com sucesso!' });

  } catch (error) {
    console.error("Erro interno não tratado no Serverless Function:", error);
    return res.status(500).json({ error: 'Erro interno no processamento da requisição.' });
  }
}
