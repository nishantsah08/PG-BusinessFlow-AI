# Sidebar Decisions

- **Local Link Data**: Chose to abstract the link details (`path`, `label`, `icon`) into a local config array (`navItems`) within the component. This makes extending the sidebar with new routes extremely trivial.
- **`NavLink` over Manual Location Matching**: Decided to use standard `react-router-dom` `<NavLink>` to rely on its native `isActive` injection callback rather than manually matching `useLocation().pathname`. This reduces boilerplate and increases reliability.
