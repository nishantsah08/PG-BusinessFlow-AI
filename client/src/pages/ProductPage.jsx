import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Sparkles } from 'lucide-react';
import { getViteEnv } from '../lib/runtimeEnv';

const proofCards = [
    {
        eyebrow: 'Leads to move-in',
        title: 'CRM + visits',
        body: 'Track enquiries, schedule visits, and move prospects into structured onboarding without scattered follow-up.',
    },
    {
        eyebrow: 'Staff to payroll',
        title: 'HR + attendance',
        body: 'Coordinate staff execution, attendance, and payroll readiness from the same operating picture.',
    },
    {
        eyebrow: 'Approvals + SOPs',
        title: 'Finance control',
        body: 'Keep collections, expenses, and approval paths visible while workflows hold the operating discipline together.',
    },
];

const ProductPage = () => {
    const docsUrl = getViteEnv('VITE_DOCS_URL', 'https://docs.fir-bestpg-development-public.web.app/');

    return (
        <div className="min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 text-slate-100">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-36 -left-20 h-96 w-96 rounded-full bg-cyan-400/12 blur-3xl" />
                <div className="absolute top-24 right-0 h-[28rem] w-[28rem] rounded-full bg-sky-400/10 blur-3xl" />
                <div className="absolute bottom-0 left-1/3 h-80 w-96 rounded-full bg-indigo-500/16 blur-3xl" />
            </div>
            <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 lg:px-10">
                <header className="relative flex flex-col gap-6 rounded-[2rem] border border-cyan-100/15 bg-slate-950/45 px-6 py-5 shadow-[0_24px_80px_rgba(8,15,36,0.34)] backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
                    <div className="inline-flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f6a62] text-white shadow-lg shadow-emerald-900/20">
                            <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold tracking-[0.22em] text-cyan-50">PG-BUSINESSFLOW.AI</p>
                            <p className="text-xs text-cyan-100/65">AI operating system for PG operators</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm text-cyan-100/80">
                        <a
                            href={docsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-cyan-100/20 bg-slate-900/45 px-4 py-2 transition hover:border-cyan-100/35 hover:text-cyan-50"
                        >
                            Docs
                        </a>
                        <span className="rounded-full border border-cyan-100/15 bg-slate-900/35 px-4 py-2 text-cyan-100/45">
                            Pricing · Coming soon
                        </span>
                        <span className="rounded-full border border-cyan-100/15 bg-slate-900/35 px-4 py-2 text-cyan-100/45">
                            Contact · Coming soon
                        </span>
                        <div className="ml-auto flex items-center gap-3 lg:ml-6">
                            <Link
                                to="/login"
                                className="rounded-full border border-cyan-100/20 bg-slate-900/45 px-4 py-2 text-cyan-50 transition hover:border-cyan-100/35 hover:text-white"
                            >
                                Sign in
                            </Link>
                            <Link
                                to="/login?intent=signup"
                                className="inline-flex items-center gap-2 rounded-full bg-[#0f6a62] px-5 py-2 text-white transition hover:bg-[#0c584f]"
                            >
                                Create workspace
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </header>

                <main className="relative flex-1 py-10 lg:py-14">
                    <section className="grid items-start gap-12">
                        <div className="space-y-8">
                            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100/20 bg-slate-900/40 px-4 py-2 text-xs uppercase tracking-[0.24em] text-cyan-200/90">
                                <Sparkles className="h-3.5 w-3.5" />
                                AI operating system
                            </div>

                            <div className="space-y-5">
                                <h1
                                    className="max-w-4xl text-5xl font-semibold leading-[0.94] tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl"
                                    style={{ fontFamily: '"Space Grotesk", "Manrope", sans-serif' }}
                                >
                                    Run your PG business from one AI operating system.
                                </h1>
                                <p className="max-w-3xl text-lg leading-8 text-cyan-50/85 sm:text-xl">
                                    Sales, onboarding, property, HR, finance, and workflows in one place.
                                    Built for PG owners who want stronger control without running operations across disconnected tools and manual follow-up.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-4">
                                <a
                                    href="#how-it-works"
                                    className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-6 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-300"
                                >
                                    See how it works
                                    <ArrowRight className="h-4 w-4" />
                                </a>
                                <a
                                    href={docsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-cyan-100/20 bg-slate-900/45 px-6 py-3 text-sm font-medium text-cyan-50 transition hover:border-cyan-100/35 hover:text-white"
                                >
                                    Read docs
                                </a>
                            </div>
                        </div>
                    </section>

                    <section className="mt-14 grid gap-4 md:grid-cols-3">
                        {proofCards.map((card) => (
                            <article
                                key={card.title}
                                className="rounded-[1.75rem] border border-cyan-100/15 bg-slate-950/45 p-6 shadow-[0_18px_50px_rgba(8,15,36,0.24)] backdrop-blur-xl"
                            >
                                <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/80">{card.eyebrow}</p>
                                <h2 className="mt-3 text-2xl font-semibold text-white">{card.title}</h2>
                                <p className="mt-3 text-sm leading-7 text-cyan-50/70">{card.body}</p>
                            </article>
                        ))}
                    </section>

                    <section
                        id="how-it-works"
                        className="mt-14 rounded-[2rem] border border-cyan-100/15 bg-slate-950/45 p-7 shadow-[0_18px_50px_rgba(8,15,36,0.24)] backdrop-blur-xl lg:p-9"
                    >
                        <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/80">How it works</p>
                        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm font-medium text-cyan-50/80 lg:text-base">
                            <span className="rounded-full border border-cyan-100/10 bg-white/[0.05] px-4 py-2">Lead inquiry</span>
                            <span className="text-cyan-100/35">-&gt;</span>
                            <span className="rounded-full border border-cyan-100/10 bg-white/[0.05] px-4 py-2">Booking</span>
                            <span className="text-cyan-100/35">-&gt;</span>
                            <span className="rounded-full border border-cyan-100/10 bg-white/[0.05] px-4 py-2">Onboarding</span>
                            <span className="text-cyan-100/35">-&gt;</span>
                            <span className="rounded-full border border-cyan-100/10 bg-white/[0.05] px-4 py-2">Stay ops</span>
                            <span className="text-cyan-100/35">-&gt;</span>
                            <span className="rounded-full border border-cyan-100/10 bg-white/[0.05] px-4 py-2">Collections</span>
                            <span className="text-cyan-100/35">-&gt;</span>
                            <span className="rounded-full border border-cyan-100/10 bg-white/[0.05] px-4 py-2">Review</span>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
};

export default ProductPage;
