# PropertyBooking Design Decisions

## 1. Four-section tabbed model inside one route
- Why built this way: Keeps Property/Booking operations in one operational surface while reducing route switching cost.
- Alternative considered: Separate route per section.
- Why rejected: More navigation overhead for tightly related operational workflows.

## 2. Admin Adapter-only execution path
- Why built this way: Enforces policy-gated execution via MasterAI and keeps admin actions auditable and centrally controlled.
- Alternative considered: Keep direct property route usage for read-heavy tabs.
- Why rejected: Bypasses Admin Adapter policy gate and weakens execution-path consistency.

## 3. Section-local state
- Why built this way: Prevents cross-section coupling and keeps refresh/mutation blast radius contained.
- Alternative considered: Global store for all property/booking entities.
- Why rejected: Higher complexity and higher stale-state risk without strong synchronization strategy.
