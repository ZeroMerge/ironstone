import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Plus, Folder, ArrowRight } from 'lucide-react';
import { deleteProject, listProjects } from '../db/repo';
import type { Project } from '../lib/types';
import CreateProjectModal from '../components/CreateProjectModal';

export default function Projects() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const refresh = () => listProjects().then(setProjects);
  useEffect(() => {
    refresh();
  }, []);

  async function remove(id: string) {
    await deleteProject(id);
    setConfirmId(null);
    refresh();
  }

  return (
    <div className="w-full px-6 md:px-10 lg:px-12 py-8 md:py-10">
      {/* Top-Left Page Header with permanent action */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-ink">Projects</h1>
            {projects !== null && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-surface-muted text-text-muted">
                {projects.length}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-text-muted">
            Manage your project spaces and moodboards.
          </p>
        </div>
        <button className="btn-primary inline-flex items-center gap-2" onClick={() => setShowCreate(true)}>
          <Plus size={16} strokeWidth={1.5} /> New Project
        </button>
      </div>

      {projects === null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse h-36 bg-surface rounded-lg" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        /* Empty State Content (Inside the Grid Container) */
        <div className="card border-[1.5px] border-dashed border-surface-active p-14 text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-12 h-12 rounded-xl bg-surface-muted flex items-center justify-center text-text-muted mb-4">
            <Folder size={22} strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-bold text-ink">Your workspace is clean</h2>
          <p className="mt-1 text-sm text-text-muted max-w-md mb-6">
            Create a project to organize boards and auto-generate PDF moodboards.
          </p>
          <button className="btn-primary inline-flex items-center gap-2" onClick={() => setShowCreate(true)}>
            <Plus size={16} strokeWidth={1.5} /> Create project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
          {projects.map((p) => (
            <div key={p.id} className="card p-5 relative group flex flex-col justify-between hover:shadow-lift transition-shadow">
              <Link to={`/projects/${p.id}`} className="block">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-text-muted/80 uppercase tracking-wider">
                    {p.orientation}
                  </span>
                  <span className="text-xs text-text-faint">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="font-bold text-ink truncate pr-8 group-hover:text-accent transition-colors">
                  {p.name}
                </h3>
              </Link>
              
              <div className="mt-6 pt-3 border-t-[1.5px] border-surface-muted flex items-center justify-between">
                <Link to={`/projects/${p.id}`} className="text-xs font-semibold text-text-muted hover:text-ink inline-flex items-center gap-1">
                  Open board <ArrowRight size={12} strokeWidth={1.5} />
                </Link>

                {confirmId === p.id ? (
                  <div className="flex items-center gap-1 bg-surface rounded-md shadow-lift p-1">
                    <button
                      className="px-2 py-1 text-xs font-semibold text-danger rounded hover:bg-surface-muted"
                      onClick={() => remove(p.id)}
                    >
                      Delete
                    </button>
                    <button
                      className="px-2 py-1 text-xs font-semibold text-text-muted rounded hover:bg-surface-muted"
                      onClick={() => setConfirmId(null)}
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <button
                    className="p-1.5 rounded-md text-text-faint opacity-0 group-hover:opacity-100 hover:text-danger hover:bg-surface-muted transition"
                    onClick={() => setConfirmId(p.id)}
                    aria-label={`Delete ${p.name}`}
                  >
                    <div className="flex items-center justify-center w-5 h-5 shrink-0">
                      <Trash2 size={16} strokeWidth={1.5} />
                    </div>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
