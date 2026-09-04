import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="w-full min-h-full bg-white text-ink overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 md:px-8 py-12 md:py-20">
        
        {/* Subtle back link */}
        <div className="mb-12">
          <Link
            to="/"
            className="text-xs text-text-muted hover:text-ink transition-colors inline-flex items-center gap-1.5 font-medium"
          >
            ← Back
          </Link>
        </div>

        {/* Document Header */}
        <header className="mb-16">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-ink">
            Ironstone Privacy Policy
          </h1>
          <p className="mt-3 text-xs text-text-muted">
            Last updated: September 4, 2026
          </p>
          <div className="mt-6 text-sm text-text-muted leading-relaxed space-y-2">
            <p>Ironstone is a moodboard tool made by Raven North Studio.</p>
            <p>This page explains what information Ironstone uses and how we protect it.</p>
          </div>
        </header>

        {/* Clean Editorial Sections */}
        <div className="space-y-12 text-[15px] leading-relaxed text-ink/90">

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink">
              1. What Ironstone does
            </h2>
            <p className="text-text-muted">
              Ironstone helps designers collect images, organize visual ideas, create moodboards, and export them as PDFs.
            </p>
            <p className="text-text-muted">
              You can add images by uploading them, importing them from Pinterest, or saving them from the web.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink">
              2. Information you give us
            </h2>
            <p className="text-text-muted">
              When you use Ironstone, you may give us:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-text-muted">
              <li>Your project names.</li>
              <li>Images you upload.</li>
              <li>Images you import from Pinterest.</li>
              <li>Text you add to your moodboards.</li>
              <li>Your moodboard layouts and settings.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink">
              3. Pinterest
            </h2>
            <p className="text-text-muted">
              You can connect your Pinterest account to Ironstone.
            </p>
            <p className="text-text-muted">
              When you do this, Ironstone can read your Pinterest boards and Pins so you can choose images to bring into your Ironstone projects.
            </p>
            <p className="text-text-muted">
              Ironstone only asks Pinterest for the access needed for this feature.
            </p>
            <p className="text-text-muted">
              Ironstone does not ask for or store your Pinterest password.
            </p>
            <p className="text-text-muted">
              Ironstone does not publish Pins to Pinterest.
            </p>
            <p className="text-text-muted">
              Ironstone does not manage Pinterest ads.
            </p>
            <p className="text-text-muted">
              Ironstone does not sell your Pinterest information.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink">
              4. Where your projects are stored
            </h2>
            <p className="text-text-muted">
              Ironstone is built to keep your projects on your device.
            </p>
            <p className="text-text-muted">
              Your projects and images can be stored in your browser using local storage.
            </p>
            <p className="text-text-muted">
              This means Ironstone does not need a central database to keep your projects.
            </p>
            <p className="text-text-muted">
              If you clear your browser&apos;s stored data, your local Ironstone projects may be deleted.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink">
              5. When we use our servers
            </h2>
            <p className="text-text-muted">
              Some features, such as creating a PDF or sending an export by email, may need our servers.
            </p>
            <p className="text-text-muted">
              When this happens, we send the information needed to complete that task.
            </p>
            <p className="text-text-muted">
              We do not use your project information to show you ads or build an advertising profile.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink">
              6. Sharing your information
            </h2>
            <p className="text-text-muted">
              We do not sell your personal information.
            </p>
            <p className="text-text-muted">
              We do not sell your Pinterest information.
            </p>
            <p className="text-text-muted">
              We do not give your Pinterest information to advertisers.
            </p>
            <p className="text-text-muted">
              We may use other companies to help us run Ironstone, such as companies that provide hosting, email, or PDF generation.
            </p>
            <p className="text-text-muted">
              These companies only receive information needed to provide the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink">
              7. Disconnecting Pinterest
            </h2>
            <p className="text-text-muted">
              You can stop Ironstone from accessing your Pinterest account by removing Ironstone&apos;s access from your Pinterest account.
            </p>
            <p className="text-text-muted">
              After you remove access, Ironstone can no longer use that Pinterest connection to read your Pinterest data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink">
              8. Deleting your information
            </h2>
            <p className="text-text-muted">
              You can delete your local Ironstone projects from your browser.
            </p>
            <p className="text-text-muted">
              If you need help deleting information that may have been processed by our servers, contact us.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink">
              9. Keeping information safe
            </h2>
            <p className="text-text-muted">
              We take reasonable steps to protect the information that Ironstone handles.
            </p>
            <p className="text-text-muted">
              We keep access to our systems limited and do not expose private API keys or passwords to users.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink">
              10. Children
            </h2>
            <p className="text-text-muted">
              Ironstone is made for designers and creative professionals.
            </p>
            <p className="text-text-muted">
              Ironstone is not intended for children.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink">
              11. Changes to this policy
            </h2>
            <p className="text-text-muted">
              We may update this Privacy Policy when Ironstone changes.
            </p>
            <p className="text-text-muted">
              When we make a change, we will update the date at the top of this page.
            </p>
          </section>

          <section className="space-y-3 pt-4">
            <h2 className="text-base font-semibold text-ink">
              12. Contact us
            </h2>
            <p className="text-text-muted">
              If you have a question about this Privacy Policy or your information, contact:
            </p>
            <div className="pt-1 text-text-muted space-y-1">
              <p className="font-medium text-ink">Raven North Studio</p>
              <p>
                Email:{' '}
                <a
                  href="mailto:hello@ravennorthstudio.com"
                  className="text-ink underline underline-offset-4 hover:text-accent transition-colors"
                >
                  hello@ravennorthstudio.com
                </a>
              </p>
              <p>
                Website:{' '}
                <a
                  href="https://ironstone.ravennorthstudio.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink underline underline-offset-4 hover:text-accent transition-colors"
                >
                  https://ironstone.ravennorthstudio.com/
                </a>
              </p>
            </div>
          </section>

        </div>

        {/* Minimal Footer */}
        <footer className="mt-20 pt-8 border-t border-surface-muted text-xs text-text-muted flex items-center justify-between">
          <span>Raven North Studio</span>
          <span>© 2026</span>
        </footer>

      </div>
    </div>
  );
}
