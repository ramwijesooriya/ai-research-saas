"use client";

import { useEffect, useState, Suspense } from "react"; // Added Suspense
import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle, XCircle } from "lucide-react"; // Added XCircle for error
import Link from "next/link";

// 1. We move the logic into a separate component called "PaymentSuccessContent"
function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const session_id = searchParams.get("session_id");
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (session_id) {
      verifyPayment(session_id);
    } else {
        // If no session_id is found immediately stop loading
        setStatus("error");
    }
  }, [session_id]);

  async function verifyPayment(id: string) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}/verify-payment?session_id=${id}`);
      const data = await res.json();
      
      if (data.status === "success") {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch (error) {
      setStatus("error");
    }
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <h2 className="text-xl font-semibold">Verifying Payment...</h2>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
        <p className="text-gray-600 mb-6">
          50 Credits have been added to your account.
        </p>
        <Link href="/" className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">
          Go Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <XCircle className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-red-600 mb-2">Verification Failed</h2>
        <p className="text-gray-600 mb-6">We couldn't verify your payment.</p>
        <Link href="/" className="text-indigo-600 underline">Return Home</Link>
    </div>
  );
}

// 2. The Main Page Export wraps the content in Suspense
export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
        {/* The Suspense boundary fixes the build error */}
        <Suspense fallback={
            <div className="flex flex-col items-center">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                <h2 className="text-xl font-semibold">Loading...</h2>
            </div>
        }>
          <PaymentSuccessContent />
        </Suspense>
      </div>
    </div>
  );
}