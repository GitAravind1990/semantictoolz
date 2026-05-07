import { prisma } from '@/lib/prisma'

export interface PostMeta {
  slug: string
  title: string
  description: string
  date: string
  readingTime: string
  category: string
}

export interface Post extends PostMeta {
  content: string
}

export async function getAllPosts(): Promise<PostMeta[]> {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: 'desc' },
    select: { slug: true, title: true, description: true, publishedAt: true, readingTime: true, category: true },
  })
  return posts.map(p => ({ ...p, date: p.publishedAt?.toISOString().split('T')[0] ?? '' }))
}

export async function getPost(slug: string): Promise<Post | null> {
  const post = await prisma.blogPost.findUnique({ where: { slug, published: true } })
  if (!post) return null
  return { ...post, date: post.publishedAt?.toISOString().split('T')[0] ?? '' }
}
