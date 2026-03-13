export const metadata = {
  title: "Privacy Policy | Sunshine WL Brazilian LLC",
};

export default function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-8 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Last updated: March 13, 2026
      </p>

      <section className="space-y-4 text-sm leading-relaxed">
        <h2 className="text-xl font-semibold">1. Who We Are</h2>
        <p>
          Sunshine WL Brazilian LLC ("we", "us", "our") is a professional
          cleaning company based in the United States, serving Georgia, Florida,
          Texas, New York, and Massachusetts. Our phone number is (470) 888-4921
          and our website is sunshinebrazilian.com.
        </p>

        <h2 className="text-xl font-semibold">2. Information We Collect</h2>
        <p>When you interact with us by phone, text, or through our website, we may collect:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Name and contact information (phone number, email address)</li>
          <li>Property address and service details</li>
          <li>Communication records (call transcripts, text messages)</li>
          <li>Scheduling and payment information</li>
        </ul>

        <h2 className="text-xl font-semibold">3. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Provide cleaning quotes and schedule services</li>
          <li>Send appointment confirmations and reminders via SMS</li>
          <li>Process payments and send receipts</li>
          <li>Follow up on service quality</li>
          <li>Improve our services and customer experience</li>
        </ul>

        <h2 className="text-xl font-semibold">4. SMS Communications</h2>
        <p>
          By providing your phone number and requesting our services, you
          consent to receive text messages from Sunshine WL Brazilian LLC
          related to your cleaning service, including quotes, scheduling
          confirmations, payment reminders, and service updates. Message
          frequency varies. Message and data rates may apply.
        </p>
        <p>
          You can opt out of SMS communications at any time by replying{" "}
          <strong>STOP</strong> to any message. Reply <strong>HELP</strong> for
          assistance.
        </p>

        <h2 className="text-xl font-semibold">5. Information Sharing</h2>
        <p>
          We do not sell, rent, or share your personal information with third
          parties for marketing purposes. We may share your information only
          with service providers who assist us in operating our business (e.g.,
          payment processors, communication platforms) and as required by law.
        </p>

        <h2 className="text-xl font-semibold">6. Data Security</h2>
        <p>
          We implement reasonable security measures to protect your personal
          information from unauthorized access, alteration, or destruction.
        </p>

        <h2 className="text-xl font-semibold">7. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy, contact us at:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Phone: (470) 888-4921</li>
          <li>Website: sunshinebrazilian.com</li>
        </ul>
      </section>
    </div>
  );
}
