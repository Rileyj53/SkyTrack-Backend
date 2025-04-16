import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Personal Site Backend
        </h1>
        
        <div className="bg-white/30 p-8 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">API Endpoints</h2>
          
          <div className="space-y-4">
            <div className="border-b pb-2">
              <h3 className="text-xl font-medium">Health Check</h3>
              <p className="text-gray-600">Check the health of the API</p>
              <Link 
                href="/api/health" 
                className="text-blue-500 hover:underline mt-1 inline-block"
              >
                /api/health
              </Link>
            </div>
            
            <div className="border-b pb-2">
              <h3 className="text-xl font-medium">Test API</h3>
              <p className="text-gray-600">Test the API with middleware</p>
              <Link 
                href="/api/test" 
                className="text-blue-500 hover:underline mt-1 inline-block"
              >
                /api/test
              </Link>
            </div>
            
            <div className="border-b pb-2">
              <h3 className="text-xl font-medium">Authentication</h3>
              <p className="text-gray-600">User authentication endpoints</p>
              <div className="space-y-1 mt-1">
                <Link 
                  href="/api/auth/login" 
                  className="text-blue-500 hover:underline block"
                >
                  /api/auth/login
                </Link>
                <Link 
                  href="/api/auth/register" 
                  className="text-blue-500 hover:underline block"
                >
                  /api/auth/register
                </Link>
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-medium">MFA</h3>
              <p className="text-gray-600">Multi-factor authentication</p>
              <div className="space-y-1 mt-1">
                <Link 
                  href="/api/mfa/setup" 
                  className="text-blue-500 hover:underline block"
                >
                  /api/mfa/setup
                </Link>
                <Link 
                  href="/api/mfa/verify" 
                  className="text-blue-500 hover:underline block"
                >
                  /api/mfa/verify
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
} 