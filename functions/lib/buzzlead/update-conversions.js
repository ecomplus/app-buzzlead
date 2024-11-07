const axios = require('axios')
const ecomUtils = require('@ecomplus/utils')

const parseStatus = status => {
  switch (status) {
    case 'paid':
      return 'confirmado'
    case 'unauthorized':
    case 'voided':
    case 'refunded':
      return 'cancelado' 
    default: 
      return 'pendente'
  }
}

module.exports = async ({ appSdk, storeId, auth }, order, appData) => {
  const { token, api_key, email } = appData
  const orderNumber = order.number
  const conversionStatus = parseStatus(order.financial_status && order.financial_status.current)
  async function updateConversion() {
    const url = `https://app.buzzlead.com.br/api/service/${email}/bonus/status/${orderNumber}/${conversionStatus} `; // Replace with the actual endpoint URL
    const data = {

    }
    if (conversionStatus === 'pendente' || conversionStatus === 'cancelado') {
      data['reason'] = 'Cliente não realizou ação de pagamento'
    }
  
    const headers = {
      'x-api-token-buzzlead': token, // Replace with your actual API token
      'x-api-key-buzzlead': api_key, // Replace with your actual API key
      'Content-Type': 'applications/json'
    };
  
    try {
      const response = await axios.post(url, data, { headers });
      if (response.status === 201) {
        const responseData = response.data;
        console.log('Request successful:', responseData);
        const metafields = order.metafields || []
        metafields.push({
          _id: ecomUtils.randomObjectId(),
          field: 'buzzlead:update',
          value: order.number
        })
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
          console.log('Conversion update was successful', responseData.conversão && responseData.conversão.success);
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
  
  updateConversion();

}

