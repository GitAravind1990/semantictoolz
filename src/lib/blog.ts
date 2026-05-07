import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')

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

export function getAllPosts(): PostMeta[] {
  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.mdx'))
  return files
    .map(filename => {
      const slug = filename.replace(/\.mdx$/, '')
      const { data } = matter(fs.readFileSync(path.join(BLOG_DIR, filename), 'utf8'))
      return { slug, ...(data as Omit<PostMeta, 'slug'>) }
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function getPost(slug: string): Post | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`)
  if (!fs.existsSync(filePath)) return null
  const { data, content } = matter(fs.readFileSync(filePath, 'utf8'))
  return { slug, content, ...(data as Omit<PostMeta, 'slug'>) }
}
