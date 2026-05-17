import Link from "next/link";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1e0a3c 0%, #15103a 30%, #0f1f3d 60%, #0a1a35 100%)" }}>
      {/* Background effects */}
      <div className="absolute inset-0 opacity-[0.06]">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="termsDots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="1" fill="white" /></pattern></defs><rect width="100%" height="100%" fill="url(#termsDots)" /></svg>
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
            <img src="/images/logo.png" alt="Inertia Leads" className="h-12" />
          </div>

          <div className="px-8 md:px-12 py-10">
            {/* Header */}
            <div className="mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
                <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className="text-xs font-medium text-amber-300">Legal</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">Terms of Service</h1>
              <p className="text-white/40 text-sm mt-2">Last updated: April 16, 2026</p>
            </div>

            {/* Content */}
            <div className="space-y-8 text-white/70 text-sm leading-relaxed">
              <p>
                These Terms of Service (&quot;Terms&quot;) govern your access to and use of Inertia Leads (the &quot;Service&quot;), operated by Inertia Leads (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). By creating an account or using the Service, you agree to be bound by these Terms.
              </p>

              {/* Section 1 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">1. Description of Service</h2>
                <p>Inertia Leads is an AI-powered lead generation and cold email outreach platform that allows users to:</p>
                <ul className="list-disc list-inside space-y-2 ml-1 mt-3">
                  <li>Find business leads by searching niches and locations via Google Maps data</li>
                  <li>Enrich leads by scraping publicly available contact information from business websites</li>
                  <li>Generate personalized cold emails and call scripts using AI</li>
                  <li>Send emails via connected Gmail or SMTP accounts with automated scheduling</li>
                  <li>Track campaign performance including sends, replies, and lead scores</li>
                </ul>
              </div>

              {/* Section 2 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">2. Account Registration</h2>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li>You must be at least 18 years old to use the Service.</li>
                  <li>You must provide accurate and complete information when creating an account.</li>
                  <li>You are responsible for maintaining the security of your account credentials.</li>
                  <li>You are responsible for all activity that occurs under your account.</li>
                  <li>You must notify us immediately if you suspect unauthorized access to your account.</li>
                </ul>
              </div>

              {/* Section 3 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">3. Acceptable Use</h2>
                <p className="mb-3">You agree to use the Service only for lawful purposes. You must NOT use Inertia Leads to:</p>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li>Send spam, unsolicited bulk emails, or messages that violate anti-spam laws (CAN-SPAM, GDPR, CASL, PECR)</li>
                  <li>Harass, threaten, or send abusive content to any recipient</li>
                  <li>Send emails containing malware, phishing links, or fraudulent content</li>
                  <li>Impersonate another person or entity</li>
                  <li>Scrape or collect data for purposes other than legitimate business outreach</li>
                  <li>Resell, redistribute, or share lead data obtained through our Service with third parties</li>
                  <li>Attempt to circumvent rate limits, plan restrictions, or security measures</li>
                  <li>Use the Service in any way that could damage, disable, or impair our infrastructure</li>
                </ul>
                <p className="mt-3">Violation of these rules may result in immediate account suspension or termination without refund.</p>
              </div>

              {/* Section 4 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">4. Email Sending & Compliance</h2>
                <p className="mb-3">You are solely responsible for the content of emails sent through the Service and for complying with all applicable laws, including:</p>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li><span className="font-medium text-white/80">CAN-SPAM Act:</span> You must not use false or misleading header information, deceptive subject lines, and must honor opt-out requests within 10 business days.</li>
                  <li><span className="font-medium text-white/80">GDPR:</span> You must have a legitimate interest or consent basis for contacting individuals in the EU/EEA.</li>
                  <li><span className="font-medium text-white/80">CASL:</span> You must comply with Canadian anti-spam legislation when contacting Canadian recipients.</li>
                  <li><span className="font-medium text-white/80">PECR:</span> You must comply with UK privacy and electronic communications regulations.</li>
                </ul>
                <p className="mt-3">All emails sent through our Service include an unsubscribe/opt-out mechanism. You must not remove, disable, or tamper with this feature.</p>
              </div>

              {/* Section 5 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">5. Gmail & SMTP Integration</h2>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li>By connecting your Gmail or SMTP account, you authorize us to send emails on your behalf.</li>
                  <li>We only request the minimum permissions necessary (Gmail: send emails and read your email address).</li>
                  <li>We do not read, scan, or access the content of your inbox.</li>
                  <li>All credentials are encrypted at rest using AES-256-GCM encryption.</li>
                  <li>You may disconnect your email accounts at any time, which permanently deletes stored credentials.</li>
                  <li>We are not responsible for any sending limits, suspensions, or bans imposed by Gmail, Microsoft, or your email provider as a result of your usage.</li>
                </ul>
              </div>

              {/* Section 6 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">6. Subscription Plans & Billing</h2>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li>The Service offers subscription plans (Starter, Growth, Agency) with different feature limits.</li>
                  <li>Subscriptions are billed monthly and processed through our payment provider (LemonSqueezy).</li>
                  <li>Prices are listed in USD and are subject to applicable taxes (VAT, sales tax) based on your location. Taxes are calculated and collected by our Merchant of Record.</li>
                  <li>You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period.</li>
                  <li>We do not offer refunds for partial months or unused features within a billing period.</li>
                  <li>We reserve the right to change pricing with 30 days&apos; notice to existing subscribers.</li>
                </ul>
              </div>

              {/* Section 7 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">7. Lead Data</h2>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li>Lead data provided through our Service is sourced from publicly available information (Google Maps listings and public business websites).</li>
                  <li>We do not guarantee the accuracy, completeness, or validity of any lead data, including email addresses and phone numbers.</li>
                  <li>You are responsible for verifying lead data before taking action.</li>
                  <li>Lead data is provided for your use within the Service only. You may not resell or redistribute lead data to third parties.</li>
                </ul>
              </div>

              {/* Section 8 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">8. AI-Generated Content</h2>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li>Emails and call scripts generated by our AI are suggestions. You are responsible for reviewing and approving all content before sending.</li>
                  <li>We do not guarantee that AI-generated content will be error-free, appropriate, or effective for your use case.</li>
                  <li>You are solely responsible for the final content sent to recipients.</li>
                </ul>
              </div>

              {/* Section 9 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">9. Intellectual Property</h2>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li>The Service, including its design, code, features, and branding, is owned by Inertia Leads and protected by intellectual property laws.</li>
                  <li>You may not copy, modify, distribute, or create derivative works from any part of the Service.</li>
                  <li>You retain ownership of your data (leads, campaigns, email content) uploaded to or created through the Service.</li>
                </ul>
              </div>

              {/* Section 10 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">10. Service Availability</h2>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li>We strive to maintain high availability but do not guarantee uninterrupted access to the Service.</li>
                  <li>We may perform scheduled maintenance, which may temporarily make the Service unavailable.</li>
                  <li>We rely on third-party services (Supabase, Google, OpenAI, Serper) and are not responsible for outages caused by those providers.</li>
                </ul>
              </div>

              {/* Section 11 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">11. Account Suspension & Termination</h2>
                <p className="mb-3">We reserve the right to suspend or terminate your account if you:</p>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li>Violate these Terms of Service or our Acceptable Use policy</li>
                  <li>Use the Service to send spam or abusive content</li>
                  <li>Attempt to exploit, hack, or circumvent security measures</li>
                  <li>Fail to pay for your subscription</li>
                </ul>
                <p className="mt-3">Upon termination, your data will be permanently deleted in accordance with our <Link href="/privacy" className="text-violet-400 hover:text-violet-300 underline">Privacy Policy</Link>.</p>
              </div>

              {/* Section 12 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">12. Limitation of Liability</h2>
                <p className="mb-3">To the maximum extent permitted by law:</p>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li>The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied.</li>
                  <li>We are not liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.</li>
                  <li>We are not liable for any damages resulting from emails sent through the Service, including but not limited to: recipient complaints, email provider bans, legal claims, or reputational harm.</li>
                  <li>Our total liability for any claim related to the Service shall not exceed the amount you paid us in the 3 months preceding the claim.</li>
                </ul>
              </div>

              {/* Section 13 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">13. Indemnification</h2>
                <p>You agree to indemnify and hold harmless Inertia Leads, its owners, and affiliates from any claims, damages, losses, or expenses (including legal fees) arising from your use of the Service, your violation of these Terms, or your violation of any applicable law.</p>
              </div>

              {/* Section 14 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">14. Governing Law</h2>
                <p>These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising from these Terms or the Service shall be subject to the exclusive jurisdiction of the courts in India.</p>
              </div>

              {/* Section 15 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">15. Changes to These Terms</h2>
                <p>We may update these Terms from time to time. When we make significant changes, we will notify you via email or through an in-app notification. Your continued use of the Service after changes are posted constitutes acceptance of the updated Terms.</p>
              </div>

              {/* Section 16 */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">16. Contact Us</h2>
                <p>If you have questions about these Terms of Service, contact us at:</p>
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
