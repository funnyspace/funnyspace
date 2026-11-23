/* Request a fresh Cloudflare token for each Supabase OTP request. */
(() => {
  'use strict';
  let loading;

  function loadTurnstile() {
    if (globalThis.turnstile) return Promise.resolve(globalThis.turnstile);
    if (loading) return loading;

    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      const timeout = setTimeout(fail, 15000);
      function fail() {
        clearTimeout(timeout);
        script.remove();
        reject(new Error('Bot verification could not load. Check your connection and try again.'));
      }
      script.onerror = fail;
      script.onload = () => {
        if (!globalThis.turnstile) return fail();
        clearTimeout(timeout);
        resolve(globalThis.turnstile);
      };
      document.head.append(script);
    }).catch(error => {
      loading = undefined;
      throw error;
    });
    return loading;
  }

  globalThis.BillNestTurnstile = async function (sitekey, host, signal) {
    const turnstile = await loadTurnstile();
    signal?.throwIfAborted();
    if (!host?.isConnected) throw new Error('Reopen the sign-in form and try again.');

    const widget = document.createElement('div');
    host.append(widget);
    let widgetId;
    let timeout;
    let cancel;
    try {
      return await new Promise((resolve, reject) => {
        const fail = () => reject(new Error('Bot verification did not complete. Please try again.'));
        cancel = () => reject(signal.reason);
        signal?.addEventListener('abort', cancel, {once: true});
        timeout = setTimeout(fail, 120000);
        widgetId = turnstile.render(widget, {
          sitekey,
          size: 'flexible',
          appearance: 'interaction-only',
          execution: 'execute',
          retry: 'never',
          'response-field': false,
          callback: token => token ? resolve(token) : fail(),
          'error-callback': fail,
          'expired-callback': fail,
          'timeout-callback': fail,
          'unsupported-callback': fail
        });
        turnstile.execute(widgetId);
      });
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', cancel);
      if (widgetId !== undefined) turnstile.remove(widgetId);
      widget.remove();
    }
  };
})();
