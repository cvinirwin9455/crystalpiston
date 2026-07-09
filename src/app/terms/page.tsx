import { getBrand } from '@/lib/brand.server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import './terms.css'

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand()
  if (brand.slug !== 'first-mile') {
    return { title: 'Not Found' }
  }
  return {
    title: 'Beta Testing Terms & Conditions — First Mile Coach',
    description: 'Terms and conditions for the First Mile Coach beta testing program.',
  }
}

export default async function TermsPage() {
  const brand = await getBrand()

  // Only show terms on First Mile domain
  if (brand.slug !== 'first-mile') {
    redirect('/')
  }

  return (
    <div className="fmc-terms-page">
      <div className="fmc-terms-container">
        <a href="/" className="fmc-terms-back">&larr; Back to First Mile Coach</a>
        <h1>Beta Testing Terms &amp; Conditions</h1>
        <p className="fmc-terms-updated">Last updated: July 2026</p>

        <div className="fmc-terms-highlight">
          <p>
            IMPORTANT: BY CLICKING &ldquo;I AGREE&rdquo; OR BY ACCESSING OR USING THE PLATFORM IN ANY WAY,
            YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE LEGALLY BOUND BY THESE TERMS.
            IF YOU DO NOT AGREE, DO NOT USE THE PLATFORM.
          </p>
        </div>

        <p>
          These Beta Testing Terms and Conditions (&ldquo;Agreement&rdquo;) constitute a legally binding contract
          between you (&ldquo;Beta Tester&rdquo;, &ldquo;you&rdquo;, &ldquo;your&rdquo;) and First Mile Coach
          (&ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). This Agreement governs
          your participation in the First Mile Coach Beta Program (&ldquo;Beta Program&rdquo;) and your use of the
          First Mile Coach platform (&ldquo;Platform&rdquo;).
        </p>

        <h2>1. Acceptance of Terms</h2>
        <p>By submitting a beta application, clicking any acceptance button, or accessing the Platform, you represent and warrant that:</p>
        <ul>
          <li>You are at least 18 years of age</li>
          <li>You have the legal capacity to enter into binding contracts</li>
          <li>You have read and understood this entire Agreement</li>
          <li>You voluntarily agree to all terms, conditions, and limitations herein</li>
          <li>If you are entering this Agreement on behalf of a business entity, you have the authority to bind that entity</li>
        </ul>

        <h2>2. Beta Program Overview &amp; Duration</h2>
        <p>The Beta Program has a <strong>fixed end date of June 30, 2027</strong>. All beta access terminates on this date regardless of when you joined. By signing up, you acknowledge that:</p>
        <ul>
          <li>The beta period ends June 30, 2027 regardless of when you join — the remaining time depends on your signup date</li>
          <li>You accept the remaining time available at the point of signup</li>
          <li>We will display the approximate time remaining when you sign up</li>
          <li>We reserve the right to extend, shorten, or terminate the beta period at any time, with or without notice, at our sole and absolute discretion</li>
          <li>We may terminate the entire Beta Program or your individual participation at any time for any reason or no reason</li>
        </ul>

        <h2>3. Pricing During Beta</h2>
        <p>During the Beta Program, you will have access to the Platform at no monetary cost, with no limit on the number of clients you may manage. This free access:</p>
        <ul>
          <li>Terminates on June 30, 2027 or upon earlier termination of the Beta Program or your participation</li>
          <li>Is granted as a privilege, not a right, and may be revoked at any time</li>
          <li>Does not create any ongoing obligation for us to provide free access beyond the beta period</li>
          <li>Is provided in exchange for your agreement to provide feedback and accept all risks outlined in this Agreement</li>
        </ul>

        <h2>4. Post-Beta Reward — Qualifying Criteria</h2>
        <p>Beta Testers who meet ALL of the following criteria may receive 10 free active clients per month after the beta ends:</p>
        <ol>
          <li><strong>Sign up at least 10 clients</strong> to the Platform during the beta period</li>
          <li><strong>Remain active for at least 3 months</strong> during the beta period (not necessarily consecutive)</li>
          <li><strong>Provide at least 3 feedback responses</strong> on how to improve the Platform when requested</li>
        </ol>
        <p><strong>IMPORTANT:</strong> The post-beta reward is offered at our sole discretion. We reserve the right to:</p>
        <ul>
          <li>Modify, reduce, or eliminate the reward at any time prior to or after the beta concludes</li>
          <li>Determine qualification criteria and whether they have been met in our sole judgment</li>
          <li>Discontinue the Platform entirely, in which case no reward will be provided</li>
          <li>Change pricing structures at any time after the beta period</li>
        </ul>
        <p>The post-beta reward does not constitute a guarantee, promise, or binding obligation. It is a statement of current intent only and may be changed at our sole discretion.</p>

        <h2>5. ASSUMPTION OF RISK</h2>
        <p className="fmc-terms-caps">
          YOU EXPRESSLY ACKNOWLEDGE AND AGREE THAT YOUR USE OF THE PLATFORM IS ENTIRELY AT YOUR OWN RISK.
          YOU VOLUNTARILY ASSUME ALL RISKS ASSOCIATED WITH USING BETA SOFTWARE, INCLUDING BUT NOT LIMITED TO:
        </p>
        <ul>
          <li>Complete or partial loss of data, including client data, training plans, session notes, messages, and any other content</li>
          <li>Platform unavailability, downtime, or permanent shutdown</li>
          <li>Bugs, errors, crashes, security vulnerabilities, or unexpected behaviour</li>
          <li>Loss of revenue, clients, business relationships, or business opportunities</li>
          <li>Damage to your professional reputation</li>
          <li>Incompatibility with your devices, software, or workflows</li>
          <li>Any consequences arising from your clients&apos; use of or reliance on the Platform</li>
        </ul>

        <h2>6. DISCLAIMER OF WARRANTIES</h2>
        <p className="fmc-terms-caps">
          THE PLATFORM IS PROVIDED STRICTLY &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTY OF ANY KIND.
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, WE EXPRESSLY DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO:
        </p>
        <ul>
          <li>Implied warranties of merchantability and fitness for a particular purpose</li>
          <li>Warranties of non-infringement</li>
          <li>Warranties of title</li>
          <li>Warranties that the Platform will meet your requirements or expectations</li>
          <li>Warranties that the Platform will be uninterrupted, timely, secure, or error-free</li>
          <li>Warranties that any data stored on the Platform will be preserved, backed up, or recoverable</li>
          <li>Warranties that defects will be corrected</li>
          <li>Warranties regarding the accuracy, reliability, or completeness of any content</li>
        </ul>

        <h2>7. LIMITATION OF LIABILITY</h2>
        <p className="fmc-terms-caps">TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:</p>
        <p><strong>(a)</strong> IN NO EVENT SHALL FIRST MILE COACH, ITS OWNERS, DIRECTORS, OFFICERS, EMPLOYEES, AGENTS, AFFILIATES, SUCCESSORS, OR ASSIGNS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES INCLUDING BUT NOT LIMITED TO:</p>
        <ul>
          <li>Loss of revenue, income, or profits</li>
          <li>Loss of clients, contracts, or business relationships</li>
          <li>Loss of data, content, or information</li>
          <li>Loss of use, productivity, or business interruption</li>
          <li>Loss of goodwill or reputation</li>
          <li>Cost of substitute goods or services</li>
        </ul>
        <p><strong>(b)</strong> OUR TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE GREATER OF: (i) THE TOTAL AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (ii) ONE POUND STERLING (&pound;1.00).</p>
        <p><strong>(c)</strong> THE LIMITATIONS APPLY REGARDLESS OF THE LEGAL THEORY ON WHICH THE CLAIM IS BASED.</p>
        <p><strong>(d)</strong> YOU ACKNOWLEDGE THAT THE PLATFORM IS PROVIDED FREE OF CHARGE DURING THE BETA PERIOD AND THAT THE LIMITATIONS OF LIABILITY ARE A FUNDAMENTAL ELEMENT OF THE BARGAIN BETWEEN THE PARTIES.</p>

        <h2>8. WAIVER OF CLAIMS</h2>
        <p>By participating in the Beta Program, you expressly waive and release any and all claims against First Mile Coach arising from or related to:</p>
        <ul>
          <li>Your use of or inability to use the Platform</li>
          <li>Any data loss, corruption, or breach during the beta period</li>
          <li>Any changes to, suspension of, or discontinuation of the Platform</li>
          <li>Any interactions between you and your clients conducted through the Platform</li>
          <li>The post-beta reward being modified, reduced, or eliminated</li>
        </ul>

        <h2>9. DISPUTE RESOLUTION &amp; ARBITRATION</h2>
        <p><strong>PLEASE READ THIS SECTION CAREFULLY — IT AFFECTS YOUR LEGAL RIGHTS.</strong></p>
        <p><strong>(a) Mandatory Arbitration.</strong> Any dispute shall be resolved by binding arbitration rather than in court.</p>
        <p><strong>(b) No Class Actions.</strong> YOU AND FIRST MILE COACH AGREE THAT EACH MAY BRING CLAIMS ONLY IN YOUR INDIVIDUAL CAPACITY.</p>
        <p><strong>(c) Arbitration Rules.</strong> Arbitration shall be conducted under the rules of the London Court of International Arbitration (LCIA) in English, in London, United Kingdom.</p>
        <p><strong>(d) Costs.</strong> If you bring a claim and do not prevail, you agree to pay our reasonable legal costs.</p>
        <p><strong>(e) Time Limitation.</strong> Any claim must be filed within one (1) year after the cause of action arises.</p>
        <p><strong>(f) Small Claims Exception.</strong> Either party may bring an individual action in small claims court.</p>

        <h2>10. Intellectual Property &amp; Feedback</h2>
        <p>By providing feedback during the Beta Program, you irrevocably agree that:</p>
        <ul>
          <li>All Feedback becomes the sole and exclusive property of First Mile Coach</li>
          <li>You assign all rights, title, and interest in any Feedback to us</li>
          <li>We may use, modify, incorporate, or implement your Feedback without restriction or compensation</li>
          <li>You waive all moral rights in any Feedback to the extent permitted by law</li>
          <li>This assignment survives termination of this Agreement</li>
        </ul>

        <h2>11. Feedback Requirements</h2>
        <p>As a Beta Tester, you agree to:</p>
        <ul>
          <li>Provide honest and constructive feedback when requested</li>
          <li>Submit any feedback received from your clients about their experience</li>
          <li>Respond to feedback requests within a reasonable timeframe</li>
          <li>Not misrepresent your experience or provide intentionally misleading feedback</li>
        </ul>

        <h2>12. Confidentiality &amp; Non-Disclosure</h2>
        <p>During the Beta Program and for twelve (12) months thereafter, you agree NOT to:</p>
        <ul>
          <li>Publicly review, rate, or critique the Platform on any public forum</li>
          <li>Share screenshots or descriptions of unreleased features without our prior written consent</li>
          <li>Disclose non-public information about the Platform</li>
          <li>Share your beta access credentials with any third party</li>
          <li>Discuss the terms of this Agreement publicly</li>
        </ul>

        <h2>13. Data, Privacy &amp; Your Responsibilities</h2>
        <p><strong>(a) No Data Guarantees.</strong> We make NO guarantee regarding data persistence, security, or availability. YOU ARE SOLELY RESPONSIBLE FOR MAINTAINING YOUR OWN BACKUPS.</p>
        <p><strong>(b) Your Client Data.</strong> You represent that you have obtained all necessary consents from your clients. You remain the data controller.</p>
        <p><strong>(c) Our Use of Data.</strong> We may use aggregated, anonymised usage data to improve the Platform. We will not sell identifiable data to third parties.</p>
        <p><strong>(d) Data on Termination.</strong> We may delete all your data after 30 days following termination.</p>

        <h2>14. Your Representations &amp; Warranties</h2>
        <ul>
          <li>You hold any necessary qualifications or insurance required to operate as a coach in your jurisdiction</li>
          <li>You are solely responsible for the coaching services you provide</li>
          <li>You will not hold us liable for any harm suffered by your clients</li>
          <li>You will comply with all applicable laws and regulations</li>
          <li>All information you provide is accurate and truthful</li>
        </ul>

        <h2>15. Acceptable Use</h2>
        <p>You will NOT:</p>
        <ul>
          <li>Use the Platform for any illegal or unauthorized purpose</li>
          <li>Attempt to exploit, hack, or reverse-engineer the Platform</li>
          <li>Upload harmful, offensive, or illegal content</li>
          <li>Create fake or duplicate accounts</li>
          <li>Resell or commercially exploit access to the Platform</li>
          <li>Interfere with the integrity or performance of the Platform</li>
        </ul>

        <h2>16. Indemnification</h2>
        <p>You agree to indemnify and hold harmless First Mile Coach from any claims arising from your use of the Platform, your violation of this Agreement, your violation of any law, or any dispute between you and your clients. This obligation survives termination.</p>

        <h2>17. Termination</h2>
        <p><strong>(a)</strong> Either party may terminate at any time, for any reason, with or without notice.</p>
        <p><strong>(b)</strong> We may immediately revoke your access if you violate any term.</p>
        <p><strong>(c)</strong> Upon termination: your access ceases, all licenses terminate, and we may delete your data after 30 days.</p>

        <h2>18. Post-Beta Transition</h2>
        <ul>
          <li>You will be notified by email about your qualification status</li>
          <li>Qualifying testers may receive 10 free clients/month (subject to Section 4)</li>
          <li>Non-qualifying testers will move to standard pricing or may lose access</li>
          <li>We reserve the right to discontinue the Platform entirely</li>
        </ul>

        <h2>19. Force Majeure</h2>
        <p>We shall not be liable for failures beyond our reasonable control including acts of God, war, pandemics, internet failures, or cyberattacks.</p>

        <h2>20. Severability</h2>
        <p>If any provision is found unenforceable, it shall be enforced to the maximum extent permissible and the remaining provisions remain in full force.</p>

        <h2>21. Entire Agreement &amp; Modifications</h2>
        <p>This Agreement constitutes the entire agreement. We may modify terms at any time by posting updates. Your continued use constitutes acceptance.</p>

        <h2>22. Governing Law &amp; Jurisdiction</h2>
        <p>This Agreement is governed by the laws of England and Wales. Legal proceedings shall be brought in the courts of England and Wales.</p>

        <h2>23. No Partnership or Employment</h2>
        <p>Nothing creates any partnership, joint venture, or employment relationship between you and First Mile Coach.</p>

        <h2>24. Assignment</h2>
        <p>You may not assign your rights without our consent. We may assign without restriction.</p>

        <h2>25. Contact</h2>
        <p>For questions: <strong>curtisirwin@me.com</strong></p>

        <div className="fmc-terms-highlight" style={{ marginTop: '48px' }}>
          <p>
            BY CLICKING &ldquo;I AGREE TO THE BETA TESTING TERMS &amp; CONDITIONS&rdquo; ON THE SIGNUP FORM,
            YOU CONFIRM THAT YOU HAVE READ THIS ENTIRE AGREEMENT, UNDERSTAND ITS TERMS, AND VOLUNTARILY AGREE
            TO BE LEGALLY BOUND BY ALL PROVISIONS HEREIN.
          </p>
        </div>
      </div>
    </div>
  )
}
