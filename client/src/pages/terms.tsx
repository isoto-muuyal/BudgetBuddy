import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Terms() {
  return (
    <div className="max-w-4xl mx-auto p-6 pt-8">
      <Card className="bg-white rounded-2xl shadow-lg border border-gray-100">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-gray-900" data-testid="text-terms-title">
            Terms and Conditions
          </CardTitle>
          <p className="text-gray-600">Last updated: January 2025</p>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[70vh] pr-4">
            <div className="space-y-6 text-gray-700">
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
                <p>
                  By accessing and using BudgetWise, you accept and agree to be bound by the terms and provision of this agreement.
                  If you do not agree to abide by the above, please do not use this service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Use License</h2>
                <p>
                  Permission is granted to temporarily download one copy of BudgetWise per device for personal, 
                  non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
                </p>
                <ul className="list-disc pl-6 mt-2">
                  <li>modify or copy the materials</li>
                  <li>use the materials for any commercial purpose or for any public display</li>
                  <li>attempt to reverse engineer any software contained on the website</li>
                  <li>remove any copyright or other proprietary notations from the materials</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Privacy and Data Protection</h2>
                <p>
                  Your privacy is important to us. BudgetWise is committed to protecting your personal and financial information:
                </p>
                <ul className="list-disc pl-6 mt-2">
                  <li>We do not sell, rent, or trade your personal information to third parties</li>
                  <li>Your financial data is processed securely and used only for providing our services</li>
                  <li>We employ industry-standard security measures to protect your data</li>
                  <li>You have the right to request deletion of your data at any time</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Financial Information Disclaimer</h2>
                <p>
                  BudgetWise provides budgeting tools and analysis for informational purposes only. This service:
                </p>
                <ul className="list-disc pl-6 mt-2">
                  <li>Does not constitute financial advice</li>
                  <li>Should not be relied upon as the sole basis for financial decisions</li>
                  <li>Provides automated analysis that may contain errors or inaccuracies</li>
                  <li>Recommends consulting with qualified financial professionals for important decisions</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">5. User Responsibilities</h2>
                <p>Users are responsible for:</p>
                <ul className="list-disc pl-6 mt-2">
                  <li>Ensuring the accuracy of uploaded financial documents</li>
                  <li>Maintaining the security of their account credentials</li>
                  <li>Using the service in compliance with applicable laws and regulations</li>
                  <li>Not attempting to circumvent security measures or access unauthorized data</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Limitations of Liability</h2>
                <p>
                  In no event shall BudgetWise or its suppliers be liable for any damages (including, without limitation, 
                  damages for loss of data or profit, or due to business interruption) arising out of the use or inability 
                  to use BudgetWise, even if BudgetWise or its authorized representative has been notified orally or in 
                  writing of the possibility of such damage.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Modifications</h2>
                <p>
                  BudgetWise may revise these terms of service at any time without notice. By using this service, 
                  you are agreeing to be bound by the then current version of these terms of service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Governing Law</h2>
                <p>
                  These terms and conditions are governed by and construed in accordance with applicable laws, 
                  and you irrevocably submit to the exclusive jurisdiction of the courts in that state or location.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Contact Information</h2>
                <p>
                  If you have any questions about these Terms and Conditions, please contact us through the 
                  support channels provided in the application.
                </p>
              </section>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}