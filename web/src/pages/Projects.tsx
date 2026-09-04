import { useEffect, useState } from 'react';
import { Plus, Search, Layers } from 'lucide-react';
import { listProjects } from '../db/repo';
import type { Project } from '../lib/types';
import ProjectCard from '../components/ProjectCard';
import CreateProjectModal from '../components/CreateProjectModal';

export default function Projects() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const refresh = () => listProjects().then(setProjects);

  useEffect(() => {
    refresh();
  }, []);

  const filtered = (projects ?? []).filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase().trim())
  );

  return (
    <div className="w-full min-h-full px-6 md:px-12 lg:px-16 py-10 md:py-14 space-y-8 max-w-7xl mx-auto">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-black/[0.04] pb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">Projects</h1>
            {projects !== null && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-black/[0.04] text-ink/70">
                {projects.length}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm text-text-muted">
            All your studio spaces, collected assets, and print-ready moodboards.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search input */}
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              className="bg-[#F5F5F3] hover:bg-[#EFEFEc] focus:bg-white text-ink text-xs rounded-xl pl-9 pr-3.5 py-2.5 border border-transparent focus:border-black/10 focus:outline-none transition-all placeholder:text-text-muted/60 w-48 sm:w-60"
            />
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-ink text-white font-medium text-xs shadow-xs hover:bg-ink/90 active:scale-[0.98] transition-all shrink-0"
          >
            <Plus size={15} strokeWidth={2.2} />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Grid of Project Cards */}
      {projects === null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse aspect-[1.12/1] bg-surface-muted/60 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-16 rounded-3xl bg-[#FAF4EC] shadow-xs text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-xs flex items-center justify-center text-ink/70 mb-4">
            <Layers size={20} strokeWidth={1.8} className="text-text-muted" />
          </div>
          <h3 className="text-lg font-bold text-ink">
            {query ? 'No matching projects' : 'No projects yet'}
          </h3>
          <p className="text-xs sm:text-sm text-text-muted max-w-sm mt-1 mb-6 leading-relaxed">
            {query
              ? `No project found matching "${query}". Try another search term.`
              : 'Create your first project to organize references and export moodboards.'}
          </p>
          <button
            onClick={() => {
              setQuery('');
              setShowCreate(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-ink text-white font-medium text-xs shadow-xs hover:bg-ink/90 transition-all"
          >
            <Plus size={15} strokeWidth={2} />
            <span>New Project</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
          {filtered.map((project, idx) => (
            <ProjectCard
              key={project.id}
              project={project}
              index={idx}
              onDeleted={refresh}
              onDuplicated={refresh}
              onUpdated={refresh}
            />
          ))}
        </div>
      )}

      {showCreate && <CreateProjectModal onClose={() => { setShowCreate(false); refresh(); }} />}
    </div>
  );
}
