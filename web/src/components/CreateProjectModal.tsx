import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';
import { createProject } from '../db/repo';
import type { Orientation } from '../lib/types';

export default function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [orientation, setOrientation] = useState<Orientation>('landscape');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Please provide a project name.'); return; }
    if (busy) return;
    setBusy(true);
    const project = await createProject(name.trim(), orientation);
    navigate(`/projects/${project.id}`);
  }

  return (
    <Modal title="New project" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="label" htmlFor="project-name">
            Project name
          </label>
          <input
            id="project-name"
            className="input"
            placeholder="e.g. Acme rebrand"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <span className="label">Orientation</span>
          <div className="grid grid-cols-2 gap-2">
            {(['landscape', 'portrait'] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOrientation(o)}
                className={`rounded-md px-3 py-2.5 text-sm font-semibold capitalize transition-colors ${
                  orientation === o
                    ? 'bg-ink text-bg'
                    : 'bg-surface-muted text-text-muted hover:text-ink'
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-danger font-semibold">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            Create project
          </button>
        </div>
      </form>
    </Modal>
  );
}

