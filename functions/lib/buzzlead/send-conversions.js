const axios = require('axios')
const ecomUtils = require('@ecomplus/utils')

function convertIsoToDateString(isoString) {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

module.exports = async ({ appSdk, storeId, auth }, order, appData) => {
  console.log('activating send conversion', order._id, storeId)
  const { token, api_key, sendEmail, campaignId, email } = appData
  const orderNumber = order.number
  const { amount, utm } = order
  const indicationCode = utm && utm.content === 'buzzlead' && utm.term
  const amountValue = amount.total - amount.freight
  const { buyers: [buyer] } = order
  async function sendConversionRequest() {
    const url = `https://app.buzzlead.com.br/api/service/${email}/notification/convert` // Replace with the actual endpoint URL
    let phoneNumber = ecomUtils.phone(buyer).replace(/\D/g, '') || ''
    if (phoneNumber.length < 10) {
      phoneNumber = `11${phoneNumber}`.padEnd(10, '9')
    }
    const data = {
      pedido: String(orderNumber),
      codigo: indicationCode,
      valor: amountValue,
      data: convertIsoToDateString(order.created_at),
      index: 1,
      notSendMail: !sendEmail,
      nome: ecomUtils.fullName(buyer),
      documento: buyer.doc_number
    }
    if (phoneNumber.length === 10 || phoneNumber.length === 11) {
      data.telefone = phoneNumber
    }
    if (buyer.main_email?.endsWith('.com') || buyer.main_email?.endsWith('.com.br')) {
      data.email = buyer.main_email
    }
    if (campaignId) {
      data.campanha = Number(campaignId)
    }
    
    const headers = {
      'x-api-token-buzzlead': token, // Replace with your actual API token
      'x-api-key-buzzlead': api_key, // Replace with your actual API key
      'Content-Type': 'application/json'
    }

    try {
      console.log('before sent conversion', JSON.stringify(data))
      const response = await axios.post(url, data, { headers })
      console.log('response data', response.data)
      if (response.status === 201) {
        const responseData = response.data
        const metafields = order.metafields || []
        metafields.push({
          _id: ecomUtils.randomObjectId(),
          field: 'buzzlead:send',
          value: String(order.number)
        })
        console.log('Request successful:', responseData)
        await appSdk.apiRequest(
          storeId,
          `/orders/${order._id}.json`,
          'PATCH',
          {
            metafields
          },
          auth
        )

        if (responseData.success) {
          console.log('Conversion send was successful', responseData.conversão && responseData.conversão.success);
          resolve(responseData)
        } else {
          console.log('Conversion failed:', responseData);
          reject(responseData)
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
