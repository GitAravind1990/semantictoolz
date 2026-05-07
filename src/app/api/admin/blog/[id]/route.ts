import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin()
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

  const { id } = await params
  const post = await prisma.blogPost.findUnique({ where: { id } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(post)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin()
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

  const { id } = await params
  const body = await req.json()
  const { title, slug, description, content, category, readingTime, published } = body

  const existing = await prisma.blogPost.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const post = await prisma.blogPost.update({
    where: { id },
    data: {
      title,
      slug,
      description,
      content,
      category,
      readingTime,
      published,
      publishedAt: published && !existing.publishedAt ? new Date() : existing.publishedAt,
    },
  })
  return NextResponse.json(post)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin()
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

  const { id } = await params
  await prisma.blogPost.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
