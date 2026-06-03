export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const {
    name,
    email,
    whatsapp,
    graduation,
    education_area,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term
  } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  // Configuration from Environment Variables
  const AC_API_URL = process.env.ACTIVE_CAMPAIGN_URL || 'https://ambientalpro.api-us1.com';
  const AC_API_KEY = process.env.ACTIVE_CAMPAIGN_KEY || '9617e0716b9a89bc87a2d382d9aeedc19df5bb57f5fd0af5278e9d788fe96c711fa0ebe6';
  const TAG_ID = '453'; // [L18][PÓS][GGSR] Lead Tag ID

  if (!AC_API_KEY) {
    console.error("ACTIVE_CAMPAIGN_KEY is not defined");
    return res.status(500).json({ message: 'Server configuration error' });
  }

  // Format subscription date in Brasília time (GMT-3)
  const now = new Date();
  const offsetMs = -3 * 60 * 60 * 1000;
  const localTime = new Date(now.getTime() + offsetMs);
  const formattedDate = localTime.toISOString().slice(0, 19).replace('T', ' ');

  // Helper to add field values conditionally
  const addField = (fieldsArray, fieldId, value) => {
    if (value !== undefined && value !== null && value !== '') {
      fieldsArray.push({ field: fieldId, value: String(value) });
    }
  };

  const fieldValues = [];
  // Map Custom Fields with verified ActiveCampaign IDs for [L18][PÓS][GGSR]
  addField(fieldValues, '772', utm_term);           // [L18][PÓS][GGSR] UTM Term
  addField(fieldValues, '773', formattedDate);      // [L18][PÓS][GGSR] UTM Data de Inscrição
  addField(fieldValues, '774', graduation);         // [L18][PÓS][GGSR] UTM Possui Graduação
  addField(fieldValues, '775', education_area);     // [L18][PÓS][GGSR] UTM Área de Formação
  addField(fieldValues, '776', utm_campaign);       // [L18][PÓS][GGSR] UTM Campaign
  addField(fieldValues, '777', utm_source);         // [L18][PÓS][GGSR] UTM Source
  addField(fieldValues, '778', utm_medium);         // [L18][PÓS][GGSR] UTM Medium
  addField(fieldValues, '779', utm_content);        // [L18][PÓS][GGSR] UTM Content

  // Split name into first and last name
  const nameParts = (name || '').trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const contactPayload = {
    contact: {
      email,
      firstName,
      lastName,
      phone: whatsapp,
      fieldValues
    }
  };

  let contactId = null;
  let activeCampaignSuccess = false;
  let activeCampaignError = null;

  // 1. Sync Contact to ActiveCampaign
  try {
    const contactResponse = await fetch(`${AC_API_URL}/api/3/contact/sync`, {
      method: 'POST',
      headers: {
        'Api-Token': AC_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactPayload)
    });

    if (contactResponse.ok) {
      const contactData = await contactResponse.json();
      contactId = contactData.contact ? contactData.contact.id : null;
      activeCampaignSuccess = true;

      // 2. Apply Tag [L18][PÓS][GGSR] Lead (ID: 453)
      if (contactId) {
        const tagPayload = {
          contactTag: {
            contact: contactId,
            tag: TAG_ID
          }
        };

        const tagResponse = await fetch(`${AC_API_URL}/api/3/contactTags`, {
          method: 'POST',
          headers: {
            'Api-Token': AC_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(tagPayload)
        });

        if (!tagResponse.ok) {
          const errorText = await tagResponse.text();
          console.error('ActiveCampaign Tag Sync Error:', errorText);
        }
      }
    } else {
      activeCampaignError = await contactResponse.text();
      console.error('ActiveCampaign Contact Sync Failed:', activeCampaignError);
    }
  } catch (error) {
    activeCampaignError = error.message;
    console.error('ActiveCampaign API Request Error:', error);
  }

  // Respond to the client
  if (activeCampaignSuccess) {
    return res.status(200).json({
      success: true,
      message: 'Lead processed successfully',
      contactId
    });
  } else {
    return res.status(500).json({
      success: false,
      message: 'Failed to process lead in ActiveCampaign',
      activeCampaignError
    });
  }
}
