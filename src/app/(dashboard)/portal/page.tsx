import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ClientPortal() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Training</h1>
            <p className="text-gray-600">Welcome, {profile?.name}!</p>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">This Week</h3>
          <p className="text-gray-500 mt-2">No training plan published yet. Check back soon!</p>
        </div>
      </div>
    </div>
  )
}
