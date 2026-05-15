'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type ProjectSummary = {
  id: string
  name: string
  domain: string
  niche: string
  totalOpportunities: number
  contactedCount: number
  securedCount: number
  aiSummary: string | null
  createdAt: string
}

const NICHE_EXAMPLES = [
  'SaaS / B2B Software', 'Health & Wellness', 'Finance / Fintech',
  'Marketing / SEO', 'E-commerce / Retail', 'Education / EdTech',
]

function ProjectCard({ p, onDelete }: { p: ProjectSummary; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false)
  const total = p.totalOpportunities

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/tools/backlinks/${p.id}`, { method: 'DELETE' })
    onDelete(p.id)
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="font-bold text-slate-800 text-base">{p.name}</div>
          <div className="text-xs text-slate-500">{p.domain} · {p.niche}</div>
          <div className="text-xs text-slate-400 mt-0.5">{new Date(p.createdAt).toLocaleDateString()}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-green-600">{p.securedCount}</div>
          <div className="text-[10px] text-slate-400">secured</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-slate-700">{total}</div>
          <div className="text-[10px] text-slate-400">Opportunities</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-blue-600">{p.contactedCount}</div>
          <div className="text-[10px] text-slate-400">Contacted</div>
        </div>
        <div className="bg-green-50 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-green-600">{p.securedCount}</div>
          <div className="text-[10px] text-slate-400">Secured</div>
        </div>
      </div>

      {total > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
            <span>Outreach progress</span>
            <span>{Math.round((p.contactedCount / total) * 100)}% contacted</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-400"
              style={{ width: `${(p.contactedCount / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {p.aiSummary && (
        <p className="text-xs text-slate-500 mb-3 line-clamp-2">{p.aiSummary}</p>
      )}

      <div className="flex gap-2">
        <Link
          href={`/dashboard/backlinks/${p.id}`}
          className="flex-1 text-center text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
        >
          🔗 View Opportunities
        </Link>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs px-3 py-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          {deleting ? '...' : 'Delete'}
        </button>
      </div>
    </div>
  )
}

export function BacklinksClient() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [niche, setNiche] = useState('')
  const [keywords, setKeywords] = useState('')
  const [brief, setBrief] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const r = await fetch('/api/tools/backlinks')
    const d = await r.json()
    if (Array.isArray(d)) setProjects(d)
    setLoading(false)
  }

  async function generate() {
    if (!name.trim() || !domain.trim() || !niche.trim()) {
      setError('Project name, domain and niche are required')
      return
    }
    setError('')
    setGenerating(true)
    try {
      const kwList = keywords.split('\n').map(k => k.trim()).filter(Boolean)
      const r = await fetch('/api/tools/backlinks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, domain, niche, targetKeywords: kwList, contentBrief: brief }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed')
      setShowForm(false)
      setName(''); setDomain(''); setNiche(''); setKeywords(''); setBrief('')
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  function removeProject(id: string) {
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            🔗 Backlink Prospector
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">PRO</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            AI-generated site-specific link building opportunities with outreach tracking
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError('') }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
        >
          {showForm ? '✕ Cancel' : '+ New Project'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-4">New Link Building Project</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Project Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Q3 Link Building Campaign"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Domain *</label>
              <input
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="example.com"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="text-xs font-medium text-slate-600 mb-1 block">Niche / Industry *</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {NICHE_EXAMPLES.map(n => (
                <button
                  key={n}
                  onClick={() => setNiche(n)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${niche === n ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:border-blue-400'}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <input
              value={niche}
              onChange={e => setNiche(e.target.value)}
              placeholder="Or type your niche..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Target Keywords (one per line)</label>
              <textarea
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                placeholder={"seo tools\nbacklink checker\nrank tracker"}
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Content Brief (optional)</label>
              <textarea
                value={brief}
                onChange={e => setBrief(e.target.value)}
                placeholder="What your site/content is about..."
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

          <div className="flex gap-3 items-center">
            <button
              onClick={generate}
              disabled={generating}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {generating ? '⏳ Generating...' : '🔗 Generate 12 Opportunities'}
            </button>
            {generating && (
              <span className="text-xs text-slate-400">Claude is researching real sites (~20 sec)</span>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">🔗</div>
          <div className="text-lg font-bold text-slate-700">No projects yet</div>
          <div className="text-sm text-slate-400 mt-1">
            Create a project to get AI-generated backlink opportunities for your domain
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
          >
            + Create First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map(p => (
            <ProjectCard key={p.id} p={p} onDelete={removeProject} />
          ))}
        </div>
      )}
    </div>
  )
}
