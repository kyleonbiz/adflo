const FEATURES = ["Vendor insurance & renewals", "Maintenance & job paperwork", "Units, jobs & reporting"];

export function Hero() {
  return (
    <section className="relative text-white" aria-labelledby="hero-title">
      <div className="relative mx-auto max-w-4xl px-4 pb-10 pt-8 text-center sm:px-6 sm:pb-12 sm:pt-12">
        <h1 id="hero-title" className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
          The Administrative Management Platform for Contractors & Property Managers
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-white/90 sm:text-lg">
          Works alongside your accounting, construction and property management software. AdFlo organizes the administrative work scattered across spreadsheets, email and folders: vendor insurance, licenses, maintenance requests, change orders and jobs, with reminders so nothing slips.
        </p>
        <ul className="mt-7 flex flex-wrap items-center justify-center gap-3" aria-label="What AdFlo covers">
          {FEATURES.map((label) => (
            <li
              key={label}
              className="rounded-full border border-white/30 bg-white/15 px-5 py-2 text-sm font-medium backdrop-blur-sm"
            >
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
