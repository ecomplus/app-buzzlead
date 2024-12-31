const axios = require('axios')
const { firestore } = require('firebase-admin')
const sendConversion = require('../../lib/buzzlead/send-conversions')
const updateConversion = require('../../lib/buzzlead/update-conversions')

// read configured E-Com Plus app data
const getAppData = require('./../../lib/store-api/get-app-data')

const SKIP_TRIGGER_NAME = 'SkipTrigger'
const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'
const ECHO_API_ERROR = 'STORE_API_ERR'

exports.post = async ({ appSdk }, req, res) => {
  // receiving notification from Store API
  const { storeId } = req

  /**
   * Treat E-Com Plus trigger body here
   * Ref.: https://developers.e-com.plus/docs/api/#/store/triggers/
   */
  const trigger = req.body

  // get app configured options
  let auth
  await appSdk.getAuth(storeId).then(_auth => {
    auth = _auth
  })
  getAppData({ appSdk, storeId, auth })

    .then(appData => {
      if (
        Array.isArray(appData.ignore_triggers) &&
        appData.ignore_triggers.indexOf(trigger.resource) > -1
      ) {
        // ignore current trigger
        const err = new Error()
        err.name = SKIP_TRIGGER_NAME
        throw err
      }

      /* DO YOUR CUSTOM STUFF HERE */
      const { resource } = trigger
      let docId
      if (trigger.action !== 'delete' && resource === 'orders') {
        docId = trigger.resource_id || trigger.inserted_id
      }
      /*
      if (docId) {
        console.log('sending order', docId)
        const docEndpoint = `orders/${docId}.json`
        return appSdk.apiRequest(storeId, docEndpoint).then(async ({ response }) => {
          const order = response.data
          const { utm } = order
          if (utm && utm.content === 'buzzlead') {
            if (order && order.financial_status && order.financial_status.current !== 'paid' && order.status !== 'cancelled') {
              await sendConversion({ appSdk, storeId, auth }, order, appData)
            } else if (order && order.financial_status && order.financial_status.current === 'paid') {
              const { metafields } = order
              const hasSendedConversion = metafields?.find(({field}) => field === 'buzzlead:send')
              try {
                if (!hasSendedConversion) {
                  await sendConversion({ appSdk, storeId, auth }, order, appData)
                  await new Promise((resolve) => setTimeout(resolve, 500))
                }
                console.log('time to send requests')
                await updateConversion({ appSdk, storeId, auth }, order, appData)
              } catch (error) {
                console.log('didnt have success', error)
              }
            }
          } else {
            console.log('its not buzzlead')
          }
          
        }).catch(error => {
          console.error(error)
          const status = error.response
            ? error.response.status || 500
            : 409
          return res.sendStatus(status)
        })
      }
      */
      console.log('nothing to do, all done on scheduled function')
      res.sendStatus(204)
    })

    .catch(err => {
      if (err.name === SKIP_TRIGGER_NAME) {
        // trigger ignored by app configuration
        res.send(ECHO_SKIP)
      } else {
        // console.error(err)
        // request to Store API with error response
        // return error status code
        res.status(500)
        const { message } = err
        res.send({
          error: ECHO_API_ERROR,
          message
        })
      }
    })
}
