import { Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Projects from './pages/Projects';
import Collection from './pages/Collection';
import Editor from './pages/Editor';
import Export from './pages/Export';
import Explore from './pages/Explore';
import ExportRender from './pages/ExportRender';
import Privacy from './pages/Privacy';
import { installExtensionSync } from './lib/extensionSync';

export default function App() {
  const location = useLocation();
  const isRenderRoute = location.pathname.startsWith('/export-render/');

  useEffect(() => {
    installExtensionSync();
  }, []);

  if (isRenderRoute) {
    // Hidden Puppeteer-only route: no navigation, no app chrome.
    return (
      <Routes>
        <Route path="/export-render/:projectId" element={<ExportRender />} />
      </Routes>
    );
  }

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<Collection />} />
          <Route path="/projects/:id/editor" element={<Editor />} />
          <Route path="/projects/:id/export" element={<Export />} />
          <Route path="/explore/:categoryId?/:collectionId?" element={<Explore />} />
          <Route path="/privacy" element={<Privacy />} />
        </Routes>
      </main>
    </div>
  );
}


