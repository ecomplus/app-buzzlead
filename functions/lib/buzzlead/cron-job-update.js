const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
const logger = require('firebase-functions/logger')
const getAppData = require('../store-api/get-app-data')
const sendConversion = require('./send-conversions')
const updateConversion = require('./update-conversions')

const listStoreIds = () => {
  const storeIds = []
  const date = new Date()
  date.setHours(date.getHours() - 48)
  return firestore()
    .collection('ecomplus_app_auth')
    .where('updated_at', '>', firestore.Timestamp.fromDate(date))
    .get().then(querySnapshot => {
      querySnapshot.forEach(documentSnapshot => {
        const storeId = documentSnapshot.get('store_id')
        if (storeIds.indexOf(storeId) === -1) {
          storeIds.push(storeId)
        }
      })
      return storeIds
    })
}

const fetchWaitingOrders = async ({ appSdk, storeId }) => {
  const auth = await appSdk.getAuth(storeId)
  return new Promise((resolve, reject) => {
    getAppData({ appSdk, storeId, auth })
      .then(async (appData) => {
        resolve()
        const { token, apikey } = appData
        if (token && apikey) {
          const d = new Date()
          d.setDate(d.getDate() - 10)
          const endpoint = '/orders.json' +
            '?fields=_id,number,amount,financial_status,utm,buyers,created_at,metafields' +
            '&financial_status.current=paid' +
            '&metafields.field!=buzzlead:update' +
            `&updated_at>=${d.toISOString()}` +
            '&sort=number' +
            '&limit=100'
          try {
            const { response } = await appSdk.apiRequest(storeId, endpoint, 'GET')
            const orders = response.data.result
            console.log('getted orders to sent', orders.length)
            for (let i = 0; i < orders.length; i++) {
              const order = orders[i]
              const { metafields } = order
              const hasSendedConversion = metafields?.find(({field}) => field === 'buzzlead:send')
              if (!hasSendedConversion) {
                await sendConversion({ appSdk, storeId, auth }, order, appData)
                await new Promise((resolve) => setTimeout(resolve, 500))
              }
              console.log('time to send requests')
              await updateConversion({ appSdk, storeId, auth }, order, appData)
            }
          } catch (_err) {
            if (_err.response) {
              const err = new Error(`Failed exporting order for #${storeId}`)
              logger.error(err, {
                request: _err.config,
                response: _err.response.data
              })
            } else {
              logger.error(_err)
            }
          }
        }
      })
      .catch(reject)
  })
}

module.exports = context => setup(null, true, firestore())
  .then(appSdk => {
    return listStoreIds().then(storeIds => {
      const runAllStores = fn => storeIds
        .sort(() => Math.random() - Math.random())
        .map(storeId => fn({ appSdk, storeId }))
      return Promise.all(runAllStores(fetchWaitingOrders))
    })
  })
  .catch(logger.error)
