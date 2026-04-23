'use client'

import { useState } from 'react'
import { useContent } from '@/context/ContentContext'

type SchemaType = 'Organization' | 'LocalBusiness' | 'Product' | 'Service' | 'BlogPosting' | 'FAQPage' | 'Person' | 'BreadcrumbList' | 'WebSite' | 'Event'

type SuggestedSchema = {
  schema_type: SchemaType
  reason: string
  confidence: 'high' | 'medium' | 'low'
}

type ExtractedData = {
  business_name: string
  website_url: string
  address: string
  phone: string
  email: string
  services: string[]
  products: string[]
  people: Array<{ name: string; title: string }>
  faq_items: Array<{ question: string; answer: string }>
  article_title: string
  publication_date: string
  author_name: string
  industry: string
}

type AnalysisResult = {
  business_type: string
  suggested_schemas: SuggestedSchema[]
  extracted_data: ExtractedData
}

const SCHEMA_DESCRIPTIONS: Record<SchemaType, string> = {
  Organization: 'General company/organization info - name, logo, contact, social profiles',
  LocalBusiness: 'Local business with physical location - address, phone, hours, map',
  Product: 'Products you sell - name, description, price, image, rating',
  Service: 'Services you offer - name, description, provider, price range',
  BlogPosting: 'Articles & blog posts - title, author, date, content, image',
  FAQPage: 'Frequently asked questions - Q&A pairs from your content',
  Person: 'Team members or influencers - name, title, image, social profiles',
  BreadcrumbList: 'Site navigation structure - helps Google understand your site hierarchy',
  WebSite: 'Overall website info - name, URL, search action',
  Event: 'Events you host - name, date, location, price, registration',
}

export default function SchemaGeneratorPage() {
  const { content: sharedContent } = useContent()
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [selectedSchemas, setSelectedSchemas] = useState<Set<SchemaType>>(new Set())
  const [generatedSchema, setGeneratedSchema] = useState<string | null>(null)
  const [customData, setCustomData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState<'idle' | 'analyzing' | 'generating'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const hasContent = !!sharedContent && sharedContent.length >= 100

  async function handleAnalyze() {
    if (!sharedContent) {
      setError('Please analyze content in the Content Analyzer first.')
      return
    }
    setError(null)
    setLoading('analyzing')
    try {
      const res = await fetch('/api/schema-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: sharedContent }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to analyze')
      setAnalysis(data)
      setSelectedSchemas(new Set(data.suggested_schemas.map((s: SuggestedSchema) => s.schema_type)))
      // Pre-fill custom data from extracted data
      const filled: Record<string, any> = {}
      Object.keys(data.extracted_data).forEach(key => {
        filled[key] = data.extracted_data[key]
      })
      setCustomData(filled)
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading('idle')
    }
  }

  function toggleSchema(schema: SchemaType) {
    const next = new Set(selectedSchemas)
    if (next.has(schema)) next.delete(schema); else next.add(schema)
    setSelectedSchemas(next)
  }

  function generateSchema() {
    if (selectedSchemas.size === 0) {
      setError('Select at least one schema')
      return
    }
    setError(null)
    setLoading('generating')

    try {
      const schemas: any[] = []

      if (selectedSchemas.has('Organization')) {
        schemas.push({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: customData.business_name || analysis?.extracted_data.business_name || '',
          url: customData.website_url || analysis?.extracted_data.website_url || '',
          logo: customData.logo || '',
          sameAs: customData.socialProfiles ? customData.socialProfiles.split(',').map((s: string) => s.trim()) : [],
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'Customer Service',
            telephone: customData.phone || analysis?.extracted_data.phone || '',
            email: customData.email || analysis?.extracted_data.email || '',
          },
        })
      }

      if (selectedSchemas.has('LocalBusiness')) {
        schemas.push({
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          name: customData.business_name || analysis?.extracted_data.business_name || '',
          address: {
            '@type': 'PostalAddress',
            streetAddress: customData.street || '',
            addressLocality: customData.city || '',
            addressRegion: customData.state || '',
            postalCode: customData.zip || '',
            addressCountry: customData.country || 'US',
          },
          telephone: customData.phone || '',
          url: customData.website_url || '',
          geo: customData.lat ? {
            '@type': 'GeoCoordinates',
            latitude: customData.lat,
            longitude: customData.lng,
          } : undefined,
        })
      }

      if (selectedSchemas.has('Product')) {
        const products = customData.products || analysis?.extracted_data.products || []
        products.forEach((prod: string) => {
          if (prod) {
            schemas.push({
              '@context': 'https://schema.org',
              '@type': 'Product',
              name: prod,
              description: customData.productDesc || '',
              price: customData.price || '',
              priceCurrency: customData.currency || 'USD',
              image: customData.productImage || '',
            })
          }
        })
      }

      if (selectedSchemas.has('Service')) {
        const services = customData.services || analysis?.extracted_data.services || []
        services.forEach((svc: string) => {
          if (svc) {
            schemas.push({
              '@context': 'https://schema.org',
              '@type': 'Service',
              name: svc,
              description: customData.serviceDesc || '',
              provider: {
                '@type': 'Organization',
                name: customData.business_name || '',
              },
              areaServed: customData.serviceArea || '',
            })
          }
        })
      }

      if (selectedSchemas.has('BlogPosting')) {
        schemas.push({
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: customData.article_title || analysis?.extracted_data.article_title || '',
          description: customData.description || '',
          datePublished: customData.article_date || analysis?.extracted_data.publication_date || new Date().toISOString().split('T')[0],
          dateModified: new Date().toISOString().split('T')[0],
          author: {
            '@type': 'Person',
            name: customData.author_name || analysis?.extracted_data.author_name || '',
          },
          image: customData.image || '',
        })
      }

      if (selectedSchemas.has('FAQPage')) {
        const faqs = customData.faq_items || analysis?.extracted_data.faq_items || []
        if (faqs.length > 0) {
          schemas.push({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map((faq: any) => ({
              '@type': 'Question',
              name: faq.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
              },
            })),
          })
        }
      }

      if (selectedSchemas.has('Person')) {
        const people = customData.people || analysis?.extracted_data.people || []
        people.forEach((person: any) => {
          if (person.name) {
            schemas.push({
              '@context': 'https://schema.org',
              '@type': 'Person',
              name: person.name,
              jobTitle: person.title || '',
              image: customData.personImage || '',
              url: customData.personUrl || '',
            })
          }
        })
      }

      if (selectedSchemas.has('WebSite')) {
        schemas.push({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: customData.business_name || '',
          url: customData.website_url || '',
          potentialAction: {
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: customData.searchUrl || '',
            },
            'query-input': 'required name=search_term_string',
          },
        })
      }

      const jsonLd = schemas.map(s => JSON.stringify(s, null, 2)).join('\n\n')
      setGeneratedSchema(jsonLd)
      setStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setLoading('idle')
    }
  }

  function downloadJSON() {
    if (!generatedSchema) return
    const blob = new Blob([generatedSchema], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'schema.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function copyToClipboard() {
    if (!generatedSchema) return
    navigator.clipboard.writeText(generatedSchema)
    alert('Schema copied to clipboard!')
  }

  function reset() {
    setAnalysis(null)
    setSelectedSchemas(new Set())
    setGeneratedSchema(null)
    setStep(1)
    setError(null)
  }

  if (!hasContent) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">📋</span>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Schema Generator</h1>
              <p className="text-sm text-slate-500">Generate JSON-LD structured data for SEO</p>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">📝</div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">No analyzed content yet</h2>
            <p className="text-sm text-slate-600 mb-4">Go to Content Analyzer first, then come back here.</p>
            <a href="/dashboard/scores" className="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl">
              Go to Content Analyzer →
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">📋</span>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Schema Generator</h1>
            <p className="text-sm text-slate-500">Generate JSON-LD structured data for SEO</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 text-xs font-bold">
          <span className={`px-3 py-1 rounded-full ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1. Analyze</span>
          <span className="text-slate-300">→</span>
          <span className={`px-3 py-1 rounded-full ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2. Customize</span>
          <span className="text-slate-300">→</span>
          <span className={`px-3 py-1 rounded-full ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>3. Download</span>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}

        {/* Step 1 */}
        {step === 1 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
            <p className="text-slate-600 mb-4">Content from Content Analyzer is ready. Click below to analyze and suggest schemas.</p>
            <button
              onClick={handleAnalyze}
              disabled={loading === 'analyzing'}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl"
            >
              {loading === 'analyzing' ? 'Analyzing…' : 'Analyze & Suggest Schemas →'}
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && analysis && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-blue-900">Detected business type: <span className="text-blue-700">{analysis.business_type}</span></p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Suggested Schemas</h2>
              <div className="space-y-2">
                {analysis.suggested_schemas.map((s, i) => (
                  <label key={i} className="flex items-start gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSchemas.has(s.schema_type)}
                      onChange={() => toggleSchema(s.schema_type)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{s.schema_type}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${s.confidence === 'high' ? 'bg-green-100 text-green-700' : s.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>
                          {s.confidence}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{s.reason}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="sticky bottom-0 bg-white pt-4 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 px-6 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl"
              >
                ← Back
              </button>
              <button
                onClick={generateSchema}
                disabled={loading === 'generating' || selectedSchemas.size === 0}
                className="flex-1 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl"
              >
                {loading === 'generating' ? 'Generating…' : `Generate Selected (${selectedSchemas.size})`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && generatedSchema && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-green-900">✓ Schema generated successfully</p>
              <p className="text-xs text-green-700 mt-1">Copy and paste this JSON-LD into your website's &lt;head&gt; tag inside &lt;script type="application/ld+json"&gt;&lt;/script&gt;</p>
            </div>

            <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto">
              <pre>{generatedSchema}</pre>
            </div>

            <div className="flex gap-3">
              <button
                onClick={downloadJSON}
                className="flex-1 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl"
              >
                ⬇ Download JSON
              </button>
              <button
                onClick={copyToClipboard}
                className="flex-1 px-6 py-2.5 border border-blue-600 text-blue-600 hover:bg-blue-50 text-sm font-bold rounded-xl"
              >
                📋 Copy to Clipboard
              </button>
              <button
                onClick={reset}
                className="px-6 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl"
              >
                Generate Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}