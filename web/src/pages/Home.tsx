import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ArrowRight, Sparkles, Compass } from 'lucide-react';
import { listProjects } from '../db/repo';
import type { Project } from '../lib/types';
import ProjectCard from '../components/ProjectCard';
import CreateProjectModal from '../components/CreateProjectModal';

const POPULAR_STYLES = [
  { name: 'Brutalism', path: '/explore/graphic-design/brutalism' },
  { name: 'Swiss', path: '/explore/graphic-design/swiss' },
  { name: 'Minimalism', path: '/explore/graphic-design/minimalism' },
  { name: 'Editorial', path: '/explore/photography/editorial' },
  { name: 'Product', path: '/explore/photography/product' },
  { name: 'Y2K', path: '/explore/graphic-design/y2k' },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning.';
  if (hour < 18) return 'Good afternoon.';
  return 'Good evening.';
}

export default function Home() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  function refreshProjects() {
    listProjects().then(setProjects);
  }

  useEffect(() => {
    refreshProjects();
  }, []);

  const greeting = getGreeting();

  return (
    <div className="w-full min-h-full px-6 md:px-12 lg:px-16 py-10 md:py-14 space-y-10 max-w-7xl mx-auto">
      {/* Top Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
            {greeting}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Curate references, extract color palettes, and compose high-resolution moodboards.
          </p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-ink text-white font-medium text-xs shadow-xs hover:bg-ink/90 active:scale-[0.98] transition-all shrink-0"
        >
          <Plus size={15} strokeWidth={2.2} />
          <span>New Project</span>
        </button>
      </div>

      {/* Main Section: Continue Working */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between gap-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted/80">
            Continue Working
          </h2>

          {projects && projects.length > 0 && (
            <Link
              to="/projects"
              className="text-xs font-semibold text-text-muted hover:text-ink transition-colors inline-flex items-center gap-1"
            >
              <span>View all ({projects.length})</span>
              <ArrowRight size={13} strokeWidth={2} />
            </Link>
          )}
        </div>

        {projects === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse aspect-[1.12/1] bg-surface-muted/60 rounded-3xl" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          /* Tactile Empty State without 1px borders */
          <div className="p-12 sm:p-16 rounded-3xl bg-[#FAF4EC] shadow-xs text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-xs flex items-center justify-center text-ink/70 mb-4">
              <Sparkles size={20} strokeWidth={1.8} className="text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-ink tracking-tight">Your atelier is quiet</h3>
            <p className="text-xs sm:text-sm text-text-muted max-w-sm mt-1 mb-6 leading-relaxed">
              Create a project space to collect visual inspirations, import Pinterest boards, and render vector PDFs.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-ink text-white font-medium text-xs shadow-xs hover:bg-ink/90 transition-all"
              >
                <Plus size={15} strokeWidth={2} />
                <span>Create first project</span>
              </button>
              <Link
                to="/explore/graphic-design"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-ink font-medium text-xs hover:bg-surface-active/50 transition-all shadow-2xs"
              >
                <Compass size={15} strokeWidth={1.8} />
                <span>Browse styles</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Project Cards Grid with reduced gap and NO 1px borders */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
            {/* Direct "+ New Project" Card for tactile access (Solid Whitish-Orange) */}
            <div
              onClick={() => setShowCreate(true)}
              className="group aspect-[1.12/1] rounded-3xl p-6 bg-[#FAF4EC] hover:bg-[#F5ECE0] shadow-xs hover:shadow-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200"
            >
              <div className="w-11 h-11 rounded-2xl bg-white shadow-2xs flex items-center justify-center text-ink/70 group-hover:scale-110 group-hover:text-ink transition-all mb-3">
                <Plus size={20} strokeWidth={2} />
              </div>
              <span className="text-sm font-semibold text-ink">New Project</span>
              <span className="text-[11px] text-text-muted/70 mt-0.5">Start fresh canvas</span>
            </div>

            {projects.map((project, idx) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={idx}
                onDeleted={refreshProjects}
                onDuplicated={refreshProjects}
                onUpdated={refreshProjects}
              />
            ))}
          </div>
        )}
      </div>

      {/* Explore by Style Section */}
      <div className="space-y-4 pt-4 border-t border-black/[0.04]">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted/80">
            Explore by Style
          </h2>
          <Link
            to="/explore/graphic-design"
            className="text-xs font-semibold text-text-muted hover:text-ink transition-colors"
          >
            All Collections →
          </Link>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {POPULAR_STYLES.map((style) => (
            <Link
              key={style.name}
              to={style.path}
              className="px-3.5 py-2 rounded-xl bg-white border border-black/[0.05] hover:border-black/15 shadow-2xs text-xs font-medium text-ink hover:text-accent transition-all"
            >
              {style.name}
            </Link>
          ))}
        </div>
      </div>

      {showCreate && <CreateProjectModal onClose={() => { setShowCreate(false); refreshProjects(); }} />}
    </div>
  );
}
