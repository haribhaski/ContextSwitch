import { signIn } from "@/auth";
import Link from "next/link";

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.876 2.684-6.614Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.181l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.963 10.706A5.42 5.42 0 0 1 3.681 9c0-.592.102-1.168.282-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.453.348 2.827.956 4.038l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.322 0 2.507.454 3.441 1.346l2.581-2.581C13.463.892 11.426 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#f8fafd] text-[#1f1f1f]">
      <header className="flex h-16 items-center justify-between px-6 md:px-10">
        <Link
          href="/"
          className="flex items-center gap-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0b57d0] text-sm font-semibold text-white">
            C
          </div>

          <span className="text-[18px] font-medium tracking-tight">
            ContextSwitch
          </span>
        </Link>

        <span className="hidden text-sm text-[#5f6368] md:block">
          Shared memory for AI development teams
        </span>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-64px)] max-w-[1180px] items-center px-6 py-16 md:px-10">
        <div className="grid w-full items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-[620px]">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#dadce0] bg-white px-3 py-1.5 text-sm text-[#5f6368]">
              <span className="h-2 w-2 rounded-full bg-[#188038]" />
              Team context that moves with you
            </div>

            <h1 className="max-w-[600px] text-[42px] font-medium leading-[1.08] tracking-[-0.035em] md:text-[58px]">
              Your team&apos;s shared
              <span className="text-[#0b57d0]">
                {" "}
                AI memory.
              </span>
            </h1>

            <p className="mt-7 max-w-[560px] text-[18px] leading-8 text-[#5f6368]">
              Decisions, failed attempts, blockers and project context stay
              available to the whole team — whether you work in Cursor,
              Claude, Gemini or another AI coding tool.
            </p>

            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-[#5f6368]">
              <span>Decisions</span>
              <span>•</span>
              <span>Failures</span>
              <span>•</span>
              <span>Blockers</span>
              <span>•</span>
              <span>Conflicts</span>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[430px]">
            <div className="rounded-2xl border border-[#dadce0] bg-white p-8 shadow-[0_1px_2px_rgba(60,64,67,0.08)] md:p-10">
              <div className="mb-10">
                <h2 className="text-[24px] font-medium tracking-tight">
                  Welcome to ContextSwitch
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#5f6368]">
                  Sign in to access your teams, projects and shared context.
                </p>
              </div>

              <form
                action={async () => {
                  "use server";

                  await signIn("google", {
                    redirectTo: "/dashboard",
                  });
                }}
              >
                <button
                  type="submit"
                  className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[#747775] bg-white px-5 text-[14px] font-medium text-[#1f1f1f] transition hover:bg-[#f8fafd] active:bg-[#f1f3f4]"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
              </form>

              <div className="mt-4 text-center">
                <Link
                  href="/dashboard"
                  className="text-xs font-medium text-[#0b57d0] hover:underline"
                >
                  Or skip sign in & continue to Dashboard (Dev Mode) →
                </Link>
              </div>


              <div className="my-8 h-px bg-[#e3e3e3]" />

              <div className="space-y-5">
                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] text-xs font-semibold text-[#0b57d0]">
                    1
                  </div>

                  <div>
                    <div className="text-sm font-medium">
                      Join your team
                    </div>

                    <div className="mt-1 text-sm leading-5 text-[#5f6368]">
                      Create a workspace or join one your teammates already use.
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e6f4ea] text-xs font-semibold text-[#188038]">
                    2
                  </div>

                  <div>
                    <div className="text-sm font-medium">
                      Connect your projects
                    </div>

                    <div className="mt-1 text-sm leading-5 text-[#5f6368]">
                      ContextSwitch keeps decisions and AI reasoning aligned.
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fef7e0] text-xs font-semibold text-[#b06000]">
                    3
                  </div>

                  <div>
                    <div className="text-sm font-medium">
                      Never lose the reasoning
                    </div>

                    <div className="mt-1 text-sm leading-5 text-[#5f6368]">
                      Fresh AI sessions can inherit the team&apos;s current context.
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-9 text-center text-[12px] leading-5 text-[#80868b]">
                ContextSwitch only uses your Google account for authentication.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
