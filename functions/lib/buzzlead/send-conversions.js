const axios = require('axios')
const ecomUtils = require('@ecomplus/utils')
const FormData = require('form-data')

function convertIsoToDateString(isoString) {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

module.exports = async ({ appSdk, storeId, auth }, order, appData) => {
  console.log('activating send conversion', JSON.stringify(order), JSON.stringify(appData))
  const { token, apikey, sendEmail, campaignId, email } = appData
  const orderNumber = order.number
  const { amount, utm } = order
  const indicationCode = utm && utm.content === 'buzzlead' && utm.term
  const amountValue = amount.total - amount.freight
  const { buyers: [buyer] } = order
  async function sendConversionRequest() {
    const url = `https://app.buzzlead.com.br/api/service/${email}/notification/convert` // Replace with the actual endpoint URL
    const form = new FormData()
    if (campaignId) {
      form.append('campanha', Number(campaignId)) // Replace with actual campaign ID
    }
    form.append('codigo', indicationCode) // Replace with the actual indication code
    form.append('pedido', orderNumber) // Replace with the actual order number
    form.append('valor', amountValue) // Replace with actual value if available
    form.append('data', convertIsoToDateString(order.created_at)) // Replace with the actual closing date of the sale
    form.append('index', 1) // Replace with the actual conversion moment index if available
    // form.append('codigoVoucher', 'voucher-code') // Replace with the actual voucher code if applicable
    form.append('notSendMail', !sendEmail) // Set to 'true' or 'false' to control email sending
    form.append('nome', ecomUtils.fullName(buyer)) // Replace with the actual name of the person who made the conversion
    form.append('email', buyer.main_email) // Replace with the actual email of the person who made the conversion
    form.append('documento', buyer.doc_number) // Replace with the actual CPF/CNPJ of the person who made the conversion
    form.append('telefone', ecomUtils.phone(buyer)) // Replace with the actual phone number of the person who made the conversion

    const headers = {
      'x-api-token-buzzlead': token, // Replace with your actual API token
      'x-api-key-buzzlead': apikey, // Replace with your actual API key
      ...form.getHeaders() // This will set the correct Content-Type and boundary for the multipart/form-data
    }

    try {
      const response = await axios.post(url, form, { headers })
      console.log('response data', response.data)
      if (response.status === 201) {
        const responseData = response.data
        console.log('Request successful:', responseData)
        await appSdk.apiRequest(
          storeId,
          `/orders/${order._id}/metafields.json`,
          'POST',
          {
            _id: ecomUtils.randomObjectId(),
            field: 'buzzlead:send',
            value: order.number
          },
          auth
        )

        if (responseData.success) {
          console.log('Conversion was successful:', responseData.conversão)
        } else {
          console.log('Conversion failed:', responseData)
        }
      } else {
        console.log('Unexpected response status:', response.status);
      }
    } catch (error) {
      console.error('Error making request:', error);
    }
  }
  sendConversionRequest()
}
