// Public self-service signup is disabled — accounts are invite-only.
export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-gray-900 border border-gray-800 p-8 rounded-xl shadow-md w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-2 text-white">Invitation required</h1>
        <p className="text-gray-400 mb-6">
          Accounts are created by invitation only. Ask your administrator to invite you,
          then use the link in your email to set a password.
        </p>
        <a href="/login" className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">
          Go to sign in
        </a>
      </div>
    </div>
  )
}
