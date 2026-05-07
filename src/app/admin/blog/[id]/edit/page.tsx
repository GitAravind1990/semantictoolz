import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import BlogEditor from '../../BlogEditor'

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const post = await prisma.blogPost.findUnique({ where: { id } })
  if (!post) notFound()

  return (
    <BlogEditor
      mode="edit"
      initial={{
        id: post.id,
        slug: post.slug,
        title: post.title,
        description: post.description,
        content: post.content,
        category: post.category,
        readingTime: post.readingTime,
        published: post.published,
      }}
    />
  )
}
