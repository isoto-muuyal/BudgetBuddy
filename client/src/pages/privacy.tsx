import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Lock, Eye, Trash2 } from "lucide-react";

export default function Privacy() {
  return (
    <div className="max-w-4xl mx-auto p-6 pt-8">
      <Card className="bg-white rounded-2xl shadow-lg border border-gray-100">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-gray-900 flex items-center" data-testid="text-privacy-title">
            <Shield className="mr-3 text-green-500" />
            Privacy Policy
          </CardTitle>
          <p className="text-gray-600">Last updated: January 2025</p>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[70vh] pr-4">
            <div className="space-y-6 text-gray-700">
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3 flex items-center">
                  <Eye className="mr-2 text-blue-500" />
                  Our Commitment to Privacy
                </h2>
                <p>
                  At BudgetWise, we understand that your financial information is deeply personal and sensitive. 
                  We are committed to protecting your privacy and ensuring your data is handled with the utmost care and security.
                </p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                  <p className="font-semibold text-green-800">Our Promise:</p>
                  <p className="text-green-700">We will never sell, rent, or trade your personal or financial information to anyone, for any reason.</p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Information We Collect</h2>
                <p>To provide our budgeting services, we collect:</p>
                <ul className="list-disc pl-6 mt-2">
                  <li><strong>Account Information:</strong> Email address, name, and encrypted password</li>
                  <li><strong>Financial Data:</strong> Bank statements and transaction data you choose to upload</li>
                  <li><strong>Usage Information:</strong> How you interact with our service to improve functionality</li>
                  <li><strong>Technical Data:</strong> IP address, browser type, and device information for security</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">How We Use Your Information</h2>
                <p>Your information is used exclusively to:</p>
                <ul className="list-disc pl-6 mt-2">
                  <li>Analyze your spending patterns and provide budget recommendations</li>
                  <li>Maintain your account and provide customer support</li>
                  <li>Improve our AI analysis algorithms and service features</li>
                  <li>Ensure the security and integrity of our platform</li>
                  <li>Send important service updates and notifications</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3 flex items-center">
                  <Lock className="mr-2 text-red-500" />
                  Data Security
                </h2>
                <p>We implement robust security measures to protect your data:</p>
                <ul className="list-disc pl-6 mt-2">
                  <li><strong>Encryption:</strong> All data is encrypted in transit and at rest</li>
                  <li><strong>Access Controls:</strong> Strict access controls and authentication requirements</li>
                  <li><strong>Secure Processing:</strong> Financial documents are processed securely and then deleted</li>
                  <li><strong>Regular Audits:</strong> Security practices are regularly reviewed and updated</li>
                  <li><strong>Minimal Retention:</strong> We keep data only as long as necessary for service provision</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Information Sharing</h2>
                <p>We do not share your personal or financial information with third parties, except:</p>
                <ul className="list-disc pl-6 mt-2">
                  <li>When required by law or legal process</li>
                  <li>To protect our rights, property, or safety, or that of our users</li>
                  <li>With service providers who assist in operations (under strict confidentiality agreements)</li>
                </ul>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                  <p className="font-semibold text-blue-800">Important:</p>
                  <p className="text-blue-700">We will never sell your information to advertisers, data brokers, or marketing companies.</p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3 flex items-center">
                  <Trash2 className="mr-2 text-purple-500" />
                  Your Rights
                </h2>
                <p>You have the right to:</p>
                <ul className="list-disc pl-6 mt-2">
                  <li><strong>Access:</strong> Request a copy of your personal data we hold</li>
                  <li><strong>Correct:</strong> Update or correct inaccurate personal information</li>
                  <li><strong>Delete:</strong> Request deletion of your account and associated data</li>
                  <li><strong>Restrict:</strong> Limit how we process your personal information</li>
                  <li><strong>Export:</strong> Receive your data in a portable format</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Data Retention</h2>
                <p>
                  We retain your information only as long as necessary to provide our services and comply with legal obligations:
                </p>
                <ul className="list-disc pl-6 mt-2">
                  <li>Account data is kept while your account is active</li>
                  <li>Financial analysis results are stored to show your history</li>
                  <li>Uploaded documents are processed and then permanently deleted</li>
                  <li>You can request complete data deletion at any time</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Cookies and Tracking</h2>
                <p>
                  BudgetWise uses minimal cookies and tracking technologies:
                </p>
                <ul className="list-disc pl-6 mt-2">
                  <li>Essential cookies for login and security</li>
                  <li>No third-party advertising or tracking cookies</li>
                  <li>No social media tracking or analytics beyond basic usage statistics</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Children's Privacy</h2>
                <p>
                  BudgetWise is not intended for use by children under 13 years of age. We do not knowingly collect 
                  personal information from children under 13. If we become aware that we have collected such information, 
                  we will take steps to delete it promptly.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Changes to This Policy</h2>
                <p>
                  We may update this privacy policy from time to time. We will notify you of any material changes 
                  by posting the new policy on this page and updating the "Last updated" date. Your continued use 
                  of BudgetWise after such modifications constitutes acceptance of the updated policy.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact Us</h2>
                <p>
                  If you have any questions about this privacy policy or our data practices, please contact us 
                  through the support channels provided in the application. We are committed to addressing your 
                  privacy concerns promptly and transparently.
                </p>
              </section>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}