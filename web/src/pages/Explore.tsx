import { useParams, Link } from 'react-router-dom';
import { CATALOGUE } from '../lib/catalogue';
import { useState, useEffect } from 'react';
import { listProjects, putImage } from '../db/repo';
import { ArrowLeft, Compass, Plus, Check } from 'lucide-react';
import Modal from '../components/Modal';

function AddToProjectModal({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    listProjects().then(setProjects);
  }, []);

  async function saveTo(projectId: string) {
    setSaving(true);
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      await putImage({ projectId, styleGroupId: null, blob, source: 'style' });
      setSavedId(projectId);
      setTimeout(() => {
        setSavedId(null);
        onClose();
      }, 800);
    } catch {
      setSaving(false);
    }
  }

  return (
    <Modal title="Save to Project" onClose={onClose}>
      <div className="flex flex-col gap-2">
        {projects.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-sm text-text-muted">No projects found. Create a project first to save references.</p>
            <Link to="/projects" className="btn-primary mt-4 inline-block text-xs">
              Go to Projects
            </Link>
          </div>
        ) : (
          projects.map((p) => (
            <button
              key={p.id}
              disabled={saving || savedId === p.id}
              onClick={() => saveTo(p.id)}
              className="btn-ghost justify-between w-full text-left"
            >
              <span className="font-semibold">{p.name}</span>
              {savedId === p.id ? (
                <span className="text-xs text-accent font-bold inline-flex items-center gap-1">
                  <Check size={14} strokeWidth={1.5} /> Saved
                </span>
              ) : (
                <span className="text-xs text-text-muted capitalize">{p.orientation}</span>
              )}
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}

export default function Explore() {
  const { categoryId, collectionId } = useParams();
  const [pickerImage, setPickerImage] = useState<string | null>(null);

  if (!categoryId) {
    return (
      <div className="w-full px-6 md:px-10 lg:px-12 py-8 md:py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">Explore</h1>
          <p className="mt-1 text-sm text-text-muted">
            Curated design styles and reference imagery to kickstart your boards.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
          {CATALOGUE.map((cat) => (
            <Link key={cat.id} to={`/explore/${cat.id}`} className="card p-6 hover:shadow-lift group transition-shadow flex flex-col justify-between min-h-[140px]">
              <div>
                <h2 className="text-xl font-bold text-ink group-hover:text-accent transition-colors">{cat.name}</h2>
                <p className="mt-2 text-sm text-text-muted">{cat.collections.length} collections</p>
              </div>
              <span className="text-xs font-bold text-accent mt-4">Explore category →</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const category = CATALOGUE.find((c) => c.id === categoryId);
  if (!category) {
    return (
      <div className="w-full px-6 md:px-10 lg:px-12 py-8 md:py-10">
        <div className="card p-12 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-surface-muted flex items-center justify-center text-text-muted mb-4">
            <Compass size={22} strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-bold text-ink">No curated references found</h2>
          <p className="mt-1 text-sm text-text-muted max-w-sm mb-6">
            This category does not exist or has been moved.
          </p>
          <Link to="/explore" className="btn-primary">
            Return to all categories
          </Link>
        </div>
      </div>
    );
  }

  if (!collectionId) {
    return (
      <div className="w-full px-6 md:px-10 lg:px-12 py-8 md:py-10">
        <div className="mb-6 flex items-center gap-2 text-sm text-text-muted">
          <Link to="/explore" className="hover:text-ink transition-colors">Explore</Link>
          <span>/</span>
          <span className="text-ink font-semibold">{category.name}</span>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">{category.name}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {category.collections.length} collection{category.collections.length === 1 ? '' : 's'} available
          </p>
        </div>

        {category.collections.length === 0 ? (
          <div className="card p-12 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-xl bg-surface-muted flex items-center justify-center text-text-muted mb-4">
              <Compass size={22} strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-bold text-ink">No collections found</h2>
            <p className="mt-1 text-sm text-text-muted max-w-sm mb-6">
              There are currently no collections under this category.
            </p>
            <Link to="/explore" className="btn-primary">
              Return to all categories
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
            {category.collections.map((col) => (
              <Link
                key={col.id}
                to={`/explore/${category.id}/${col.id}`}
                className="card p-6 hover:shadow-lift group transition-shadow flex flex-col justify-between min-h-[140px]"
              >
                <div>
                  <h2 className="text-xl font-bold text-ink group-hover:text-accent transition-colors">{col.name}</h2>
                  <p className="mt-2 text-sm text-text-muted">{col.images.length} references</p>
                </div>
                <span className="text-xs font-bold text-accent mt-4">View references →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  const collection = category.collections.find((c) => c.id === collectionId);
  if (!collection) {
    return (
      <div className="w-full px-6 md:px-10 lg:px-12 py-8 md:py-10">
        <div className="card p-12 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-surface-muted flex items-center justify-center text-text-muted mb-4">
            <Compass size={22} strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-bold text-ink">Collection not found</h2>
          <p className="mt-1 text-sm text-text-muted max-w-sm mb-6">
            This collection does not exist.
          </p>
          <Link to={`/explore/${category.id}`} className="btn-primary">
            Return to {category.name}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 md:px-10 lg:px-12 py-8 md:py-10">
      <div className="mb-6 flex items-center gap-2 text-sm text-text-muted">
        <Link to="/explore" className="hover:text-ink transition-colors">Explore</Link>
        <span>/</span>
        <Link to={`/explore/${category.id}`} className="hover:text-ink transition-colors">{category.name}</Link>
        <span>/</span>
        <span className="text-ink font-semibold">{collection.name}</span>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">{collection.name}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {collection.images.length} reference{collection.images.length === 1 ? '' : 's'}
        </p>
      </div>
      
      <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 2xl:columns-7 gap-5 [&>*]:mb-5">
        {collection.images.map((img, i) => (
          <div key={i} className="relative group break-inside-avoid rounded-lg overflow-hidden bg-surface-muted shadow-sm">
            <img src={img} alt="" className="w-full h-auto block" loading="lazy" />
            <button 
              onClick={() => setPickerImage(img)}
              className="absolute top-3 right-3 btn-primary !px-3 !py-1.5 shadow-pop opacity-0 group-hover:opacity-100 transition inline-flex items-center gap-1.5 text-xs"
            >
              <Plus size={14} strokeWidth={1.5} /> Save
            </button>
          </div>
        ))}
      </div>

      {pickerImage && <AddToProjectModal imageUrl={pickerImage} onClose={() => setPickerImage(null)} />}
    </div>
  );
}
