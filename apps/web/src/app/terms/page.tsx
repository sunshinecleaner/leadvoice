export const metadata = {
  title: "Terms and Conditions | Sunshine WL Brazilian LLC",
};

export default function TermsAndConditions() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-8 text-3xl font-bold">Terms and Conditions</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Last updated: March 13, 2026
      </p>

      <section className="space-y-4 text-sm leading-relaxed">
        <h2 className="text-xl font-semibold">1. SMS Messaging Program</h2>
        <p>
          <strong>Program Name:</strong> Sunshine WL Brazilian Cleaning Services
          Notifications
        </p>
        <p>
          <strong>Program Description:</strong> Sunshine WL Brazilian LLC sends
          text messages to customers regarding cleaning service quotes,
          appointment scheduling, payment reminders, service confirmations, and
          follow-up communications.
        </p>

        <h2 className="text-xl font-semibold">2. Consent</h2>
        <p>
          By calling Sunshine WL Brazilian LLC at (470) 888-4921, submitting a
          service request through our website, or providing your phone number to
          our team, you consent to receive SMS text messages from us related to
          your cleaning service.
        </p>
        <p>
          Consent is not a condition of purchase. You may receive messages even
          if you do not complete a purchase.
        </p>

        <h2 className="text-xl font-semibold">3. Message Frequency</h2>
        <p>
          Message frequency varies based on your service interactions. Typical
          messages include: quote confirmation, appointment reminders, service
          completion notice, payment reminders, and follow-up requests. You may
          receive up to 10 messages per service engagement.
        </p>

        <h2 className="text-xl font-semibold">4. Message and Data Rates</h2>
        <p>
          Message and data rates may apply. Sunshine WL Brazilian LLC is not
          responsible for any charges from your mobile carrier.
        </p>

        <h2 className="text-xl font-semibold">5. Opt-Out</h2>
        <p>
          You can opt out of receiving text messages at any time by replying{" "}
          <strong>STOP</strong> to any message. After opting out, you will
          receive a confirmation message and no further texts will be sent
          unless you re-subscribe.
        </p>

        <h2 className="text-xl font-semibold">6. Help</h2>
        <p>
          For help or questions about our SMS program, reply <strong>HELP</strong>{" "}
          to any message or call us at (470) 888-4921.
        </p>

        <h2 className="text-xl font-semibold">7. Supported Carriers</h2>
        <p>
          Our SMS program is supported on all major US carriers including
          AT&T, Verizon, T-Mobile, Sprint, and others.
        </p>

        <h2 className="text-xl font-semibold">8. Privacy</h2>
        <p>
          Your privacy is important to us. We do not sell or share your phone
          number or personal information with third parties for marketing
          purposes. For full details, see our{" "}
          <a href="/privacy" className="text-primary underline">
            Privacy Policy
          </a>
          .
        </p>

        <h2 className="text-xl font-semibold">9. Contact Information</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Company:</strong> Sunshine WL Brazilian LLC
          </li>
          <li>
            <strong>Phone:</strong> (470) 888-4921
          </li>
          <li>
            <strong>Website:</strong> sunshinebrazilian.com
          </li>
        </ul>
      </section>
    </div>
  );
}
