import { useState, useEffect } from 'react';
import { useMatch } from 'react-router-dom';
import { NavLink } from 'react-router-dom';
import { CATALOGUE } from '../lib/catalogue';
import { Home, Folder, Palette, Camera, Briefcase, Megaphone, Calendar, Shapes, PanelLeftClose, PanelLeftOpen, ShieldCheck } from 'lucide-react';

function IconWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center w-5 h-5 shrink-0">
      {children}
    </div>
  );
}

export default function Sidebar() {
  const match = useMatch('/projects/:id/editor');
  const isEditorPage = !!match;
  const [manualState, setManualState] = useState<boolean | null>(null);
  const collapsed = manualState !== null ? manualState : isEditorPage;

  const catIcons: Record<string, React.ReactNode> = {
    'graphic-design': <IconWrapper><Palette size={16} strokeWidth={1.5} /></IconWrapper>,
    'photography': <IconWrapper><Camera size={16} strokeWidth={1.5} /></IconWrapper>,
    'branding': <IconWrapper><Briefcase size={16} strokeWidth={1.5} /></IconWrapper>,
    'campaigns': <IconWrapper><Megaphone size={16} strokeWidth={1.5} /></IconWrapper>,
    'events': <IconWrapper><Calendar size={16} strokeWidth={1.5} /></IconWrapper>
  };

  return (
    <aside
      className={`shrink-0 bg-surface-muted/60 flex transition-[width] duration-300 ease-in-out w-full md:flex-col overflow-y-auto overflow-x-auto ${collapsed ? 'md:w-[80px]' : 'md:w-64'}`}
    >
      <div className={`px-6 py-7 flex items-center ${collapsed ? 'md:justify-center md:px-0' : 'justify-start'}`}>
        <NavLink to="/" className="flex items-center shrink-0">
          {/* Mobile always shows full logo */}
          <img src="/images/ironstone_logo.png" alt="Ironstone" className="h-6 w-auto md:hidden block" />

          {/* Desktop toggles based on collapsed state */}
          <img
            src="/images/ironstone_icon.png"
            alt="Ironstone"
            className={`w-8 h-8 object-contain hidden ${collapsed ? 'md:block' : ''}`}
          />
          <img
            src="/images/ironstone_logo.png"
            alt="Ironstone"
            className={`h-6 w-auto object-contain hidden ${!collapsed ? 'md:block' : ''}`}
          />
        </NavLink>
      </div>

      <div className={`flex-1 flex flex-col gap-12 pb-4 ${collapsed ? 'px-4 md:px-3' : 'px-4'}`}>
        <div>
          <div className={`text-[11px] font-bold text-text-muted/70 tracking-wider uppercase mb-3 px-3 hidden ${!collapsed ? 'md:block' : ''}`}>
            Overview
          </div>
          <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible items-center md:items-stretch">
            <NavLink
              to="/"
              end
              title="Home"
              className={({ isActive }) => `flex items-center gap-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-surface text-ink shadow-sm' : 'text-text-muted hover:text-ink hover:bg-surface-active/50'} ${collapsed ? 'px-3 md:px-0 md:justify-center' : 'px-3'}`}
            >
              <IconWrapper><Home size={16} strokeWidth={1.5} /></IconWrapper>
              <span className={`truncate ${collapsed ? 'md:hidden' : ''}`}>Home</span>
            </NavLink>
            <NavLink
              to="/projects"
              title="Projects"
              className={({ isActive }) => `flex items-center gap-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-surface text-ink shadow-sm' : 'text-text-muted hover:text-ink hover:bg-surface-active/50'} ${collapsed ? 'px-3 md:px-0 md:justify-center' : 'px-3'}`}
            >
              <IconWrapper><Folder size={16} strokeWidth={1.5} /></IconWrapper>
              <span className={`truncate ${collapsed ? 'md:hidden' : ''}`}>Projects</span>
            </NavLink>
          </nav>
        </div>

        <div>
          <div className={`text-[11px] font-bold text-text-muted/70 tracking-wider uppercase mb-3 px-3 hidden ${!collapsed ? 'md:block' : ''}`}>
            Explore
          </div>
          <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible items-center md:items-stretch">
            {CATALOGUE.map(cat => (
              <NavLink
                key={cat.id}
                to={`/explore/${cat.id}`}
                title={cat.name}
                className={({ isActive }) => `flex items-center gap-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-surface text-ink shadow-sm' : 'text-text-muted hover:text-ink hover:bg-surface-active/50'} ${collapsed ? 'px-3 md:px-0 md:justify-center' : 'px-3'}`}
              >
                {catIcons[cat.id] || <IconWrapper><Shapes size={16} strokeWidth={1.5} /></IconWrapper>}
                <span className={`truncate ${collapsed ? 'md:hidden' : ''}`}>{cat.name}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Bottom Section: Privacy & Collapse Toggle */}
      <div className={`mt-auto pb-4 pt-2 ${collapsed ? 'px-3 flex flex-col items-center gap-2' : 'px-4 flex items-center justify-between gap-1'}`}>
        <NavLink
          to="/privacy"
          title="Privacy"
          className={({ isActive }) =>
            `flex items-center gap-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? 'bg-surface text-ink shadow-sm'
                : 'text-text-muted hover:text-ink hover:bg-surface-active/50'
            } ${collapsed ? 'w-10 h-10 justify-center p-0' : 'flex-1 px-3'}`
          }
        >
          <IconWrapper>
            <ShieldCheck size={16} strokeWidth={1.5} />
          </IconWrapper>
          {!collapsed && <span className="truncate">Privacy</span>}
        </NavLink>

        <button
          onClick={() => setManualState(!collapsed)}
          className={`text-text-muted hover:text-ink hover:bg-surface-active/50 rounded-md transition-colors hidden md:flex items-center justify-center ${
            collapsed ? 'w-10 h-10 p-0' : 'p-2 shrink-0'
          }`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <IconWrapper>
            {collapsed ? <PanelLeftOpen size={16} strokeWidth={1.5} /> : <PanelLeftClose size={16} strokeWidth={1.5} />}
          </IconWrapper>
        </button>
      </div>
    </aside>
  );
}
