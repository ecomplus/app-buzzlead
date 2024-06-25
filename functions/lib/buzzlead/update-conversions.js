const axios = require('axios')
const FormData = require('form-data')

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

module.exports = async (order, appData) => {
  const { token, apikey, email } = appData
  const orderNumber = order.number
  const conversionStatus = parseStatus(order.financial_status && order.financial_status.current)
  async function updateConversion() {
    const url = `https://api.buzzlead.com/api/service/${email}/bonus/status/${orderNumber}/${conversionStatus} `; // Replace with the actual endpoint URL
    const form = new FormData();
    if (conversionStatus === 'pendente' || conversionStatus === 'cancelado') {
      form.append('reason', 'Cliente não realizou ação de pagamento')
    }
  
    const headers = {
      'x-api-token-buzzlead': token, // Replace with your actual API token
      'x-api-key-buzzlead': apikey, // Replace with your actual API key
      ...form.getHeaders() // This will set the correct Content-Type and boundary for the multipart/form-data
    };
  
    try {
      const response = await axios.post(url, form, { headers });
      if (response.status === 201) {
        const responseData = response.data;
        console.log('Request successful:', responseData);
  
        if (responseData.success) {
          console.log('Conversion was successful:', responseData.conversão);
        } else {
          console.log('Conversion failed:', responseData);
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

