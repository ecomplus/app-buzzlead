const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
const logger = require('firebase-functions/logger')
const getAppData = require('../store-api/get-app-data')
const sendConversion = require('./send-conversions')
const updateConversion = require('./update-conversions')

const debugAxiosError = error => {
  const err = new Error(error.message)
  if (error.response) {
    err.status = error.response.status
    err.response = error.response.data
  }
  err.request = error.config
  logger.error(err)
}

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
        const { token, api_key: apikey } = appData
        if (token && apikey) {
          const d = new Date()
          d.setDate(d.getDate() - 2)
          const endpoint = '/orders.json' +
            '?fields=_id,number,amount,financial_status,utm,buyers,created_at,metafields' +
            '&financial_status.current=paid' +
            '&utm.content=buzzlead' +
            `&updated_at>=${d.toISOString()}` +
            '&sort=number' +
            '&limit=1000'
          try {
            const { response } = await appSdk.apiRequest(storeId, endpoint, 'GET')
            const orders = response.data.result
            logger.info(`start exporting ${orders.length} orders for #${storeId}`, { orders })
            for (let i = 0; i < orders.length; i++) {
              if (i > 0) {
                await new Promise((resolve) => setTimeout(resolve, 500))
              }
              const order = orders[i]
              const { metafields } = order
              const hasSendedConversion = metafields?.find(({ field }) => field === 'buzzlead:send')
              if (!hasSendedConversion) {
                logger.info(`sending new order ${order.number} ${order._id} for #${storeId}`, { order })
                try {
                  await sendConversion({ appSdk, storeId, auth }, order, appData)
                } catch (err) {
                  logger.warn(`failed sending order ${order.number} ${order._id} for #${storeId}`)
                  debugAxiosError(err)
                }
                continue
              }
              logger.info(`updating order ${order.number} ${order._id} for #${storeId}`)
              try {
                await updateConversion({ appSdk, storeId, auth }, order, appData)
              } catch (err) {
                logger.warn(`failed updating order ${order.number} ${order._id} for #${storeId}`)
                debugAxiosError(err)
              }
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
