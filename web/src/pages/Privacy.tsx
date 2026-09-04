import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  ShieldCheck, 
  HardDrive, 
  Server, 
  Share2, 
  Lock, 
  Mail, 
  ExternalLink,
  Layers,
  Sparkles,
  CheckCircle2,
  XCircle
} from 'lucide-react';

export default function Privacy() {
  return (
    <div className="w-full min-h-full bg-[#FAFAF9] text-ink py-10 px-6 sm:px-10 lg:px-16 overflow-y-auto">
      <div className="max-w-3xl mx-auto space-y-10 pb-20">
        
        {/* Navigation / Back Button */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-text-muted hover:text-ink transition-colors px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-active shadow-xs"
          >
            <ArrowLeft size={14} strokeWidth={2} />
            <span>Back to Ironstone</span>
          </Link>

          <span className="text-[11px] font-mono tracking-wider uppercase text-text-muted/70 bg-surface-muted/80 px-2.5 py-1 rounded-md">
            Raven North Studio
          </span>
        </div>

        {/* Page Hero Header */}
        <header className="space-y-4 pt-2 border-b border-surface-muted pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold tracking-wide">
            <ShieldCheck size={14} strokeWidth={2.2} />
            <span>Privacy & Data Protection</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
            Ironstone Privacy Policy
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-muted">
            <span>Last updated: <strong className="text-ink font-semibold">September 4, 2026</strong></span>
            <span>•</span>
            <span>Product: <strong className="text-ink font-semibold">Ironstone by Raven North Studio</strong></span>
          </div>

          <p className="text-sm text-text-muted leading-relaxed max-w-2xl pt-2">
            This page explains what information Ironstone uses and how we protect it. Ironstone is designed from the ground up to respect creative ownership, prioritizing device-local storage and privacy-preserving workflows.
          </p>
        </header>

        {/* Highlight Summary Card */}
        <div className="p-6 rounded-2xl bg-surface border border-surface-muted/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink">
            <Sparkles size={15} className="text-accent" />
            <span>Key Principles at a Glance</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 text-xs">
            <div className="p-3.5 rounded-xl bg-surface-muted/50 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-ink">
                <HardDrive size={14} className="text-accent" />
                <span>On-Device Storage</span>
              </div>
              <p className="text-text-muted leading-relaxed">
                Your visual assets and projects live in your browser&apos;s local storage, not on a central database.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-muted/50 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-ink">
                <Lock size={14} className="text-accent" />
                <span>Zero Ad Tracking</span>
              </div>
              <p className="text-text-muted leading-relaxed">
                We never sell your data, build advertising profiles, or share reference assets with marketers.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-muted/50 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-ink">
                <Server size={14} className="text-accent" />
                <span>Ephemeral Servers</span>
              </div>
              <p className="text-text-muted leading-relaxed">
                Servers process exports in memory for rendering and discard payload data immediately after completion.
              </p>
            </div>
          </div>
        </div>

        {/* Structured Sections 1 to 12 */}
        <div className="space-y-8 text-sm leading-relaxed text-ink/90">

          {/* Section 1 */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-ink text-surface text-[11px] font-bold flex items-center justify-center font-mono">
                01
              </span>
              <h2 className="text-base font-bold text-ink tracking-tight">What Ironstone does</h2>
            </div>
            <p className="text-text-muted pl-8.5">
              Ironstone helps designers collect images, organize visual ideas, create moodboards, and export them as PDFs. You can add images by uploading them, importing them from Pinterest, or saving them from the web.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-ink text-surface text-[11px] font-bold flex items-center justify-center font-mono">
                02
              </span>
              <h2 className="text-base font-bold text-ink tracking-tight">Information you give us</h2>
            </div>
            <p className="text-text-muted pl-8.5">
              When you use Ironstone, you may give us:
            </p>
            <ul className="pl-8.5 space-y-1.5 text-text-muted">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                <span>Your project names.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                <span>Images you upload.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                <span>Images you import from Pinterest.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                <span>Text you add to your moodboards.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                <span>Your moodboard layouts and settings.</span>
              </li>
            </ul>
          </section>

          {/* Section 3 - Pinterest */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-ink text-surface text-[11px] font-bold flex items-center justify-center font-mono">
                03
              </span>
              <h2 className="text-base font-bold text-ink tracking-tight">Pinterest</h2>
            </div>
            <div className="pl-8.5 space-y-3 text-text-muted">
              <p>
                You can connect your Pinterest account to Ironstone. When you do this, Ironstone can read your Pinterest boards and Pins so you can choose images to bring into your Ironstone projects.
              </p>
              
              {/* Pinterest Boundaries Card */}
              <div className="p-4 rounded-xl bg-surface border border-surface-muted/80 space-y-2 text-xs">
                <div className="font-semibold text-ink">Pinterest Integration Boundaries:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-text-muted">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    <span>Asks only for needed access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle size={14} className="text-red-500 shrink-0" />
                    <span>Never asks for or stores passwords</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle size={14} className="text-red-500 shrink-0" />
                    <span>Does not publish Pins</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle size={14} className="text-red-500 shrink-0" />
                    <span>Does not manage ads</span>
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <XCircle size={14} className="text-red-500 shrink-0" />
                    <span>Does not sell Pinterest information</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-ink text-surface text-[11px] font-bold flex items-center justify-center font-mono">
                04
              </span>
              <h2 className="text-base font-bold text-ink tracking-tight">Where your projects are stored</h2>
            </div>
            <div className="pl-8.5 space-y-2 text-text-muted">
              <p>
                Ironstone is built to keep your projects on your device. Your projects and images can be stored in your browser using local storage.
              </p>
              <p>
                This means Ironstone does not need a central database to keep your projects. If you clear your browser&apos;s stored data, your local Ironstone projects may be deleted.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-ink text-surface text-[11px] font-bold flex items-center justify-center font-mono">
                05
              </span>
              <h2 className="text-base font-bold text-ink tracking-tight">When we use our servers</h2>
            </div>
            <div className="pl-8.5 space-y-2 text-text-muted">
              <p>
                Some features, such as creating a PDF or sending an export by email, may need our servers. When this happens, we send the information needed to complete that task.
              </p>
              <p>
                We do not use your project information to show you ads or build an advertising profile.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-ink text-surface text-[11px] font-bold flex items-center justify-center font-mono">
                06
              </span>
              <h2 className="text-base font-bold text-ink tracking-tight">Sharing your information</h2>
            </div>
            <div className="pl-8.5 space-y-2 text-text-muted">
              <p>
                We do not sell your personal information. We do not sell your Pinterest information. We do not give your Pinterest information to advertisers.
              </p>
              <p>
                We may use other companies to help us run Ironstone, such as companies that provide hosting, email, or PDF generation. These companies only receive information needed to provide the service.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-ink text-surface text-[11px] font-bold flex items-center justify-center font-mono">
                07
              </span>
              <h2 className="text-base font-bold text-ink tracking-tight">Disconnecting Pinterest</h2>
            </div>
            <p className="text-text-muted pl-8.5">
              You can stop Ironstone from accessing your Pinterest account by removing Ironstone&apos;s access from your Pinterest account. After you remove access, Ironstone can no longer use that Pinterest connection to read your Pinterest data.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-ink text-surface text-[11px] font-bold flex items-center justify-center font-mono">
                08
              </span>
              <h2 className="text-base font-bold text-ink tracking-tight">Deleting your information</h2>
            </div>
            <p className="text-text-muted pl-8.5">
              You can delete your local Ironstone projects from your browser. If you need help deleting information that may have been processed by our servers, contact us.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-ink text-surface text-[11px] font-bold flex items-center justify-center font-mono">
                09
              </span>
              <h2 className="text-base font-bold text-ink tracking-tight">Keeping information safe</h2>
            </div>
            <p className="text-text-muted pl-8.5">
              We take reasonable steps to protect the information that Ironstone handles. We keep access to our systems limited and do not expose private API keys or passwords to users.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-ink text-surface text-[11px] font-bold flex items-center justify-center font-mono">
                10
              </span>
              <h2 className="text-base font-bold text-ink tracking-tight">Children</h2>
            </div>
            <p className="text-text-muted pl-8.5">
              Ironstone is made for designers and creative professionals. Ironstone is not intended for children.
            </p>
          </section>

          {/* Section 11 */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-ink text-surface text-[11px] font-bold flex items-center justify-center font-mono">
                11
              </span>
              <h2 className="text-base font-bold text-ink tracking-tight">Changes to this policy</h2>
            </div>
            <p className="text-text-muted pl-8.5">
              We may update this Privacy Policy when Ironstone changes. When we make a change, we will update the date at the top of this page.
            </p>
          </section>

          {/* Section 12 - Contact Us */}
          <section className="space-y-3 pt-4">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-accent text-white text-[11px] font-bold flex items-center justify-center font-mono">
                12
              </span>
              <h2 className="text-base font-bold text-ink tracking-tight">Contact us</h2>
            </div>
            <div className="pl-8.5">
              <p className="text-text-muted mb-4">
                If you have a question about this Privacy Policy or your information, contact:
              </p>
              
              <div className="p-5 rounded-2xl bg-surface border border-surface-muted/80 shadow-xs space-y-3">
                <div className="font-bold text-ink text-sm">Raven North Studio</div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-xs text-text-muted">
                  <a
                    href="mailto:privacy@ravennorthstudio.com"
                    className="inline-flex items-center gap-1.5 text-accent hover:underline font-semibold"
                  >
                    <Mail size={14} />
                    <span>privacy@ravennorthstudio.com</span>
                  </a>
                  <span className="hidden sm:inline text-text-muted/40">•</span>
                  <a
                    href="https://ironstone.ravennorthstudio.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-ink hover:text-accent transition-colors font-medium"
                  >
                    <ExternalLink size={13} />
                    <span>https://ironstone.ravennorthstudio.com/</span>
                  </a>
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* Document Footer */}
        <footer className="pt-10 border-t border-surface-muted flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
          <span>© 2026 Raven North Studio. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-ink transition-colors font-medium">Home</Link>
            <Link to="/projects" className="hover:text-ink transition-colors font-medium">Projects</Link>
            <a 
              href="#top" 
              onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="text-accent hover:underline font-medium"
            >
              Back to top ↑
            </a>
          </div>
        </footer>

      </div>
    </div>
  );
}
