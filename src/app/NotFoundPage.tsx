import { Link } from 'react-router'
import { Card } from '../components/ui/Card'
import { PageSurface } from '../components/ui/PageSurface'

export default function NotFoundPage() { return <PageSurface contentClassName="max-w-lg"><Card className="mt-16 text-center"><img src="/templates/jamozy-simplified.png" alt="" className="mx-auto h-20 w-20 object-contain" /><h1 className="mt-4 text-xl font-bold">Page not found</h1><p className="mt-2 text-[#667085]">The page you're looking for doesn't exist.</p><Link to="/" className="mt-5 inline-block rounded-full bg-[#a85d4e] px-4 py-2 text-sm font-semibold text-white">Back home</Link></Card></PageSurface> }
