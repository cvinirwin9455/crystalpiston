import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Helper: create admin client with service role key
async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST /api/upload-avatar - Upload a profile photo
// Accepts FormData with:
//   - file: the image file (already resized client-side to ~200x200)
//   - userId: (optional) target user ID — only admins can set another user's avatar
export async function POST(request: Request) {
  const supabase = await createClient()

  // Verify authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's role
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const targetUserId = formData.get('userId') as string | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, or WebP.' }, { status: 400 })
  }

  // Validate file size (max 2MB — images should be pre-resized client-side)
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Max 2MB.' }, { status: 400 })
  }

  // Determine which user's avatar to update
  let uploadUserId = user.id
  if (targetUserId && targetUserId !== user.id) {
    // Only admins can update another user's avatar
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    uploadUserId = targetUserId
  }

  const adminClient = await createAdminClient()

  // Generate unique filename: avatars/{userId}/{timestamp}.{ext}
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const fileName = `avatars/${uploadUserId}/${Date.now()}.${ext}`

  // Convert File to ArrayBuffer for upload
  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  // Upload to Supabase Storage (bucket: avatars)
  const { data: uploadData, error: uploadError } = await adminClient.storage
    .from('avatars')
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    console.error('Avatar upload failed:', uploadError)
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }

  // Get the public URL
  const { data: urlData } = adminClient.storage
    .from('avatars')
    .getPublicUrl(fileName)

  const avatarUrl = urlData.publicUrl

  // Update the user's avatar_url in the database
  const { error: updateError } = await adminClient
    .from('users')
    .update({ avatar_url: avatarUrl })
    .eq('id', uploadUserId)

  if (updateError) {
    console.error('Failed to update avatar_url:', updateError)
    return NextResponse.json({ error: 'Failed to save avatar. Please try again.' }, { status: 500 })
  }

  // Clean up old avatars for this user (keep only the latest)
  try {
    const { data: existingFiles } = await adminClient.storage
      .from('avatars')
      .list(`avatars/${uploadUserId}`)

    if (existingFiles && existingFiles.length > 1) {
      // Delete all except the one we just uploaded
      const currentFileName = fileName.split('/').pop()
      const toDelete = existingFiles
        .filter(f => f.name !== currentFileName)
        .map(f => `avatars/${uploadUserId}/${f.name}`)

      if (toDelete.length > 0) {
        await adminClient.storage.from('avatars').remove(toDelete)
      }
    }
  } catch (err) {
    // Non-critical — old files can remain
    console.error('Failed to clean up old avatars:', err)
  }

  return NextResponse.json({ avatarUrl })
}

// DELETE /api/upload-avatar - Remove profile photo
export async function DELETE(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  // Check if admin is removing someone else's avatar
  const url = new URL(request.url)
  const targetUserId = url.searchParams.get('userId')

  let removeUserId = user.id
  if (targetUserId && targetUserId !== user.id) {
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    removeUserId = targetUserId
  }

  const adminClient = await createAdminClient()

  // Remove all files in the user's avatar folder
  try {
    const { data: existingFiles } = await adminClient.storage
      .from('avatars')
      .list(`avatars/${removeUserId}`)

    if (existingFiles && existingFiles.length > 0) {
      const toDelete = existingFiles.map(f => `avatars/${removeUserId}/${f.name}`)
      await adminClient.storage.from('avatars').remove(toDelete)
    }
  } catch (err) {
    console.error('Failed to delete avatar files:', err)
  }

  // Clear the avatar_url in database
  const { error: updateError } = await adminClient
    .from('users')
    .update({ avatar_url: null })
    .eq('id', removeUserId)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to remove avatar.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
