/* Public Supabase project settings for BillNest.
 * Set these to your project's URL and PUBLISHABLE (or legacy anon) key.
 * Never place a secret or service_role key in this public GitHub Pages file.
 * If left blank, sign-in uses the per-browser connection in Settings > Cloud backup.
 */
window.BILLNEST_AUTH_CONFIG = {
  url: 'https://lqtpimpgasxlqpiopeqc.supabase.co',
  key: 'sb_publishable_CkdlJORVbvWchvnfdilTqw_0MC0BJx2' // Public client-side key. Never substitute service_role, sb_secret_, or a DB password.
};

/* Merchant receiving UPI ID. Set only to the verified BillNest merchant account. */
window.BILLNEST_SUBSCRIPTION_UPI = '9631011998@ptsbi';
