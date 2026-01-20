"use client";
import { useState, useEffect } from "react";
import { useUser, UserButton, SignInButton } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import { Loader2, Search, FileText, TrendingUp, Zap, CheckCircle, X } from "lucide-react";

export default function Home() {
  const { isSignedIn, user } = useUser();
  const [topic, setTopic] = useState("");
  const [report, setReport] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // New States for Credits, Tier & Modal
  const [credits, setCredits] = useState<number | null>(null);
  const [tier, setTier] = useState("Free"); // Added Tier state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const exampleTopics = [
    "AI trends in healthcare 2025",
    "Electric vehicle market in India",
    "Future of remote work technology"
  ];

  // 1. Fetch Credits on Load
  useEffect(() => {
    if (isSignedIn && user) {
      fetchCredits();
    }
  }, [isSignedIn, user]);

  async function fetchCredits() {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/profile/${user?.id}`);
      if (res.ok) {
        const data = await res.json();
        setCredits(data.credits);
        setTier(data.tier || "Free"); // Set the tier from backend
      }
    } catch (error) {
      console.error("Failed to fetch credits", error);
    }
  }

  // --- Handle Upgrade / Top-up Function ---
  async function handleUpgrade() {
    try {
      setLoading(true); 
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      
      const res = await fetch(`${apiUrl}/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.id,
        }),
      });

      const data = await res.json();
      
      // Redirect to Stripe
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Failed to initiate payment");
      }
      
    } catch (error) {
      console.error("Payment Error:", error);
      alert("Something went wrong with payment initiation.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!topic.trim() || topic.length < 5) {
      setError("Please enter at least 5 characters");
      return;
    }

    if (credits !== null && credits <= 0) {
      setShowUpgradeModal(true); // Open modal if no credits
      return;
    }

    setLoading(true);
    setError("");
    setReport("");
    setSources([]);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      
      const res = await fetch(`${apiUrl}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic,
          user_id: user?.id || "anonymous",
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        // Handle specific credit error
        if (res.status === 402) {
            setShowUpgradeModal(true);
            throw new Error("Insufficient credits");
        }
        throw new Error(errorData.detail || "Failed to generate report");
      }

      const data = await res.json();
      setReport(data.report);
      setSources(data.sources || []);
      
      // Update credits from response
      if (data.credits_left !== undefined) {
        setCredits(data.credits_left);
      }
      
    } catch (err: any) {
      if (err.message !== "Insufficient credits") {
        setError(err.message || "Error generating report.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      
      {/* Header */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-indigo-600" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent hidden sm:block">
              AI ResearchPro
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {isSignedIn && credits !== null && (
              <div 
                className="flex items-center gap-3 bg-white border border-gray-200 px-4 py-2 rounded-full shadow-sm cursor-pointer hover:bg-gray-50 transition"
                onClick={() => setShowUpgradeModal(true)}
              >
                {/* PRO Badge - Only shows if user is Tier 'Pro' */}
                {tier === "Pro" && (
                  <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                    PRO
                  </span>
                )}
                
                <div className="flex items-center gap-2">
                  <Zap className={`w-4 h-4 ${credits > 0 ? 'text-amber-500 fill-amber-500' : 'text-gray-400'}`} />
                  <span className="text-sm font-semibold text-gray-700">
                    {credits} Credits
                  </span>
                </div>
              </div>
            )}
            
            {isSignedIn ? (
              <UserButton afterSignOutUrl="/" />
            ) : (
              <SignInButton mode="modal">
                <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition">
                  Sign In
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!isSignedIn ? (
          // Landing Page
          <div className="text-center mt-20 space-y-8">
            <div className="inline-block p-3 bg-indigo-100 rounded-full mb-4">
              <FileText className="w-12 h-12 text-indigo-600" />
            </div>
            <h2 className="text-5xl font-bold text-gray-900 mb-4">
              Research Faster.<br />
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Decide Smarter.
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Generate comprehensive market research reports in seconds using AI. 
              Perfect for investors, entrepreneurs, and business analysts.
            </p>
            <SignInButton mode="modal">
              <button className="bg-indigo-600 text-white text-lg px-8 py-4 rounded-xl hover:bg-indigo-700 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                Get Started Free →
              </button>
            </SignInButton>
             
             <div className="grid md:grid-cols-3 gap-6 mt-16 text-left">
              {[
                { icon: Search, title: "Deep Research", desc: "AI searches multiple sources automatically" },
                { icon: FileText, title: "Professional Reports", desc: "Structured, citation-backed analysis" },
                { icon: TrendingUp, title: "Market Insights", desc: "Stay ahead with latest trends" }
              ].map((feature, i) => (
                <div key={i} className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                  <feature.icon className="w-8 h-8 text-indigo-600 mb-3" />
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-gray-600 text-sm">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Dashboard
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                What do you want to research?
              </label>
              
              <div className="flex gap-3 mb-4">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => {
                    setTopic(e.target.value);
                    setError("");
                  }}
                  placeholder="e.g., Future of quantum computing in finance"
                  className="flex-1 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-lg"
                  disabled={loading}
                  onKeyPress={(e) => e.key === "Enter" && handleGenerate()}
                />
                <button
                  onClick={handleGenerate}
                  disabled={loading || !topic.trim()}
                  className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm hover:shadow-md flex items-center gap-2 whitespace-nowrap"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Generate
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-500">Try:</span>
                {exampleTopics.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setTopic(ex)}
                    className="text-sm px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition"
                    disabled={loading}
                  >
                    {ex}
                  </button>
                ))}
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
            </div>

            {report && (
              <div className="bg-white p-10 rounded-2xl shadow-lg border border-gray-100 animate-fade-in">
                <div className="prose prose-indigo max-w-none">
                  <ReactMarkdown
                    components={{
                      h1: ({node, ...props}) => <h1 className="text-3xl font-bold mb-4 text-gray-900" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-2xl font-semibold mt-8 mb-3 text-gray-800" {...props} />,
                      p: ({node, ...props}) => <p className="text-gray-700 leading-relaxed mb-4" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-2 mb-4" {...props} />,
                      li: ({node, ...props}) => <li className="text-gray-700" {...props} />,
                    }}
                  >
                    {report}
                  </ReactMarkdown>
                </div>

                {sources.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-3">Sources:</h3>
                    <ul className="space-y-2">
                      {sources.map((url, i) => (
                        <li key={i}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 text-sm underline break-all"
                          >
                            {url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Smart Upgrade / Top-up Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">
            <button 
              onClick={() => setShowUpgradeModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-indigo-600 fill-indigo-600" />
              </div>

              {/* Dynamic Heading based on Tier */}
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {tier === "Pro" ? "Need more power?" : "Upgrade to Pro"}
              </h2>
              
              <p className="text-gray-600 mb-6">
                {tier === "Pro" 
                  ? "You are already a Pro member. Running low on credits? Add another pack instantly."
                  : "Unlock deep research mode and get 50 monthly credits to power your decisions."}
              </p>

              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 mb-6 text-left">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-indigo-900">
                    {tier === "Pro" ? "Credit Pack" : "Pro Plan"}
                  </span>
                  <span className="text-xl font-bold text-indigo-600">$10</span>
                </div>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    +50 AI Research Credits
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Valid Lifetime (No Expiry)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Deep Search Capability
                  </li>
                </ul>
              </div>

              <button 
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition shadow-md disabled:opacity-50"
              >
                {loading 
                  ? "Processing..." 
                  : (tier === "Pro" ? "Buy 50 Credits" : "Upgrade to Pro")
                }
              </button>
              <p className="text-xs text-gray-400 mt-4">
                Secure payment powered by Stripe
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}