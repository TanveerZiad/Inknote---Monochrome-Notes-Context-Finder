import React, { useState } from 'react';
import './InknoteLanding.css';
import {
  Plus,
  Sparkles,
  ArrowRight,
  Sun,
  Moon,
  Folder,
  Shield,
  Layers,
  Calendar,
  CheckCircle2,
  FileText,
  Search,
  ExternalLink,
  ChevronRight,
  Command,
} from 'lucide-react';

interface InknoteLandingProps {
  onNewNote: () => void;
  onOpenWorkspace: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  notesCount?: number;
  foldersCount?: number;
}

export const InknoteLanding: React.FC<InknoteLandingProps> = ({
  onNewNote,
  onOpenWorkspace,
  isDarkMode,
  onToggleDarkMode,
  notesCount = 14,
  foldersCount = 5,
}) => {
  const [activePreviewTab, setActivePreviewTab] = useState<'timeline' | 'cards' | 'markdown'>('timeline');
  const todayDate = new Date().getDate();

  return (
    <div className="landing-container">
      {/* 1. Top Minimalist Navigation Bar */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          {/* Brand Logo */}
          <div className="landing-brand" onClick={onOpenWorkspace} role="button" tabIndex={0}>
            <div className="landing-logo-box">
              <img
                src="/inknote-icon.png"
                alt="Inknote"
                className="landing-logo-img"
                onError={(e) => {
                  // Fallback in case icon path differs
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span className="landing-logo-fallback">✦</span>
            </div>
            <span className="landing-brand-name">Inknote</span>
          </div>

          {/* Minimal Nav Links */}
          <nav className="landing-nav-links" aria-label="Main Navigation">
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#preview" className="landing-nav-link">Workspace</a>
            <a href="#philosophy" className="landing-nav-link">Philosophy</a>
            <button
              onClick={onOpenWorkspace}
              className="landing-nav-link landing-nav-link-btn"
            >
              Vault Sync
            </button>
          </nav>

          {/* Right Controls */}
          <div className="landing-nav-actions">
            {/* Dark / Light Mode Switch */}
            <button
              className="landing-icon-btn"
              onClick={onToggleDarkMode}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Direct Open Workspace */}
            <button
              className="landing-btn-subtle"
              onClick={onOpenWorkspace}
              title="Open your notes"
            >
              <span>Workspace</span>
            </button>

            {/* Hero Launch CTA in Nav */}
            <button
              className="landing-btn-nav-primary"
              onClick={onNewNote}
              title="Create note (takes to workspace)"
            >
              <span>New Note</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Hero Section */}
      <main className="landing-main">
        <section className="landing-hero">
          {/* Background Ambient Radial Glow */}
          <div className="hero-ambient-glow" aria-hidden="true" />
          <div className="hero-grid-pattern" aria-hidden="true" />

          {/* Symmetrically Floating Minimalist 3D-ish Badges (Inspired by Assemble reference) */}
          <div className="floating-elements-layer" aria-hidden="true">
            {/* Top-Left: Optical Lens Badge */}
            <div className="float-item float-lens" title="Focus & Perspective">
              <div className="badge-lens">
                <div className="badge-lens-inner">
                  <div className="badge-lens-core" />
                </div>
              </div>
            </div>

            {/* Top-Right: Dot-Matrix Grid Badge */}
            <div className="float-item float-matrix" title="Structured Organization">
              <div className="badge-matrix">
                <div className="matrix-dot" />
                <div className="matrix-dot" />
                <div className="matrix-dot" />
                <div className="matrix-dot" />
                <div className="matrix-dot" />
                <div className="matrix-dot is-accent" />
                <div className="matrix-dot" />
                <div className="matrix-dot" />
                <div className="matrix-dot" />
                <div className="matrix-dot" />
                <div className="matrix-dot" />
                <div className="matrix-dot" />
                <div className="matrix-dot" />
                <div className="matrix-dot" />
                <div className="matrix-dot" />
                <div className="matrix-dot" />
              </div>
            </div>

            {/* Mid-Left: Calendar Date Badge */}
            <div className="float-item float-calendar" title="Daily Journal & Timeline">
              <div className="badge-calendar">
                <span className="badge-calendar-day">{todayDate || 28}</span>
                <span className="badge-calendar-label">JOURNAL</span>
              </div>
            </div>

            {/* Mid-Right: Layered Glass Circles Badge */}
            <div className="float-item float-glass" title="Semantic Context Links">
              <div className="badge-glass">
                <div className="glass-disc disc-1" />
                <div className="glass-disc disc-2" />
              </div>
            </div>

            {/* Bottom-Left: Markdown Note Card Badge */}
            <div className="float-item float-note" title="Local Markdown">
              <div className="badge-note-card">
                <div className="note-card-corner" />
                <div className="note-card-line line-title" />
                <div className="note-card-line line-short" />
                <div className="note-card-line line-long" />
              </div>
            </div>

            {/* Bottom-Right: Context / Speech Bubble Badge */}
            <div className="float-item float-chat" title="AI Context Finder">
              <div className="badge-chat-bubble">
                <div className="chat-dot" />
                <div className="chat-dot" />
                <div className="chat-tail" />
              </div>
            </div>
          </div>

          {/* Central Hero Content */}
          <div className="hero-content">
            <div className="hero-pill-announcement">
              <span className="announcement-dot" />
              <span>Minimalist local-first notes</span>
              <span className="announcement-arrow">✦</span>
            </div>

            <h1 className="hero-headline">
              Organize your
              <br />
              projects <span className="hero-highlight">in ink.</span>
            </h1>

            <p className="hero-subline">
              Every file, note, convo and to-do.
              <br className="hidden sm:inline" />
              Stored in local markdown, connected by context.
            </p>

            {/* The Signature "New Note" Button (Capsule CTA with luminous status dot) */}
            <div className="hero-cta-group">
              <button
                className="hero-btn-new-note"
                onClick={onNewNote}
                title="Create a new note in workspace (⌘N)"
              >
                <span className="cta-status-dot" />
                <span className="cta-label">New Note</span>
                <span className="cta-shortcut">
                  <Command size={11} className="inline mr-0.5" />N
                </span>
                <ArrowRight size={15} className="cta-arrow" />
              </button>

              <button
                className="hero-btn-secondary"
                onClick={onOpenWorkspace}
                title="Jump directly to existing notes"
              >
                <span>Browse {notesCount} notes</span>
                <ChevronRight size={15} />
              </button>
            </div>

            <p className="hero-meta-note">
              No cloud lock-in · 100% Client-side AES-GCM · Instant startup
            </p>
          </div>

          {/* 3. App Mockup / Perspective Interface Preview */}
          <div id="preview" className="hero-preview-wrapper">
            <div
              className="hero-preview-frame"
              onClick={onOpenWorkspace}
              role="button"
              tabIndex={0}
              title="Click anywhere to open full workspace"
            >
              {/* Window Header Bar */}
              <div className="preview-window-bar">
                <div className="preview-window-controls">
                  <span className="dot dot-close" />
                  <span className="dot dot-minimize" />
                  <span className="dot dot-expand" />
                </div>
                <div className="preview-window-title">
                  <Folder size={12} className="inline mr-1 text-slate-400" />
                  <span>inknote-vault / Campaign</span>
                </div>
                <div className="preview-tabs">
                  <span
                    className={`preview-tab ${activePreviewTab === 'timeline' ? 'is-active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePreviewTab('timeline');
                    }}
                  >
                    Timeline
                  </span>
                  <span
                    className={`preview-tab ${activePreviewTab === 'cards' ? 'is-active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePreviewTab('cards');
                    }}
                  >
                    Cards
                  </span>
                  <span
                    className={`preview-tab ${activePreviewTab === 'markdown' ? 'is-active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePreviewTab('markdown');
                    }}
                  >
                    Markdown
                  </span>
                </div>
              </div>

              {/* Workspace Mockup Content */}
              <div className="preview-window-body">
                {/* Mini Sidebar */}
                <div className="preview-sidebar">
                  <div className="preview-sidebar-header">
                    <span className="preview-sidebar-title">Campaign</span>
                    <span className="preview-count">{notesCount} Files</span>
                  </div>
                  <div className="preview-nav-item is-selected">
                    <span className="nav-bullet" />
                    <span>Design System</span>
                  </div>
                  <div className="preview-nav-item">
                    <span className="nav-bullet" />
                    <span>Concepting</span>
                  </div>
                  <div className="preview-nav-item">
                    <span className="nav-bullet" />
                    <span>Development</span>
                  </div>
                  <div className="preview-nav-item">
                    <span className="nav-bullet" />
                    <span>Daily Journal</span>
                  </div>
                </div>

                {/* Main Mockup Timeline Area */}
                <div className="preview-timeline-stage">
                  {/* Timeline Days Header */}
                  <div className="preview-timeline-ruler">
                    <span className="ruler-col">W 14</span>
                    <span className="ruler-col">T 15</span>
                    <span className="ruler-col">F 16</span>
                    <span className="ruler-col">S 17</span>
                    <span className="ruler-col">S 18</span>
                    <span className="ruler-col">M 20</span>
                    <span className="ruler-col is-current">T 21 (Today)</span>
                    <span className="ruler-col">W 22</span>
                    <span className="ruler-col">T 24</span>
                    <span className="ruler-col">F 25</span>
                  </div>

                  {/* Sample Interactive Note Tracks */}
                  <div className="preview-tracks">
                    {/* Track 1 */}
                    <div className="preview-track-row">
                      <div className="preview-track-label">Design</div>
                      <div className="preview-block block-brainstorming">
                        <CheckCircle2 size={13} className="text-emerald-500" />
                        <span>Brainstorming UI Layouts</span>
                        <div className="preview-avatars">
                          <span className="avatar avatar-1">✦</span>
                          <span className="avatar avatar-2">▲</span>
                        </div>
                      </div>
                    </div>

                    {/* Track 2 */}
                    <div className="preview-track-row">
                      <div className="preview-track-label">Concepting</div>
                      <div className="preview-block block-sprint">
                        <span className="block-dot" />
                        <span>Design Sprint · Context Finder Integration</span>
                        <span className="preview-tag">#v1</span>
                      </div>
                    </div>

                    {/* Track 3 */}
                    <div className="preview-track-row">
                      <div className="preview-track-label">Release</div>
                      <div className="preview-block block-boards">
                        <FileText size={12} className="text-blue-500" />
                        <span>Markdown Sync & Local Vault Protocol</span>
                        <span className="preview-pill-badge">V1 Due</span>
                      </div>
                    </div>
                  </div>

                  {/* Hover Overlay Prompt */}
                  <div className="preview-hover-cta">
                    <span>Enter Workspace</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Minimalist Pillars Section */}
        <section id="features" className="landing-pillars-section">
          <div className="pillars-header">
            <span className="pillars-eyebrow">DESIGNED FOR CLARITY</span>
            <h2 className="pillars-title">Notes without clutter. Power without complexity.</h2>
            <p className="pillars-subtitle">
              Built for developers, writers, and thinkers who value their attention and ownership.
            </p>
          </div>

          <div className="pillars-grid">
            {/* Pillar 1 */}
            <div className="pillar-card">
              <div className="pillar-icon-box">
                <Folder size={20} />
              </div>
              <h3 className="pillar-heading">100% Local & Markdown Native</h3>
              <p className="pillar-body">
                Every note is a human-readable <code>.md</code> file inside your own folder. No proprietary databases, no lock-in, forever readable.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="pillar-card">
              <div className="pillar-icon-box">
                <Sparkles size={20} />
              </div>
              <h3 className="pillar-heading">Semantic Context Finder</h3>
              <p className="pillar-body">
                Ask questions across your entire knowledge base. Inknote surfaces deep connections and relevant passages instantly using local indexing.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="pillar-card">
              <div className="pillar-icon-box">
                <Shield size={20} />
              </div>
              <h3 className="pillar-heading">Client-Side AES-GCM Security</h3>
              <p className="pillar-body">
                Lock sensitive folders or individual thoughts with hardware-grade PBKDF2 passkey encryption. Safe from prying eyes.
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="pillar-card">
              <div className="pillar-icon-box">
                <Layers size={20} />
              </div>
              <h3 className="pillar-heading">Distraction-Free Speed</h3>
              <p className="pillar-body">
                Instant keyboard shortcuts (<code>⌘N</code>, <code>⌘K</code>, <code>⌘⇧J</code>), nested folders, task checklists, and a clean monochrome canvas.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Minimalist Bottom CTA Banner */}
        <section id="philosophy" className="landing-cta-banner">
          <div className="cta-banner-content">
            <h2 className="cta-banner-headline">Start writing in seconds.</h2>
            <p className="cta-banner-sub">
              Your thoughts deserve a calm space. Jump straight in with a fresh blank page.
            </p>
            <div className="cta-banner-actions">
              <button
                className="hero-btn-new-note"
                onClick={onNewNote}
              >
                <span className="cta-status-dot" />
                <span className="cta-label">Create First Note</span>
                <ArrowRight size={15} />
              </button>
              <button
                className="landing-btn-subtle"
                onClick={onOpenWorkspace}
                style={{ padding: '12px 20px', fontSize: '14px' }}
              >
                Open Current Workspace
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* 6. Clean Minimalist Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="footer-left">
            <span className="footer-logo">✦ Inknote</span>
            <span className="footer-copy">Local-first monochrome knowledge tool.</span>
          </div>
          <div className="footer-right">
            <button onClick={onNewNote} className="footer-link">New note</button>
            <button onClick={onOpenWorkspace} className="footer-link">Workspace</button>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="footer-link"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
