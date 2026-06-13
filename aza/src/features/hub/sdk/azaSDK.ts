/**
 * SDK script injected into every community mini-app WebView via
 * injectedJavaScriptBeforeContentLoaded.
 *
 * Exposes window.aza to the page. Each method returns a Promise resolved by
 * a native PostMessage round-trip.
 *
 * Message format (JS → native):  { id, method, params }
 * Response format (native → JS): dispatched as a window 'message' event
 *                                 with data = JSON.stringify({ id, result?, error? })
 */
export const AZA_SDK_JS = `
(function () {
  'use strict';
  if (window.aza) return;

  var pending = {};
  var seq = 0;

  window.addEventListener('message', function (event) {
    var msg;
    try { msg = JSON.parse(event.data); } catch (e) { return; }
    if (!msg || !msg.id || !pending[msg.id]) return;
    var cb = pending[msg.id];
    delete pending[msg.id];
    if (msg.error) {
      cb.reject(new Error(msg.error));
    } else {
      cb.resolve(msg.result);
    }
  });

  function call(method, params) {
    return new Promise(function (resolve, reject) {
      var id = (++seq) + '-' + Date.now();
      pending[id] = { resolve: resolve, reject: reject };
      var payload = JSON.stringify({ id: id, method: method, params: params || {} });
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(payload);
      } else {
        delete pending[id];
        reject(new Error('aza SDK: not running inside Aza'));
      }
    });
  }

  window.aza = {
    /**
     * Get the authenticated user's profile.
     * Always available once consent is granted.
     * @returns {Promise<{ username, firstName, lastName, avatarUrl, phone?, email? }>}
     */
    getUser: function () { return call('getUser'); },

    /**
     * Get the user's wallet balance.
     * Requires READ_BALANCE permission.
     * @returns {Promise<{ balance: number }>}
     */
    getBalance: function () { return call('getBalance'); },

    /**
     * Request a payment from the user (shows native confirmation).
     * Requires MAKE_PAYMENTS permission.
     * @param {{ amount: number, recipientIdentifier: string, note?: string, idempotencyKey: string }} params
     * @returns {Promise<{ transactionId, status, amount, recipientUsername, note }>}
     */
    requestPayment: function (params) {
      if (!params || !params.amount || !params.recipientIdentifier || !params.idempotencyKey) {
        return Promise.reject(new Error('amount, recipientIdentifier and idempotencyKey are required'));
      }
      return call('requestPayment', params);
    },

    /**
     * Close this mini app.
     */
    close: function () { return call('close'); },

    /**
     * Open the native share sheet.
     * @param {{ title?: string, message: string }} params
     */
    share: function (params) { return call('share', params); },

    version: '1.0.0',
  };

  window.dispatchEvent(new Event('azaReady'));
})();
`;
