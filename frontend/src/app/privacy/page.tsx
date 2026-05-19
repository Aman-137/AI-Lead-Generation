import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1e0a3c 0%, #15103a 30%, #0f1f3d 60%, #0a1a35 100%)" }}>
      {/* Background effects — same as login/signup */}
      <div className="absolute inset-0 opacity-[0.06]">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="privacyDots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="1" fill="white" /></pattern></defs><rect width="100%" height="100%" fill="url(#privacyDots)" /></svg>
      </div>
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-fuchsia-500/[0.12] blur-3xl" />
      <div className="absolute top-1/3 right-[10%] w-72 h-72 rounded-full bg-violet-500/[0.10] blur-3xl" />
      <div className="absolute -bottom-20 left-1/4 w-80 h-80 rounded-full bg-cyan-500/[0.08] blur-3xl" />
      <div className="absolute bottom-1/3 right-[30%] w-64 h-64 rounded-full bg-amber-500/[0.05] blur-3xl" />

      <div className="relative z-10 min-h-screen py-12 px-6">
        {/* Back to login link */}
        <div className="max-w-3xl mx-auto mb-6">
          <Link href="/login" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Login
          </Link>
        </div>

        {/* Glass container */}
        <div
          className="max-w-3xl mx-auto rounded-3xl border border-white/[0.10] overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.05) 100%)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(255,255,255,0.02), 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        >
          {/* Logo header — attached to glass box */}
          <div className="flex items-center justify-center gap-3 py-5 border-b border-white/[0.08]" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(139,92,246,0.06) 50%, rgba(255,255,255,0.04) 100%)" }}>
            <img src="/images/logo-3.png" alt="Inertia Leads" className="h-12" />
          </div>

          <div className="px-8 md:px-12 py-10">
            {/* Header */}
            <div className="mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 mb-4">
                <svg className="w-3.5 h-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                <span className="text-xs font-medium text-violet-300">Legal</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">Privacy Policy</h1>
              <p className="text-white/40 text-sm mt-2">Last updated: April 16, 2026</p>
            </div>

            {/* Content */}
            <div className="space-y-8 text-white/70 text-sm leading-relaxed">
              <p>
                Inertia Leads (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the Inertia Leads platform (the &quot;Service&quot;), an AI-powered lead generation and email outreach tool. This Privacy Policy explains how we collect, use, store, and protect your information when you use our Service.
              </p>
              <p>
                By using Inertia Leads, you agree to the collection and use of information as described in this policy.
              </p>

              {/* Section 1 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">1. Information We Collect</h2>

                <h3 className="text-sm font-semibold text-white/90 mt-4 mb-2">Account Information</h3>
                <p>When you create an account, we collect your name, email address, and password. Your password is securely hashed and never stored in plaintext.</p>

                <h3 className="text-sm font-semibold text-white/90 mt-4 mb-2">Profile Information</h3>
                <p>You may optionally provide a display name, bio, and profile photo.</p>

                <h3 className="text-sm font-semibold text-white/90 mt-4 mb-2">Email Account Credentials</h3>
                <p>When you connect Gmail or SMTP accounts for sending emails, we store OAuth tokens (for Gmail) and SMTP credentials. All tokens and credentials are encrypted using AES-256-GCM encryption at rest.</p>

                <h3 className="text-sm font-semibold text-white/90 mt-4 mb-2">Lead Data</h3>
                <p>When you use our lead finding feature, we collect publicly available business information including business names, email addresses, phone numbers, websites, addresses, and industry categories from Google Maps and publicly accessible business websites.</p>

                <h3 className="text-sm font-semibold text-white/90 mt-4 mb-2">Email Content</h3>
                <p>We store AI-generated email subjects, bodies, send status, and reply status associated with your campaigns.</p>

                <h3 className="text-sm font-semibold text-white/90 mt-4 mb-2">Usage Data</h3>
                <p>We track your plan type, number of leads found, emails sent, and feature usage to enforce plan limits and improve our Service.</p>
              </div>

              {/* Section 2 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">2. How We Collect Information</h2>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li><span className="font-medium text-white/80">Directly from you:</span> When you sign up, update your profile, upload CSV files, or configure email accounts.</li>
                  <li><span className="font-medium text-white/80">From third-party APIs:</span> We use Serper.dev (Google Maps/Places API) to find publicly listed business information based on your search queries.</li>
                  <li><span className="font-medium text-white/80">From public websites:</span> We scrape publicly available contact information (emails, phone numbers) from business websites that are already indexed by search engines.</li>
                  <li><span className="font-medium text-white/80">From Google OAuth:</span> When you connect Gmail, we request permission to send emails on your behalf and access your email address. We do not read your inbox.</li>
                </ul>
              </div>

              {/* Section 3 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">3. How We Use Your Information</h2>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li>To provide and operate the lead finding, enrichment, and email outreach service</li>
                  <li>To authenticate your identity and manage your account</li>
                  <li>To send emails on your behalf via your connected Gmail or SMTP accounts</li>
                  <li>To generate AI-powered personalized email content using your lead data</li>
                  <li>To track and enforce plan-based usage limits</li>
                  <li>To improve and maintain the Service</li>
                  <li>To communicate with you about your account or the Service</li>
                </ul>
              </div>

              {/* Section 4 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">4. How We Protect Your Information</h2>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li>All data is stored in Supabase, hosted on AWS infrastructure with SOC2 compliance.</li>
                  <li>Gmail OAuth tokens and SMTP passwords are encrypted with AES-256-GCM before storage. They are never stored in plaintext.</li>
                  <li>All data transmission uses HTTPS/TLS encryption.</li>
                  <li>Row Level Security (RLS) is enforced on all database tables, ensuring users can only access their own data.</li>
                  <li>API access is protected with JWT authentication, rate limiting, and input validation.</li>
                  <li>OAuth state parameters are HMAC-signed to prevent cross-site request forgery.</li>
                </ul>
              </div>

              {/* Section 5 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">5. Third-Party Services</h2>
                <p className="mb-3">We use the following third-party services to operate Inertia Leads:</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-white/[0.10] rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-white/[0.06]">
                        <th className="text-left px-4 py-2.5 text-white/90 font-semibold border-b border-white/[0.08]">Service</th>
                        <th className="text-left px-4 py-2.5 text-white/90 font-semibold border-b border-white/[0.08]">Purpose</th>
                        <th className="text-left px-4 py-2.5 text-white/90 font-semibold border-b border-white/[0.08]">Data Shared</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      <tr>
                        <td className="px-4 py-2.5 font-medium text-white/80">Supabase</td>
                        <td className="px-4 py-2.5">Database, authentication, file storage</td>
                        <td className="px-4 py-2.5">Account data, lead data, encrypted tokens</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-medium text-white/80">Google Gmail API</td>
                        <td className="px-4 py-2.5">Sending emails on your behalf</td>
                        <td className="px-4 py-2.5">Email content, recipient addresses</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-medium text-white/80">OpenAI</td>
                        <td className="px-4 py-2.5">AI email and call script generation</td>
                        <td className="px-4 py-2.5">Business name, website summary, industry</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-medium text-white/80">Serper.dev</td>
                        <td className="px-4 py-2.5">Lead finding via Google Maps</td>
                        <td className="px-4 py-2.5">Search queries (niche + location only)</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-medium text-white/80">LemonSqueezy</td>
                        <td className="px-4 py-2.5">Payment processing</td>
                        <td className="px-4 py-2.5">Billing name, email, payment method</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-3">We do not sell, rent, or share your personal data or lead data with any third parties for marketing or advertising purposes.</p>
              </div>

              {/* Section 6 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">6. Google API Disclosure</h2>
                <p className="mb-3">Inertia Leads&apos; use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. Specifically:</p>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li>We only request the minimum scopes necessary: <code className="text-xs bg-white/[0.08] px-1.5 py-0.5 rounded text-violet-300">gmail.send</code> (to send emails) and <code className="text-xs bg-white/[0.08] px-1.5 py-0.5 rounded text-violet-300">userinfo.email</code> (to identify your Gmail address).</li>
                  <li>We do not read, scan, or analyze the content of your Gmail inbox.</li>
                  <li>We do not use Gmail data for advertising or any purpose other than sending emails you explicitly create and approve through our platform.</li>
                  <li>Gmail tokens are encrypted at rest and can be revoked by you at any time by disconnecting your account.</li>
                </ul>
              </div>

              {/* Section 7 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">7. Data Retention</h2>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li><span className="font-medium text-white/80">Account data</span> is retained until you delete your account.</li>
                  <li><span className="font-medium text-white/80">Lead data and campaigns</span> are retained until you delete them or delete your account.</li>
                  <li><span className="font-medium text-white/80">Gmail and SMTP credentials</span> are retained until you disconnect the email account. Upon disconnection, encrypted tokens are permanently deleted.</li>
                  <li><span className="font-medium text-white/80">AI-generated email content</span> is retained as part of your campaign history until you delete the campaign or your account.</li>
                </ul>
                <p className="mt-3">When you delete your account, all associated data (leads, campaigns, emails, connected accounts, usage records) is permanently deleted via cascade deletion.</p>
              </div>

              {/* Section 8 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">8. Your Rights</h2>
                <p className="mb-3">Depending on your location, you may have the following rights:</p>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li><span className="font-medium text-white/80">Access:</span> Request a copy of the personal data we hold about you.</li>
                  <li><span className="font-medium text-white/80">Deletion:</span> Delete your account and all associated data at any time.</li>
                  <li><span className="font-medium text-white/80">Disconnection:</span> Remove connected Gmail or SMTP accounts at any time, which permanently deletes stored credentials.</li>
                  <li><span className="font-medium text-white/80">Export:</span> Request an export of your lead and campaign data.</li>
                  <li><span className="font-medium text-white/80">Correction:</span> Update your profile information at any time through the Settings page.</li>
                  <li><span className="font-medium text-white/80">Objection:</span> Object to processing of your data for certain purposes.</li>
                </ul>
                <p className="mt-3">To exercise any of these rights, contact us at <a href="mailto:info@inertialeads.com" className="text-violet-400 hover:text-violet-300 underline">info@inertialeads.com</a>.</p>
              </div>

              {/* Section 9 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">9. Cold Email Compliance</h2>
                <p className="mb-3">Inertia Leads is a tool that enables users to send outreach emails. Users are solely responsible for ensuring their use of the Service complies with applicable laws, including:</p>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li><span className="font-medium text-white/80">CAN-SPAM Act</span> (United States)</li>
                  <li><span className="font-medium text-white/80">GDPR</span> (European Union)</li>
                  <li><span className="font-medium text-white/80">CASL</span> (Canada)</li>
                  <li><span className="font-medium text-white/80">PECR</span> (United Kingdom)</li>
                </ul>
                <p className="mt-3">All outbound emails generated through our platform include an unsubscribe/opt-out option. We encourage all users to respect opt-out requests promptly.</p>
              </div>

              {/* Section 10 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">10. Cookies</h2>
                <p>Inertia Leads uses essential cookies for authentication and session management through Supabase Auth. These are strictly necessary for the Service to function and cannot be disabled.</p>
                <p className="mt-2">We do not use third-party tracking cookies or advertising cookies.</p>
              </div>

              {/* Section 11 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">11. Children&apos;s Privacy</h2>
                <p>Inertia Leads is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that a child has provided us with personal data, we will take steps to delete it.</p>
              </div>

              {/* Section 12 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">12. Changes to This Policy</h2>
                <p>We may update this Privacy Policy from time to time. When we make significant changes, we will notify you via email or through an in-app notification. Your continued use of the Service after changes are posted constitutes acceptance of the updated policy.</p>
              </div>

              {/* Section 13 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">13. Contact Us</h2>
                <p>If you have questions or concerns about this Privacy Policy or our data practices, contact us at:</p>
                <div className="mt-3 p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <p className="font-medium text-white/90">Email: <a href="mailto:info@inertialeads.com" className="text-violet-400 hover:text-violet-300 underline">info@inertialeads.com</a></p>
                  <p className="font-medium text-white/90 mt-1">Website: <a href="https://inertialeads.com" className="text-violet-400 hover:text-violet-300 underline" target="_blank" rel="noopener noreferrer">inertialeads.com</a></p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-10 pt-6 border-t border-white/[0.08] text-center">
              <p className="text-xs text-white/30">&copy; {new Date().getFullYear()} Inertia Leads. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
