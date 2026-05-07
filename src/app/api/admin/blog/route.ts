import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

export async function GET() {
  const check = await requireAdmin()
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

  const posts = await prisma.blogPost.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, slug: true, title: true, category: true, published: true, publishedAt: true, createdAt: true, readingTime: true },
  })
  return NextResponse.json(posts)
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

  const body = await req.json()
  const { slug, title, description, content, category, readingTime, published } = body

  if (!slug || !title || !content) {
    return NextResponse.json({ error: 'slug, title, and content are required' }, { status: 400 })
  }

  const post = await prisma.blogPost.create({
    data: {
      slug,
      title,
      description: description ?? '',
      content,
      category: category ?? 'SEO',
      readingTime: readingTime ?? '5 min read',
      published: published ?? false,
      publishedAt: published ? new Date() : null,
    },
  })
  return NextResponse.json(post, { status: 201 })
}
