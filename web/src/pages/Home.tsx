import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Folder, Image as ImageIcon, Plus, ArrowRight, Compass } from 'lucide-react';
import { listProjects, countAllImages } from '../db/repo';
import type { Project } from '../lib/types';
import CreateProjectModal from '../components/CreateProjectModal';

export default function Home() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [totalReferences, setTotalReferences] = useState(0);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    listProjects().then(setProjects);
    countAllImages().then(setTotalReferences);
  }, []);

  return (
    <div className="w-full px-6 md:px-10 lg:px-12 py-8 md:py-10">
      {/* Top-Left Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Home</h1>
        <p className="mt-1 text-sm text-text-muted">
          Create and curate visual moodboards for your creative projects.
        </p>
      </div>

      {/* Top Metrics / Status Strip (Inspired by Reference Image 4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <div className="card p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Total Projects</p>
            <p className="text-2xl font-extrabold text-ink mt-1">
              {projects === null ? '—' : projects.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-surface-muted flex items-center justify-center text-text-muted shrink-0">
            <Folder size={18} strokeWidth={1.5} />
          </div>
        </div>

        <div className="card p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Total References</p>
            <p className="text-2xl font-extrabold text-ink mt-1">
              {totalReferences}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-surface-muted flex items-center justify-center text-text-muted shrink-0">
            <ImageIcon size={18} strokeWidth={1.5} />
          </div>
        </div>

        <div className="card p-5 flex items-center justify-between sm:col-span-2 lg:col-span-1">
          <div>
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Quick Action</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-1 text-sm font-bold text-accent hover:underline inline-flex items-center gap-1"
            >
              + Create new project
            </button>
          </div>
          <div className="w-10 h-10 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
            <Plus size={18} strokeWidth={1.5} />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-ink">Recent Projects</h2>
          {projects && projects.length > 0 && (
            <Link to="/projects" className="text-xs font-bold text-accent hover:underline inline-flex items-center gap-1">
              View all ({projects.length}) <ArrowRight size={14} strokeWidth={1.5} />
            </Link>
          )}
        </div>

        {projects === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse h-32 bg-surface rounded-lg" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          /* Empty State Container (Centered inside fixed page frame) */
          <div className="card p-12 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-xl bg-surface-muted flex items-center justify-center text-text-muted mb-4">
              <Folder size={22} strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-bold text-ink">No projects yet</h3>
            <p className="text-sm text-text-muted max-w-sm mt-1 mb-6">
              Start by creating your first project space to collect visual references and export moodboards.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button className="btn-primary inline-flex items-center gap-2" onClick={() => setShowCreate(true)}>
                <Plus size={16} strokeWidth={1.5} /> Create project
              </button>
              <Link to="/explore/graphic-design" className="btn-secondary inline-flex items-center gap-2">
                <Compass size={16} strokeWidth={1.5} /> Browse curated styles
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
            {projects.map((p) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="card p-5 hover:shadow-lift transition-shadow group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-text-muted/80 uppercase tracking-wider">
                      {p.orientation}
                    </span>
                    <span className="text-xs text-text-faint">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-bold text-ink truncate group-hover:text-accent transition-colors">
                    {p.name}
                  </h3>
                </div>
                <div className="mt-6 pt-3 border-t-[1.5px] border-surface-muted flex items-center justify-between text-xs text-text-muted">
                  <span>Open collection</span>
                  <ArrowRight size={14} strokeWidth={1.5} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
